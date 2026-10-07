import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { z } from "zod";
import { BROWSER_APP, SITE_HOST, SITE_URL } from "../../config.ts";
import type { TokenPair } from "../../interfaces/session.ts";
import { createLaunchRequest, decodeLaunchToken, TOKEN_LINK_PATTERN } from "./launch-token.ts";

const run = promisify(execFile);

/** Tabs on these paths are still in the middle of logging in. */
const LOGIN_PATHS = ["/login/", "/auth/", "/admin/tool/mobile/"];

/**
 * JXA run inside osascript: finds an already-open, logged-in E-Learn tab in the user's own browser
 * and runs `code` in it. Nothing new is opened.
 */
const FIND_TAB_SCRIPT = `
function run(argv) {
  const [appName, host, loginPathsJson, code] = argv;
  const loginPaths = JSON.parse(loginPathsJson);
  const app = Application(appName);
  if (!app.running()) return JSON.stringify({ status: "no-tab" });
  let sawLoginTab = false;
  for (const w of app.windows()) {
    for (const t of w.tabs()) {
      const m = /^https?:\\/\\/([^/]+)(\\/[^?#]*)?/.exec(t.url());
      if (!m || m[1] !== host) continue;
      if (loginPaths.some((p) => (m[2] || "/").startsWith(p))) { sawLoginTab = true; continue; }
      try {
        return JSON.stringify({ status: "ok", result: String(t.execute({ javascript: code })) });
      } catch (e) {
        return JSON.stringify({ status: "error", message: String(e) });
      }
    }
  }
  return JSON.stringify({ status: sawLoginTab ? "not-logged-in" : "no-tab" });
}`;

const ScriptResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), result: z.string() }),
  z.object({ status: z.literal("error"), message: z.string() }),
  z.object({ status: z.literal("no-tab") }),
  z.object({ status: z.literal("not-logged-in") }),
]);

/**
 * Runs in the E-Learn tab: same-origin, so the request carries the tab's existing session.
 * Synchronous XHR because AppleScript's `execute javascript` doesn't await promises.
 * confirmed=1 makes launch.php return the token link inside HTML instead of a redirect.
 */
function tabCode(launchUrl: string): string {
  return `(function () {
    var x = new XMLHttpRequest();
    x.open("GET", ${JSON.stringify(launchUrl)}, false);
    x.send();
    var m = ${TOKEN_LINK_PATTERN}.exec(x.responseText);
    if (m) return "TOKEN:" + m[1];
    return x.responseURL.indexOf("/login/") >= 0 ? "LOGIN" : "HTTP:" + x.status;
  })()`;
}

const HINTS = {
  openTab: `Open ${SITE_URL} in ${BROWSER_APP} and sign in with Google (an already logged-in tab is fine).`,
  appleEvents: `In ${BROWSER_APP}'s menu bar, turn on View → Developer → "Allow JavaScript from Apple Events" (one-time).`,
};

/**
 * Gets an app token from the user's existing, logged-in E-Learn tab, waiting for one if needed.
 * macOS only (uses AppleScript).
 */
export async function chromeTabLogin(log: (msg: string) => void, timeoutMs = 5 * 60_000): Promise<TokenPair> {
  if (process.platform !== "darwin") {
    throw new Error("Logging in through an open browser tab only works on macOS. Use `pnpm signin --cookie`.");
  }

  const shown = new Set<string>();
  const hint = (msg: string) => {
    if (!shown.has(msg)) log(msg);
    shown.add(msg);
  };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const request = createLaunchRequest(true);
    let stdout: string;
    try {
      ({ stdout } = await run(
        "osascript",
        ["-l", "JavaScript", "-e", FIND_TAB_SCRIPT, BROWSER_APP, SITE_HOST, JSON.stringify(LOGIN_PATHS), tabCode(request.url)],
        { timeout: 30_000 },
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/-1743|not authori[sz]ed/i.test(message)) {
        throw new Error(
          `macOS blocked controlling ${BROWSER_APP}. Allow it in System Settings → Privacy & Security → Automation, then retry.`,
        );
      }
      throw new Error(`Could not talk to ${BROWSER_APP}: ${message}`);
    }

    const result = ScriptResultSchema.parse(JSON.parse(stdout));
    if (result.status === "ok") {
      if (result.result.startsWith("TOKEN:")) return decodeLaunchToken(result.result.slice(6), request.passport);
      hint(result.result === "LOGIN" ? HINTS.openTab : `E-Learn answered unexpectedly (${result.result}); retrying.`);
    } else if (result.status === "error") {
      if (!/Apple Events/i.test(result.message)) throw new Error(`${BROWSER_APP} refused the request: ${result.message}`);
      hint(HINTS.appleEvents);
    } else {
      hint(HINTS.openTab);
    }
    await sleep(2000);
  }
  throw new Error(`Timed out after 5 minutes. ${[...shown].join(" ")}`);
}

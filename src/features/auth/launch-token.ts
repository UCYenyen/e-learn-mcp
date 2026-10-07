import { createHash, randomBytes } from "node:crypto";
import { MOBILE_SERVICE, SITE_URL } from "../../config.ts";
import type { TokenPair } from "../../interfaces/session.ts";

export const TOKEN_LINK_PATTERN = /moodlemobile:\/\/token=([A-Za-z0-9+/=]+)/;

export interface LaunchRequest {
  url: string;
  passport: string;
}

/**
 * launch.php is how the official Moodle app turns a logged-in browser session into an app token.
 * It answers with `moodlemobile://token=<base64(md5(wwwroot+passport):::token[:::privatetoken])>`,
 * as a redirect, or (with confirmed=1) as a link in an HTML page.
 */
export function createLaunchRequest(confirmed: boolean): LaunchRequest {
  const passport = randomBytes(16).toString("hex");
  const url = new URL(`${SITE_URL}/admin/tool/mobile/launch.php`);
  url.searchParams.set("service", MOBILE_SERVICE);
  url.searchParams.set("passport", passport);
  url.searchParams.set("urlscheme", "moodlemobile");
  if (confirmed) url.searchParams.set("confirmed", "1");
  return { url: url.toString(), passport };
}

export function decodeLaunchToken(encoded: string, passport: string): TokenPair {
  const [siteId, token, privateToken] = Buffer.from(encoded, "base64").toString("utf8").split(":::");
  const expectedSiteId = createHash("md5").update(SITE_URL + passport).digest("hex");
  if (siteId !== expectedSiteId || !token) {
    throw new Error("E-Learn returned a token that doesn't match this login request; refusing to use it.");
  }
  return { token, privateToken: privateToken || undefined };
}

/** Cookie variant (for `pnpm signin --cookie`). Returns null when the cookie isn't a logged-in session. */
export async function exchangeSessionForToken(cookieHeader: string): Promise<TokenPair | null> {
  const request = createLaunchRequest(false);
  const res = await fetch(request.url, { headers: { Cookie: cookieHeader }, redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const source = location.startsWith("moodlemobile://") ? location : await res.text();
  const match = TOKEN_LINK_PATTERN.exec(source);
  return match?.[1] ? decodeLaunchToken(match[1], request.passport) : null;
}

import { MOBILE_SERVICE, SITE_URL } from "../../config.ts";
import { SiteInfoSchema, TokenResponseSchema } from "../../interfaces/moodle.ts";
import type { Session, TokenPair } from "../../interfaces/session.ts";
import { callWithToken } from "../moodle/client.ts";
import { exchangeSessionForToken } from "./launch-token.ts";
import { saveSession } from "./session-store.ts";

/** Verifies a fresh token against the site and persists it. */
export async function completeLogin(pair: TokenPair, method: Session["method"]): Promise<Session> {
  const info = await callWithToken(pair.token, "core_webservice_get_site_info", {}, SiteInfoSchema);
  const session: Session = {
    siteUrl: SITE_URL,
    token: pair.token,
    privateToken: pair.privateToken,
    userId: info.userid,
    username: info.username,
    fullName: info.fullname,
    createdAt: new Date().toISOString(),
    method,
  };
  await saveSession(session);
  return session;
}

/** Only works for accounts that have a Moodle password (not Google-only accounts). */
export async function passwordLogin(username: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${SITE_URL}/login/token.php`, {
    method: "POST",
    body: new URLSearchParams({ username, password, service: MOBILE_SERVICE }),
  });
  const json: unknown = await res.json();
  const parsed = TokenResponseSchema.safeParse(json);
  if (!parsed.success) {
    const message = typeof json === "object" && json && "error" in json ? String(json.error) : "unknown error";
    throw new Error(`Password login failed: ${message}. Google-only accounts must use the browser login.`);
  }
  return { token: parsed.data.token, privateToken: parsed.data.privatetoken ?? undefined };
}

/** Accepts a raw MoodleSession cookie value (or a full Cookie header) copied from browser devtools. */
export async function cookieLogin(cookie: string): Promise<TokenPair> {
  const header = cookie.includes("=") ? cookie : `MoodleSession=${cookie}`;
  const pair = await exchangeSessionForToken(header);
  if (!pair) throw new Error("That cookie is not a logged-in E-Learn session (it may have expired).");
  return pair;
}

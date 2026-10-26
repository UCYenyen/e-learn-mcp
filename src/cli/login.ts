import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { SESSION_FILE } from "../config.ts";
import { chromeTabLogin } from "../features/auth/chrome-tab-login.ts";
import { completeLogin, cookieLogin, passwordLogin, sessionTokenLogin } from "../features/auth/login.ts";
import type { Session, TokenPair } from "../interfaces/session.ts";

const USAGE = `Usage: pnpm signin [--browser | --cookie | --password]
  (default)   Asks for your E-Learn session token (MoodleSession cookie or mobile token).
  --browser   Uses your already-open, logged-in E-Learn tab in Chrome.
  --cookie    Paste the MoodleSession cookie from browser DevTools (Application → Cookies).
  --password  Use a Moodle username/password (not for Google-only accounts).`;

let muted = false;
const output = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });

async function ask(question: string, hidden = false): Promise<string> {
  const answer = rl.question(question);
  muted = hidden;
  const value = await answer;
  if (hidden) process.stdout.write("\n");
  muted = false;
  return value.trim();
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  let pair: TokenPair;
  let method: Session["method"];

  if (mode === "--help" || mode === "-h") {
    console.log(USAGE);
    return;
  } else if (mode === "--cookie" || mode === "--token") {
    const raw = await ask("E-Learn session token / MoodleSession cookie: ", true);
    const res = await sessionTokenLogin(raw);
    pair = res.pair;
    method = res.method;
  } else if (mode === "--password") {
    const username = await ask("Username: ");
    pair = await passwordLogin(username, await ask("Password: ", true));
    method = "password";
  } else if (mode === "--browser") {
    console.log("Looking for a logged-in E-Learn tab in your browser...");
    pair = await chromeTabLogin(console.log);
    method = "browser";
  } else if (mode === undefined) {
    const raw = await ask("Enter E-Learn session token (MoodleSession cookie or web service token): ", true);
    if (!raw) {
      console.log("No token provided. Looking for a logged-in E-Learn tab in your browser...");
      pair = await chromeTabLogin(console.log);
      method = "browser";
    } else {
      const res = await sessionTokenLogin(raw);
      pair = res.pair;
      method = res.method;
    }
  } else {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  const session = await completeLogin(pair, method);
  console.log(`Logged in as ${session.fullName} (${session.username}). Token saved to ${SESSION_FILE}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
}

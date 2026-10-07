import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { CONFIG_DIR, SESSION_FILE, SITE_URL } from "../../config.ts";
import { type Session, SessionSchema } from "../../interfaces/session.ts";

export async function loadSession(): Promise<Session | null> {
  let raw: string;
  try {
    raw = await readFile(SESSION_FILE, "utf8");
  } catch {
    return null;
  }
  const parsed = SessionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success || parsed.data.siteUrl !== SITE_URL) return null;
  return parsed.data;
}

export async function saveSession(session: Session): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
  // writeFile's mode only applies on creation, so tighten an existing file too.
  await chmod(SESSION_FILE, 0o600);
}

export async function clearSession(): Promise<void> {
  await rm(SESSION_FILE, { force: true });
}

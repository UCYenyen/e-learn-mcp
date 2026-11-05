import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_URL = (process.env.ELEARN_SITE_URL ?? "https://elearn.uc.ac.id").replace(/\/+$/, "");
export const SITE_HOST = new URL(SITE_URL).host;

/** The service the official Moodle app uses; its tokens are long-lived. */
export const MOBILE_SERVICE = "moodle_mobile_app";

export const CONFIG_DIR = process.env.ELEARN_CONFIG_DIR ?? join(homedir(), ".config", "elearn-mcp");
export const SESSION_FILE = join(CONFIG_DIR, "session.json");
/** The user's everyday browser; login reuses its open E-Learn tab. Any Chromium browser with AppleScript works. */
export const BROWSER_APP = process.env.ELEARN_BROWSER_APP ?? "Google Chrome";

export const DOWNLOAD_DIR = process.env.ELEARN_DOWNLOAD_DIR ?? join(homedir(), "Downloads", "University", "Academics", "elearn");

/** Universitas Ciputra is in WIB (UTC+7, no DST). */
export const TIMEZONE = "Asia/Jakarta";

/** Project root (one level above src/). */
export const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * When true, elearn_submit_assignment and elearn_unsubmit_assignment skip the confirmation
 * (needed where it cannot be shown, e.g. a Linux server whose client times out elicitation).
 * Set "autoApproveSubmissions": true in elearn.config.json at the project root, or
 * ELEARN_AUTO_APPROVE_SUBMISSIONS=1. Read on every call, so toggling the file needs no restart.
 */
export function autoApproveSubmissions(): boolean {
  if (process.env.ELEARN_AUTO_APPROVE_SUBMISSIONS === "1") return true;
  try {
    const cfg = JSON.parse(readFileSync(join(PROJECT_DIR, "elearn.config.json"), "utf8")) as { autoApproveSubmissions?: unknown };
    return cfg.autoApproveSubmissions === true;
  } catch {
    return false;
  }
}

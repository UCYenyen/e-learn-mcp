import { homedir } from "node:os";
import { join } from "node:path";

export const SITE_URL = (process.env.ELEARN_SITE_URL ?? "https://elearn.uc.ac.id").replace(/\/+$/, "");
export const SITE_HOST = new URL(SITE_URL).host;

/** The service the official Moodle app uses; its tokens are long-lived. */
export const MOBILE_SERVICE = "moodle_mobile_app";

export const CONFIG_DIR = process.env.ELEARN_CONFIG_DIR ?? join(homedir(), ".config", "elearn-mcp");
export const SESSION_FILE = join(CONFIG_DIR, "session.json");
/** The user's everyday browser; login reuses its open E-Learn tab. Any Chromium browser with AppleScript works. */
export const BROWSER_APP = process.env.ELEARN_BROWSER_APP ?? "Google Chrome";

export const DOWNLOAD_DIR = process.env.ELEARN_DOWNLOAD_DIR ?? join(homedir(), "Downloads", "elearn");

/** Universitas Ciputra is in WIB (UTC+7, no DST). */
export const TIMEZONE = "Asia/Jakarta";

import { clearSession } from "../features/auth/session-store.ts";

await clearSession();
console.log("Removed saved token.");

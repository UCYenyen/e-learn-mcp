import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SiteInfoSchema } from "../../interfaces/moodle.ts";
import { jsonResult } from "../../lib/format.ts";
import { callMoodle } from "../moodle/client.ts";
import { chromeTabLogin } from "./chrome-tab-login.ts";
import { completeLogin } from "./login.ts";
import { loadSession } from "./session-store.ts";

export function registerAuthTools(server: McpServer): void {
  server.registerTool(
    "elearn_login",
    {
      title: "Log in to E-Learn",
      description:
        "Gets a long-lived app token from the user's already-open, logged-in elearn.uc.ac.id tab in Chrome (no new window). " +
        "Only needed the first time or when other tools report the token expired. If no logged-in tab exists it waits " +
        "up to 5 minutes; tell the user to open E-Learn in Chrome and sign in with Google.",
    },
    async () => {
      const session = await completeLogin(await chromeTabLogin(() => undefined), "browser");
      return jsonResult({ loggedIn: true, fullName: session.fullName, username: session.username });
    },
  );

  server.registerTool(
    "elearn_status",
    {
      title: "E-Learn login status",
      description: "Checks whether the saved E-Learn token still works and who it belongs to.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const session = await loadSession();
      if (!session) return jsonResult({ loggedIn: false, hint: "Call elearn_login." });
      const info = await callMoodle("core_webservice_get_site_info", {}, SiteInfoSchema);
      return jsonResult({
        loggedIn: true,
        site: info.sitename,
        fullName: info.fullname,
        username: info.username,
        userId: info.userid,
        tokenSavedAt: session.createdAt,
      });
    },
  );
}

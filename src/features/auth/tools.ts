import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SiteInfoSchema } from "../../interfaces/moodle.ts";
import { jsonResult } from "../../lib/format.ts";
import { callMoodle } from "../moodle/client.ts";
import { completeLogin, sessionTokenLogin } from "./login.ts";
import { loadSession } from "./session-store.ts";

export function registerAuthTools(server: McpServer): void {
  server.registerTool(
    "elearn_login",
    {
      title: "Log in to E-Learn",
      description:
        "Logs in to E-Learn (elearn.uc.ac.id) using a session token (the MoodleSession cookie value from browser DevTools, or a Moodle mobile token). " +
        "Saves the persistent token to ~/.config/elearn-mcp/session.json.",
      inputSchema: {
        sessionToken: z
          .string()
          .describe(
            "The E-Learn session token: either your MoodleSession cookie value from DevTools (Application → Cookies) or a Moodle web service token.",
          ),
      },
    },
    async ({ sessionToken }) => {
      const { pair, method } = await sessionTokenLogin(sessionToken);
      const session = await completeLogin(pair, method);
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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NotificationsSchema } from "../../interfaces/moodle.ts";
import { decodeEntities, formatTime, htmlToText, jsonResult } from "../../lib/format.ts";
import { callMoodle, currentUserId } from "../moodle/client.ts";

export function registerNotificationTools(server: McpServer): void {
  server.registerTool(
    "elearn_get_notifications",
    {
      title: "Get notifications",
      description: "Recent E-Learn notifications (new grades, announcements, due-date reminders, feedback), newest first.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
        unreadOnly: z.boolean().default(false),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, unreadOnly }) => {
      const { notifications, unreadcount } = await callMoodle(
        "message_popup_get_popup_notifications",
        { useridto: await currentUserId(), limit, offset: 0, newestfirst: true },
        NotificationsSchema,
      );
      return jsonResult({
        unreadCount: unreadcount,
        notifications: notifications
          .filter((n) => !unreadOnly || !n.read)
          .map((n) => ({
            subject: decodeEntities(n.subject),
            message: htmlToText(n.smallmessage ?? n.text),
            date: formatTime(n.timecreated),
            read: n.read,
            url: n.contexturl ?? undefined,
          })),
      });
    },
  );
}

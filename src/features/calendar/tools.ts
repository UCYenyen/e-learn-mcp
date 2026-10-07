import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ActionEventsSchema } from "../../interfaces/moodle.ts";
import { decodeEntities, formatTime, htmlToText, jsonResult } from "../../lib/format.ts";
import { callMoodle } from "../moodle/client.ts";

const DAY = 24 * 60 * 60;

export function registerCalendarTools(server: McpServer): void {
  server.registerTool(
    "elearn_upcoming_deadlines",
    {
      title: "Upcoming deadlines",
      description:
        "The user's to-do timeline across all courses: assignments, quizzes and other activities that still need action, " +
        "sorted by due date. Same list as the Moodle dashboard 'Timeline' block.",
      inputSchema: {
        days: z.number().int().min(1).max(365).default(14).describe("How many days ahead to look"),
        includeOverdue: z.boolean().default(true).describe("Also include items overdue in the last 30 days"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ days, includeOverdue }) => {
      const now = Math.floor(Date.now() / 1000);
      const { events } = await callMoodle(
        "core_calendar_get_action_events_by_timesort",
        { timesortfrom: includeOverdue ? now - 30 * DAY : now, timesortto: now + days * DAY, limitnum: 50 },
        ActionEventsSchema,
      );
      return jsonResult(
        events.map((e) => ({
          name: decodeEntities(e.name),
          course: e.course && decodeEntities(e.course.fullname),
          courseId: e.course?.id,
          type: e.modulename ?? e.eventtype,
          instanceId: e.instance ?? undefined,
          due: formatTime(e.timesort ?? e.timestart),
          overdue: e.overdue || (e.timesort ?? e.timestart) < now || undefined,
          action: e.action?.name,
          url: e.action?.url ?? e.url,
          description: htmlToText(e.description).slice(0, 500) || undefined,
        })),
      );
    },
  );
}

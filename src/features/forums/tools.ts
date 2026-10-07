import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiscussionPostsSchema, ForumDiscussionsSchema } from "../../interfaces/moodle.ts";
import { decodeEntities, formatTime, htmlToText, jsonResult } from "../../lib/format.ts";
import { callMoodle } from "../moodle/client.ts";

export function registerForumTools(server: McpServer): void {
  server.registerTool(
    "elearn_get_forum_discussions",
    {
      title: "List forum discussions",
      description:
        "Lists discussions in a forum (e.g. a course's Announcements). forumId is the forum activity's instanceId " +
        "from elearn_get_course_contents (type 'forum').",
      inputSchema: {
        forumId: z.number().int(),
        limit: z.number().int().min(1).max(50).default(15),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ forumId, limit }) => {
      const { discussions } = await callMoodle(
        "mod_forum_get_forum_discussions",
        { forumid: forumId, page: 0, perpage: limit },
        ForumDiscussionsSchema,
      );
      return jsonResult(
        discussions.map((d) => ({
          discussionId: d.discussion,
          title: decodeEntities(d.name),
          author: d.userfullname,
          posted: formatTime(d.created),
          lastActivity: formatTime(d.timemodified),
          replies: d.numreplies,
          pinned: d.pinned || undefined,
          preview: htmlToText(d.message).slice(0, 400),
        })),
      );
    },
  );

  server.registerTool(
    "elearn_get_discussion",
    {
      title: "Read a forum discussion",
      description: "Returns all posts in a forum discussion, oldest first, with attachment URLs.",
      inputSchema: { discussionId: z.number().int() },
      annotations: { readOnlyHint: true },
    },
    async ({ discussionId }) => {
      const { posts } = await callMoodle(
        "mod_forum_get_discussion_posts",
        { discussionid: discussionId, sortby: "created", sortdirection: "ASC" },
        DiscussionPostsSchema,
      );
      return jsonResult(
        posts.map((p) => ({
          subject: decodeEntities(p.subject),
          author: p.author?.fullname,
          posted: formatTime(p.timecreated),
          message: htmlToText(p.message),
          attachments: p.attachments?.map((a) => ({ filename: a.filename, url: a.fileurl })),
        })),
      );
    },
  );
}

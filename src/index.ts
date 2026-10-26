#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAssignmentTools } from "./features/assignments/tools.ts";
import { registerAuthTools } from "./features/auth/tools.ts";
import { registerCalendarTools } from "./features/calendar/tools.ts";
import { registerCourseTools } from "./features/courses/tools.ts";
import { registerFileTools } from "./features/files/tools.ts";
import { registerForumTools } from "./features/forums/tools.ts";
import { registerGradeTools } from "./features/grades/tools.ts";
import { registerNotificationTools } from "./features/notifications/tools.ts";
import { registerSubmissionTools } from "./features/submissions/tools.ts";

const server = new McpServer(
  { name: "elearn", version: "1.0.0" },
  {
    instructions:
      "Access to the user's Ciputra E-Learning (Moodle, elearn.uc.ac.id): courses, materials, assignments, deadlines, " +
      "grades, notifications and forums. Login is persistent; if a tool says the token expired, call elearn_login. " +
      "Reading tools are safe to use freely. The two write tools, elearn_submit_assignment and elearn_unsubmit_assignment, " +
      "each pop a native confirmation dialog on the user's Mac that the user must approve before anything changes; never " +
      "assume approval. Times are in WIB (UTC+7).",
  },
);

registerAuthTools(server);
registerCourseTools(server);
registerAssignmentTools(server);
registerSubmissionTools(server);
registerCalendarTools(server);
registerGradeTools(server);
registerNotificationTools(server);
registerForumTools(server);
registerFileTools(server);

await server.connect(new StdioServerTransport());

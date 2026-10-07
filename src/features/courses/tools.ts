import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CourseContentsSchema, EnrolledCoursesSchema, type Module, PagesSchema } from "../../interfaces/moodle.ts";
import { decodeEntities, formatTime, htmlToText, jsonResult } from "../../lib/format.ts";
import { callMoodle } from "../moodle/client.ts";

function summarizeModule(mod: Module, includeDescriptions: boolean) {
  return {
    cmid: mod.id,
    instanceId: mod.instance,
    type: mod.modname,
    name: decodeEntities(mod.name),
    url: mod.url,
    hidden: mod.uservisible === false || undefined,
    completed: mod.completiondata ? mod.completiondata.state > 0 : undefined,
    dates: mod.dates?.map((d) => ({ label: d.label, date: formatTime(d.timestamp) })),
    description: includeDescriptions ? htmlToText(mod.description) || undefined : undefined,
    files: mod.contents
      ?.filter((c) => c.type === "file" && c.fileurl)
      .map((c) => ({ filename: c.filename, url: c.fileurl, size: c.filesize, mimetype: c.mimetype })),
  };
}

export function registerCourseTools(server: McpServer): void {
  server.registerTool(
    "elearn_list_courses",
    {
      title: "List my courses",
      description: "Lists the user's enrolled E-Learn courses. Defaults to courses currently in progress.",
      inputSchema: {
        filter: z.enum(["inprogress", "future", "past", "all"]).default("inprogress"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ filter }) => {
      const { courses } = await callMoodle(
        "core_course_get_enrolled_courses_by_timeline_classification",
        { classification: filter, limit: 0, offset: 0, sort: "fullname" },
        EnrolledCoursesSchema,
      );
      return jsonResult(
        courses.map((c) => ({
          id: c.id,
          name: decodeEntities(c.fullname),
          shortName: c.shortname,
          category: c.coursecategory,
          progressPercent: c.progress ?? undefined,
          start: formatTime(c.startdate),
          end: formatTime(c.enddate),
          url: c.viewurl,
        })),
      );
    },
  );

  server.registerTool(
    "elearn_get_course_contents",
    {
      title: "Get course contents",
      description:
        "Returns a course's sections and activities (materials, assignments, quizzes, forums, pages) with file download URLs. " +
        "Use elearn_download_file for files and elearn_read_page for 'page' activities.",
      inputSchema: {
        courseId: z.number().int().describe("Course id from elearn_list_courses"),
        includeDescriptions: z.boolean().default(false).describe("Include section summaries and activity descriptions"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ courseId, includeDescriptions }) => {
      const sections = await callMoodle("core_course_get_contents", { courseid: courseId }, CourseContentsSchema);
      return jsonResult(
        sections
          .filter((s) => s.modules.length > 0 || (includeDescriptions && s.summary))
          .map((s) => ({
            section: decodeEntities(s.name),
            summary: includeDescriptions ? htmlToText(s.summary) || undefined : undefined,
            activities: s.modules.map((m) => summarizeModule(m, includeDescriptions)),
          })),
      );
    },
  );

  server.registerTool(
    "elearn_read_page",
    {
      title: "Read a page activity",
      description: "Returns the text of a 'page' activity (modname=page) inside a course.",
      inputSchema: {
        courseId: z.number().int(),
        cmid: z.number().int().describe("The activity's cmid from elearn_get_course_contents"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ courseId, cmid }) => {
      const { pages } = await callMoodle("mod_page_get_pages_by_courses", { courseids: [courseId] }, PagesSchema);
      const page = pages.find((p) => p.coursemodule === cmid);
      if (!page) throw new Error(`No page activity with cmid ${cmid} in course ${courseId}.`);
      return jsonResult({ name: decodeEntities(page.name), intro: htmlToText(page.intro) || undefined, content: htmlToText(page.content) });
    },
  );
}

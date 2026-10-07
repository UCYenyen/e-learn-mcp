import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CourseGradesSchema, EnrolledCoursesSchema, GradeItemsSchema } from "../../interfaces/moodle.ts";
import { decodeEntities, htmlToText, jsonResult } from "../../lib/format.ts";
import { callMoodle, currentUserId } from "../moodle/client.ts";

export function registerGradeTools(server: McpServer): void {
  server.registerTool(
    "elearn_get_grades",
    {
      title: "Get grades",
      description:
        "Without courseId: the overall grade of every course. With courseId: every grade item (assignments, quizzes, " +
        "totals) in that course with feedback.",
      inputSchema: { courseId: z.number().int().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ courseId }) => {
      if (courseId === undefined) {
        const [{ grades }, { courses }] = await Promise.all([
          callMoodle("gradereport_overview_get_course_grades", {}, CourseGradesSchema),
          callMoodle(
            "core_course_get_enrolled_courses_by_timeline_classification",
            { classification: "all", limit: 0, offset: 0 },
            EnrolledCoursesSchema,
          ),
        ]);
        const names = new Map(courses.map((c) => [c.id, decodeEntities(c.fullname)]));
        return jsonResult(
          grades.map((g) => ({ courseId: g.courseid, course: names.get(g.courseid), grade: g.grade })),
        );
      }

      const { usergrades } = await callMoodle(
        "gradereport_user_get_grade_items",
        { courseid: courseId, userid: await currentUserId() },
        GradeItemsSchema,
      );
      return jsonResult(
        (usergrades[0]?.gradeitems ?? []).map((item) => ({
          item: item.itemname ? decodeEntities(item.itemname) : (item.itemtype === "course" ? "Course total" : item.itemtype),
          type: item.itemmodule ?? item.itemtype,
          grade: item.gradeformatted,
          max: item.grademax,
          percent: item.percentageformatted,
          feedback: htmlToText(item.feedback) || undefined,
        })),
      );
    },
  );
}

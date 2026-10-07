import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AssignmentsSchema, EnrolledCoursesSchema, SubmissionStatusSchema } from "../../interfaces/moodle.ts";
import { decodeEntities, formatTime, htmlToText, jsonResult } from "../../lib/format.ts";
import { callMoodle } from "../moodle/client.ts";

async function inProgressCourseIds(): Promise<number[]> {
  const { courses } = await callMoodle(
    "core_course_get_enrolled_courses_by_timeline_classification",
    { classification: "inprogress", limit: 0, offset: 0 },
    EnrolledCoursesSchema,
  );
  return courses.map((c) => c.id);
}

export function registerAssignmentTools(server: McpServer): void {
  server.registerTool(
    "elearn_list_assignments",
    {
      title: "List assignments",
      description:
        "Lists assignments with due dates for one course, or for all in-progress courses when courseId is omitted. " +
        "Use elearn_get_assignment for instructions, attachments and submission/grade status.",
      inputSchema: {
        courseId: z.number().int().optional(),
        upcomingOnly: z.boolean().default(false).describe("Only assignments whose due date is in the future"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ courseId, upcomingOnly }) => {
      const courseids = courseId ? [courseId] : await inProgressCourseIds();
      const { courses } = await callMoodle("mod_assign_get_assignments", { courseids }, AssignmentsSchema);
      const now = Date.now() / 1000;
      return jsonResult(
        courses.flatMap((course) =>
          course.assignments
            .filter((a) => !upcomingOnly || a.duedate > now)
            .sort((a, b) => a.duedate - b.duedate)
            .map((a) => ({
              assignId: a.id,
              cmid: a.cmid,
              course: decodeEntities(course.fullname),
              courseId: course.id,
              name: decodeEntities(a.name),
              due: formatTime(a.duedate),
              cutoff: formatTime(a.cutoffdate),
              opens: formatTime(a.allowsubmissionsfromdate),
            })),
        ),
      );
    },
  );

  server.registerTool(
    "elearn_get_assignment",
    {
      title: "Get assignment details",
      description: "Returns an assignment's instructions, attached files, the user's submission status, and grade/feedback.",
      inputSchema: {
        courseId: z.number().int(),
        assignId: z.number().int().describe("assignId from elearn_list_assignments"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ courseId, assignId }) => {
      const [{ courses }, status] = await Promise.all([
        callMoodle("mod_assign_get_assignments", { courseids: [courseId] }, AssignmentsSchema),
        callMoodle("mod_assign_get_submission_status", { assignid: assignId }, SubmissionStatusSchema),
      ]);
      const assignment = courses.flatMap((c) => c.assignments).find((a) => a.id === assignId);
      if (!assignment) throw new Error(`Assignment ${assignId} not found in course ${courseId}.`);

      const attempt = status.lastattempt;
      const submission = attempt?.submission ?? attempt?.teamsubmission;
      const feedbackComments = status.feedback?.plugins
        ?.flatMap((p) => p.editorfields ?? [])
        .map((f) => htmlToText(f.text))
        .filter(Boolean);

      return jsonResult({
        name: decodeEntities(assignment.name),
        due: formatTime(assignment.duedate),
        cutoff: formatTime(assignment.cutoffdate),
        maxGrade: assignment.grade,
        instructions: htmlToText(assignment.intro),
        attachments: assignment.introattachments?.map((f) => ({ filename: f.filename, url: f.fileurl })),
        submission: {
          status: submission?.status ?? "nosubmission",
          lastModified: formatTime(submission?.timemodified),
          gradingStatus: attempt?.gradingstatus,
          canSubmit: attempt?.cansubmit,
          locked: attempt?.locked,
        },
        feedback: status.feedback
          ? {
              grade: htmlToText(status.feedback.gradefordisplay),
              gradedOn: formatTime(status.feedback.gradeddate),
              comments: feedbackComments?.length ? feedbackComments : undefined,
            }
          : undefined,
      });
    },
  );
}

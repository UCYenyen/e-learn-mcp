import { stat } from "node:fs/promises";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SubmissionStatusSchema } from "../../interfaces/moodle.ts";
import { formatTime, jsonResult } from "../../lib/format.ts";
import { callMoodle, currentUserId, uploadToDraftArea } from "../moodle/client.ts";
import { requireApproval } from "./approval.ts";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Moodle write functions return [] on success or a list of warning objects. */
function warningsOf(result: unknown): { message: string }[] {
  if (!Array.isArray(result)) return [];
  return result.filter(
    (w): w is { message: string } => !!w && typeof w === "object" && "message" in w,
  );
}

async function submissionSummary(assignId: number) {
  const status = await callMoodle(
    "mod_assign_get_submission_status",
    { assignid: assignId },
    SubmissionStatusSchema,
  );
  const attempt = status.lastattempt;
  const submission = attempt?.submission ?? attempt?.teamsubmission;
  return {
    status: submission?.status ?? "nosubmission",
    gradingStatus: attempt?.gradingstatus,
    lastModified: formatTime(submission?.timemodified),
    canSubmit: attempt?.cansubmit,
    locked: attempt?.locked,
  };
}

export function registerSubmissionTools(server: McpServer): void {
  server.registerTool(
    "elearn_submit_assignment",
    {
      title: "Submit an assignment (asks for confirmation)",
      description:
        "Uploads one or more local files to an assignment and, by default, submits it for grading. " +
        "The user MUST approve a confirmation (a native dialog on macOS, otherwise a prompt in the MCP client) " +
        "before anything is uploaded or submitted; if it is declined or times out, nothing happens. " +
        "Get assignId from elearn_list_assignments.",
      inputSchema: {
        assignId: z.number().int().describe("assignId from elearn_list_assignments"),
        filePaths: z
          .array(z.string())
          .min(1)
          .describe("Absolute path(s) of the file(s) to submit, e.g. the exported .ai"),
        finalize: z
          .boolean()
          .default(true)
          .describe("true: submit for grading (final). false: only save as a draft, not submitted."),
        acceptStatement: z
          .boolean()
          .default(true)
          .describe("Accept the assignment's submission statement when finalizing (most assignments require it)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ assignId, filePaths, finalize, acceptStatement }) => {
      await currentUserId(); // fail early with a clear message if not logged in

      const files: { filename: string; bytes: number }[] = [];
      for (const path of filePaths) {
        let info: Awaited<ReturnType<typeof stat>>;
        try {
          info = await stat(path);
        } catch {
          throw new Error(`File not found: ${path}`);
        }
        if (!info.isFile()) throw new Error(`Not a file: ${path}`);
        files.push({ filename: basename(path), bytes: info.size });
      }

      const before = await submissionSummary(assignId);
      const fileList = files.map((f) => `• ${f.filename} (${humanSize(f.bytes)})`).join("\n");
      const action = finalize
        ? "UPLOAD and SUBMIT FOR GRADING"
        : "UPLOAD as a DRAFT (not submitted for grading)";

      const approval = await requireApproval(server, {
        title: "E-Learn: confirm submission",
        confirmLabel: finalize ? "Submit" : "Save draft",
        summary: `${action} to assignment #${assignId}?`,
        detail: `${files.length} file(s):\n${fileList}\n\nCurrent status: ${before.status}${before.locked ? " (locked)" : ""}.`,
      });
      if (!approval.approved) {
        return jsonResult({
          submitted: false,
          cancelled: true,
          reason: `${approval.reason} Nothing was uploaded.`,
        });
      }

      const upload = await uploadToDraftArea(filePaths);

      const saveWarnings = warningsOf(
        await callMoodle(
          "mod_assign_save_submission",
          { assignmentid: assignId, plugindata: { files_filemanager: upload.itemid } },
          z.any(),
        ),
      );
      if (saveWarnings.length > 0) {
        return jsonResult({ submitted: false, step: "save_submission", warnings: saveWarnings });
      }

      let finalizedForGrading = false;
      if (finalize) {
        const gradeWarnings = warningsOf(
          await callMoodle(
            "mod_assign_submit_for_grading",
            { assignmentid: assignId, acceptsubmissionstatement: acceptStatement ? 1 : 0 },
            z.any(),
          ),
        );
        if (gradeWarnings.length > 0) {
          return jsonResult({
            submitted: false,
            step: "submit_for_grading",
            note: "Your file(s) were saved as a draft, but finalizing for grading failed. The draft is kept.",
            warnings: gradeWarnings,
            status: await submissionSummary(assignId),
          });
        }
        finalizedForGrading = true;
      }

      return jsonResult({
        submitted: true,
        finalizedForGrading,
        uploaded: upload.files,
        status: await submissionSummary(assignId),
      });
    },
  );

  server.registerTool(
    "elearn_unsubmit_assignment",
    {
      title: "Unsubmit an assignment / revert to draft (asks for confirmation)",
      description:
        "Reverts your submitted assignment back to draft so it can be edited again (an 'unsubmit'). " +
        "The user MUST approve a confirmation first (a native dialog on macOS, otherwise a prompt in the MCP client); " +
        "if it is declined, nothing changes. " +
        "Whether a student may do this depends on the assignment's settings; E-Learn rejects it otherwise.",
      inputSchema: {
        assignId: z.number().int().describe("assignId from elearn_list_assignments"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ assignId }) => {
      const userId = await currentUserId();
      const before = await submissionSummary(assignId);

      const approval = await requireApproval(server, {
        title: "E-Learn: confirm unsubmit",
        confirmLabel: "Unsubmit",
        summary: `Revert assignment #${assignId} back to draft (unsubmit)?`,
        detail: `Current status: ${before.status}${before.locked ? " (locked)" : ""}.`,
      });
      if (!approval.approved) {
        return jsonResult({
          reverted: false,
          cancelled: true,
          reason: `${approval.reason} Nothing changed.`,
        });
      }

      const warnings = warningsOf(
        await callMoodle(
          "mod_assign_revert_submission_to_draft",
          { assignmentid: assignId, userid: userId },
          z.any(),
        ),
      );
      if (warnings.length > 0) {
        return jsonResult({ reverted: false, warnings });
      }

      return jsonResult({ reverted: true, status: await submissionSummary(assignId) });
    },
  );
}

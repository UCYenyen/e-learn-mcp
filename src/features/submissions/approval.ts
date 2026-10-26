import { execFile } from "node:child_process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface ApprovalRequest {
  /** Dialog window title. */
  title: string;
  /** One-line headline of what is about to happen. */
  summary: string;
  /** Optional extra lines (file list, current status). */
  detail?: string;
  /** Label of the confirm button, e.g. "Submit" or "Unsubmit". */
  confirmLabel: string;
}

export interface ApprovalOutcome {
  approved: boolean;
  /** Why it was not approved; set only when approved is false. */
  reason?: string;
}

/** How long the dialog waits for a human before giving up (treated as a decline). */
const TIMEOUT_SECONDS = 180;

/** Escape a string for embedding inside an AppleScript double-quoted literal. */
function asLiteral(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function approvalMessage(req: ApprovalRequest): string {
  const lines = [req.summary];
  if (req.detail) lines.push("", req.detail);
  lines.push("", "This changes your submission on E-Learn (elearn.uc.ac.id).");
  return lines.join("\n");
}

/**
 * Asks the human to confirm before any write to E-Learn happens. Returns approved ONLY
 * on an explicit confirm. A cancel, the Escape key, a timeout, or any failure to ask all
 * count as "no", so nothing is ever submitted or unsubmitted without a deliberate human
 * answer. This gate is intentionally not bypassable from the tool arguments.
 *
 * On macOS it shows a native dialog. Elsewhere (e.g. the server runs on Linux) it asks
 * through MCP elicitation, which the client shows to the user directly; the model
 * cannot answer it on the user's behalf.
 */
export function requireApproval(server: McpServer, req: ApprovalRequest): Promise<ApprovalOutcome> {
  return process.platform === "darwin" ? macDialogApproval(req) : elicitationApproval(server, req);
}

function macDialogApproval(req: ApprovalRequest): Promise<ApprovalOutcome> {
  const declined = { approved: false, reason: "The confirmation dialog on the Mac was not approved." };
  const script =
    `tell application "System Events"\n` +
    `  activate\n` +
    `  set theResult to display dialog ${asLiteral(approvalMessage(req))} ` +
    `with title ${asLiteral(req.title)} ` +
    `buttons {"Cancel", ${asLiteral(req.confirmLabel)}} ` +
    `default button "Cancel" cancel button "Cancel" ` +
    `with icon caution giving up after ${TIMEOUT_SECONDS}\n` +
    `  if gave up of theResult then return "__GAVEUP__"\n` +
    `  return button returned of theResult\n` +
    `end tell`;

  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], (error, stdout) => {
      if (error) {
        // Non-zero exit means the user pressed Cancel/Escape (-128), the dialog
        // could not be shown, or osascript is unavailable. All mean "no".
        resolve(declined);
        return;
      }
      resolve(stdout.trim() === req.confirmLabel ? { approved: true } : declined);
    });
  });
}

async function elicitationApproval(server: McpServer, req: ApprovalRequest): Promise<ApprovalOutcome> {
  if (!server.server.getClientCapabilities()?.elicitation) {
    return {
      approved: false,
      reason:
        "This MCP client cannot show confirmation prompts (no elicitation support), and the native dialog " +
        "only works on macOS. Submit on elearn.uc.ac.id instead.",
    };
  }
  try {
    const result = await server.server.elicitInput(
      {
        mode: "form",
        message: `${req.title}\n\n${approvalMessage(req)}`,
        requestedSchema: {
          type: "object",
          properties: {
            confirm: {
              type: "boolean",
              title: req.confirmLabel,
              description: `Tick to ${req.confirmLabel.toLowerCase()}. Leave unticked or decline to cancel.`,
              default: false,
            },
          },
          required: ["confirm"],
        },
      },
      { timeout: TIMEOUT_SECONDS * 1000 },
    );
    if (result.action === "accept" && result.content?.confirm === true) return { approved: true };
    return { approved: false, reason: "The confirmation prompt was not approved." };
  } catch {
    return { approved: false, reason: "The confirmation prompt could not be shown or timed out." };
  }
}

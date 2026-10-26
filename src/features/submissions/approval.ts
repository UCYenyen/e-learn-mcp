import { execFile } from "node:child_process";

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

/** How long the dialog waits for a human before giving up (treated as a decline). */
const TIMEOUT_SECONDS = 180;

/** Escape a string for embedding inside an AppleScript double-quoted literal. */
function asLiteral(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Shows a native macOS confirmation that the user must click before any write to
 * E-Learn happens. Returns true ONLY on an explicit confirm. A cancel, the Escape
 * key, a timeout, or any failure to show the dialog all return false, so nothing is
 * ever submitted or unsubmitted without a deliberate human click. This gate is
 * intentionally not bypassable from the tool arguments.
 */
export function requireApproval(req: ApprovalRequest): Promise<boolean> {
  const lines = [req.summary];
  if (req.detail) lines.push("", req.detail);
  lines.push("", "This changes your submission on E-Learn (elearn.uc.ac.id).");
  const message = lines.join("\n");

  const script =
    `tell application "System Events"\n` +
    `  activate\n` +
    `  set theResult to display dialog ${asLiteral(message)} ` +
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
        resolve(false);
        return;
      }
      resolve(stdout.trim() === req.confirmLabel);
    });
  });
}

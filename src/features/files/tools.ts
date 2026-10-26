import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DOWNLOAD_DIR, SITE_HOST } from "../../config.ts";
import { MoodleErrorSchema } from "../../interfaces/moodle.ts";
import { jsonResult } from "../../lib/format.ts";
import { loadSession } from "../auth/session-store.ts";
import { MoodleError, NotLoggedInError } from "../moodle/client.ts";

const INLINE_TEXT_LIMIT = 100_000;
const TEXT_MIME = /^(text\/|application\/(json|xml|csv))/;

function filenameFrom(res: Response, url: URL): string {
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const raw = match?.[1] ?? url.pathname.split("/").pop() ?? "download";
  // basename() + stripping separators keeps the file inside DOWNLOAD_DIR.
  return basename(decodeURIComponent(raw)).replace(/[/\\:]/g, "_") || "download";
}

export function registerFileTools(server: McpServer): void {
  server.registerTool(
    "elearn_download_file",
    {
      title: "Download a course file",
      description:
        "Downloads an E-Learn file (lecture slides, PDFs, assignment attachments) to the user's Downloads/University/Academics/elearn folder " +
        "and returns the local path. Small text files are also returned inline. Read PDFs/docs from the returned path.",
      inputSchema: {
        url: z.string().url().describe("A file URL from elearn_get_course_contents, an assignment, or a forum post"),
      },
    },
    async ({ url: rawUrl }) => {
      const session = await loadSession();
      if (!session) throw new NotLoggedInError("You are not logged in to E-Learn yet.");

      const url = new URL(rawUrl);
      if (url.host !== SITE_HOST) {
        throw new Error(`Refusing to send your E-Learn token to ${url.host}; only ${SITE_HOST} URLs are allowed.`);
      }
      // Browser-style links need the web-service endpoint to accept a token.
      if (url.pathname.startsWith("/pluginfile.php/")) url.pathname = `/webservice${url.pathname}`;
      url.searchParams.set("token", session.token);

      const res = await fetch(url);
      const mimetype = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0] ?? "";
      const bytes = Buffer.from(await res.arrayBuffer());
      // Errors come back as JSON, but so do real JSON files (e.g. .ipynb notebooks).
      if (mimetype === "application/json") {
        let json: unknown = null;
        try {
          json = JSON.parse(bytes.toString("utf8"));
        } catch {
          // Not valid JSON, so not a Moodle error either; save it as-is.
        }
        const error = MoodleErrorSchema.safeParse(json);
        if (error.success && error.data.errorcode === "invalidtoken") {
          throw new NotLoggedInError("Your E-Learn token was rejected; it has probably expired.");
        }
        if (error.success) throw new MoodleError(error.data.errorcode, error.data.message);
      }
      if (!res.ok) throw new Error(`Download failed with HTTP ${res.status}.`);

      const filename = filenameFrom(res, url);
      await mkdir(DOWNLOAD_DIR, { recursive: true });
      const path = join(DOWNLOAD_DIR, filename);
      await writeFile(path, bytes);

      const inline = TEXT_MIME.test(mimetype) && bytes.length <= INLINE_TEXT_LIMIT;
      return jsonResult({
        path,
        filename,
        mimetype,
        bytes: bytes.length,
        content: inline ? bytes.toString("utf8") : undefined,
      });
    },
  );
}

import type { z } from "zod";
import { SITE_URL } from "../../config.ts";
import { MoodleErrorSchema } from "../../interfaces/moodle.ts";
import { loadSession } from "../auth/session-store.ts";

type Scalar = string | number | boolean;
export type MoodleArgs = { [key: string]: Scalar | Scalar[] | MoodleArgs | MoodleArgs[] | undefined };

const RELOGIN_HINT =
  "Make sure E-Learn is open and logged in (Google) in Chrome, then call the `elearn_login` tool or run `pnpm signin` in the elearn-mcp folder.";

export class NotLoggedInError extends Error {
  constructor(reason: string) {
    super(`${reason} ${RELOGIN_HINT}`);
    this.name = "NotLoggedInError";
  }
}

export class MoodleError extends Error {
  readonly errorcode: string;
  constructor(errorcode: string, message: string) {
    super(`Moodle error (${errorcode}): ${message}`);
    this.name = "MoodleError";
    this.errorcode = errorcode;
  }
}

const TOKEN_ERRORS = new Set(["invalidtoken", "accessexception"]);

/** Moodle's REST format wants nested args flattened to `a[0][b]=c`. */
function flatten(args: MoodleArgs, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object") flatten(item, `${name}[${i}]`, out);
        else out.append(`${name}[${i}]`, String(item));
      });
    } else if (typeof value === "object") {
      flatten(value, name, out);
    } else {
      out.append(name, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
    }
  }
  return out;
}

export async function callWithToken<S extends z.ZodType>(
  token: string,
  wsfunction: string,
  args: MoodleArgs,
  schema: S,
): Promise<z.infer<S>> {
  const body = flatten(args);
  body.set("wstoken", token);
  body.set("wsfunction", wsfunction);
  body.set("moodlewsrestformat", "json");

  const res = await fetch(`${SITE_URL}/webservice/rest/server.php`, { method: "POST", body });
  if (!res.ok) throw new Error(`E-Learn returned HTTP ${res.status} for ${wsfunction}`);
  const json: unknown = await res.json();

  const error = MoodleErrorSchema.safeParse(json);
  if (error.success) {
    if (TOKEN_ERRORS.has(error.data.errorcode)) {
      throw new NotLoggedInError(`Your E-Learn token was rejected (${error.data.errorcode}); it has probably expired.`);
    }
    throw new MoodleError(error.data.errorcode, error.data.message);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Unexpected response shape from ${wsfunction}: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function callMoodle<S extends z.ZodType>(
  wsfunction: string,
  args: MoodleArgs,
  schema: S,
): Promise<z.infer<S>> {
  const session = await loadSession();
  if (!session) throw new NotLoggedInError("You are not logged in to E-Learn yet.");
  return callWithToken(session.token, wsfunction, args, schema);
}

export async function currentUserId(): Promise<number> {
  const session = await loadSession();
  if (!session) throw new NotLoggedInError("You are not logged in to E-Learn yet.");
  return session.userId;
}

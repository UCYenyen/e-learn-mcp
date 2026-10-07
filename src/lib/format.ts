import { TIMEZONE } from "../config.ts";

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Moodle timestamps are unix seconds; 0 means "not set". */
export function formatTime(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return `${dateFormatter.format(new Date(unixSeconds * 1000))} WIB`;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#039;": "'",
};

/** Moodle returns names with HTML entities (e.g. "Use Case &amp; Scenario"). */
export function decodeEntities(text: string): string {
  return text.replace(/&[#\w]+;/g, (entity) => ENTITIES[entity] ?? entity);
}

/** Turns Moodle's rich-text HTML into readable plain text, keeping link targets. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => `${text} (${href})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[#\w]+;/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function jsonResult(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

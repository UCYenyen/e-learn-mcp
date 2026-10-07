# elearn-mcp

MCP server for **Ciputra E-Learning** (Moodle 4.5, https://elearn.uc.ac.id). You log in once and it stays logged in.

## How the login stays alive

The site uses Google SSO, so there's no password to store. Instead, this reuses the E-Learn tab you already have open in Chrome, and it never opens a new window:

1. It finds an open, logged-in `elearn.uc.ac.id` tab in Google Chrome (via AppleScript, macOS).
2. Inside that tab it requests `admin/tool/mobile/launch.php`, the same endpoint the official Moodle app uses, and receives a **mobile-app token**.
3. The token is saved to `~/.config/elearn-mcp/session.json` (permissions `600`).

Moodle mobile tokens are valid for **12 weeks** by default, and they don't depend on the browser session. When one expires, the tools say so. Make sure E-Learn is open and logged in in Chrome, then run `elearn_login` again.

**One-time Chrome setting:** View → Developer → **Allow JavaScript from Apple Events**. The first time, macOS may also ask whether your terminal or editor may control Chrome; allow it.

## Setup

```bash
pnpm install
pnpm signin             # uses your open, logged-in E-Learn tab in Chrome
```

Other options:

```bash
pnpm signin --cookie    # paste the MoodleSession cookie from DevTools → Application → Cookies
pnpm signin --password  # only for accounts with a real Moodle password
pnpm signout            # delete the saved token
```

`pnpm login` / `pnpm logout` are pnpm's own npm-registry commands, so this project uses `signin` / `signout` instead.

You can also skip the terminal: ask Claude to call `elearn_login`.

### Register with Claude Code

```bash
claude mcp add elearn -s user -- node /absolute/path/to/elearn-mcp/src/index.ts
```

Requires Node ≥ 22.18, which runs the TypeScript directly; there is no build step.

### Other MCP clients (Claude Desktop, Cursor, …)

```json
{
  "mcpServers": {
    "elearn": { "command": "node", "args": ["/absolute/path/to/elearn-mcp/src/index.ts"] }
  }
}
```

## Tools

| Tool | What it does |
| --- | --- |
| `elearn_login` / `elearn_status` | Get a token from your open E-Learn tab / check the saved token |
| `elearn_list_courses` | Enrolled courses (in progress / past / future / all) |
| `elearn_get_course_contents` | Sections, activities and file URLs of a course |
| `elearn_read_page` | Text of a "page" activity |
| `elearn_list_assignments` / `elearn_get_assignment` | Due dates, instructions, attachments, submission status, feedback |
| `elearn_upcoming_deadlines` | Dashboard timeline: everything due soon or overdue |
| `elearn_get_grades` | Course totals, or every grade item in one course |
| `elearn_get_notifications` | Recent notifications |
| `elearn_get_forum_discussions` / `elearn_get_discussion` | Announcements and forum threads |
| `elearn_download_file` | Saves a course file to `~/Downloads/elearn` and returns the path |

Every tool is read-only. Nothing submits, posts, or marks anything on E-Learn. Times are shown in WIB.

## Environment overrides

`ELEARN_SITE_URL`, `ELEARN_CONFIG_DIR`, `ELEARN_DOWNLOAD_DIR`, `ELEARN_BROWSER_APP` (default `Google Chrome`; e.g. `Brave Browser`, `Microsoft Edge`).

## Security notes

- The token can read everything your E-Learn account can see. Keep `session.json` private. Delete it with `pnpm signout`, or revoke it on E-Learn under *Preferences → Security keys*.
- `elearn_download_file` only sends the token to `elearn.uc.ac.id`.

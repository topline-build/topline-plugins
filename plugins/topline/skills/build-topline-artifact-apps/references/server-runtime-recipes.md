# Server Runtime Recipes

Copyable server-side contracts for an app's own code: company-table system
columns, server table SQL, managed file storage, browser uploads, secrets and Python
parts. Everything here runs in the app's server code (a Node handler or a
Python part), never in browser code.

## Company-table system columns

Every company table gets these platform-owned columns. Read and filter on them
freely; never set, rename, retype or drop them, and never name them in
`readableColumns` or `writableColumns`.

| Column | Type | Meaning |
| --- | --- | --- |
| `_row_id` | `uuid` | The row's key (the primary key). Comes back as a lowercase string. |
| `_version` | `bigint` | Starts at 1 and goes up on every change. Use it for optimistic updates. |
| `_created_at`, `_created_by` | `timestamptz`, `text` | When and by whom the row was added. |
| `_updated_at`, `_updated_by` | `timestamptz`, `text` | The last change. |
| `_deleted_at`, `_deleted_by` | `timestamptz`, `text` | Set by a soft delete; `null` while the row is live. |

There is **no `_id` column**: a statement that names `_id` fails with
`company_table_sql_failed:42703` (undefined column). Filter out soft-deleted
rows with `_deleted_at is null`. There are no sequences: for a human-friendly
number, show part of `_row_id` or keep your own column; `max()+1` races.

## Server table SQL

An app whose own server code decides writes (a workflow rule, an approval, a
public form) runs table SQL as the app:

1. Set `"serverTables": true` in `artifact-app.json`.
2. On each request, read two request headers the platform sets:
   `x-platform-tables-sql-url` (the endpoint) and `x-platform-tables-token`
   (the credential). Never send the token to the browser or log it.
3. `POST` JSON `{ "sql": "...", "params": { "name": value }, "actingUser": "<viewer email>" }`
   to that URL with the token as a Bearer `Authorization` header and
   `Content-Type: application/json`.

Contract details:

- Placeholders are `:name`, filled from `params` by name: strings, numbers,
  booleans, `null` and arrays. Cast when the column type matters:
  `CAST(:startDate AS date)`, `CAST(:ids AS uuid[])`. `_row_id = :id` works
  with the string id.
- One statement per call, at most 20,000 characters. A data-changing CTE
  (`WITH ... INSERT/UPDATE`) is refused; run two statements.
- `actingUser` (at most 200 characters, usually the `x-platform-viewer-email`
  header) only labels the row history. It never authorizes anything: your code
  decides who may change what.
- A success is `200` with `{ ok: true, rows, rowCount, columns, warnings, ... }`.
  Read `rows`; `rowCount` tells an `UPDATE` whether it matched. **Treat every
  value in `rows` as a string**: timestamps arrive as Postgres text such as
  `2026-11-16 21:10:14.04+00`, numbers as digit strings. Convert in code, or
  shape values in SQL (`to_char(col, 'YYYY-MM-DD')`,
  `date_part('epoch', col) * 1000`).
- A failure is `{ ok: false, error, sqlstate?, hint? }` with status 400, 401,
  403 or 503. `company_table_sql_failed` carries the Postgres SQLSTATE
  (`42703` is an unknown column, `42P01` an unknown table);
  `company_table_not_found` means the `company_data.<name>` relation isn't a
  registered table; `preview_writes_not_allowed` means a draft tried to write
  (see below); `server_tables_not_declared` means the manifest lacks
  `serverTables: true`.
- Name tables as `company_data.<name>`. Prefer `date_part('epoch', col)` to
  `extract(epoch FROM col)`, which the statement checker currently misreads as
  a table reference.
- A draft may only read unless the manifest also sets `"previewWrites": true`,
  and then a draft writes **real rows** (there is no isolated preview data).
  A dev-sandbox preview gets no token, so the headers are absent there.

### Server-only apps do not declare `tables[]`

`serverTables: true` is enough for server SQL; a deploy without `tables[]`
works. Do **not** add a `tables[]` binding just to "register" a table: every
binding exposes `./_artifact/tables/<alias>` to every viewer of the app, and a
`list` binding returns every row's `_row_id`, `_version` and the binding's
`readableColumns`, whatever your server code filters. Declare `tables[]` only
for a table the browser should read or write directly, and choose its
`readableColumns` for every viewer.

### Node helper

```js
// Server code only. `req` is the request the platform passed to your handler.
export async function tablesSql(req, sql, params = {}, actingUser) {
  const url = req.headers["x-platform-tables-sql-url"];
  const token = req.headers["x-platform-tables-token"];
  if (!url || !token) throw Object.assign(new Error("server_tables_unavailable"), { status: 503 });
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
    body: JSON.stringify({ sql, params, ...(actingUser ? { actingUser } : {}) })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    const code = `${body.error ?? `table_sql_http_${response.status}`}${body.sqlstate ? `:${body.sqlstate}` : ""}`;
    throw Object.assign(new Error(code), { status: response.status, hint: body.hint });
  }
  return { rows: body.rows ?? [], rowCount: body.rowCount ?? 0 };
}

// Example: an optimistic update that only succeeds on the version the person saw.
const viewer = req.headers["x-platform-viewer-email"];
const { rowCount } = await tablesSql(req,
  "update company_data.time_off_requests set status = :status where _row_id = :id and _version = :version and _deleted_at is null",
  { status: "approved", id: rowId, version: expectedVersion }, viewer);
if (rowCount === 0) { /* someone changed it first: re-read and answer 409 */ }
```

### Python helper

```py
# Server code only (FastAPI). Use a plain `def` route: this helper blocks.
import json
import urllib.error
import urllib.request

def tables_sql(request, sql, params=None, acting_user=None):
    url = request.headers.get("x-platform-tables-sql-url")
    token = request.headers.get("x-platform-tables-token")
    if not url or not token:
        raise RuntimeError("server_tables_unavailable")
    payload = {"sql": sql, "params": params or {}}
    if acting_user:
        payload["actingUser"] = acting_user
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
        headers={"content-type": "application/json", "authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            body = json.load(res)
    except urllib.error.HTTPError as err:
        body = json.loads(err.read() or b"{}")
        code = body.get("error", f"table_sql_http_{err.code}")
        raise RuntimeError(f"{code}:{body['sqlstate']}" if body.get("sqlstate") else code) from None
    return body.get("rows", []), body.get("rowCount", 0)
```

The Build MCP starter `table-approvals-app` (`platform_init_artifact_app`)
ships the Node helper with a request form, a "my requests" list, an approver
queue backed by an app-owned approvers table, and no `tables[]`.

## Message people and run on a schedule

Only when `platform_capability_status` shows `families.appMessaging` as
`available` (in a Topline coding task: when your instructions say app
messaging is on). Otherwise these headers never arrive and a `call_route` schedule
skips every run: say so, and build the page without them.

**Message people (`notify`).** Declare `"notify": { "enabled": true }` (needs a
server part). Server code then gets `x-platform-notify-url` and
`x-platform-notify-token` on every request it serves, including scheduled
runs. `POST` JSON `{ "to": "owner" | "<email>" | [...], "text": "...", "link"?: "https://..." }`
with the token as a Bearer `Authorization` header.

- Alerts are opt in. Send only the messages the person asked for; offer any
  other alert (for example "also DM on Urgent?") instead of adding it.
- The message goes as a Slack DM from the company's Topline Slack app, or by
  email when the person isn't on Slack. It ends with "Sent by <app> · Open app".
- Only people who can open the app receive it; anyone else comes back as
  `skipped: not_allowed`. At most 25 recipients a call, 2,000 characters of
  plain text, 200 messages a day per app and 20 a day per person.
- A draft sends only to its owner, marked `[Test]`, so test the real wording on
  the draft. The live app sends to everyone named.
- **An alert sent when a row is saved** ("DM me when a High complaint comes
  in") can be tried on the draft too, even though a draft can't save rows. Add
  an owner-only "Send a test alert" action that builds the same message from
  sample values through the same function the save uses, and sends it. Offer
  `previewWrites: true` (real rows from the draft) only when the person accepts
  real test rows. Never tell the person they have to publish before they can
  try the alert.
- The answer is `{ ok: true, results: [{ to, status: "sent" | "skipped" | "failed", channel?, reason? }] }`.
  Report skipped and failed people in the app's own run log; never retry a
  `sent` one.

**Run on a schedule (`call_route`).** Add a `refreshSchedules[]` entry with
`"mode": "call_route"` and `"route"` naming one of the app's own `api` routes,
for example `/_artifact/jobs/morning-digest`, plus the usual `name`, `cron`,
`timezone` and a one-line `promptText` saying what the job does. It runs only on the published
app (a draft's schedule waits until publish), as a `POST` with no viewer:
`x-platform-artifact-access: system` and `x-platform-scheduled: <schedule name>`.
The route gets the same table, notify and events headers as any request, and
the app's normal route time limit. Answer 2xx when the job finished. Any other
answer, or running out of time, fails the run, shows on the app's problems,
and is **not retried**, so make the job safe to run twice (dedupe on the day
in a run-log table). To try the job on a draft, call the same route yourself.

```js
// Node: one call for any job route or page action.
async function notify(req, to, text, link) {
  const url = req.headers["x-platform-notify-url"];
  const token = req.headers["x-platform-notify-token"];
  if (!url || !token) throw Object.assign(new Error("notify_unavailable"), { status: 503 });
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
    body: JSON.stringify({ to, text, ...(link ? { link } : {}) })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw Object.assign(new Error(body.error ?? `notify_http_${response.status}`), { status: response.status, hint: body.hint });
  return body.results;
}

// The scheduled route: the scheduler, or the owner trying it on a draft.
const caller = req.headers["x-platform-artifact-access"];
if (req.headers["x-platform-scheduled"] !== "morning-digest" && caller !== "owned" && caller !== "internal") {
  return res.status(403).json({ error: "scheduled_only" });
}
```

```python
# Python (FastAPI): a plain `def` route, this helper blocks.
import json, urllib.request

def notify(request, to, text, link=None):
    url = request.headers.get("x-platform-notify-url")
    token = request.headers.get("x-platform-notify-token")
    if not url or not token:
        raise RuntimeError("notify_unavailable")
    payload = {"to": to, "text": text, **({"link": link} if link else {})}
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
        headers={"content-type": "application/json", "authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read())["results"]
```

Batch table writes in a job: one `INSERT ... SELECT * FROM unnest(...)` or a
multi-row `VALUES` per call, not one call per row. Table writes are limited per
minute, and a row-by-row job stops partway.

## Managed file storage

Declare `storageBindings: [{ "name": "files", "access": "read_write" }]` (or
`"read"`), and list `ARTIFACT_STORAGE_BINDINGS` in `env`. At most eight
bindings; names match `^[a-z][a-z0-9_-]{0,47}$`. At runtime
`ARTIFACT_STORAGE_BINDINGS` is a JSON **array**, one object per binding:

```json
[{ "name": "files", "access": "read_write", "bucket": "<bucket>", "prefix": "<namespace>/", "region": "us-west-2" }]
```

`prefix` ends in `/`. Prepend it to every key and pass it as `Prefix` when
listing. Credentials come from the function's own role; use the AWS SDK
(Node: declare `@aws-sdk/client-s3` in `package.json` dependencies; Python:
`boto3`).

```js
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
const files = JSON.parse(process.env.ARTIFACT_STORAGE_BINDINGS || "[]").find((b) => b.name === "files");
if (!files) throw new Error("storage_binding_missing:files");
const s3 = new S3Client({ region: files.region });
await s3.send(new PutObjectCommand({ Bucket: files.bucket, Key: `${files.prefix}receipts/${id}.pdf`, Body: bytes, ContentType: "application/pdf" }));
```

What the role allows and doesn't:

- Object reads and writes, versions, tags, copy, delete and multipart uploads
  inside the namespace. Bucket administration, `ListMultipartUploads` and
  permanent version deletes are not granted.
- Listing is granted **only with a `Prefix` inside the namespace**. Because of
  that, `GetObject` or `HeadObject` on a key that doesn't exist answers
  **403 `AccessDenied`**, not `NoSuchKey`/404. Treat `AccessDenied` on a key
  your own code built as "not found", or keep the keys you wrote in a table.
- Server code in drafts uses the same files as live. Use a separate binding
  name for draft-only data. Browser uploads are the exception: they go through
  the platform upload route below, which keeps draft uploads apart.

## Uploads and downloads through the app

The app proxy forwards request bodies up to **4,500,000 bytes**; a larger one
gets a clean 413 `artifact_app_proxy_body_too_large` (never a 502). Never send
file bodies through your own routes, and never chunk or stitch files in server
code. Browser uploads go straight to storage through the platform upload route.

Declare `uploads` on a `read_write` binding:

```json
{ "name": "receipts", "access": "read_write",
  "uploads": { "maxBytes": 26214400, "types": ["image/*", "application/pdf"],
               "viewerAccess": "own", "unclaimedExpiryDays": 1,
               "onComplete": "/_artifact/api/receipts/uploaded" } }
```

- `maxBytes` (required, at most 5 GiB; 25 MB is a good default) and `types`
  (required, 1-20 exact MIME types or `type/*`, never `*/*`; `image/*` does not
  include SVG, list `image/svg+xml` explicitly if you need it).
- `viewerAccess`: `"own"` (default) lets a viewer list, open and delete only
  files they uploaded; `"all"` shares every file with every viewer.
- `unclaimedExpiryDays` (1-7, default 1): an upload that never completes, or
  that your callback refused, is deleted after that many days.
- `onComplete`: a declared `api` route on a Node server part. The platform
  calls it after its own checks pass. Always declare it.
- `audience: "public"` is not supported yet; uploads need a signed-in viewer.

In the browser, use the vendored helper (`src/vendor/artifact-uploads.js` in
the starter templates; copy it unchanged from another template if yours lacks it):

```js
import { upload, fileUrl, listFiles, deleteFile } from "./vendor/artifact-uploads.js";
const result = await upload(file, { binding: "receipts", onProgress: (sent, total) => setProgress(sent / total) });
// result.status === "completed": result.app is what onComplete returned (for example the new row id).
// result.status === "pending": the file is kept but your callback didn't answer; reconcile with listFiles.
img.src = fileUrl("receipts", result.file.key);
```

`upload` picks single or multipart upload, retries, resumes after a dropped
connection (it keeps the upload id in `sessionStorage`), sends the file's
SHA-256 and cancels with an `AbortSignal`. A refused file rejects with
`error.message === "upload_rejected"` and `error.detail.reason`.

The platform picks every key (`uploads/<yyyy>/<mm>/<uuid>/<name>`), never
overwrites a file, and on completion checks the size, the content type (by
sniffing the first bytes) and the checksum. A file that fails is deleted and
never reaches your app.

The `onComplete` route receives a POST with JSON `{ binding, key, size, type,
filename, sha256?, sha256Verified?, uploadedBy, environment }` and the
uploader's `x-platform-viewer-email`. The Lambda adapter verifies the
platform's signature before your handler runs, so nothing else can call it.
Answer 2xx to accept (your JSON goes back to the browser), or a 4xx with
`{ "reason": "..." }` to refuse: the file is deleted and the browser sees the
reason. A 5xx or no answer within 10 seconds keeps the file and tells the
browser `pending`; it is never lost. The platform calls the route at most once
per upload, but write it to be idempotent anyway (key your row on `key`), since
a `pending` file may be reconciled later.

Downloads: `GET ./_artifact/storage/<binding>/files/<key>` redirects to a
five-minute storage link (`?download=1` for an attachment), served with the
type recorded at upload. Only images (not SVG) and PDFs open inline; HTML, SVG,
XML, text and everything else always download as attachments. `GET
./_artifact/storage/<binding>/files?prefix=uploads/&cursor=` lists, and
`DELETE` on a file deletes it. Never presign your own links for these files.

To let someone else open one file in an `"own"` binding (an approver opening a
receipt, say), your server code asks for a share link:

```js
const { url } = await globalThis.platformStorage.shareLink(req, "receipts", {
  key, viewerEmail: approverEmail, ttlSeconds: 900 // at most 3600; omit viewerEmail for any viewer of the app
});
```

`url` is relative (`./_artifact/storage/...?link=...`); hand it to the page.
The link opens that file only, only for the named viewer when `viewerEmail` is
set, and still requires the viewer to be able to open the app. The platform
token behind it lives only in the function's environment. Only the app's current
deployment can ask for links: the live app, or the latest draft. A version
preview pinned to an older draft (`/versions/<id>/`) gets 401
`platform_token_invalid`; open the latest draft to test links.

Drafts: a draft's **server code still uses live storage** (its
`ARTIFACT_STORAGE_BINDINGS` prefix is the live one), so server-side writes in a
draft touch live files. Only **browser uploads** from a draft are kept apart:
they go under `app-preview/`, are deleted after 7 days, never show in the live
app and aren't copied on publish. A draft's server code reaches those uploads
through the callback payload and share links. On a live app, uploads and deletes
need the app's own address (its subdomain or custom domain), like table saves.

Local checks: `validate-local` answers `./_artifact/storage/*` in its render
smoke with an in-memory route (same size and type rules, no callback).

## Secrets in server code

Bind an approved Secrets Manager ARN in `secretBindings: [{ "name": "crmApiKey",
"env": "CRM_API_KEY_SECRET_ARN", "secretArn": "<arn>" }]` (list approved
references with `platform_list_build_secrets`; an empty list means none is
approved for this build yet, so ask for one with `platform_request_build_secret`;
see [Getting a key](security-and-runtime-boundaries.md#getting-a-key)). Read the value at runtime
only, never at build time:

- Node: the platform installs a global; no import is needed.
  `const key = await globalThis.platformSecrets.get("crmApiKey");`
  (`globalThis.platformSecrets.bindings()` returns the bindings as `[{ name, env }]`; read `.name` for the bound names).
- Python: `from platform_artifact_secrets import get_secret` then
  `get_secret("crmApiKey")`.

Both cache the value per function instance. Never return it to the browser or
write it to a log.

### Calling `/api/v1/pestroutes/connections` with an app key

To add or manage a PestRoutes account from the app (the External API guide's
"PestRoutes connections" section has the full contract), bind the Topline app
key (`tlk_...`, `pestroutes:connect` scope) as a secret and call Topline from
**server code only**. The API origin arrives as the `x-platform-api-origin`
request header, which the platform sends to apps with `"serverTables": true`.

```js
const origin = req.headers["x-platform-api-origin"];
const key = await globalThis.platformSecrets.get("toplineAppKey");
const res = await fetch(new URL("/api/v1/pestroutes/connections", origin), {
  method: "POST",
  headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ apiUrl, apiKey, apiToken, groupName, label })
});
```

`validate-local` accepts a quoted path starting `/api/v1/pestroutes/connections`
only when the app has `secretBindings`, and, in an app with parts, only inside
a server part; a website part naming it is refused. Never send an `Origin`
header (Topline answers 403) or pass the key or the PestRoutes keys to the browser.

## Python server parts

A Python part runs an ASGI app (FastAPI) behind Lambda through `mangum`.
`requirements.txt` must list `mangum`; without it every route answers 500
`No module named 'mangum'`. If you pin `boto3`, use **1.40 or newer** (with a
matching `botocore`): older pins shadow the runtime's copy and break the
platform's helpers (`TypeError: Got unexpected keyword argument
'auth_scheme_preference'`).

```text
fastapi>=0.115,<1
mangum>=0.19,<1
boto3>=1.40,<2
```

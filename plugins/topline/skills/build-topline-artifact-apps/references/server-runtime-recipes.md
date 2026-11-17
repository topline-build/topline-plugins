# Server Runtime Recipes

Copyable server-side contracts for an app's own code: company-table system
columns, server table SQL, managed file storage, uploads, secrets and Python
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
- Drafts use the same files as live. Use a separate binding name for
  draft-only data. No CORS is configured on the bucket, so browsers can't PUT
  to it directly.

## Uploads and downloads through the app

The proxy refuses a request body over 5,000,000 bytes with 413
`artifact_app_proxy_body_too_large`, but a **binary body over about 4.7 MB
fails earlier with a bare 502**, because the body is base64-encoded on its way
to the function. Keep every request body at or under **4 MB**. App responses
have the same ceiling: hand the viewer a short-lived presigned GET (it works in
`<img>`, `<iframe>` and download links) for anything larger, after your code
has checked the viewer may see that file.

Chunked upload recipe for larger files (tested with a 9 MB file in 3 MB parts):

1. Browser: slice the `File` into 3 MB pieces and `PUT` each, in order, to
   `./_artifact/api/uploads/<uploadId>/parts/<n>` with
   `Content-Type: application/octet-stream` (`uploadId` from
   `crypto.randomUUID()`).
2. Server: check the viewer, then write each body to
   `prefix + "uploads/<uploadId>/part-<n>"`.
3. Browser: `POST ./_artifact/api/uploads/<uploadId>/complete` with the part
   count, file name and type.
4. Server: read the parts in order, concatenate, `PutObject` the final key,
   delete the parts, and record the key (and its owner) in a table. Cap the
   total size (for example 25 MB) so it fits the function's memory.

S3 multipart upload doesn't help here: every part but the last must be at
least 5 MiB, which is above what one proxied request can carry.

## Secrets in server code

Bind an approved Secrets Manager ARN in `secretBindings: [{ "name": "crmApiKey",
"env": "CRM_API_KEY_SECRET_ARN", "secretArn": "<arn>" }]` (list approved
references with `platform_list_build_secrets`; an empty list means none is
approved for this build yet, so ask the person). Read the value at runtime
only, never at build time:

- Node: the platform installs a global; no import is needed.
  `const key = await globalThis.platformSecrets.get("crmApiKey");`
  (`globalThis.platformSecrets.bindings()` lists the bound names).
- Python: `from platform_artifact_secrets import get_secret` then
  `get_secret("crmApiKey")`.

Both cache the value per function instance. Never return it to the browser or
write it to a log.

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

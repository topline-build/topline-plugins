# Table approvals app

## Example user request

"Give the team a time-off request app: people submit requests and see their
own, and managers approve or reject them with a note."

## Fit and starting point

This is the golden example for requests, approvals and other workflow apps
whose rules decide who may change what. The data lives in company tables, and
every read and write runs in the app's own server code through server table
SQL. With the Build MCP, start from `platform_init_artifact_app` with
`starter: "table-approvals-app"`: it scaffolds a dependency-free Node app with
a request form, "My requests", an approver queue and the `tablesSql()`
helper. In a Topline coding task, start from
`scripts/artifacts/templates/table-editor` and move its writes into server
code the same way.

## Topology and contract decisions

- The manifest sets `serverTables: true` and declares **no** `tables[]`. A
  `tables[]` binding would be a browser route every viewer can call, listing
  every row's `_row_id`, `_version` and readable columns regardless of what
  the server code filters. Server SQL needs no binding.
- The server reads the viewer from the `x-platform-viewer-email` header,
  filters "My requests" by it, and passes it as `actingUser` so the row
  history names the person.
- Topline has no platform roles or groups. Approvers are an app role: follow
  [App roles](../app-roles/EXAMPLE.md) for the `<app_slug>_roles` table, the
  server check on every decision, `./_artifact/api/me`, and the "People and
  roles" page where managers (and always the app's editors) add approvers.
  The starter's `approval_approvers` table is an older shape of the same
  idea; move it to the roles table when you build on the starter.
- A decision is an optimistic update: `where _row_id = :id and _version =
  :version and status = 'pending'`. When `rowCount` is 0 the server re-reads
  the row and answers 409 (someone else decided first), 403 (your own
  request) or 404.
- `viewerPolicy: "private"`. There is no anonymous form here; see
  [Replace a spreadsheet](../replace-a-spreadsheet/EXAMPLE.md) for the limits
  of public forms.
- Apps can't send email, Slack or in-app notifications yet. Approvers see
  their queue when they open the app; say so in the handoff.

## Create the tables

Run each statement with `platform_run_artifact_workspace_sql`
(`scope: "company"`) or, in a coding task, the workspace SQL tool. Company
tables need `documentation` with a description and a sensitivity for every
column. Rename the tables to fit the request, then update `REQUESTS` and
`APPROVERS` in `src/index.js`.

```sql
create table company_data.approval_requests (
  requester_email text not null,
  title text not null,
  details text,
  status text not null default 'pending',
  decided_by text,
  decided_at timestamptz,
  decision_note text
)
```

```sql
create table company_data.approval_approvers (
  email text not null,
  active boolean not null default true
)
```

Don't seed approvers by hand: with the [App roles](../app-roles/EXAMPLE.md)
pattern, an editor of the app adds them on the "People and roles" page. The platform adds the system columns
(`_row_id`, `_version`, `_created_at`, ...; there is no `_id`) to both tables;
see [Server runtime recipes](../../references/server-runtime-recipes.md#company-table-system-columns).

## Manifest explanation

See [artifact-app.json](artifact-app.json). `routes[]` lists the page and the
two app routes (`/_artifact/api/requests` for GET and POST,
`/_artifact/api/decisions` for POST). `serverTables: true` is the only table
setting. Add `previewWrites: true` only if the person wants to try submit and
decide on the draft, and say that a draft write changes real rows.

## Implementation pattern

- Server SQL values come back as strings: `_version` is `"3"`, timestamps are
  Postgres text. The starter formats `created_at` in SQL with `to_char` and
  converts the version with `Number()`.
- Add request fields (dates, amounts, a category) as columns, form inputs and
  `:name` parameters on the insert. Cast typed values in SQL
  (`CAST(:startDate AS date)`).
- Before the tables exist, or where server table access is unavailable, the
  GET route answers 200 with `{ ready: false, reason }` and the page says what
  is missing, so a fresh deploy's smoke stays healthy.
- Keep each request body small; for receipts or other files, add a storage
  binding and the chunked-upload recipe in the
  [Server runtime recipes](../../references/server-runtime-recipes.md#uploads-and-downloads-through-the-app).

## Validation and controls

- `npm test` runs the starter's rule checks against an in-memory table; they
  are scaffold checks. Replace them with checks of your own rules (who may
  decide, required notes, conflicts).
- On the draft without `previewWrites`, submit and decide answer 403
  `draft_is_read_only`; reading works. Check the full flow on the live app
  after a person publishes it, with one requester and one approver.
- The rendered smoke and reviewer read the page as it first loads: keep the
  brief's headings ("My requests", "Waiting for your decision") word for word.

## Limitations

- No notifications, no platform roles (roles are app-owned; see
  [App roles](../app-roles/EXAMPLE.md)), no isolated draft data.
- A second identity can't be simulated on a draft; test the requester-only
  view on the live app.

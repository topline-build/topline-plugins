# Replace a spreadsheet

## Example user request

"Replace our client tracker sheet with an app the team edits."

## Fit and template

This is the golden example for editable records: a Google Sheet (or task
spreadsheet) that a team edits by hand becomes an app backed by company
tables. Start from `scripts/artifacts/templates/table-editor`. `/` is a
list-and-edit page; there is no separate operational surface.

## Topology and contract decisions

- Records people add or edit in Topline belong in tables, not an
  artifact's own storage; never `DATABASE_URL` or direct Postgres access.
  This example's editor is browser-first: declare the table in manifest
  `tables[]`, and every list, read, insert, update, soft delete and restore
  goes through the platform's routes at
  `/_artifact/tables/<alias>[/<rowId>[/restore]]`.
- When the app's own logic should decide a write (a workflow rule, an
  approval, a public form), do it in the app's server code instead: set
  `serverTables: true` in the manifest, read the `x-platform-tables-token`
  and `x-platform-tables-sql-url` request headers, and POST
  `{ sql, params, actingUser }` to that URL with
  the token as a Bearer `Authorization` header. Keep the token on the server. It runs as
  the app, under the same table rules as builder SQL; `actingUser` names the
  person the write is for in the row history. The app decides who may change
  what. A draft may only SELECT there unless the manifest sets
  `previewWrites: true`; a sandbox preview gets no token, so try server SQL
  on a draft deploy instead.
- A binding's `writeAccess` is `members` by default; set `signed_in` to also
  admit, on the live app, Topline users the app is shared with directly.
- Platform table-route writes are accepted only on the `live` environment, only on an
  origin that serves exactly one app (the deployed app subdomain or a bound
  custom domain). A draft, a version preview, the shared `/artifacts/<id>/live`
  path, a View-as lens, and a viewer-token or restricted-link visit are all
  read-only for tables; a write there is refused, not retried.
- `viewerPolicy: "private"` by default: public-link visitors never use table
  routes, so a write-declaring app does not rely on a public link for the
  people who edit records.
- Deploying assigns the app its own subdomain; that's the origin table
  writes must come from once the app is live.

## Import

The import tools are for Topline coding tasks only. An external builder
(Build MCP) has no import tool: ask the person to run the import from a
Topline chat or task, then declare the table it creates. Never copy sheet
rows through table SQL or ask for sheet contents. Credential-looking
columns are flagged, not dropped: explain the risk, offer to leave the column
out or keep the value as a Topline secret, and import it only if the person
chooses to.

1. Call `inspect_table_import` with the sheet's `spreadsheetId` (or the task
   asset's `assetId`). Reads happen as this workspace's own Google identity,
   never a credential the sheet owner supplied. Per kept tab it reports rows,
   header row, inferred column types, `credentialColumns` (flagged for the
   person to decide; an imported one is stored as sensitive), and a few sample rows with credential and
   long cells withheld. No cell value from the sheet passes through this
   conversation or appears in a task event or log. On `sheet_not_shared`,
   ask the person to share the sheet as Viewer with this workspace's Google
   reader identity, or to attach the workbook as an .xlsx or .csv and import
   it by `assetId`; on `sheets_own_identity_required`, ask for the workbook.
   Neither is a platform blocker.
2. Plan one table per tab you are keeping. In the plan's
   `columns[].source`, use each column's source exactly as
   `inspect_table_import` reports it, including `column_<n>` for a blank or
   credential-looking header it renamed — never the sheet's own header text,
   which the import refuses if it doesn't match.
3. Call `import_tables` with the source, the plan, and a fresh
   `idempotencyKey`. This is a one-time copy: a cell that fails to convert is
   stored empty and reported by row and column, and a completed tab's table is
   not re-imported. After a partial failure, retry with the same
   `idempotencyKey`, or drop the finished tabs from the plan and
   `delete_table` an empty table to import it again.
4. `import_tables` returns each table's `logicalName` and
   `relation` (`company_data.<name>`, for example `company_data.clients`);
   use the logical name in `tables[]` and the `relation` in dataset SQL.

## Manifest explanation

- `tables[]` declares one binding per table the app uses: `alias`
  (what the app's own routes and code call it), `table` (the table's
  logical name), `operations` (here `list`, `get`, `insert`, `update`,
  `delete`, `restore`), `readableColumns`, and `writableColumns` (required
  because the binding declares a write operation). Table routes never appear
  in `routes[]` — the platform serves `/_artifact/tables/<alias>...` itself.
- The `client-status-summary` dataset is declared both in `datasets[]`
  (`mode: "live"`, a bounded aggregate `sql`, `cacheTtlSeconds`) and as a
  matching entry in `routes[]`, the same as any other live dataset. It reads
  `company_data.clients`, the `relation` the import returns (Import step 4). A
  precomputed dataset may not read tables; use a live one.
- There are no `secretBindings`: nothing here calls an external system.

## Implementation pattern

Browser code builds every table URL relative to the document base, never a
root-absolute path:

```js
const url = new URL('_artifact/tables/clients', document.baseURI);
```

The served page carries the write token in `<meta name="topline-table-token">`;
read it once and send it back as the `x-topline-table-token` header on every
write, along with `Content-Type: application/json` (a write without it gets
415 `json_content_type_required`).

- **List**: `GET` the table URL with `f.<column>.contains=<text>` for a
  search box, `sort=<column>` or `sort=-<column>` (descending) for a column
  header, and `limit`/`cursor` for paging. Render `rows[]` and keep `nextCursor` for the next page.
- **Inline edit**: `PATCH` the row URL with `{ expectedVersion, values }`,
  where `expectedVersion` is the row's own numeric `_version`. A successful
  write returns the updated row; a stale edit gets 409 `row_version_conflict`
  with the current `row` in the body — show the person both versions and let
  them keep their edit (retry with the new `_version`) or take the saved one.
- **Add**: `POST` the table URL with a JSON object of the new row's
  writable columns, such as `{ "name": "Acme" }` (no `values` wrapper; only
  an inline edit nests them); a success returns 201 with the created row.
- **Soft delete**: `DELETE` the row URL with `?expectedVersion=<n>`. Deletes
  are soft: the row keeps existing with `_deleted_at` set, and a write to an
  already-deleted row gets 409 `row_deleted` with the current `row` — tell
  the person someone else removed it, rather than showing a generic failure.
- **Restore**: `POST` the row URL's `/restore` path (no body) with the same
  JSON content type and token header as every write, to undo a soft delete.
  It takes no version: restoring a row that is not deleted succeeds and
  changes nothing, and 409 `row_version_conflict` happens only when someone
  deletes the row again at the same moment.
- Any 2xx is success; treat every other status as a failure and show the
  reported error code, not raw response text.

## Validation and controls

- Before deploying, check every declared write with `test_table_writes`
  using representative sample values for each writable column — never by
  writing rows into the real table. The check copies the table's structure
  and triggers into a temporary table, runs insert, update, a stale update,
  soft delete and restore, and always rolls back; it does not check
  uniqueness against the real table's existing rows.
- Draft smoke is read-only: a draft or version preview never exercises an
  insert, update, delete or restore against the real table.
- After the operator promotes the app, have a member open the live app,
  add or edit a row, and reload to confirm the save is visible to everyone
  with access — not just the browser tab that made it.

## Limitations and graduation boundary

- There is no sync back to the sheet; once imported, the sheet is not the
  source of truth and further edits to it do not reach the table.
- Changing a table's shape is table SQL (builder SQL or the app's server
  table SQL), not a manifest edit; the manifest's `readableColumns` and
  `writableColumns` only choose among a table's existing columns.
- Anonymous public-link visitors cannot use the platform table routes. A form
  that takes anonymous submissions writes through the app's server table SQL,
  where the app's own logic decides what to accept.
- Purging rows or deleting the table (`purge_table_rows`,
  `delete_table`) runs at once, with no confirmation step, and
  cannot be undone — say what you are about to remove before calling either.
- Saving app data through tables is not yet available on an account
  without the capability on; a deploy that declares `tables[]` there answers
  `capability_not_enabled` instead of succeeding.

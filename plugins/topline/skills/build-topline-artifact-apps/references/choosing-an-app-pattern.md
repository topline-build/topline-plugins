# Choosing an App Pattern

Start with the smallest blessed template that matches the delivery shape; copy
it, then change the manifest and source. Run local validation from the
repository root: `node scripts/artifacts/validate-local --dir <appDir>`.

| Situation | Start from | Data approach |
| --- | --- | --- |
| Landing page, simple website, or app without runtime data | `artifact-draft` | No dataset until one is actually needed. |
| Chart-heavy dashboard | `react-dashboard` | Add declared live datasets as needed. |
| Dashboard with joins, derived metrics, or multiple read-only relations | `multi-source-dashboard` | Bounded live SQL datasets; prototype with catalog tools and `run_psql`. |
| Private operational action surface | `internal-tool` | Keep private UI and any server work scoped to declared artifact routes. |
| Records people add or edit | `table-editor` | Manifest `tables[]` over tables; saves work only on the live app. See `examples/replace-a-spreadsheet/EXAMPLE.md`. |
| Private API-first tool | `python-api` | Declare `/_artifact/api/*`; keep viewer auth and external calls server-side. |
| Page that only reads platform routes, with no backend of its own | Static-only `parts` | One `static` part and no server part; no machine runs for it. See "One app, several parts". |
| Website or app with its own backend API (two parts, possibly two languages) | `web-and-api` | One artifact with `parts`: a static website part and a server API part, routed by path under one address. |
| MCP server exposed to Topline chat or Topline Coding Agent tasks | `fastmcp-server` | Exact FastMCP 3.4.7 lock, stateless JSON Streamable HTTP at `/_artifact/mcp`; connect and review after live promotion in Developer Access. |
| External webhook receiver | Platform service | Current artifact routing does not expose provider-verifiable machine ingress. |
| Customer API that must be synced on a schedule | Data Sources build, then its data pipeline artifact | Create a source, connection, connector runtime contract, materialized catalog resources, and a pipeline; with the workspace on it becomes a data pipeline artifact. Build an artifact app only as a downstream consumer. |
| A page for running a connector: its health, tables, schedules and runs | `connector-app` | Static-only page that reads the connector through manifest `pipelines[]` and `./_artifact/pipeline/<alias>`. Start it with `init-app --template connector-app --pipeline-artifact-id <connector artifact id>`. Read-only until the page actions route ships. Keep everything for the connector inside the page; never link to a Topline connector page. Needs Connector page apps turned on for the account. |
| Change which tables a connector syncs or when | Data pipeline artifact | Edit the `pipelineManifest` as a draft; a person publishes. See `examples/data-pipeline-artifact/EXAMPLE.md`. |
| Exact narrow count aggregate | `live-aggregate-dashboard` | `service_aggregate` binding with `aggregate.type: "count"` only. |
| A customer viewing only their own customer row | `viewer-scoped-dashboard` | Viewer binding with required session and `customers.email` filter. |

## One app, several parts

One app is always one artifact, even when it has a website and a separate
backend, or code in two languages. Declare `parts` in the manifest:

- A `static` part serves built files (`build.outputDir`) straight from storage.
  Set `spa: true` to send `index.html` for page navigations that match no file.
- A `server` part runs its own `entryPoint` (`language` node or python) on its
  own machine size (`resources` on the part, starting from the top-level ones).
- Each part's `build.command` runs in its own `dir`; the top-level `build` is
  optional and runs first, at the app root.
- Routes pick the part with `part`. Paths are exact or end in `/*`; the longest
  match wins, and unmatched paths go to the first static part. Platform routes
  (`/_artifact/data/*`, `/_artifact/knowledge/*`) are always served by Topline.
- Use relative asset URLs (`./app.js`) and hash routes (`#/reports`) so the
  same files work on the draft, live, and version addresses.

Up to four parts. `mcp_server` apps stay single-part.

An app can be **static parts only**: built files with no server of its own.
It deploys no machine, so it suits a page that only reads platform routes
(`/_artifact/data/*`, `/_artifact/tables/*`, `/_artifact/pipeline/*`,
`/_artifact/me`). A static-only app can't declare API routes, `serverTables`,
`previewWrites`, `secretWrites`, `secretBindings` or `storageBindings`; add a
server part when it needs any of them. Paths that match no file get 404, or
`index.html` for page navigations when `spa: true`.

## Data-pattern decision

Use a **live SQL dataset** for ordinary interactive reporting, joins, ratios,
averages, time series, and metrics that must reflect the source within the
declared TTL. It is the default for private dashboards.

Use a **source binding** only for its two narrow supported cases: viewer-scoped
customer rows or a count aggregate. Do not force a multi-table metric through a
binding.

Use a **precomputed dataset** when a report is dense or its bounded query is too
expensive for a request. It still exposes the same declared data route, but
reads platform-managed private JSON after warming. Declare `warmParams` for all
parameter variants that must be ready.

Use an **upstream materialized table or view** when the source-side preparation
itself needs a durable data product, shared reuse, or a cadence independent of
one app. This is artifact-adjacent/platform data work: make it available and
understood through the approved catalog/read-only path first, then have the app
query it as a bounded live dataset. Do not create or manage upstream
materialization from artifact runtime code.

Use a **Data Sources connector pipeline** when the customer is introducing a
new API or system that must be ingested repeatedly. The conversation drives the
build; the Data Source owns the connection, secrets, checkpoints and rows, and
with the Data Sources workspace on its data pipeline artifact owns which tables
sync on which schedule. Start with
`examples/customer-api-source-pipeline/EXAMPLE.md`, then
`examples/data-pipeline-artifact/EXAMPLE.md`.

## UI contract

For a live view, show the user an explicit last-updated/freshness state and
poll only at a cadence consistent with the TTL. Model empty, unavailable,
partial, stale, and error states; a local handler may return an empty response
or a clear error, never template/sample tenant rows that disguise a failed live
route.

Keep the package reproducible. The trusted builder provides the ordinary React
dashboard toolchain; do not commit or rely on `node_modules` in the app package.

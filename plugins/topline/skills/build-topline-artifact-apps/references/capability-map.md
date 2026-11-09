# Capability Map

Choose an artifact app when the deliverable is a hosted dashboard, website,
private tool, or interactive app with a versioned `artifact-app.json` manifest.
The current runtime target is `aws_lambda_function_url`; supported languages are
Node and Python.

| Need | Artifact-native path | Do not infer |
| --- | --- | --- |
| Page, asset, or private app API | Declare a route. API routes live under `/_artifact/*`; use relative browser fetches such as `./_artifact/data/summary`. | Global `/api/*` access or root-absolute `/_artifact/*` fetches. |
| Read-only reporting or derived metrics | Declare bounded live SQL in `datasets[]`, with a matching `/_artifact/data/<name>` API route. | A database URL or direct database connection in runtime/browser code. |
| Multi-select filter on a dataset | Declare the parameter with `type: "array"` and homogeneous `string`, `integer`, `number`, or `boolean` items; the browser sends one query parameter holding a JSON array (`params.set("officeIds", JSON.stringify([12, 34]))`) and SQL uses it as a typed array, for example `office_id = ANY(:officeIds)`; cast string items for other column types, such as `id = ANY(:ids::uuid[])`, and cast before array functions so an empty selection keeps a type (`cardinality(:officeIds::int[]) = 0 OR office_id = ANY(:officeIds)`). Item `pattern` is not supported; use `enum` or length bounds. At most 100 items and 8 KiB per parameter; empty arrays are allowed unless `minItems` forbids them. | Repeating a query parameter name, comma-joined strings, string-building SQL, or nested/object items. |
| Editable records people save from an app | Tables declared in manifest `tables[]`, read and saved through relative `./_artifact/tables/<alias>` routes; import an existing sheet with `inspect_table_import` and `import_tables` (Topline coding tasks only; an external builder asks the person to run the import from a Topline chat or task, and never copies sheet rows through SQL); live datasets read the same tables. App server code may run table SQL as the app with manifest `serverTables: true` and a POST to the URL in the `x-platform-tables-sql-url` request header (see [Replace a spreadsheet](../examples/replace-a-spreadsheet/EXAMPLE.md)). Needs tables enabled for the account; otherwise company tools and `tables[]` deploys answer `capability_not_enabled`. | Artifact workspace tables while tables are on, a database URL or Postgres connection from the app's Lambda, browser storage, SQL from browser code, or draft writes without `previewWrites: true`. Browser `./_artifact/tables/*` writes are live-only, and a draft with `previewWrites: true` changes real rows: there is no isolated preview data yet. |
| A person's attached or library file in a coding task | `materialize_assets` copies the original bytes into the task workspace (Topline Coding Agent: `.topline/sources/library/`) for every accepted file, up to 25 MiB each and 50 per call. Use `read_asset` when only the text of a PDF, DOCX, XLSX, CSV or text file is needed. | Asking for a smaller file, pasting file contents through chat, or reading a PDF's bytes as text. |
| Narrow source count | Use a live `sourceBinding` with `access: "service_aggregate"` and `aggregate.type: "count"`. | Sum, average, joins, ratios, or custom aggregates through this binding. |
| Per-viewer customer rows | Use the `viewer` source-binding path. It requires a session and is currently limited to `resource: "customers"`, `emailField: "email"`. | General row-level authorization for arbitrary sources. |
| Third-party API | Use a declared Secrets Manager ARN and a server-side artifact route. | Browser credentials, ordinary env-var secrets, or direct vendor calls from the browser. |
| Durable files and general S3 object operations | Declare `storageBindings[]` with a name and `read` or `read_write` access. Use the standard AWS SDK server-side with bucket/prefix/region from `ARTIFACT_STORAGE_BINDINGS` and workload IAM. See the template guide's managed S3 section. Server-side SDK access is not browser-transfer readiness: no CORS is provisioned, so keep uploads and downloads within the app proxy's 5,000,000-byte body limit or hand the viewer a presigned read link. Drafts use the same binding as live, so a draft test touches live files, and dev sandboxes refuse storage bindings. | Caller-selected buckets, bucket administration, browser credentials, automatic CORS changes, direct browser PUTs to S3, isolated preview files, or per-viewer file authorization from an app-wide binding. |
| Save a credential from a form | To save credentials from a form, declare `secretWrites` and `PUT` to `./_artifact/secrets/<prefix><name>` from the page; never send secrets through your own server code. | Collecting a credential's value in server code, or an app overwriting or deleting a secret it did not create. |
| Simple LLM turn | Private server-side `/_artifact/api/*` route plus one bounded Bedrock `Converse` call. | Agent loops, tools, memory, streaming, history, or a caller-supplied model/API key. |
| Published customer documents | For a normal app, declare an exact `knowledgeBases[]` binding and read it through relative `./_artifact/knowledge/<alias>` list, search, and fetch routes. | Company Knowledge, a source binding, direct `/knowledge/*` delivery, a Knowledge Base bearer, provider/storage identifiers, draft content, or Knowledge Bases in a hosted MCP artifact. |
| MCP tools for Topline chat or Topline Coding Agent tasks | `kind: "mcp_server"` from `fastmcp-server`, with the one canonical `/_artifact/mcp` route. | A credential in artifact source, direct self-connection, self-approval, or bypass of Developer Access tool review. |
| Large or expensive report | A `precomputed` dataset backed by private tenant-scoped object storage and an enabled `refresh_live_cache` schedule. | Direct object URLs or a slow fallback query before the first successful warm. |
| New customer API ingestion | Data Sources build using the shared REST connector when it fits, otherwise a custom platform connector. With the Data Sources workspace on, the source becomes a data pipeline artifact when scheduled. | An artifact app that owns a credential, checkpoint, scheduler, or ETL loop. |
| Which tables sync and when | The source's data pipeline artifact: edit its `pipelineManifest` as a draft (`save_pipeline_artifact_draft`); a person publishes. | Changing scheduler jobs directly, or publishing, pausing or resuming from a coding task. |

## Artifact-native versus adjacent work

Artifact apps own their package, manifest, declared routes, UI, bounded
read-only datasets, runtime API code, and manifest-declared refresh contract.
They can use platform-provided viewer/session, data-query, secret-reference,
object-storage, and Bedrock capabilities only through those declarations.

Artifact-adjacent work is required when the source is not already available to
the approved read-only tools: connector onboarding, source synchronization,
catalog exposure, and upstream data quality/freshness. Stop with a data blocker
instead of adding a credential, unbounded query, or unsupported network path to
the app.

For a new customer API, this adjacent work is itself a first-class Data Sources
workflow: source and connection intake, secret-reference capture, table
approval, bounded sample sync, connector-owned materialization, catalog
registration, and a normal scheduled pipeline. With the Data Sources workspace
on, that source is represented by one data pipeline artifact whose
`pipelineManifest` names its tables and schedules; the platform objects above
stay the system of record for credentials, checkpoints, rows and runs. Any
other saved artifact may hold the human-readable build brief, but it cannot
substitute for those durable objects.

Platform-service work is outside the app package: IAM, Lambda/runtime
provisioning, database/source credentials, secret creation, raw scheduler jobs,
bucket administration, direct cloud deploys, and live promotion. Apps may use
the SDK to presign their own bound objects after viewer authorization; public
bucket access is not required. An app can
declare what it needs; it does not grant itself those platform capabilities.

## App shape

Pick the manifest `kind` that matches the result: `dashboard`, `mini_page`,
`briefing`, `table`, `tool`, or the app-only `mcp_server`. Every v2 manifest declares its
runtime, build, validation commands, routes, source bindings (possibly empty),
environment names, and `viewerPolicy` (`private` or `tenant`). Datasets and
refresh schedules are optional only when the app does not need them.

Use the manifest as the boundary: each dataset name contains only letters,
numbers, underscores, or hyphens and maps exactly to
`/_artifact/data/<name>`; each route is declared once. Set maximum rows, bytes,
timeout, and rate/cache settings appropriate to the displayed result rather
than treating the app as a general query client.

`mcp_server` is the deliberate exception to the ordinary artifact data shape:
its `sourceBindings`, `datasets`, and `refreshSchedules` must be empty. Its
machine credential authorizes only the exact live MCP route, not a callback to
artifact data routes. Use approved `secretBindings` for server-side external
APIs or move Topline-owned data and recurring work behind a reviewed platform
service.

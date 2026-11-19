# Example Catalog

Use these names as routing examples, not as promises of a new platform
capability. Each starts from the smallest current template and follows the
draft-only lifecycle in `validation-and-lifecycle.md`.

| Golden example | Route to | Core boundary |
| --- | --- | --- |
| `worked-walkthrough` | `python-api` | End-to-end application of every skill step to one request; also the minimal single-Converse-call reference. |
| `live-operations-dashboard` | `multi-source-dashboard` + live SQL datasets | Bounded joins/metrics and visible TTL freshness. |
| `viewer-scoped-customer-portal` | `viewer-scoped-dashboard` | Signed-in viewer; currently only `customers.email` row filtering. |
| `internal-action-tool` | `internal-tool` | Private tool whose external API owns the decision; records people edit go in tables. |
| `private-api-first-app` | `python-api` | Private `/_artifact/api/*` routes and server-side integrations. |
| `replace-a-spreadsheet` | `table-editor` + manifest `tables[]` | One-time import into tables with credential columns left out; platform-served row saves on the live app only; conflicts surface as 409. |
| `table-approvals-app` | Build MCP starter `table-approvals-app` (coding task: `table-editor`) + `serverTables` | Requests and approvals decided in the app's server code over company tables; an app-owned approvers table; no `tables[]` browser route; drafts read-only unless `previewWrites`. |
| `public-form-private-board` | Build MCP starter `table-approvals-app` + `serverTables` + public routes | A public quote form and its api route (`audience: "public"`) write leads through server table SQL; the pipeline board stays private; Turnstile, duplicate checks, iframe embed. |
| `app-roles` | Any app with approvers, reps, agents or other roles (usually on `table-approvals-app`) | App-owned `<app_slug>_roles` company table checked in server code from the viewer header; owners and editors always manage roles on a "People and roles" page; no shared or browser-writable roles table. |
| `file-uploads` | `artifact-draft`, `internal-tool` or `react-dashboard` (vendored `artifact-uploads.js`) + storage binding `uploads` | Files go straight to storage under platform-chosen keys; the platform checks size, type and checksum before the declared `onComplete` route hears about a file; per-viewer access and share links come from the platform, never self-presigned links or file bodies through app routes. |
| `customer-scoped-map` | Platform-service-backed UI | MapLibre browser surface over a tenant-authenticated, customer-account Amazon Location Maps and Places broker; no browser credentials or implicit location writes. |
| FastMCP server | `fastmcp-server` | Live-only exact MCP ingress, platform-owned credential, and customer-managed tool review for chat/coding. |
| `notify-via-slack-or-email` | `python-api` + a requested key | Alerts through the customer's own Slack webhook or email provider; the key arrives through `platform_request_build_secret`, sends happen in server routes or schedules only, and a failed send is visible app state. |
| `bounded-bedrock-assistant` | `python-api` | Private route, one bounded Bedrock Converse call, no agentic extras. |
| `knowledge-base-backed-app` | `react-dashboard` + an exact published Knowledge Base grant | Normal artifact reads one approved live release through relative `/_artifact/knowledge/*` broker routes; no token, provider ID, or direct public endpoint. |
| `webhook-receiver` | Node server + `serverTables` + a webhook route | A public `api` route with a `webhook` block: provider headers pass, Topline checks the HMAC signature before the handler, a unique delivery ID dedupes, 2xx quickly, signed local samples, the URL handed to the person after publish. |
| `signed-webhook-boundary` | Points to `webhook-receiver` | What still needs a platform service: queueing, replay, non-HMAC signature schemes, MCP server apps. |
| `cache-warmed-multi-source-dashboard` | `multi-source-dashboard` + live dataset | Explicit recurring `refresh_live_cache`, Redis preflight (not where `families.redis` is `not_supported`), live fallback, and visible `generatedAt`. |
| `precomputed-s3-report` | `artifact-draft` or `react-dashboard` + precomputed dataset | Platform-managed private object storage through declared routes; never expose object URLs. |
| `materialized-sql-data-product` | `multi-source-dashboard` after upstream work | Upstream materialized table/view is separately owned and cataloged; app performs bounded read-only access. |
| `customer-api-source-pipeline` | Data Sources build + `platform.connector.rest.v1` | The operational connector, credentials, checkpoints and tables are first-class Data Source objects; with the workspace on, scheduling it creates its data pipeline artifact. |
| `data-pipeline-artifact` | Built-in data pipeline artifact (no template) | One artifact per connector instance: tables and named schedules (including PestRoutes hard-delete schedules) in a `pipelineManifest`; the coder saves drafts, a person publishes. |

Template choice may change if the visual surface changes, but the stated
security and data boundary must not. In particular, do not use the aggregate
template for multi-source math, use a precompute schedule merely as a cache
warmer, or put a webhook on a viewer-authenticated route.

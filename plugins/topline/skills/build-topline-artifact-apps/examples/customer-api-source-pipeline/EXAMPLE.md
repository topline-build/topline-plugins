# Customer API Source Pipeline

Use this specimen when a customer says, "We have an API; keep its customers
and work orders synced for dashboards." This is deliberately a boundary
example: the recurring sync is a first-class Data Source, not an artifact app.
With the Data Sources workspace on, the source becomes a **data pipeline
artifact** (a built-in artifact type, not an app) when its first schedule is
created; later table and schedule changes follow
[Data pipeline artifact](../data-pipeline-artifact/EXAMPLE.md).

Start and complete this workflow in chat. **Custom** in Add data source opens
a focused Topline chat; no special mode or agent is needed. Ask for the customer's
business goal, provider documentation/access, data scope, and refresh needs;
derive the technical connector details from documentation and bounded discovery.
Use secure credential and table approval cards. Do not require a generic API
setup form or a customer-authored manifest. The harness owns implementation;
Data Sources owns progress, freshness, and recovery after the build starts.

## Product ownership

| Concern | Owner |
| --- | --- |
| API identity, documentation, and connection | Data Source |
| Credentials and resource checkpoints | Tenant secret references and connector config on the source connection |
| Build phase, blocker, and next action | Durable `data_source_builds` record |
| Run now, retry, and recurring execution | Pipeline targeting `sync-generic-rest` |
| Materialized rows, schema, row count, and freshness | Source catalog and connector-owned SQL tables |
| Operational status and recovery | Data Sources UI, or the source's data pipeline artifact when the workspace is on |
| Which tables sync on which named schedule (workspace on) | The data pipeline artifact's `pipelineManifest`; drafts change nothing live until a person publishes |
| Optional dashboard or tool using the synced data | A separate artifact app |

A workspace document or saved artifact may preserve the customer's request,
API notes, table proposal, and review evidence. It is not the operational
connector and must not own the secret, scheduler, checkpoint, or materialized
tables. The data pipeline artifact is the one exception to "not an artifact":
it references the source and names its tables and schedules, while the
platform still owns the secret, checkpoint, handler, tables and jobs. After the build starts, link that document to the source/build instead
of treating it as the system of record.

## Choose the runtime before building

Use the shared `platform.connector.rest.v1` path only when all of these are
true:

- the API is read-only HTTPS JSON;
- authentication is none, bearer, or one secret header;
- every resource has stable primitive primary-key fields;
- pagination is none, offset, page, or same-origin next URL and can resume at a
  page boundary;
- a bounded GET can discover and sample the schema.

Stop and design a custom platform connector for OAuth refresh, signed requests,
asynchronous reports, webhooks, writes, or pagination that cannot resume
safely. Dynamic `updated_since` windows, provider-specific backfills, large
authoritative snapshots, and tombstone semantics are also outside the generic
contract. The current chat builder is end-to-end executable only for an
explicit valid `platform.connector.rest.v1` manifest; custom runtime generation,
deployment, and scheduling require separate platform implementation. Do not
move those requirements into an artifact server route or record a custom build
as ready from metadata alone.

## Ground the provider contract

Before changing `connector-manifest.json`, verify the current provider docs,
base origin, auth header, endpoint paths, response envelopes, primary keys,
pagination, timestamp semantics, rate limits, and whether a completed read is a
full snapshot. The included origin and paths are placeholders; replace them
with verified provider values. Use `syncMode: "snapshot"` only when a complete
read represents the full current dataset. Otherwise retain incremental upserts.

For this specimen the approved table proposal is:

| Resource | Grain | Key | Cursor | Target |
| --- | --- | --- | --- | --- |
| `customers` | one customer account | `id` | absolute offset | connector-owned customer relation |
| `work_orders` | one work order | `id` | absolute offset | connector-owned work-order relation |

Record discovered columns, relationships, sensitivity, and any provider-side
created/updated timestamps in the proposal before approval.

The example manifest deliberately chooses 100-row offset pages, a 20-page
per-read ceiling, stable `id` keys, source-created/source-updated mappings, and
incremental upserts for both resources. Verify those choices against the
provider. New top-level fields materialize additively as JSONB and default to
operational sensitivity; incompatible type changes remain visible in `_raw`.
HTTP 408, 429, and 5xx failures receive at most one delayed queue retry, after
which the next schedule or a manual recovery run is responsible for progress.

## Execute the build

Use the chat-native data-source tools in this order. Preserve the returned
`buildId`, `sourceId`, and `connectionId`; never invent IDs.

An adapted intake begins with values shaped like:

```json
{
  "displayName": "Acme Service API",
  "sourceType": "external_api",
  "docsUrl": "https://docs.provider.example/api",
  "authType": "other",
  "selectedTables": [
    { "name": "customers", "primaryKey": ["id"] },
    { "name": "work_orders", "primaryKey": ["id"] }
  ],
  "schedule": {
    "cron": "0 * * * *",
    "timezone": "America/Denver"
  }
}
```

Replace the placeholder documentation URL and confirm the auth connection kind
before invoking `start_data_source_build`.

1. Call `start_data_source_build` with `sourceType: "external_api"`, the
   provider documentation URL, the correct auth type, the requested resources,
   and the requested schedule. This creates the durable build plus draft source
   and connection.
2. Call `attach_data_source_docs` for any OpenAPI, Postman, cURL, or verified
   documentation references not supplied at intake.
3. For this protected single-header specimen, start with `authType: "other"`,
   then call `request_data_source_auth` with the returned `connectionId` and a
   `token` slot. The masked operator card must return the connection secret ref
   under `token` because the manifest uses `secretKey: "token"`. Then call
   `verify_data_source_auth` with that reference; never put the credential value
   in chat, the manifest, or an artifact. This verification step records refs
   only; the sample sync is the first deployed-path provider/auth proof.
   The connection kind must allow the manifest's exact secret slot (`token` in
   this specimen). Public APIs use `authType: "none"` and skip this step.
4. Perform bounded discovery, then call `propose_data_source_tables` with the
   observed columns, stable keys, cursor strategy, sensitivity, target names,
   and relationships. Call `approve_data_source_tables` and wait for explicit
   approval before runtime generation.
5. Adapt `connector-manifest.json` to the verified API. The manifest's
   `secretKey` must exactly match the connection secret slot. Call
   `start_pipeline_runtime_build` with the `buildId`, the manifest, and
   `verifyOnly: true`. Topline runs it against the live API with the credential
   stored on the connection and returns evidence (row counts, field types,
   timestamp coverage, and an incremental filter probe) plus warnings, never
   source rows. It saves nothing. Fix the warnings and repeat until it is clean.
   A syntactically valid placeholder manifest is not live proof.
6. Call `start_pipeline_runtime_build` with the approved `buildId` and verified
   manifest. The platform writes the contract to the source connection, keeps
   existing checkpoints only when the manifest is unchanged, and selects the
   shared `sync-generic-rest` worker. It does not deploy a per-provider service.
7. Call `run_pipeline_sample_sync` with a bounded `maxRecords` such as 25. This
   must perform the actual read and materialization, and report resource row
   counts and output fields. Fix auth, keys, pagination, or schema before moving
   on; do not substitute a hand-written success result for a declarative REST
   connector. The sample is provider/auth/schema evidence, not initial-load
   completion.
8. Call `run_pipeline_initial_load` in bounded batches. Each call persists one
   resource slice and resumes from the connection's stored checkpoint. Continue
   until every approved resource reports `hasMore: false`. Never call a partial
   batch a completed initial load. Resources commit independently, so a later
   resource failure can leave an earlier resource fresher; surface that partial
   state.
9. Call `register_source_catalog` after the initial load succeeds. Physical resource
   catalog entries are created by materialization; this step records the
   approved dashboard-facing resource set on the source/build.
10. If recurring freshness was requested, call `schedule_pipeline_refresh` with
   the approved cron and IANA timezone. Success must return a pipeline ID and an
   enabled schedule whose scheduler status is active and whose handler is
   `sync-generic-rest`. With the Data Sources workspace on, this also creates
   the source's data pipeline artifact and returns `pipelineArtifactId`. Later
   cadence or table-to-schedule changes go through that artifact with
   `read_pipeline_artifact` and `save_pipeline_artifact_draft`;
   `schedule_pipeline_refresh` refuses them with `pipeline_artifact_owned`.
11. Call `mark_data_source_build_ready` only after runtime generation, the
    complete initial load, catalog registration, an active linked pipeline, and
    any requested schedule are complete. The transition rechecks live
    tenant-scoped catalog, pipeline, handler, target-table, and scheduler state;
    a build summary ID alone is not readiness evidence.

The resulting materialized tables contain `_record_key`, `_raw`,
`date_inserted`, `date_updated`, and optional mapped source timestamps. Cursor
advancement and materialization commit together. A stale overlapping run is
rejected before it can overwrite the current checkpoint, partial payloads
merge, and a truncated snapshot read never deletes missing rows.
`syncMode: "incremental"` is a non-destructive repeated
scan, not a source-timestamp watermark; after a cursor completes, the next
scheduled run starts scanning from the beginning.

The generic materializer creates resource and column catalog entries, but it
does not currently persist proposed cross-resource relationships. Keep those
relationships in the approved proposal until a separate catalog relationship
path is implemented.

## Acceptance evidence

The pipeline is ready only when all of the following are true:

- the source and connection belong to the intended tenant, and every credential
  is represented only by a tenant secret reference;
- local verification passes against the verified origin with bounded reads;
- the sample sync proves provider/auth/schema behavior without exposing source
  rows, and the initial-load record shows every approved resource complete;
- the source catalog exposes the resource schema and freshness timestamp;
- the pipeline targets `sync-generic-rest`, carries the source ID and approved
  target tables, and its requested schedule is active;
- Data Sources shows current freshness, latest run, failure/retry state, and a
  recovery path;
- a second bounded run creates no duplicate identities, and a stale competing
  run cannot overwrite the connection's current resource checkpoint;
- the initial traversal is complete; while any `hasMore` work remains, the build
  stays non-ready and exposes its partial-resource freshness;
- one bounded catalog/SQL query proves a downstream dashboard can read the new
  data.

Prove both consumption paths: inspect the source's bounded materialized
resource preview/freshness in Data Sources, then use `list_data_catalog`,
`describe_data_resource`, and a bounded `query_source_data` or `run_psql`
control query. Do not infer queryability merely from `sources.knownTables`.

The ordinary Data Sources flow includes a first-class Customer API setup for
this declarative contract. It creates the same durable build, stores protected
credentials through the tenant secret registry, performs one bounded resource
page per browser request, and exposes resumable progress and blockers on the
source detail page. APIs outside the declarative contract remain assisted
custom platform work.

Use `repair_data_source_or_pipeline` for a durable re-auth, invalid-manifest,
failed-run, or recovery workflow. A manual run may select one resource, bound
`maxRecords`, or request `fullRefresh: true`; the latter resets traversal from
the beginning but still advances its durable checkpoint only after successful
materialization. Keep connector source integration, shared worker deployment,
and customer rollout as separate evidence and authorization steps.

Only then start a separate artifact-app build for the requested dashboard. Its
dataset should query the cataloged materialized relations and present an honest
fresh/stale/error state; it should not call the customer API directly.

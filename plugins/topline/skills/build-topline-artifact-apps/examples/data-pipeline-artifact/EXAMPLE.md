# Data Pipeline Artifact

Use this example when a customer wants to connect a system, keep its data
synced, or change what syncs and when. With the Data Sources workspace on, each
connector instance (one PestRoutes account, one Five9 tenant, one Google Sheet,
one custom API) is **one data pipeline artifact** in the Data Sources
workspace. It holds many tables and many named schedules.

A data pipeline artifact is a built-in artifact type, not an artifact app. It
has no package, routes, runtime, deploy or smoke. Its whole payload is a
`pipelineManifest`. The platform still owns the connection and its secret
references, checkpoints, the sync handlers, the materialized tables, the
scheduler jobs and run history. The manifest only says which tables exist and
which named schedule runs each one.

## Is the workspace on?

Call `list_pipeline_artifacts`. If it is not offered, or it fails because the
workspace is not enabled, the tenant still uses the classic Data Sources pages:
follow [Customer API source pipeline](../customer-api-source-pipeline/EXAMPLE.md)
and stop there. Do not invent artifacts.

## The manifest

```json
{
  "pipelineManifestVersion": 1,
  "connector": "pestroutes",
  "sourceId": "<the bound source id; never change it>",
  "title": "PestRoutes",
  "tables": [
    { "name": "appointments", "label": "Appointments" },
    { "name": "routes", "label": "Routes" },
    { "name": "customers", "label": "Customers" },
    { "name": "tickets", "label": "Tickets" },
    { "name": "employees", "label": "Employees" }
  ],
  "schedules": [
    { "name": "Every 15 minutes", "tables": ["appointments", "routes"], "cron": "*/15 * * * *", "timezone": "America/Denver", "enabled": true },
    { "name": "Hourly", "tables": ["customers", "tickets"], "cron": "0 * * * *", "timezone": "America/Denver", "enabled": true },
    { "name": "Nightly 2:00", "tables": ["employees"], "cron": "0 2 * * *", "timezone": "America/Denver", "enabled": true },
    { "name": "Nightly hard delete", "job": "hard_delete", "tables": ["customers", "appointments", "tickets"], "cron": "0 3 * * *", "timezone": "America/Denver", "enabled": true, "resources": { "memoryMb": 8192 } },
    { "name": "Upcoming appointments and routes", "job": "hard_delete_upcoming", "tables": ["appointments", "routes"], "cron": "*/30 6-20 * * *", "timezone": "America/Denver", "enabled": true }
  ]
}
```

Rules the server enforces when a draft is saved:

- `tables` are the source's own tables. Do not add a table the connector does
  not sync; the connector's setup adds tables (PestRoutes: add a resource; Five9:
  schedule a report).
- Each table is in at most one schedule per job. A schedule without `job` is a
  sync. `hard_delete` (full scan) and `hard_delete_upcoming` (records dated
  today or later) exist only on PestRoutes, and only for tables that have that
  scan installed (`read_pipeline_artifact` lists them in `hardDeleteTables`).
- `resources` sets the machine size of each run of a hard-delete schedule:
  `memoryMb` and optional `cpu` (a Fargate pair, the same as an app's
  `resources.build`; omitted `cpu` means the smallest that fits). Omitted
  `resources` means 8 GB. Each run gets its own machine, which stops when the
  check ends. Sync schedules cannot set it. Publishing refuses a size above
  the account's build limit (`resources_above_ceiling`, default 8 GB); never
  lower a size silently. Raise it when a check fails with
  `sized_task_stopped: OutOfMemoryError`.
- `cron` is five-field cron or `null` for manual only; a manual-only schedule
  cannot be enabled. `timezone` is an IANA name and decides when the cron fires.
- Schedule names are unique and are what people see; name them by cadence or
  purpose ("Every 15 minutes", "Nightly hard delete").

## Change a pipeline (the coder's loop)

1. `read_pipeline_artifact` with the artifact id. Note `version`, the live
   manifest, any existing `draftManifest`, each schedule's live job state
   (`enabledJobs`, `operatorPausedJobs`, `failingJobs`) and `reconcile`.
2. Start from `draftManifest` when there is one (someone is mid-edit), else from
   the live manifest. Change only what was asked.
3. `save_pipeline_artifact_draft` with the complete manifest and
   `expectedVersion`. Fix and resave on `pipeline_manifest_invalid`; on
   `version_conflict` reread and reapply.
4. Tell the person what changed and that it is a draft: live schedules keep
   running unchanged until they press **Publish** on the pipeline. You cannot
   publish, pause or resume; those change live jobs and stay with a person.

What publishing does, so you can explain it: each schedule's jobs move to its
new cron, timezone or on/off state; schedules that did not change are not
touched; a job an operator paused stays paused; nothing reloads data.

## Worked examples

### Supplied connector, many tables, several schedules (PestRoutes)

"Sync appointments and routes every 15 minutes during business hours, the rest
hourly, and check for deleted customers nightly."

1. `read_pipeline_artifact`. The live manifest has 22 tables in three adopted
   schedules plus two hard-delete schedules.
2. Edit the draft: set "Every 15 minutes" to `*/15 7-18 * * 1-6` and rename it
   "Every 15 minutes, business hours"; move the remaining sync tables into
   "Hourly"; make sure `customers` is in the `hard_delete` schedule at
   `0 3 * * *`.
3. Save the draft and tell the person to review the Schedules tab (Sync and
   Hard delete sub-tabs) and publish.

Offices and the PestRoutes credentials are not in the manifest. Offices live on the pipeline's Offices tab; credentials on its
Connection tab.

### Custom API

"We have a vendor API; keep its customers and work orders synced hourly."

1. Build the source with the chat data-source tools exactly as in
   [Customer API source pipeline](../customer-api-source-pipeline/EXAMPLE.md):
   secure credential card, table approval card, verified
   `platform.connector.rest.v1` manifest, bounded sample sync, resumable initial
   load, catalog registration.
2. `schedule_pipeline_refresh` creates the first schedule. With the workspace
   on, the source becomes its data pipeline artifact and the tool returns
   `pipelineArtifactId`.
3. Later cadence changes go through that artifact (draft, then a person
   publishes). `schedule_pipeline_refresh` refuses them with
   `pipeline_artifact_owned`.

### Google Sheets

Each spreadsheet set up is its own artifact; several can share the tenant's
Google access, and deleting one never revokes it. The usual change is a single
schedule's cadence: read, edit that schedule's `cron`/`timezone`, save the
draft.

## What does not belong in the manifest

- Credentials, secret references, API keys, connection settings.
- Endpoints, pagination, checkpoints, rate limits: those are the connector's.
- Dashboards or tools built on the synced data: build those as ordinary
  artifact apps that read the cataloged tables.
- Machine size: set by the platform for the connector's handler.

## Acceptance evidence

- The draft saved with no validation errors, and `read_pipeline_artifact` shows
  it as `draftManifest`.
- Live job state is unchanged until a person publishes.
- After publish, `reconcile.upToDate` is true and each changed schedule's jobs
  show the new cadence; operator-paused jobs are still paused.

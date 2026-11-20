---
name: topline-aws-diagnostics
description: "Diagnose a Topline customer's AWS-side failure read-only and evidence-first: a pipeline that stopped running, an app deploy that failed or returns 5xx, data that looks stale, or something that worked yesterday. Uses Topline's read tools and the AWS runner (aws_run_script: read-only JavaScript against the company's own AWS account). Names the right account, log group and revision for hosted customers."
---

# Topline AWS Diagnostics

## Before you start

1. Read the account map (documentation id `aws-account-map`, source
   `docs/AWS_ACCOUNT_MAP_FOR_AGENTS.md`; with the Topline plugin,
   `platform_read_documentation` with that id): which
   account holds what for a hosted customer, which log group answers which
   question, and why the running revision of a hosted customer's own services
   is never current. With the Topline plugin the runner tool is
   `platform_aws_run_script` (same input as `aws_run_script`, Builders only).
2. Read the [rules and evidence template](references/rules-and-evidence.md).
   They apply to every playbook.

## Rules (short form)

- Read-only first; writes go through Topline tools, never through raw AWS.
- Cap output and summarize; never paste raw responses.
- Never print values from environment variables, secrets, parameters or
  presigned URLs. Name the key, not the value.
- On AccessDenied: it is an answer, not a blocker. Stop that line, name the
  exact action and resource as a permission the user can request, and keep
  going with other evidence. Never retry or work around. Use the platform
  blocker path only when nothing else can answer and the task cannot finish.
- State a cause only when a second, independent source agrees.
- For a hosted customer, the newest registered task-definition revision is
  current; the running one is frozen history.

## Playbooks

Each has a Topline read-tools path first, then a ready-made AWS runner script,
and ends with an evidence summary to fill in.

| Symptom | Playbook | Runner script |
| --- | --- | --- |
| A pipeline stopped running; last run is old | [pipeline-not-running](references/pipeline-not-running.md) | `scripts/pipeline_not_running.js` |
| A deploy failed; an app or upload returns 5xx | [app-deploy-or-5xx](references/app-deploy-or-5xx.md) | `scripts/app_5xx.js` |
| Data looks stale | [data-stale](references/data-stale.md) | `scripts/data_stale.js` |
| It worked yesterday | [worked-yesterday](references/worked-yesterday.md) | `scripts/revision_drift.js` |

## The AWS runner

`aws_run_script` runs a short JavaScript program (the body of an async
function) in a sandbox whose only network access is
`await call_aws(service, operation, region, params)`; `region` is `null` for the
account's own region, and the script `return`s its answer.

- **Where:** web chat on an attended turn for a Builder seat, and the coding
  agent (Pi: `load_tools` group `aws_diagnostics`; `appId` defaults to the
  task's app). Never on unattended turns.
- **Who:** persona `builder-read` (role `<prefix>-agent-read`) in this
  company's own account. IAM is the limit: what the role does not allow comes
  back as `AccessDenied`. Every write is refused before AWS with `write_blocked`.
  `ecs:DescribeTaskDefinition`, `lambda:GetFunction`, secrets and invoke are
  never granted. Services: lambda, ecs, scheduler, cloudwatch, logs,
  cloudtrail, s3, iam (no ec2, sts or sqs). Topline's own account (hosted
  services and their logs) is not reachable; that is staff work.
- **`appId`:** narrows Lambda and log reads to one app; S3 object reads need it
  (`s3_requires_app_scope` without). Leave it out for pipeline and ECS reads.
- **Results:** a failed call resolves to `{ ok: false, errorCode, message,
  requestId }`, never throws. `credentials_unavailable` means the account
  link cannot be assumed: stop and say so.
- **Limits:** 25 s, 50 calls, 20,000 characters per call result, 50,000 for the
  whole output. A list page over the per-call cap comes back with `$truncated`,
  `$itemsReturned`, `$itemsOnPage` and `$hint`, and its page token removed.

Every script in `scripts/` runs as-is. Copy the "Runner script" block from
the playbook (`read_docs` with docId `aws-playbook-pipeline-not-running`,
`aws-playbook-app-5xx`, `aws-playbook-data-stale` or
`aws-playbook-worked-yesterday`; it is the `.js` file, copied by
`npm run docs:generate`) as `script`, after setting the values under
`settings` at the top. Each carries the same helpers:
`aws()` (one call; records denials and failures), `page()` (pages of 5 to 20,
follows `NextToken`/`nextToken`/`NextMarker`, retries smaller on `$truncated`,
keeps following empty pages that still carry a token) and `denied()` (records
`AccessDenied` as a permission not checked and keeps going). Each returns one
compact summary with `notChecked` and `problems`; none returns raw responses or
environment values. Lessons they encode (first live runs, 2026-11-20):

- A 50-item list page exceeded the per-call cap and a script counted 0. Page
  small, and never count from a `$truncated` response.
- `FilterLogEvents` returns empty pages with a `nextToken`. Keep paging
  (bounded) before saying there are no matches; report whether paging ended.
- An app's log group does not exist until the function first runs:
  `ResourceNotFoundException` or no group means "no logs yet", not a failure.
- Derive function, cluster, group and log group names from list and config
  calls, not from a guessed name.

Writing your own script: same helpers, same rules. `apps/server/test/aws-runner/diagnostics-scripts.test.ts`
runs each script through the real runner against a fake AWS.

## Completion

End with the evidence summary from the playbook. Distinguish a verified cause
(two sources), a lead (one source) and not checked (denied or unavailable).

# AWS Diagnostics: Rules and Evidence

The rules every AWS diagnosis follows, whether it uses today's Topline read
tools or the AWS runner. Read the account map (documentation id `aws-account-map`, `docs/AWS_ACCOUNT_MAP_FOR_AGENTS.md`)
first: most wrong answers come from reading the wrong account or the wrong
revision.

## Rules

- **Read-only first.** Describe, list, get and filter before anything that
  changes state. A diagnosis needs no writes.
- **Cap output and summarize.** Ask for small pages (`MaxItems`, `MaxResults`
  or `limit` of 10 to 20; 5 for CloudTrail events) and report counts plus the
  few rows that matter. Never paste a raw response. A response with
  `$truncated` dropped items to fit the 20,000-character per-call cap and lost
  its page token: never count from it; retry that page smaller.
- **Zero needs a finished search.** `FilterLogEvents` can return empty pages
  that still carry a `nextToken`; keep paging (bounded) before reporting no
  matches, and say whether the search reached the end.
- **Derive names, never guess them.** Function, cluster, schedule group and
  log group names come from list or config calls. A missing app log group
  (`ResourceNotFoundException`) means the function has not run yet: "no logs
  yet", not a failure.
- **Never print secret-bearing values.** No values from Lambda or ECS
  environment, Secrets Manager, SSM parameters or presigned URLs. Name the key
  (`ARTIFACT_STORAGE_ACCESS_POINT_ALIAS is missing`), not its value. Resource
  ids such as `sg-...` or a queue name may be named when they are the finding.
- **Writes go through Topline tools.** Deploys, schedules, restarts, secrets,
  retries and data refreshes have their own tools with caps and approvals. The
  runner refuses every write (`write_blocked`) before it reaches AWS.
- **AccessDenied is an answer, not a blocker.** Stop that line and say plainly
  which permission the persona lacks: the exact action and resource from the
  error (`ecs:DescribeTaskDefinition on task-definition/<family>:<rev>`). Many
  denials are deliberate (task-definition env, secrets, invoke, other regions),
  so continue with the other evidence sources and include the denied action
  in the evidence summary as a permission the user can request. Do not retry,
  switch region, try another role or work around it through another tool.
  Only when no other path can answer the question, and the task cannot finish
  without it, report it through the platform blocker path
  (`report_platform_blocker` with `category: "platform_access"` in a coding
  task), naming the action and resource.
- **Verify a cause with a second source.** A cause is stated only when two
  independent reads agree, for example a CloudTrail error naming a security
  group plus `DescribeSecurityGroups` saying it does not exist. One source is
  a lead, not a cause.
- **Frozen services.** For a hosted customer, the customer account's own API
  and worker services are scaled to 0 and pinned. Their running revision is
  history; the newest registered revision is current.
- **Launch failures leave no run.** A pipeline schedule that cannot start its
  task creates no run row, no task log and no failed run, so the pipeline's
  success rate can read 100% while nothing runs.

## Using the AWS runner

`aws_run_script` runs a short JavaScript program in a sandbox whose only
network access is `await call_aws(service, operation, region, params)`
(`region`: `null` for the account's own region). The script is the body of an
async function and `return`s its answer; `console.log` is captured.

- **Where it runs:** web chat on an attended turn for a Builder seat, and the
  coding agent (Pi loads it with `load_tools` group `aws_diagnostics`; `appId`
  defaults to the task's app). It is never offered on unattended turns.
- **Credentials:** persona `builder-read`, role `<prefix>-agent-read` in this
  company's own account and region, assumed per script. IAM is the limit:
  anything the role does not allow returns `AccessDenied`. Never granted:
  `ecs:DescribeTaskDefinition`, `ecs:RunTask`, `lambda:GetFunction`,
  `lambda:InvokeFunction`, `secretsmanager:*`, `ssm:GetParameter*`,
  `kms:Decrypt`, `iam:PassRole`. Use `GetFunctionConfiguration`, not
  `GetFunction`.
- **Services:** lambda, ecs, scheduler, cloudwatch, logs, cloudtrail, s3, iam.
  There is no ec2, sts or sqs: a deleted security group shows up as a
  CloudTrail `DeleteSecurityGroup` event, not a `DescribeSecurityGroups` error.
  Topline's own account (hosted services, `/topline/dev/hosted-*` logs) is not
  reachable; that is staff work.
- **Writes:** refused with `write_blocked` before any AWS client exists.
- **`appId`:** narrows Lambda and log reads to one app's functions and log
  groups; S3 object reads need it (`s3_requires_app_scope` without). Leave it
  out for pipeline, schedule and ECS reads (it would deny the
  `platform-worker` log group).
- **Results:** a failed call resolves to `{ ok: false, errorCode, message,
  requestId }`; it never throws. `credentials_unavailable` means the role could
  not be assumed: say so and use the Topline read tools.
- **Limits:** 25 s, 50 calls (4 at a time), 10 s per call, 20,000 characters
  per call result (an over-cap list keeps its shape with `$truncated`,
  `$itemsReturned`, `$itemsOnPage`, `$hint` and no page token), 50,000 for the
  whole output. Secret values, Lambda and task environment values and signed
  URLs come back redacted. Every call is audited.

Each playbook ends with a "Runner script" block that runs as-is: copy it from
the playbook (`read_docs` with docId `aws-playbook-pipeline-not-running`,
`aws-playbook-app-5xx`, `aws-playbook-data-stale` or
`aws-playbook-worked-yesterday`) as `script`, after setting the values under
`settings`. Each carries the same
helpers: `aws()` (one call; records denials and failures), `page()` (small
pages, follows `NextToken`/`nextToken`/`NextMarker`, retries smaller on
`$truncated`, follows empty pages that carry a token) and `denied()` (records
`AccessDenied` in `notChecked` and continues). Each returns one compact
summary with `notChecked` (permissions the user can request) and `problems`.

If the runner is not offered in this turn, use the Topline read-tools path in
each playbook. Staff can run the same reads with the read-only AWS CLI and an
SSO profile for the right account.

## Evidence summary template

End every diagnosis with this block, filled in. Leave a line out rather than
guess.

```text
Symptom: <what the person saw, with the time window>
Cause: <one sentence>
Evidence 1: <source, exact error or value, time range>
Evidence 2: <independent source that agrees>
Scope: <which apps, pipelines or customers; since when>
Not checked: <reads that were denied or skipped, with the exact action>
Next step: <Topline tool or person, never a raw AWS write>
```

# Playbook: A Pipeline Is Not Running

Symptom: a standalone pipeline (connector sync) shows an old last run, or its
tables stop changing, while the Pipelines page may still show a 100% success
rate. Follow the [rules](rules-and-evidence.md); accounts are in the
account map (documentation id `aws-account-map`, `docs/AWS_ACCOUNT_MAP_FOR_AGENTS.md`).

Real case (2026-11-15..19): every standalone schedule in every hosted customer
named a security group a converge had deleted. Each fire, EventBridge
Scheduler's `RunTask` failed with `InvalidGroup.NotFound`; no task started, no
run row was written, nothing alarmed, and the Pipelines page kept showing the
last good run and a 100% success rate for about three days.

## With Topline's read tools

1. `get_pipeline` (or `list_pipelines`): read `cron`, `lastRun` and
   `successRate24h`. A `lastRun` older than two cron intervals is the symptom.
   A high success rate does not clear it, because launch failures create no
   run. If the response has `overdue` or `missedRuns`, use them.
2. Pipeline task logs: `get_logs` with `target: "task"`, `kind: "pipeline"`
   (v1 `inspect_harness_service_logs` with `service: "task"`; staff
   `platform_read_logs` with `target: "task"`). No recent tasks at all, while
   the cron says there should be, points at launch, not at the sync code.
3. A task that did start and failed: read it by `taskId` or `runId` for its
   exit code and last error lines. That is a sync failure, not this playbook.
4. `inspect_schedule_sync` compares app and workspace schedules with the live
   scheduler. Whether it covers the pipeline group's ECS targets is not
   confirmed; treat "not listed" as unknown, not healthy.
5. These tools do not read Scheduler metrics or CloudTrail. If the last run is
   stale and no task started, run the script below with `aws_run_script`. If
   the runner is not offered in this turn, say so with the evidence above and
   hand off to a coding task (tool group `aws_diagnostics`) or Topline staff.
   Do not guess a cause.

## With the AWS runner

Script: the "Runner script" block at the end of this page
(`scripts/pipeline_not_running.js`). Copy it as the `script` of
`aws_run_script`, without `appId`. Set `SCHEDULE_ID` to the
pipeline schedule id for a focused read, or leave it `null` for the whole
group. It finds the group and `<prefix>` with `ListScheduleGroups`, then reads:

| Step | Call | What it tells you |
| --- | --- | --- |
| Schedule | `scheduler GetSchedule` (or `ListSchedules` state counts) | `State` (a `DISABLED` schedule never fires), expression, timezone, network, task definition |
| Launch errors | `cloudtrail LookupEvents` `RunTask` in pages of 5, kept only for session issuer `<prefix>-artifact-pipeline-scheduler` | The exact refusal (a missing security group, IAM, task definition) grouped with first and last time, the ids it names, and how far back the pages reached |
| Scheduler metrics | `cloudwatch GetMetricStatistics` on `AWS/Scheduler` `TargetErrorCount`, `InvocationDroppedCount`, `InvocationAttemptCount` for the group, hourly | Fires that could not start a task, and since when |
| Network | `cloudtrail LookupEvents` by `ResourceName` for each id named in an error or on the schedule | When a named security group or subnet was deleted (the runner has no ec2) |
| Stopped tasks | `ecs ListTasks` (STOPPED, family `<prefix>-artifact-pipeline-<id>`) + `DescribeTasks` | Exit codes and stop reasons of tasks that did start (ECS keeps them about an hour) |
| Run rows | not AWS: `get_pipeline` | Launch failures never create a run |

Second source: the CloudTrail `RunTask` error names the missing id, and a
CloudTrail `DeleteSecurityGroup` event for that id (or Scheduler
`TargetErrorCount` starting the same hour) agrees. If the schedule today names
only existing groups but CloudTrail shows errors, the schedule was rewritten
since: `scripts/revision_drift.js` lists `UpdateSchedule` events, and the
playbook "Something worked yesterday" covers the hosted env.

## Evidence summary

```text
Symptom: pipeline <name> last ran <lastRun>; cron <expr> expects a run every <n> min
Cause: Scheduler cannot launch the task: RunTask fails with <errorCode> (<missing id>)
Evidence 1: CloudTrail RunTask by <prefix>-artifact-pipeline-scheduler: <count> errors, <first> -> <last>
Evidence 2: <CloudTrail DeleteSecurityGroup sg-... at <time>> / Scheduler TargetErrorCount <sum> over <hours> h
Scope: <n> schedules in <prefix>-artifact-pipelines; <customers if hosted>
Not checked: <denied reads>
Next step: Topline staff fix the schedule network (setup-runner hosted sync), then confirm a successful launch and a new run row
```

## Runner script

Copy this whole block as the `script` of `aws_run_script`, after setting the values under `settings`. It is `scripts/pipeline_not_running.js` in the topline-aws-diagnostics skill, copied here by `npm run docs:generate`.

```js
// Playbook: a standalone pipeline is not running (references/pipeline-not-running.md).
// Paste this whole file as the `script` of aws_run_script, without appId (pipeline reads are
// company-wide; appId narrows logs to one app). Read-only. Returns one compact summary object;
// never raw responses, never environment values.

// ---- settings ----
const SCHEDULE_ID = null;   // the pipeline's schedule id (schedule name platform-schedule-<id>); null = whole group
const HOURS = 72;           // window for metrics and CloudTrail
const TRAIL_PAGES = 20;     // CloudTrail RunTask pages of 5 events; the summary says how far back they reached

// ---- helpers: the same block in every script in this folder (aws, page, denied) ----
const REGION = null;               // null = this company's own region (the runner refuses others)
const CALL_BUDGET = 45;            // the runner stops a script at 50 calls
const TIME_BUDGET_MS = 18000;      // the runner stops a script at 25 s
const startedAt = Date.now();
const notChecked = [];             // refused reads: the exact action, a permission the user can request
const problems = [];               // other failed reads (throttling, validation, timeouts)
let callsMade = 0;
const DENIED = /AccessDenied|Unauthorized|not authorized|write_blocked|s3_requires_app_scope/i;

function short(text, max) {
  const s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  return s.length > (max || 200) ? s.slice(0, max || 200) + "..." : s;
}
function budgetLeft() { return callsMade < CALL_BUDGET && Date.now() - startedAt < TIME_BUDGET_MS; }
function failed(r) { return !r || r.ok === false; }

// A refused read is an answer: record the exact action once and move on. Never retry it.
function denied(r, action) {
  if (!r || r.ok !== false || !DENIED.test(r.errorCode + " " + r.message)) return false;
  if (!notChecked.some((n) => n.action === action)) notChecked.push({ action, errorCode: r.errorCode, message: short(r.message, 240) });
  return true;
}

// One AWS call. Failures resolve to { ok: false, errorCode, message }. Codes in `expected`
// (ResourceNotFoundException for a log group that does not exist yet) are answers, not problems.
async function aws(service, operation, params, expected) {
  callsMade += 1;
  const r = await call_aws(service, operation, REGION, params || {});
  if (!failed(r)) return r;
  if (r && r.errorCode === "credentials_unavailable") throw new Error("credentials_unavailable: " + r.message);
  const code = r ? r.errorCode : "no_response";
  if ((expected || []).indexOf(code) === -1 && !denied(r, service + ":" + operation)) {
    problems.push({ call: service + ":" + operation, errorCode: code, message: short(r && r.message, 240) });
  }
  return r || { ok: false, errorCode: code, message: "" };
}

// Pages through a list in small pages, following NextToken, nextToken or NextMarker (as Marker).
// A $truncated page dropped items to fit the per-call cap and lost its token: never count from it,
// retry the same page smaller. Empty pages that still carry a token (FilterLogEvents) are followed
// up to maxPages. `complete` is true only when the last page had no token.
async function page(service, operation, params, opt) {
  const o = Object.assign({ items: "Items", size: 20, sizeKey: "MaxResults", maxPages: 5, maxItems: 200, expected: [] }, opt);
  const out = { items: [], pages: 0, complete: false, error: null };
  let size = o.size, tokenKey = null, token = null;
  while (out.pages < o.maxPages && out.items.length < o.maxItems) {
    if (!budgetLeft()) { out.error = "script_budget"; break; }
    const req = Object.assign({}, params);
    if (o.sizeKey) req[o.sizeKey] = size;
    if (token) req[tokenKey] = token;
    const r = await aws(service, operation, req, o.expected);
    if (failed(r)) { out.error = r.errorCode; break; }
    if (r.$truncated) {
      if (!o.sizeKey || size <= 1) { out.error = "item_over_output_cap"; break; }
      size = Math.max(1, Math.min(Math.floor(size / 2), r.$itemsReturned || size));
      continue;
    }
    out.pages += 1;
    const list = r[o.items];
    if (Array.isArray(list)) for (const item of list) out.items.push(item);
    if (r.NextToken) { tokenKey = "NextToken"; token = r.NextToken; }
    else if (r.nextToken) { tokenKey = "nextToken"; token = r.nextToken; }
    else if (r.NextMarker) { tokenKey = "Marker"; token = r.NextMarker; }
    else { out.complete = true; break; }
  }
  if (out.items.length > o.maxItems) out.items.length = o.maxItems;
  return out;
}
// ---- end helpers ----

// Names come from list calls, never guessed: the group ending in -artifact-pipelines gives <prefix>.
async function pipelineGroup() {
  const groups = await page("scheduler", "ListScheduleGroups", {}, { items: "ScheduleGroups", size: 20, maxPages: 3 });
  const g = groups.items.map((x) => x.Name).find((name) => /-artifact-pipelines$/.test(name || ""));
  return g ? { group: g, prefix: g.replace(/-artifact-pipelines$/, "") } : null;
}

async function schedulerMetrics(group, start, end) {
  const out = {};
  for (const metric of ["TargetErrorCount", "InvocationDroppedCount", "InvocationAttemptCount"]) {
    const r = await aws("cloudwatch", "GetMetricStatistics", {
      Namespace: "AWS/Scheduler", MetricName: metric, Dimensions: [{ Name: "ScheduleGroup", Value: group }],
      StartTime: Math.floor(start / 1000), EndTime: Math.floor(end / 1000), Period: 3600, Statistics: ["Sum"]
    });
    if (failed(r)) { out[metric] = "not read: " + r.errorCode; continue; }
    const points = (r.Datapoints || []).filter((p) => p.Sum).sort((a, b) => String(a.Timestamp).localeCompare(String(b.Timestamp)));
    out[metric] = { sum: points.reduce((n, p) => n + p.Sum, 0), nonzeroHours: points.length,
      first: points.length ? String(points[0].Timestamp) : null, last: points.length ? String(points[points.length - 1].Timestamp) : null };
  }
  return out;
}

// RunTask calls made by the scheduler role. CloudTrail events are large: pages of 5, bounded.
async function runTaskByScheduler(schedulerRole, start, end) {
  const trail = await page("cloudtrail", "LookupEvents", {
    LookupAttributes: [{ AttributeKey: "EventName", AttributeValue: "RunTask" }],
    StartTime: Math.floor(start / 1000), EndTime: Math.floor(end / 1000)
  }, { items: "Events", size: 5, maxPages: TRAIL_PAGES, maxItems: 500 });
  const errors = {};
  const missingIds = {};
  let launched = 0, oldest = null;
  for (const item of trail.items) {
    let e;
    try { e = JSON.parse(item.CloudTrailEvent || "{}"); } catch (_) { continue; }
    oldest = !oldest || e.eventTime < oldest ? e.eventTime : oldest;
    const issuer = (((e.userIdentity || {}).sessionContext || {}).sessionIssuer || {}).userName;
    if (issuer !== schedulerRole) continue;
    const family = String(((e.requestParameters || {}).taskDefinition) || "").split("/").pop().split(":")[0];
    if (SCHEDULE_ID && !family.endsWith(SCHEDULE_ID)) continue;
    if (!e.errorCode) { launched += 1; continue; }
    const key = e.errorCode + ": " + short(e.errorMessage, 200);
    const g = errors[key] || (errors[key] = { count: 0, first: e.eventTime, last: e.eventTime });
    g.count += 1;
    if (e.eventTime < g.first) g.first = e.eventTime;
    if (e.eventTime > g.last) g.last = e.eventTime;
    for (const id of String(e.errorMessage || "").match(/\b(?:sg|subnet)-[0-9a-f]{8,17}\b/g) || []) missingIds[id] = true;
  }
  return { scanned: trail.items.length, complete: trail.complete, coveredFrom: trail.complete ? new Date(start).toISOString() : oldest,
    launched, errors, idsNamedInErrors: Object.keys(missingIds), stoppedBecause: trail.error };
}

// No ec2 in the runner: whether a named group or subnet was deleted comes from CloudTrail instead.
async function deletions(ids) {
  const out = [];
  for (const id of ids.slice(0, 3)) {
    const trail = await page("cloudtrail", "LookupEvents", { LookupAttributes: [{ AttributeKey: "ResourceName", AttributeValue: id }] },
      { items: "Events", size: 10, maxPages: 1, maxItems: 10 });
    const del = trail.items.find((x) => /^Delete(SecurityGroup|Subnet)$/.test(x.EventName || ""));
    out.push({ id, deleted: del ? String(del.EventTime) : null, eventsSeen: trail.items.length, lookupError: trail.error });
  }
  return out;
}

async function scheduleState(group) {
  if (!SCHEDULE_ID) {
    const list = await page("scheduler", "ListSchedules", { GroupName: group, NamePrefix: "platform-schedule-" }, { items: "Schedules", size: 20, maxPages: 5 });
    const states = {};
    for (const s of list.items) states[s.State] = (states[s.State] || 0) + 1;
    return { count: list.items.length, complete: list.complete, states };
  }
  const s = await aws("scheduler", "GetSchedule", { GroupName: group, Name: "platform-schedule-" + SCHEDULE_ID }, ["ResourceNotFoundException"]);
  if (failed(s)) return { error: s.errorCode };
  const ecs = (s.Target || {}).EcsParameters || {};
  const net = ((ecs.NetworkConfiguration || {}).awsvpcConfiguration) || {};
  return { name: s.Name, state: s.State, expression: s.ScheduleExpression, timezone: s.ScheduleExpressionTimezone || "UTC",
    taskDefinition: String(ecs.TaskDefinitionArn || "").split("/").pop(), securityGroups: net.SecurityGroups || [], subnets: net.Subnets || [] };
}

async function stoppedTasks(prefix) {
  if (!SCHEDULE_ID) return "set SCHEDULE_ID to read stopped tasks (ECS keeps them about an hour)";
  const cluster = prefix + "-cluster";
  const list = await page("ecs", "ListTasks", { cluster, family: prefix + "-artifact-pipeline-" + SCHEDULE_ID, desiredStatus: "STOPPED" },
    { items: "taskArns", sizeKey: "maxResults", size: 10, maxPages: 1, maxItems: 10 });
  if (!list.items.length) return { tasks: 0, error: list.error };
  const r = await aws("ecs", "DescribeTasks", { cluster, tasks: list.items });
  if (failed(r)) return { tasks: list.items.length, error: r.errorCode };
  return (r.tasks || []).map((t) => ({ task: String(t.taskArn).split("/").pop(), stopCode: t.stopCode, stoppedReason: short(t.stoppedReason, 200),
    exitCodes: (t.containers || []).map((c) => c.exitCode), stoppedAt: t.stoppedAt ? String(t.stoppedAt) : null }));
}

async function main() {
  const end = Date.now();
  const start = end - HOURS * 3600 * 1000;
  const found = await pipelineGroup();
  if (!found) return { error: "No schedule group ending in -artifact-pipelines is visible to this persona.", notChecked, problems };
  const schedule = await scheduleState(found.group);
  const launches = await runTaskByScheduler(found.prefix + "-artifact-pipeline-scheduler", start, end);
  const named = SCHEDULE_ID ? (schedule.securityGroups || []).concat(schedule.subnets || []) : [];
  const ids = launches.idsNamedInErrors.concat(named.filter((id) => launches.idsNamedInErrors.indexOf(id) === -1));
  return {
    group: found.group, scheduleId: SCHEDULE_ID, windowHours: HOURS,
    schedulerMetrics: await schedulerMetrics(found.group, start, end),
    runTaskByScheduler: launches,
    schedule,
    networkDeletedPerCloudTrail: await deletions(ids),
    stoppedTasks: await stoppedTasks(found.prefix),
    notChecked, problems, calls: callsMade,
    note: "A launch failure creates no run row and no task log; compare with get_pipeline lastRun. ec2 is not in the runner: a deletion comes from CloudTrail, not DescribeSecurityGroups."
  };
}

try { return await main(); } catch (e) { return { error: short(e && e.message, 300), notChecked, problems, calls: callsMade }; }
```

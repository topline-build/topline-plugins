# Playbook: Data Looks Stale

Symptom: a dashboard or table shows old numbers, or "last updated" is older
than the person expects. Follow the [rules](rules-and-evidence.md); accounts
are in the account map (documentation id `aws-account-map`, `docs/AWS_ACCOUNT_MAP_FOR_AGENTS.md`).

Stale data has three different causes, and each needs different evidence:

| Cause | What you see |
| --- | --- |
| The pipeline did not launch | Fewer launches than the cron expects, launch errors, no new run rows (see [pipeline not running](pipeline-not-running.md)) |
| The pipeline ran but failed or wrote nothing | Run rows exist with errors or zero rows; task logs show the error |
| The pipeline is fine; the app shows a cache | Recent successful runs; the app's dataset `cacheTtlSeconds` or a precomputed dataset is older |

## With Topline's read tools

1. `get_pipeline`: `cron`, `lastRun` (status, start, finish) and
   `successRate24h`. Work out the expected fires since `lastRun` from the cron
   and the schedule timezone. If the response has `overdue` or `missedRuns`,
   use those instead of counting by hand.
2. Run rows exist and are recent: read the newest failed run's task by
   `runId` (`get_logs` `target: "task"`, or `platform_read_logs`). Then check
   whether the source returned rows.
3. Runs are recent and succeeded: the staleness is in the app. Read the app's
   dataset definition (`read_source` with `scope: "artifact_app"`, v1
   `inspect_artifact_app_source`) for `cacheTtlSeconds` or a precomputed refresh.
4. `lastRun` is old and no task started: go to
   [pipeline not running](pipeline-not-running.md).

## With the AWS runner

Script: the "Runner script" block at the end of this page
(`scripts/data_stale.js`). Copy it as the `script` of
`aws_run_script`, without `appId`. Set `SCHEDULE_ID` and `HOURS`. It reads the
schedule (`scheduler GetSchedule`), counts `RunTask` launches and launch
failures by `<prefix>-artifact-pipeline-scheduler` for that schedule's family
in CloudTrail (pages of 5, bounded), and counts the fires its `rate()` or
`cron()` expression expects over the hours those pages actually covered
(`coveredHours`). Day-level cron fields, and hour fields in a non-UTC
timezone, come back as "count by hand".

Reading the result:

- `searchedToEnd: false`: the CloudTrail pages ran out before the window did;
  compare only within `coveredHours`, or lower `HOURS`.
- `expectedFires` close to `launchesSeen`, `launchFailures` 0: launches are
  fine; look at run rows and task logs.
- `launchFailures` high: the pipeline did not launch; use the pipeline
  playbook's script for the exact error.
- `state: DISABLED`: the schedule is off; the pipeline will not run until a
  person turns it back on in Topline.

Real numbers (one five-minute schedule, 24 hours, during the 11-17..19 outage
and its recovery): `expectedFires` 288, `launchFailures` 264, `launchesSeen` 24,
all launches after the fix.

Second source: launch counts from CloudTrail plus run rows from
`get_pipeline`. They must tell the same story; if CloudTrail shows launches
but there are no run rows, the task starts and dies before it records a run,
so read its stopped-task exit code.

## Evidence summary

```text
Symptom: <table/dashboard> last updated <time>; expected every <interval>
Cause: <did not launch | ran and failed | ran, app cache older>
Evidence 1: <expected fires vs launches seen vs launch failures over <hours> h>
Evidence 2: <get_pipeline lastRun / run row status / task exit code>
Scope: <pipelines and tables affected>
Not checked: <denied reads>
Next step: <pipeline playbook | fix the sync | change dataset freshness | Run now by a Data Sources manager>
```

## Runner script

Copy this whole block as the `script` of `aws_run_script`, after setting the values under `settings`. It is `scripts/data_stale.js` in the topline-aws-diagnostics skill, copied here by `npm run docs:generate`.

```js
// Playbook: data looks stale (references/data-stale.md). Expected fires from the schedule's
// expression vs RunTask launches CloudTrail saw. Paste this whole file as the `script` of
// aws_run_script, without appId. Read-only. Returns one compact summary object.

// ---- settings ----
const SCHEDULE_ID = null;   // the pipeline's schedule id (from get_pipeline); null = list the group's schedules
const HOURS = 12;           // window; a five-minute schedule fills about 4 CloudTrail pages an hour
const TRAIL_PAGES = 30;     // CloudTrail RunTask pages of 5 events; coveredHours says how far back they reached

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
const THROTTLED = ["ThrottlingException", "Throttling", "TooManyRequestsException", "RequestLimitExceeded"];

async function aws(service, operation, params, expected) {
  callsMade += 1;
  const send = () => call_aws(service, operation, REGION, params || {});
  let r = await send();
  // CloudTrail LookupEvents allows about 2 calls a second: back off and retry a throttled read
  // (no timers in the runner, so wait on the clock; at most ~1.75 s in all).
  for (let attempt = 0; attempt < 3 && r && r.ok === false && THROTTLED.indexOf(r.errorCode) !== -1; attempt += 1) {
    const until = Date.now() + 250 * Math.pow(2, attempt);
    while (Date.now() < until) { /* wait */ }
    callsMade += 1;
    r = await send();
  }
  if (!failed(r)) return r;
  if (r && r.errorCode === "credentials_unavailable") throw new Error("credentials_unavailable: " + r.message);
  const code = r ? r.errorCode : "no_response";
  if ((expected || []).indexOf(code) === -1 && !denied(r, service + ":" + operation)) {
    problems.push({ call: service + ":" + operation, errorCode: code, message: short(r && r.message, 240) });
  }
  return r || { ok: false, errorCode: code, message: "" };
}

// Pages through a list in small pages, following NextToken, nextToken or NextMarker (as Marker).
// A $truncated page dropped items to fit the per-call cap and lost its cursor: never count from it,
// retry the same page smaller. Empty pages that still carry a cursor (FilterLogEvents) are followed
// up to maxPages. `complete` is true only when the last page had no cursor.
async function page(service, operation, params, opt) {
  const o = Object.assign({ items: "Items", size: 20, sizeKey: "MaxResults", maxPages: 5, maxItems: 200, expected: [] }, opt);
  const out = { items: [], pages: 0, complete: false, error: null };
  let size = o.size, cursorKey = null, cursor = null;
  while (out.pages < o.maxPages && out.items.length < o.maxItems) {
    if (!budgetLeft()) { out.error = "script_budget"; break; }
    const req = Object.assign({}, params);
    if (o.sizeKey) req[o.sizeKey] = size;
    if (cursor) req[cursorKey] = cursor;
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
    if (r.NextToken) { cursorKey = "NextToken"; cursor = r.NextToken; }
    else if (r.nextToken) { cursorKey = "nextToken"; cursor = r.nextToken; }
    else if (r.NextMarker) { cursorKey = "Marker"; cursor = r.NextMarker; }
    else { out.complete = true; break; }
  }
  if (out.items.length > o.maxItems) out.items.length = o.maxItems;
  return out;
}
// ---- end helpers ----

function fieldValues(field, low, high) {
  if (field === "*" || field === "?") { const all = []; for (let i = low; i <= high; i++) all.push(i); return all; }
  const values = {};
  for (let part of field.split(",")) {
    let step = 1;
    if (part.indexOf("/") !== -1) { const bits = part.split("/"); part = bits[0]; step = parseInt(bits[1], 10); }
    let first, last;
    if (part === "*" || part === "") { first = low; last = high; }
    else if (part.indexOf("-") !== -1) { const bits = part.split("-"); first = parseInt(bits[0], 10); last = parseInt(bits[1], 10); }
    else { first = last = parseInt(part, 10); if (step !== 1) last = high; }
    for (let v = first; v <= last; v += step) values[v] = true;
  }
  return Object.keys(values).map(Number);
}

// Fires of an EventBridge rate() or cron() expression in [start, end). A string when it cannot be
// counted here (day-level fields, or hour fields in a non-UTC timezone: there is no tz data).
function expectedFires(expression, timezone, start, end) {
  const rate = /^rate\((\d+) (minute|minutes|hour|hours|day|days)\)$/.exec(expression || "");
  if (rate) {
    const minutes = parseInt(rate[1], 10) * ({ minute: 1, minutes: 1, hour: 60, hours: 60, day: 1440, days: 1440 })[rate[2]];
    return Math.floor((end - start) / 60000 / minutes);
  }
  const cron = /^cron\((.+)\)$/.exec(expression || "");
  if (!cron) return "unsupported expression: count by hand";
  const f = cron[1].trim().split(/\s+/);
  if (f.length !== 6) return "unsupported expression: count by hand";
  if (!(f[2] === "*" || f[2] === "?") || f[3] !== "*" || !(f[4] === "*" || f[4] === "?")) return "day-level fields: count by hand";
  const utc = !timezone || timezone === "UTC" || timezone === "Etc/UTC";
  if (!utc && f[1] !== "*") return "hour field in " + timezone + ": count by hand";
  const minutes = fieldValues(f[0], 0, 59), hours = fieldValues(f[1], 0, 23);
  let count = 0;
  for (let t = Math.ceil(start / 60000) * 60000; t < end; t += 60000) {
    const d = new Date(t);
    if (minutes.indexOf(d.getUTCMinutes()) !== -1 && hours.indexOf(d.getUTCHours()) !== -1) count += 1;
  }
  return count;
}

async function main() {
  const end = Date.now();
  const groups = await page("scheduler", "ListScheduleGroups", {}, { items: "ScheduleGroups", size: 20, maxPages: 3 });
  const group = groups.items.map((x) => x.Name).find((name) => /-artifact-pipelines$/.test(name || ""));
  if (!group) return { error: "No schedule group ending in -artifact-pipelines is visible to this persona.", notChecked, problems };
  const prefix = group.replace(/-artifact-pipelines$/, "");
  if (!SCHEDULE_ID) {
    const list = await page("scheduler", "ListSchedules", { GroupName: group, NamePrefix: "platform-schedule-" }, { items: "Schedules", size: 20, maxPages: 5 });
    return { error: "Set SCHEDULE_ID (from get_pipeline) and run again.", group, listedToEnd: list.complete,
      schedules: list.items.slice(0, 20).map((s) => ({ id: String(s.Name).replace(/^platform-schedule-/, ""), state: s.State })), notChecked, problems };
  }
  const s = await aws("scheduler", "GetSchedule", { GroupName: group, Name: "platform-schedule-" + SCHEDULE_ID }, ["ResourceNotFoundException"]);
  if (failed(s)) return { schedule: "platform-schedule-" + SCHEDULE_ID, error: s.errorCode === "ResourceNotFoundException" ? "no such schedule in " + group : s.errorCode, notChecked, problems };

  // CloudTrail RunTask by the scheduler role for this schedule's family, newest first, in pages of 5.
  const start = end - HOURS * 3600 * 1000;
  const trail = await page("cloudtrail", "LookupEvents", {
    LookupAttributes: [{ AttributeKey: "EventName", AttributeValue: "RunTask" }], StartTime: Math.floor(start / 1000), EndTime: Math.floor(end / 1000)
  }, { items: "Events", size: 5, maxPages: TRAIL_PAGES, maxItems: 1000 });
  let launched = 0, launchFailures = 0, lastLaunch = null, oldest = null;
  for (const item of trail.items) {
    let e;
    try { e = JSON.parse(item.CloudTrailEvent || "{}"); } catch (_) { continue; }
    if (!oldest || e.eventTime < oldest) oldest = e.eventTime;
    if ((((e.userIdentity || {}).sessionContext || {}).sessionIssuer || {}).userName !== prefix + "-artifact-pipeline-scheduler") continue;
    if (!String(((e.requestParameters || {}).taskDefinition) || "").split("/").pop().split(":")[0].endsWith(SCHEDULE_ID)) continue;
    if (e.errorCode) launchFailures += 1;
    else { launched += 1; if (!lastLaunch || e.eventTime > lastLaunch) lastLaunch = e.eventTime; }
  }
  // Compare like with like: expected fires over the window the CloudTrail pages actually covered.
  const coveredFrom = trail.complete || !oldest ? start : Date.parse(oldest);
  return {
    schedule: s.Name, state: s.State, expression: s.ScheduleExpression, timezone: s.ScheduleExpressionTimezone || "UTC",
    windowHours: HOURS, coveredHours: Math.round((end - coveredFrom) / 360000) / 10, searchedToEnd: trail.complete,
    expectedFires: expectedFires(s.ScheduleExpression, s.ScheduleExpressionTimezone, coveredFrom, end),
    launchesSeen: launched, launchFailures, lastLaunch,
    cloudTrailScanned: trail.items.length, stoppedBecause: trail.error,
    notChecked, problems, calls: callsMade,
    note: "Compare lastLaunch with get_pipeline lastRun (and overdue/missedRuns if the pipeline API returns them)."
  };
}

try { return await main(); } catch (e) { return { error: short(e && e.message, 300), notChecked, problems, calls: callsMade }; }
```

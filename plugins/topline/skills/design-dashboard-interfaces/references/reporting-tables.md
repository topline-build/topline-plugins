# Reporting tables

Use for read-only spreadsheet-style reporting: finding records, comparing exact values, verifying totals, exporting, and drilling into evidence. Editing, formulas, writeback, and collaboration require their own explicit task scope; table density does not imply them.

## Choose the features that serve the report

Use this as a selection checklist, not a mandate to install every control. Map chosen features to visible states or working behavior in the feature ledger.

| Capability | Design and correctness check |
| --- | --- |
| Identity and scope | Report name, grain, date range, timezone, source and freshness are understandable. |
| Search and filters | Show the applied query/chips and result count; support individual removal and clear-all. Separate first-use empty from no matches. |
| Sorting | Make active direction and any secondary sort visible. Apply sorting over the matching dataset when that is the promised scope, not only the loaded page. |
| Columns and density | Put stable identifiers first; use shared column widths for header, body, and footer. Prioritize fields before adding column/density controls. |
| Sticky or pinned context | Use when scrolling would otherwise lose identity or column meaning; do not obscure content or focus. |
| Resize/reorder | Provide a keyboard-accessible settings alternative if offered; a drag handle alone is insufficient. |
| Formatting | Align comparable numbers to the right. Make currency, percent, counts, dates, signs, precision, zero and missing values distinct. |
| Totals | Label current-page subtotal versus all-matching total. Compute rates from underlying counts. Qualify partial totals. |
| Pagination | State position, matching count and page size; bound navigation. Deliberately reset or reconcile the page when search/filter/sort changes. |
| Drilldown | Keep the originating record identifiable and restore scope, scroll and focus on return. |
| Copy | Name the copied value and confirm success; do not silently copy a truncated label. |
| Export | Choose all matching rows, current page or selection explicitly; show included columns, dates, filters, format and comparison scope. |

Keep controls honest when the backend cannot supply a total, global sort, or full export. Do not label a loaded subset as the whole report.

## Use stable geometry and deliberate disclosure

Use a shared column grid or actual table layout. A header's text length must not determine where its values start. Use tabular numerals when the design system supports them. Preserve full values through wrapping, expansion, copying or detail; hover alone is not sufficient for truncated data.

Keep identity links, active filters/sorting and primary report actions visible. Reserve a utility column for secondary copy/More controls so rows do not shift. Reveal them on hover and focus-within; show More persistently for touch. Draw or test the actual open menu with its trigger, focus, and dismissal behavior.

At narrow widths, prioritize comparable columns and expose the rest through details or column choices. Keep bounded horizontal scrolling when the task needs side-by-side comparison; do not automatically turn every table into unrelated cards. Check sticky columns, overlays and focus at zoomed and narrow sizes.

## Carry report scope through actions and recovery

- State whether filters apply immediately or through Apply. Preserve user state during background refresh and announce meaningful result-count changes without moving focus.
- An export must respect the same permissions and metric meaning as the report. Distinguish full-precision data from displayed rounding, and include enough context for someone opening the file later.
- Show export preparation, cancel where supported, success and retry for asynchronous exports. Preserve the requested scope on retry. Do not claim a download succeeded before the export is ready.
- Keep successful rows visible after refresh failure when safe, with age and recovery context. Partial data needs a qualified total, not a complete-looking footer.
- Cover loading, first-use empty, no matches, missing values, partial, stale, error and permission states that can occur. Reuse the [shared state matrix](interaction-states-and-accessibility.md#design-the-full-state-matrix).

For chart-to-record selection, use [chart inspection and evidence](chart-system-and-quality.md#connect-inspection-to-evidence). For implementation checks, use the [Storybook quality loop](storybook-quality-loop.md).

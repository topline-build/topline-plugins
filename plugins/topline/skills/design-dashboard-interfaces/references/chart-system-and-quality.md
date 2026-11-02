# Chart system and quality

Use when designing or reviewing graphs beyond choosing a chart type. Start with the analytical relationship in [composition and data display](dashboard-composition-and-data.md); use this reference to make its marks, controls, and data claims reliable.

## Define the graph before styling it

Specify the metric, grain, date basis, unit, aggregation, comparison, and relevant source/freshness. State what selection does: inspect a value, filter records, or navigate. Keep the important reading information visible without interaction.

A useful graph has a title, explicit scope and units, appropriate marks and scale, a way to inspect exact values, and source/definition context. Shared scope can live at the nearest common dashboard level; do not repeat every timestamp in every card.

## Choose the marks and their geometry together

| Relationship | Useful default | Check before accepting |
| --- | --- | --- |
| Time trend | Straight line with points when density permits | Equal time intervals use equal distance; missing intervals break the line. |
| Category ranking | Ordered horizontal bars | Fixed label column, shared zero, and ticks derived from the same plot bounds as bar lengths. |
| Part-to-whole | Stacked bars; 100% stacks for proportions | Label series directly where possible. Show denominators so different-sized groups are not mistaken for equal volumes. |
| Distribution | Histogram, box plot, or dot plot | Label counts and bin boundaries. Equal-width histogram bins have equal visual widths; unequal bins require density normalization. |
| Relationship | Scatter plot | Label axes and selected/outlier points. Avoid a causal claim from correlation or arbitrary marker sizes. |
| Activity matrix | Heatmap | Headers and rows share one column grid. Use a shared sequential scale and a count/value path for each cell. |
| Many comparable series | Small multiples | Keep scales and intervals shared when absolute comparison is intended; disclose independently scaled panels. |

Bars start at zero when length encodes magnitude. Line/scatter axes can use a useful nonzero range if the visible ticks make it clear. Disclose logarithmic scales, normalization, cumulative values, or other transformations. Avoid dual axes when aligned panels explain the relationship more clearly.

For custom plots, compute labels, ticks, bars, points, bands, and selection guides from one coordinate system. Do not align a label column by the length of its text. In a design tool, verify actual rendered bounds: a nominal width may be ignored by automatic text sizing. Do not use smoothing or resampling that invents observations.

## Define styling roles, not just colors

Use the published product tokens first. When a graph system is missing, establish these roles and adapt them to its density and viewport:

| Role | Practical starting point |
| --- | --- |
| Actual data | About 2–3px line; 6–8px point markers only where readable |
| Prior period or forecast | Distinct labeled dashed stroke; do not make two meanings indistinguishable in the same graph |
| Grid and axes | Restrained 1px guides, a readable baseline, and a few useful ticks |
| Bars and bins | Consistent width/gap, modest corners; histogram gaps small enough to preserve continuity |
| Text | Chart titles around 16–18px; labels around 12–14px; readable units and numeric alignment |
| Selection | Visible ring/outline plus exact-value detail or a selected-state label |
| Plot margins | Enough room for the longest labels, endpoints, units, and overlays at the intended width |

These are starting points, not overrides for the customer's design system. Inspect at actual size. Thin strokes may need stronger contrast than the numeric minimum suggests.

- **Categorical colors** identify series. Keep the assignment stable when sorting or filtering changes order. Compact graphs usually work with a few visible series; use small multiples or a deliberate series control when crowded.
- **Sequential colors** encode a common magnitude. Keep heatmap scales consistent across comparable rows/panels.
- **Semantic colors** communicate status, quality, or good/bad direction. A revenue increase is not automatically green if its business meaning is unknown.
- **Fill, stroke, and on-fill text are separate roles.** A pale brand accent may work as a fill but fail as a necessary thin line on white. Use the existing numbered graph tokens for marks and matching legends; do not substitute a separate hardcoded blue/purple palette. Retain the accent and add a neutral contrasting boundary when needed, then choose passing on-fill text or external labels. Derive sequential scales from an existing graph token. Do not assume all colors in a long palette work in every role.
- Use direct labels, line patterns, marker shapes, or values to supplement color. Check necessary data marks against adjacent backgrounds at at least 3:1, and normal small text at at least 4.5:1. Do not round a failing ratio up to the threshold. Supporting decorative guides need not compete with the data.

## Make comparisons and claims numerically honest

- State both comparison windows, interval, timezone, and alignment basis. Matched weekdays and matched calendar dates answer different questions. Label partial periods; do not silently compare a partial day/week with a complete one.
- Recompute displayed totals and deltas from the same scoped observations as the plot and data table. Distinguish percentage points from relative percent change. A zero or missing comparison denominator needs an explicit undefined/not-comparable treatment.
- Compare weighted rates using underlying numerators and denominators. Do not average row percentages unless that is the defined metric.
- A most-common bin can contain only 35%; call it the most common interval rather than implying a majority. Titles and summaries must remain true after filtering.
- Keep benchmark lines labeled and visually distinct from observations. Place dated event annotations without covering data or implying causation.

## Connect inspection to evidence

Keep View data or an equivalent discoverable route to the plotted values. A chart summary explains the pattern; a data table supplies exact observations, units, comparison values, and totals. A selected chart mark and its corresponding table row should agree.

Aggregate values alone do not establish source-record details. A design proposal can use labeled synthetic drilldown rows that reconcile with its sample totals, or state that destination data is still needed. A working interface must retrieve the authorized records rather than fabricate them.

| Input/state | Depict or implement |
| --- | --- |
| Rest | Identity, scope, units, series identification, and data route remain visible. |
| Hover | Supplemental tooltip with date/category, exact value/unit, and relevant comparison; keep it away from the selected mark and labels. |
| Keyboard | Visible focus and a way to inspect the same values. Choose a chart-level navigation model or accessible table; avoid thousands of tab stops. |
| Pinned detail | Deliberate selection keeps detail open; a labeled drilldown opens the matching records. |
| Touch/narrow | Persistent inspection sheet or equivalent; visible More; comfortable controls around 44px where space permits. Reduce ticks or series rather than shrinking text. |
| Filtered selection | Selected mark plus removable scope chip, linked result count, and clear/reset route. |
| Return | Preserve relevant filters, sort, page, selection, and scroll; restore originating focus. |

If series visibility is configurable, show hidden-series state, allow restoration, and handle all-series-hidden deliberately. Do not quietly change the scale or totals in a way that changes the comparison's meaning.

Export should be understandable on its own: name current and comparison dates, branches/entities, series, filters, units, and timezone. Distinguish chart-data CSV from record export and chart-image export. Preserve context in the output, full data precision where appropriate, and the viewer's authorized scope.

## Represent uncertainty and failure faithfully

- **Zero:** show a received zero at its correct coordinate.
- **Missing:** break the line; label unavailable periods and qualify totals over received data. A gap is not a zero and is not an invitation to interpolate.
- **Partial:** name missing scope and which totals remain valid. Keep incomplete totals visibly qualified.
- **Stale/error:** retain safe last-good data with the last successful timestamp and a retry route. Do not reset freshness when retry starts or replace a failed fetch with invented observations.
- **Forecast:** distinguish observed and predicted periods with labels and stroke treatment. Label the interval's meaning/level and show its extent with contrasting boundaries or exact bounds. Do not invent a confidence level; a synthetic design specimen must say it is illustrative. Exclude forecasts from actual totals unless explicitly defined otherwise.
- **Definitions:** provide a reachable expanded metric definition or assumptions state when meaning is non-obvious. Include inclusions, exclusions, date basis, rounding and, for a real forecast, method and relevant limitations. An unexplained info icon is insufficient evidence.

Use the [state matrix](interaction-states-and-accessibility.md#design-the-full-state-matrix) for loading, empty, no-match, and permission recovery.

## Reference patterns to inspect

These are references for particular decisions, not templates to copy wholesale. Verify the current relevant screen when researching a new design.

- [Linear Insights](https://linear.app/docs/insights): graph selection linked to evidence records; [Linear's own dashboard examples](https://linear.app/now/dashboards-best-practices) show audience-specific compositions.
- [Our World in Data](https://ourworldindata.org/grapher/population): units, direct series labels, sparse guides, source and caveat placement. Avoid importing many overlapping series into a small card.
- [Stripe Dashboard charts](https://support.stripe.com/questions/dashboard-home-page-charts-for-business-insights?locale=en-GB): comparison windows and metric context close to the analytical view.
- [Vercel Web Analytics](https://vercel.com/docs/analytics/using-web-analytics): explicit scope and panel-level export.
- [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): evaluate text and meaningful graphics separately.

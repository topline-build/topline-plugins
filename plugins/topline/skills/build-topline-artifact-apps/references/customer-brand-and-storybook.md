# Customer Brand and Storybook

The customer's published design-system Storybook is both a brand reference and
a component catalog. Customers can describe the character of their brand,
visual principles, voice, layout preferences, and intended component usage in
that Storybook. Use the published version when designing an artifact with a
visual surface.

## Inspect before designing

1. Use the task-provided Storybook MCP. Call `list-all-documentation`, then open
   the brand guidance and the closest relevant component or page stories with
   `get-documentation` or `get-documentation-for-story`.
2. Read the human-authored brand guidance as design intent. Inspect rendered
   stories for concrete evidence of hierarchy, density, typography, color,
   spacing, shape, imagery, interaction, and voice.
3. Use the corresponding vendored components and tokens from
   `src/design-system/`. Materialize approved logos or imagery through the asset
   tools when the brief needs them.
4. Build the app's own stories and rendered draft in that visual language.

Do not treat Storybook as only a test harness. It is the customer's durable
reference for what an application should feel like. Do not infer the brand from
a logo alone or replace a published customer direction with generic dashboard
styling.

## Authority and fallback

Use the current published design system, not an unpublished draft, stale local
copy, or another tenant's stories. The task brief controls the app's purpose;
the published Storybook controls its established visual language. Accessibility,
truthful data presentation, and artifact security/runtime constraints still
apply when a brand preference conflicts with them.

If the Storybook MCP or published design system is unavailable, report that
limitation and use the blessed template plus its vendored defaults. Do not invent
customer-specific colors, typography, voice, or brand rules.

## Validate against the reference

Compare the rendered artifact with the referenced customer stories at desktop
and mobile sizes. Verify the app uses the intended components and tokens and
that its hierarchy, density, voice, and interaction feel related to the
customer's examples without copying an unrelated page layout. Keep the normal
loading, empty, zero, partial, stale, error, permission, dense-data, and long-label
states in the app's Storybook or equivalent rendered validation surface.

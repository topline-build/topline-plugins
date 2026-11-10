---
name: topline-design-system-storybook
description: Use the company's published design system Storybook from Claude Code or Codex through the Topline MCP. Use before building or reviewing any Topline artifact UI, when choosing components, props or brand styling, when sharing story previews, or when someone asks to change the design system itself.
---

# Topline design system Storybook

Every Topline account has a design system Storybook: the components, tokens and brand guidance its artifact apps use. Read it through the `platform_storybook` tool on the Topline connection. Don't add a second MCP server, start a browser, or read component source first.

## Which Storybook this is

- **The company's design system** (this skill): components such as `Breadcrumbs`, `DatePicker` and `Graphs` that artifact apps import from `src/design-system/`. `platform_storybook` reads it.
- **Topline's own app UI** (`apps/web/src/components/ui` in the topline-app repository) is a different Storybook. It is not in the Topline MCP. When you work in that repository, run `npm run storybook` there instead.

If you can't tell which one the task means, say which one you used.

## Workflow

1. **List once at the start.** Call `platform_storybook` with `action: "list"`. Add `withStoryIds: true` only when you'll preview stories. Use only IDs it returns, and never guess an ID.
2. **Read docs in one call.** Call `action: "docs"` with every component you plan to use in `ids` (up to 10). Pass a single ID with `storyName` to read one story variant. Take props, variants and usage from these docs. If a component or prop isn't documented, say so instead of inventing it.
3. **Build with the vendored components.** Import from `src/design-system/` in the artifact app. Don't restyle them or recreate them with generic markup. Treat the brand guidance in the docs as the visual reference.
4. **Share previews.** Call `action: "preview"` with the story IDs that show what you used, and put the returned links in your reply. They open for anyone signed in to Topline. They aren't screenshots, so don't claim you saw the rendered result.

Call the tool once per step. Don't call `list` again for each component.

## When it fails

- `storybook_session_not_ready` or `storybook_busy`: the Storybook is starting. Wait about 30 seconds and retry once.
- `storybook_unavailable`: the design system Storybook can't run for this account right now. Tell the person, and don't invent components in its place. If you continue, use plain, accessible markup and say that you did.
- `scope_required:harness:artifact:read`: the sign-in lacks read access. Ask the person to reconnect Topline.

## Changing the design system itself

Reading is all most tasks need. To change components or brand guidance, use the Storyboard tools, which need the `storyboard:write` permission:

1. `platform_get_design_system_state` for the published commit and any draft.
2. `platform_checkout_design_system` into a new folder, then `npm ci` and `npm run storybook` there to iterate locally.
3. `platform_submit_design_system_draft` with the exact commit and draft ID from step 1. Wait for the server build and review the private preview.
4. `platform_publish_design_system` only after the person approves the preview.

Never publish without the person's go.

# Changelog

All notable changes to zephyr-framework are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/).

## Stability contract

The agent-facing surface is the API contract other software depends on. Within a
major version, these do not break:

- **`Zephyr.agent` methods** — `act`, `getState`, `describe`, `setState`, `getSchema`,
  `getPrompt`, `observe`/`observeDiffs`, `render`, `compose`, `visualize`, `annotate`,
  `headless`, `lock`/`unlock`, `guard`/`confirm`/`deny`, `record`
- **Machine-readable contracts** — `zephyr-schema.json`, `zephyr-prompt.md`,
  `zephyr-a2ui-catalog.json` (fields may be added, not removed or repurposed)
- **Component tags, state attributes (`data-open`, `data-active`, …), and events**
- **MCP tool names and input schemas** (`zephyr_act`, `zephyr_get_state`, …)

New methods, tools, attributes, and schema fields land in minor versions.

## [Unreleased]

### Added
- **WebMCP adapter (`zephyr-webmcp.js`)** — registers every Zephyr agent capability
  as a native browser-agent tool via the W3C WebMCP API
  (`document.modelContext.registerTool()`), with `guard()` confirmations preserved.
  Auto-registers when the API is present; no-op otherwise. The `zephyr-browser/`
  Electron PoC that anticipated this pattern is archived.
- **A2UI renderer (`zephyr-a2ui.js`)** — consumes Google's A2UI v0.8 JSONL protocol
  (`surfaceUpdate` / `dataModelUpdate` / `beginRendering`) and renders to DOM with
  data binding, template lists, two-way inputs, and `userAction` callbacks. The
  other half of `zephyr-a2ui-catalog.json`.
- **Auto-Visualizer** — `Zephyr.agent.visualize(data, container, options?)` routes any
  data shape to the right component (z-chart, z-stat, z-sortable/z-virtual-list,
  z-data-grid), plus purpose-named agent tools `zephyr_show_chart`, `zephyr_show_table`,
  `zephyr_show_stats`, `zephyr_show_list` in the MCP server and AI SDK example.
  Live demo: `visualizer.html`.
- **Streaming in `<z-agent>`** — responses render token-by-token via SSE for both
  Anthropic and OpenAI, in direct and proxy modes (non-streaming proxies still work).
- **Widget error handling** — request/stream timeouts, friendly messages for
  401/429/529 errors, and an in-chat retry button.
- **MCP Apps exploration** — `examples/mcp-apps/` has a SEP-1865 UI-resource template
  (Zephyr + Auto-Visualizer in a sandboxed iframe over JSON-RPC/postMessage) and a
  go/no-go assessment.
- **"Zephyr and the agentic stack"** positioning section in the README mapping
  A2A → MCP → WebMCP → A2UI → AG-UI and Zephyr's place beneath them.
- **Headless CI** — `npm test` runs all `tests/test-*.html` pages in headless Chromium
  via `tests/run-ci.js` (Playwright, devDependency only); GitHub Actions workflow at
  `.github/workflows/ci.yml`. Results publish to `window.__zephyrTestResults`.

### Changed
- `<z-agent>` default Anthropic model updated from the retiring
  `claude-sonnet-4-20250514` to `claude-haiku-4-5`; AI SDK example moved to
  `claude-sonnet-4-6`.
- `render()` `setup` calls now route through the same action adapters as `act()`,
  so `setup.params` uses the object convention everywhere
  (`{ method: 'setData', params: { data } }`).
- `withTransition()` respects `prefers-reduced-motion` and agent headless mode
  (mutations apply synchronously), and no longer leaks unhandled rejections when a
  View Transition is skipped.

### Accessibility
- New axe-core audit in CI (`npm run test:a11y`) — zero serious/critical WCAG 2.1 AA
  violations on the demo pages.
- Select/combobox listboxes get accessible names; the file-upload input gets a label;
  scrollable regions (combobox listbox, z-infinite-scroll, z-virtual-list) are
  keyboard-focusable; z-data-grid's `role="table"` moved to a wrapper so the toolbar
  and footer no longer violate required-children.
- Scroll-driven and entrance animations respect `prefers-reduced-motion` (previously
  content could be left dimmed or shifting).
- Inactive tabs and the upload dropzone no longer rely on `opacity` dimming, which
  pushed text below WCAG contrast thresholds.

### Fixed
- Trigger buttons (`<button slot="trigger">`) inside a `<form>` no longer submit the
  form when clicked — they default to `type="button"` unless an explicit type is set.
- `z-modal` now mirrors its open state to `data-open` on the host element, so
  `getState()`, `observe()`, and `observeDiffs()` see modal open/close (previously
  invisible to agents).
- `visualize()` returns structured errors for empty/malformed data and a clear
  message when the dashboard add-on isn't loaded, instead of throwing.
- `tests/test-data-grid.html` had a literal `</script>` inside a string that
  terminated the script element — the suite never actually ran.

## [1.0.0] — 2026-04-25

First stable release: 14 core components, `Zephyr.agent` API, MCP server, A2UI
catalog, dashboard and runtime add-ons, `<z-agent>` chat widget, action guard
system, multi-agent locks, headless mode, and action recording.

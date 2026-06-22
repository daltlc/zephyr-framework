# Zephyr × MCP Apps (SEP-1865) — Exploration

[MCP Apps](https://modelcontextprotocol.io/community/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp) is the first official extension to the Model Context Protocol (stable January 2026, Linux Foundation), co-designed by Anthropic and OpenAI by consolidating MCP-UI and OpenAI's Apps SDK work. It lets an MCP server attach an interactive UI to a tool:

1. The server declares a **UI resource** under the `ui://` scheme containing HTML (`text/html;profile=mcp-app`).
2. The tool definition references it via `_meta.ui.resourceUri`.
3. The host renders the HTML in a **sandboxed iframe** and the two sides speak **JSON-RPC over `postMessage`**.

## What's in this directory

- **`zephyr-app.html`** — a UI-resource template that loads Zephyr from CDN, bridges the JSON-RPC/postMessage protocol, and feeds incoming tool-result data to `Zephyr.agent.visualize()`. Whatever shape the tool returns (time series, KPIs, records), the right component renders — no per-tool UI code.

## Registering it from an MCP server

```js
// Declare the UI resource
mcpServer.resource('zephyr-app', 'ui://zephyr/app.html', async () => ({
  contents: [{
    uri: 'ui://zephyr/app.html',
    mimeType: 'text/html;profile=mcp-app',
    text: fs.readFileSync('examples/mcp-apps/zephyr-app.html', 'utf8'),
  }],
}));

// Attach it to a tool via metadata
mcpServer.tool('get_sales_report', 'Fetch the sales report', {/* schema */},
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(report) }],
    structuredContent: report,
    _meta: { ui: { resourceUri: 'ui://zephyr/app.html' } },
  })
);
```

## Assessment: GO (as a template, not a hosted product)

**Why go:**

- **Perfect fit for Zephyr's constraints.** MCP App UIs run in sandboxed iframes with no build pipeline — exactly the environment Zephyr is designed for (two script tags, zero dependencies, CSP-compatible, no `eval`).
- **The Auto-Visualizer is the killer pairing.** Most MCP Apps render *data a tool returned*. `Zephyr.agent.visualize()` collapses "write a custom UI per tool" into "return the data" — a genuinely lower-effort path than React-based app kits.
- **Backed by both Anthropic and OpenAI**, stable status, and host support growing (Claude, Goose, Postman were early adopters).

**Why not a deeper commitment yet:**

- Host implementations are young and the host-side API surface (which notifications carry tool results, theming, sizing) still varies; the bridge in `zephyr-app.html` keeps that surface deliberately small.
- The extension's value depends on hosts users actually run. Revisit a first-class `zephyr-mcp` integration (auto-attaching the visualizer app to every `zephyr_show_*` tool) once two or more mainstream hosts render MCP Apps by default.

**Recommended next step when revisiting:** add an opt-in flag to `zephyr-mcp/server.js` that declares `ui://zephyr/app.html` and stamps `_meta.ui.resourceUri` onto the visualization tools.

## References

- [MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/)
- [SEP-1865 specification](https://modelcontextprotocol.io/community/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
- [ext-apps repository](https://github.com/modelcontextprotocol/ext-apps)

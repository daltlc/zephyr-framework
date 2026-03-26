# Zephyr MCP Server

MCP (Model Context Protocol) server that exposes Zephyr UI components as AI agent tools. This lets Claude Desktop, Cursor, and any MCP-compatible host discover and control Zephyr components running in a browser.

## Why this exists

Today, when an AI agent needs to interact with a web UI, it has two bad options:

1. **Screenshot parsing** (computer use) — Slow, brittle, token-expensive. A minor CSS change breaks everything.
2. **Raw HTML analysis** — The agent parses DOM structure, guesses what elements do, and writes JavaScript to manipulate them. High token cost, error-prone.

The Zephyr MCP server eliminates both problems. Instead of parsing pixels or HTML, the agent gets **typed, structured tools**:

```
Agent thinks: "I need to open the settings modal"
Agent calls:  zephyr_act({ selector: '#settings', action: 'open' })
Agent gets:   { success: true }
```

The agent doesn't need to know about `<dialog>`, View Transitions, or CSS selectors for state. It just calls a function.

## What you can build with this

- **Agent-controlled dashboards** — An agent calls `zephyr_get_schema` to learn available components, generates a page with tabs/selects/modals, then drives the UI via `zephyr_act` — switching views, opening detail panels, selecting filters
- **AI-powered testing** — Instead of writing Playwright scripts, tell Claude Desktop: "Test that the accordion opens, closes, and fires the toggle event." The agent uses `zephyr_get_state` to check component states and `zephyr_act` to interact
- **Agent-assisted form filling** — An agent fills complex forms by calling `zephyr_act('#country', 'select', { value: 'US' })` and `zephyr_act('#date', 'set', { value: '2026-04-01' })` — these are form-associated components that participate in native FormData, so the form just works
- **Live debugging** — Working in Claude Code or Cursor and something looks wrong? Ask the agent to inspect the page — it calls `zephyr_get_state()` and instantly sees every component's state as structured JSON
- **Agent skills and tools** — Build custom agent skills that leverage Zephyr components. Your skill calls `zephyr_get_schema` to know what's available, `zephyr_act` to control components, and `zephyr_get_prompt` to inject UI context into the agent's working memory

## Architecture

```
Claude Desktop / Cursor / MCP Host
    ↕ stdio (JSON-RPC 2.0)
zephyr-mcp/server.js
    ↕ WebSocket (localhost:3456)
Browser tab running Zephyr page
    ↕ direct JavaScript calls
Zephyr.agent API
```

The server is a single Node.js process with three responsibilities:
1. **HTTP file server** — Serves the Zephyr demo page and framework files
2. **WebSocket bridge** — Connects the MCP server to the browser
3. **MCP stdio server** — Implements the Model Context Protocol

## Prerequisites

- Node.js 18+
- npm

## Setup

**Option A: Via `create-zephyr-framework` (recommended)**

```bash
npx create-zephyr-framework my-app
cd my-app
npm start
```

This scaffolds a project with the framework, MCP server, and a starter page — all wired up.

**Option B: Add to an existing project**

```bash
npm install zephyr-framework-mcp
npx zephyr-mcp
```

Run `npx zephyr-mcp` from your project directory (where your `index.html` lives). The server automatically finds your HTML files and framework assets.

**Option C: From the framework repo (development)**

```bash
cd zephyr-mcp
npm install
node server.js
```

## Usage

### 1. Start the server

```bash
npm start        # if using create-zephyr-framework
npx zephyr-mcp   # if installed standalone
node server.js   # if running from the repo
```

This starts both the MCP stdio transport and the HTTP bridge on port 3456. The server logs which directory it's serving files from so you can verify it found your project.

### 2. Open the bridge page

Open `http://localhost:3456` in your browser. You should see the Zephyr demo page with a `[Zephyr MCP] Bridge connected` message in the browser console.

### 3. Configure your MCP host

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zephyr": {
      "command": "node",
      "args": ["/absolute/path/to/zephyr-mcp/server.js"]
    }
  }
}
```

#### Custom port

Set the `ZEPHYR_MCP_PORT` environment variable:

```json
{
  "mcpServers": {
    "zephyr": {
      "command": "node",
      "args": ["/absolute/path/to/zephyr-mcp/server.js"],
      "env": {
        "ZEPHYR_MCP_PORT": "8080"
      }
    }
  }
}
```

## Available Tools

### `zephyr_act`

Perform a high-level action on a Zephyr component.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string | CSS selector (e.g., `#my-modal`, `z-select`) |
| `action` | string | Action name (e.g., `open`, `close`, `select`, `next`) |
| `params` | object? | Optional parameters (e.g., `{ value: "red" }`) |

**Examples:**
```
"Open the modal"       → zephyr_act({ selector: "#my-modal", action: "open" })
"Select the red option" → zephyr_act({ selector: "#color-select", action: "select", params: { value: "red" } })
"Next slide"           → zephyr_act({ selector: "z-carousel", action: "next" })
```

### `zephyr_get_state`

Snapshot all Zephyr component states on the page.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string? | Optional filter (omit for all components) |

Returns: Array of `{ tag, id, state, actions }` objects.

### `zephyr_describe`

Get a detailed description of a specific component.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string | CSS selector for the component |

Returns: `{ tag, id, state, actions, slots, events, methods, description }`.

### `zephyr_set_state`

Directly set or remove data attributes on a component.

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | string | CSS selector |
| `attributes` | object | Attributes to set/remove (null to remove) |

### `zephyr_get_schema`

Get the full component schema with all 13 components, their actions, events, and methods. Call this once to understand what's available.

### `zephyr_get_prompt`

Generate a markdown summary of all components currently on the page with their states and available actions.

## Troubleshooting

**"No browser connected"** — Open `http://localhost:3456` in your browser. The bridge-client.js script auto-connects via WebSocket.

**Port conflict** — Change the port with `ZEPHYR_MCP_PORT=8080 node server.js`.

**Testing tools** — Use the MCP Inspector to test interactively:
```bash
npx @modelcontextprotocol/inspector node server.js
```

## How it works

1. The MCP host (Claude Desktop) spawns `server.js` as a child process
2. `server.js` starts an HTTP server on port 3456 and listens for MCP messages on stdin
3. When you open `http://localhost:3456`, the demo page loads with `bridge-client.js` injected
4. `bridge-client.js` opens a WebSocket connection back to the server
5. When an agent calls a tool (e.g., `zephyr_act`), the server sends the request over WebSocket
6. `bridge-client.js` calls `Zephyr.agent.act()` in the browser and sends the result back
7. The server returns the result to the MCP host via stdout

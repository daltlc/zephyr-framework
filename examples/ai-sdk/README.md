# Zephyr + Vercel AI SDK — Agent-Controlled UI Components

Give an AI agent real-time control over web UI components using the [Vercel AI SDK](https://sdk.vercel.ai) and [Zephyr Framework](https://github.com/daltlc/zephyr-framework).

The agent can inspect, interact with, and create Zephyr web components through 7 AI SDK tools — open modals, switch tabs, select options, build dashboards, and more.

## Quick start

```bash
git clone https://github.com/daltlc/zephyr-framework.git
cd zephyr-framework/examples/ai-sdk
npm install
cp .env.example .env    # Add your Anthropic API key
node server.js
```

Open http://localhost:3457 and try:

- "What components are on the page?"
- "Open the modal"
- "Switch to the Agent API tab"
- "Select Zephyr from the dropdown"
- "Create a stat card showing revenue of $1.2M"

## Architecture

```
Browser                          Server                         Claude
┌─────────────────────┐   ┌──────────────────────┐   ┌─────────────────┐
│ Zephyr components   │   │ Express + AI SDK      │   │                 │
│ + bridge-client.js  │◄─►│ 7 tool() definitions  │◄─►│ Tool calls      │
│                     │ WS│ callBrowser() bridge   │API│ Text responses  │
└─────────────────────┘   └──────────────────────┘   └─────────────────┘
```

1. User types a message in the chat UI
2. Server sends it to Claude via `generateText()` with 7 Zephyr tools
3. Claude calls tools (e.g., `zephyr_act`) to interact with the page
4. Tool `execute()` forwards the call over WebSocket to the browser
5. `bridge-client.js` runs `Zephyr.agent.act(...)` and returns the result
6. Claude sees the result and responds to the user

## Tools

| Tool | Maps to | Purpose |
|------|---------|---------|
| `zephyr_get_state` | `Zephyr.agent.getState()` | Snapshot all component states |
| `zephyr_describe` | `Zephyr.agent.describe()` | Deep-inspect one component |
| `zephyr_act` | `Zephyr.agent.act()` | Perform actions (open, close, select, etc.) |
| `zephyr_set_state` | `Zephyr.agent.setState()` | Set/remove data attributes |
| `zephyr_get_schema` | `Zephyr.agent.getSchema()` | Get full component registry |
| `zephyr_render` | `Zephyr.agent.render()` | Create new components |
| `zephyr_compose` | `Zephyr.agent.compose()` | Build dashboard layouts |

## How it works

Each tool is defined with the AI SDK's `tool()` function:

```js
import { tool } from 'ai';
import { z } from 'zod';

const zephyr_act = tool({
  description: 'Perform an action on a Zephyr component.',
  inputSchema: z.object({
    selector: z.string(),
    action: z.string(),
    params: z.record(z.any()).optional(),
  }),
  execute: async ({ selector, action, params }) =>
    callBrowser('act', [selector, action, params]),
});
```

The `callBrowser()` function sends the call over WebSocket to the browser, where `bridge-client.js` executes the corresponding `Zephyr.agent` method and returns the result.

## Adapting for your project

1. Install Zephyr in your app: `npm install zephyr-framework` (or use the CDN)
2. Copy the 7 tool definitions from `server.js` into your AI SDK route
3. Add the WebSocket bridge (`bridge-client.js`) to your frontend
4. Point `callBrowser()` at your WebSocket connection

The tools work with any Zephyr component — the 14 core components, dashboard add-on, and runtime add-on are all controllable.

## Requirements

- Node.js 18+
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

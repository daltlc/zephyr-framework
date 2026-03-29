# Zephyr Browser - WebMCP Proof of Concept

A minimal Electron app showing what we're calling the **WebMCP** pattern. The browser process acts as the AI agent, controls Zephyr web components via IPC, and your API keys never touch the webpage.

## What is WebMCP?

Right now if you want an AI agent to control a webpage, you either need a server in the middle or you embed the agent directly in the page (which means your API keys are just sitting there in the source). Neither is great.

**WebMCP is a different approach:**

- The **browser process** holds the API keys and runs the AI agent
- The **webpage** just exposes what it can do
- A **secure bridge** (IPC) connects them - keys never cross

Eventually this could be a browser-native API like `navigator.webmcp`. This demo proves the pattern works using Electron's IPC as the transport.

## Quick Start

The app reads your API key from the project root `.env` file automatically.

```bash
cd zephyr-browser
npm install
npm start
```

Or pass the key directly:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process                                  │
│  ┌──────────────────┐    ┌───────────────────────────┐  │
│  │  Agent Loop       │    │  API Key (env var)        │  │
│  │  - conversation   │    │  - never sent to renderer │  │
│  │  - tool dispatch  │    │  - used for Anthropic API │  │
│  └────────┬─────────┘    └───────────────────────────┘  │
│           │ IPC                                          │
├───────────┼─────────────────────────────────────────────┤
│           v                                              │
│  Preload Bridge (the "WebMCP" layer)                    │
│  - Receives { id, method, args } from main              │
│  - Calls Zephyr.agent[method](...args)                  │
│  - Returns { id, result } to main                       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Web Page (renderer)                                     │
│  - Loads Zephyr demo page                               │
│  - Has NO access to API keys                            │
│  - Exposes capabilities via Zephyr.agent API            │
└─────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `main.js` | Electron main process - agent loop, Anthropic API, IPC hub |
| `preload.js` | The WebMCP bridge - translates IPC to Zephyr.agent calls |
| `agent-preload.js` | Agent panel bridge - chat UI to main process |
| `agent-panel.html` | Split-pane UI with educational splash + chat |
| `agent-panel.js` | Chat renderer logic |
| `styles.css` | Agent panel styling (matches Zephyr demo design) |

## Try It

1. Start the app and read the splash screen
2. Click "Try it" to open the chat
3. Ask: "What components are on the page?"
4. Ask: "Open the modal"
5. Watch the agent call `zephyr_act` via IPC - the modal opens on the left, keys stayed on the right

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key |
| `ZEPHYR_MODEL` | `claude-haiku-4-20250506` | Model to use |

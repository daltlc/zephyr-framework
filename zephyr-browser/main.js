/**
 * Zephyr Browser  - Main Process (Agent Host)
 *
 * This is the core of the WebMCP POC. The main process:
 *   1. Creates a split-pane window (Zephyr demo page + agent panel)
 *   2. Holds the API key (never sent to any renderer)
 *   3. Runs the AI agent conversation loop
 *   4. Forwards tool calls to the webpage via IPC
 *
 * Communication flow:
 *   User → Agent Panel → IPC → Main Process → Anthropic API
 *                                    ↓ IPC (tool calls)
 *                              Preload Bridge
 *                                    ↓ Zephyr.agent.*
 *                              Web Page (no keys)
 */

'use strict';

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Load .env from project root (zero dependencies  - just read the file)
// ---------------------------------------------------------------------------

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    // Don't override existing env vars (CLI takes precedence)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ZEPHYR_MODEL || 'claude-haiku-4-20250506';
const MAX_ITERATIONS = 10;

// Path to the Zephyr demo page (parent directory)
const DEMO_PAGE = path.resolve(__dirname, '..', 'index.html');

// ---------------------------------------------------------------------------
// Tool Definitions (reused from zephyr-agent-widget.js)
// ---------------------------------------------------------------------------

const ZEPHYR_TOOLS = [
  {
    name: 'zephyr_get_state',
    description: 'Get the current state of all Zephyr components on the page. Returns tag name, id, state attributes (data-open, data-active, etc.), and available actions for each component. Call this first to understand what is on the page.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Optional CSS selector to filter components (e.g., "z-modal" for only modals). Omit to get all components.'
        }
      }
    }
  },
  {
    name: 'zephyr_describe',
    description: 'Get a detailed description of a specific component including state, available actions, slots, events, and methods. Use this when you need to deeply understand one component.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the component (e.g., "#my-modal", "z-tabs")'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'zephyr_act',
    description: 'Perform an action on a Zephyr component. Actions include: open, close, toggle, select, next, prev, goto, show, set, activate, complete. Use zephyr_get_state first to see available actions per component.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the component (e.g., "#my-modal", "z-select")'
        },
        action: {
          type: 'string',
          description: 'Action name (e.g., "open", "close", "select", "next")'
        },
        params: {
          type: 'object',
          description: 'Optional parameters (e.g., { value: "red" } for select, { tab: "pricing" } for tabs activate)'
        }
      },
      required: ['selector', 'action']
    }
  },
  {
    name: 'zephyr_set_state',
    description: 'Set or remove data attributes on a component. Pass null to remove an attribute, true to set a boolean attribute, or a string for a valued attribute.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the component'
        },
        attributes: {
          type: 'object',
          description: 'Attributes to set or remove (e.g., { "data-open": true } to set, { "data-open": null } to remove)'
        }
      },
      required: ['selector', 'attributes']
    }
  },
  {
    name: 'zephyr_get_schema',
    description: 'Get the complete component schema with all available components, their actions, slots, events, and methods. Call this once to understand what Zephyr components exist.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'zephyr_get_prompt',
    description: 'Get a markdown summary of all Zephyr components currently on the page, including their state and available actions. Useful for understanding the full page context.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'zephyr_render',
    description: 'Create and insert a new Zephyr component into the page. Use this to dynamically build UI elements. Only registered z-* tags and safe HTML tags are allowed.',
    input_schema: {
      type: 'object',
      properties: {
        container: { type: 'string', description: 'CSS selector for the container to insert into' },
        spec: {
          type: 'object',
          description: 'Component spec: { tag, id?, attributes?, text?, children?, setup?, position? }',
          properties: {
            tag: { type: 'string', description: 'Element tag name (z-stat, z-chart, z-dashboard, etc.)' },
            id: { type: 'string', description: 'Element ID' },
            attributes: { type: 'object', description: 'data-* and aria-* attributes' },
            text: { type: 'string', description: 'Text content' },
            children: { type: 'array', description: 'Child element specs' },
            setup: { type: 'object', description: '{ method, params } to call after insertion' },
            position: { type: 'number', description: 'Insert position index' }
          },
          required: ['tag']
        }
      },
      required: ['container', 'spec']
    }
  },
  {
    name: 'zephyr_compose',
    description: 'Compose a complete dashboard layout from a declarative spec. Creates a z-dashboard with panels, each containing a component.',
    input_schema: {
      type: 'object',
      properties: {
        container: { type: 'string', description: 'CSS selector for the container' },
        layout: {
          type: 'object',
          description: '{ tag?, id?, attributes?, panels: [{ id, colspan?, rowspan?, title?, component: spec }] }',
          properties: {
            tag: { type: 'string', description: 'Dashboard tag (default: z-dashboard)' },
            id: { type: 'string', description: 'Dashboard ID' },
            attributes: { type: 'object', description: 'Dashboard attributes' },
            panels: { type: 'array', description: 'Panel definitions with components' }
          },
          required: ['panels']
        }
      },
      required: ['container', 'layout']
    }
  }
];

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an AI agent running inside the Zephyr Browser  - a WebMCP proof-of-concept.

You control Zephyr web components on the page using tools. The key insight: you run in the browser's main process, NOT on the webpage. Your API keys never touch the webpage.

Workflow:
1. Call zephyr_get_state() first to see what components are on the page
2. Use zephyr_act() to interact with components (open modals, switch tabs, etc.)
3. Use zephyr_describe() for detailed info about a specific component
4. Be conversational  - explain what you're doing and what you see

You can also use zephyr_render() and zephyr_compose() to create new components dynamically.

Keep responses concise. When you perform actions, describe what happened.`;

// ---------------------------------------------------------------------------
// Pending Requests (IPC correlation)
// ---------------------------------------------------------------------------

/** @type {Map<string, {resolve: Function, reject: Function}>} */
const pendingRequests = new Map();

/** @type {Electron.WebContents|null} */
let webviewContents = null;

/** @type {Electron.WebContents|null} */
let panelContents = null;

// ---------------------------------------------------------------------------
// IPC → Renderer bridge (mirrors zephyr-mcp/server.js callBrowser)
// ---------------------------------------------------------------------------

/**
 * Send a Zephyr.agent method call to the webview via IPC and await the result.
 * Uses UUID-based request/response correlation  - same pattern as the MCP
 * WebSocket bridge, but over Electron IPC instead.
 *
 * @param {string} method - Zephyr.agent method name
 * @param {Array} args - Arguments to pass to the method
 * @returns {Promise<any>} - The method's return value
 */
function callRenderer(method, args) {
  return new Promise((resolve, reject) => {
    if (!webviewContents || !panelContents) {
      reject(new Error('Webview not connected. The Zephyr page has not loaded yet.'));
      return;
    }

    const id = crypto.randomUUID();
    pendingRequests.set(id, { resolve, reject });

    // Send to the panel, which relays to the webview via its <webview>.send()
    panelContents.send('zephyr:relay-execute', { id, method, args });

    // Timeout after 10 seconds (same as MCP server)
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Webview call timed out after 10s for method: ' + method));
      }
    }, 10000);
  });
}

// ---------------------------------------------------------------------------
// Tool Execution (mirrors zephyr-agent-widget.js _executeTool)
// ---------------------------------------------------------------------------

/**
 * Execute a Zephyr tool by dispatching to the renderer via IPC.
 *
 * @param {string} name - Tool name (e.g., 'zephyr_act')
 * @param {object} input - Tool input parameters
 * @returns {Promise<any>} - Tool result
 */
async function executeTool(name, input) {
  const methodMap = {
    zephyr_get_state:  () => callRenderer('getState', input.selector ? [input.selector] : []),
    zephyr_describe:   () => callRenderer('describe', [input.selector]),
    zephyr_act:        () => callRenderer('act', [input.selector, input.action, input.params]),
    zephyr_set_state:  () => callRenderer('setState', [input.selector, input.attributes]),
    zephyr_get_schema: () => callRenderer('getSchema', []),
    zephyr_get_prompt: () => callRenderer('getPrompt', []),
    zephyr_render:     () => callRenderer('render', [input.container, input.spec]),
    zephyr_compose:    () => callRenderer('compose', [input.container, input.layout]),
  };

  const handler = methodMap[name];
  if (!handler) {
    return { error: 'Unknown tool: ' + name };
  }

  try {
    return await handler();
  } catch (err) {
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Agent Conversation Loop
// ---------------------------------------------------------------------------

/** @type {Array<{role: string, content: any}>} */
let messages = [];

/**
 * Run the agent conversation loop for a user message.
 * Calls the Anthropic API, executes tool calls via IPC, and loops
 * until the model gives a text-only response.
 *
 * @param {string} userMessage - The user's message text
 * @returns {Promise<string>} - The assistant's final text response
 */
async function runAgentLoop(userMessage) {
  messages.push({ role: 'user', content: userMessage });

  // Notify panel: thinking
  if (panelContents) {
    panelContents.send('agent:status', 'thinking');
  }

  let finalText = '';
  let iterations = 0;

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // Call Anthropic API (raw fetch  - no SDK needed)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: messages,
          tools: ZEPHYR_TOOLS
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const textBlocks = data.content.filter(b => b.type === 'text');
      const toolBlocks = data.content.filter(b => b.type === 'tool_use');

      // No tool calls  - we're done
      if (toolBlocks.length === 0) {
        finalText = textBlocks.map(b => b.text).join('');
        messages.push({ role: 'assistant', content: finalText });
        break;
      }

      // Has tool calls  - add assistant message with full content blocks
      messages.push({ role: 'assistant', content: data.content });

      // Execute each tool call
      const toolResults = [];
      for (const tool of toolBlocks) {
        // Notify panel: executing tool
        if (panelContents) {
          panelContents.send('agent:tool-call', {
            name: tool.name,
            input: tool.input
          });
        }

        // Execute via IPC to webview
        const result = await executeTool(tool.name, tool.input);

        // Notify panel: tool result
        if (panelContents) {
          panelContents.send('agent:tool-result', {
            name: tool.name,
            result: result
          });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result)
        });
      }

      // Add all tool results as a single user message
      messages.push({ role: 'user', content: toolResults });

      // Capture any text alongside tool calls
      if (textBlocks.length > 0) {
        finalText = textBlocks.map(b => b.text).join('');
      }
    }

    if (!finalText && iterations >= MAX_ITERATIONS) {
      finalText = 'I performed several actions but reached the iteration limit.';
    }

  } catch (err) {
    finalText = '';
    if (panelContents) {
      panelContents.send('agent:error', err.message || 'Failed to reach the AI service.');
    }
  }

  // Notify panel: done
  if (panelContents) {
    panelContents.send('agent:status', 'idle');
    if (finalText) {
      panelContents.send('agent:message', finalText);
    }
  }

  return finalText;
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

// Agent panel sends a user message
ipcMain.handle('agent:send-message', async (_event, userMessage) => {
  if (!API_KEY) {
    if (panelContents) {
      panelContents.send('agent:error', 'No API key set. Start with: ANTHROPIC_API_KEY=sk-ant-... npm start');
    }
    return null;
  }
  return runAgentLoop(userMessage);
});

// Agent panel checks status on startup
ipcMain.handle('agent:get-status', () => {
  return {
    hasApiKey: !!API_KEY,
    hasWebview: !!webviewContents,
    model: MODEL
  };
});

// Agent panel requests conversation reset
ipcMain.handle('agent:clear', () => {
  messages = [];
  return true;
});

// Webview IPC is relayed through the agent panel.
// The webview's ipc-message events arrive on the <webview> DOM element,
// and agent-panel.js forwards them to the main process via these channels.

// Webview sends back Zephyr.agent method results (relayed by panel)
ipcMain.on('zephyr:result', (_event, data) => {
  const pending = pendingRequests.get(data.id);
  if (!pending) return;
  pendingRequests.delete(data.id);

  if (data.error) {
    pending.reject(new Error(data.error));
  } else {
    pending.resolve(data.result);
  }
});

// Webview bridge is ready (relayed by panel)
ipcMain.on('webview:ready', (_event) => {
  // The panel will forward execute commands to the webview for us
  webviewContents = { send: () => {} }; // Placeholder  - actual sends go through panel relay
  console.log('[Main] Webview bridge connected (via panel relay)');
  if (panelContents) {
    panelContents.send('agent:webview-ready');
  }
});

// ---------------------------------------------------------------------------
// Window Creation
// ---------------------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Zephyr Browser  - WebMCP Demo',
    backgroundColor: '#0a0e27',
    webPreferences: {
      preload: path.join(__dirname, 'agent-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  // Store panel webContents for IPC
  panelContents = win.webContents;

  // Pass config to the agent panel via a global that the preload can read
  // The preload will expose these to the renderer
  win.webContents.on('did-finish-load', () => {
    panelContents.send('agent:config', {
      demoPageUrl: `file://${DEMO_PAGE}`,
      preloadPath: path.join(__dirname, 'preload.js'),
      hasApiKey: !!API_KEY,
      model: MODEL
    });
  });

  win.loadFile(path.join(__dirname, 'agent-panel.html'));
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

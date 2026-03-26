#!/usr/bin/env node

/**
 * Zephyr MCP Server
 *
 * This is the Model Context Protocol (MCP) server for the Zephyr Framework.
 * It exposes Zephyr UI components as MCP tools that AI agents (Claude Desktop,
 * Cursor, etc.) can use to discover, inspect, and control Zephyr components
 * running in a browser.
 *
 * Architecture (3 responsibilities in one process):
 *
 *   1. HTTP Static File Server — Serves the Zephyr demo page and framework
 *      files on localhost. Automatically injects bridge-client.js into HTML
 *      pages so the browser connects to the WebSocket bridge.
 *
 *   2. WebSocket Bridge — Maintains a WebSocket connection to the browser.
 *      When an MCP tool is called, the bridge forwards the request to the
 *      browser, which executes the corresponding Zephyr.agent method and
 *      returns the result.
 *
 *   3. MCP Stdio Server — Implements the Model Context Protocol over stdio.
 *      Defines 6 tools that map 1:1 to Zephyr.agent methods.
 *
 * Data flow:
 *   MCP Host (Claude Desktop)
 *     ↕ stdio (JSON-RPC 2.0)
 *   This server (server.js)
 *     ↕ WebSocket (localhost)
 *   Browser page (bridge-client.js)
 *     ↕ direct JavaScript calls
 *   Zephyr.agent API (in browser context)
 *
 * Usage:
 *   1. cd zephyr-mcp && npm install
 *   2. node server.js
 *   3. Open http://localhost:3456 in your browser
 *   4. Add to Claude Desktop config (see README.md)
 *
 * Environment variables:
 *   ZEPHYR_MCP_PORT — HTTP/WebSocket port (default: 3456)
 */

'use strict';

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

// Node.js built-in modules (no npm dependency)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// npm dependencies (installed via package.json)
const { WebSocketServer } = require('ws');                                    // WebSocket server for browser bridge
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');    // MCP protocol server
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js'); // stdio transport for MCP
const { z } = require('zod');                                                // Schema validation for MCP tool inputs

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Port for the HTTP server and WebSocket bridge
// Configurable via ZEPHYR_MCP_PORT environment variable
const PORT = parseInt(process.env.ZEPHYR_MCP_PORT || '3456', 10);

// Root directory of the Zephyr framework (one level up from zephyr-mcp/)
// This is where index.html, zephyr-framework.js, etc. live
const FRAMEWORK_ROOT = path.resolve(__dirname, '..');

// Path to the bridge client script that gets injected into HTML pages
const BRIDGE_CLIENT_PATH = path.join(__dirname, 'bridge-client.js');

// MIME types for serving static files
// Maps file extensions to Content-Type headers
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Log a message to stderr.
 * IMPORTANT: We must NEVER write to stdout — it's reserved for MCP
 * JSON-RPC communication. All logging goes to stderr instead.
 *
 * @param {...any} args - Arguments to log (same as console.log)
 */
function log(...args) {
  console.error('[Zephyr MCP]', ...args);
}

// ---------------------------------------------------------------------------
// Part 1: HTTP Static File Server
// ---------------------------------------------------------------------------

/**
 * Creates an HTTP server that serves Zephyr framework files.
 *
 * Special behavior for HTML files:
 *   The server injects a <script> tag for bridge-client.js before </body>
 *   so the browser automatically connects to the WebSocket bridge.
 *   This injection only applies to files served from FRAMEWORK_ROOT.
 *
 * Special route:
 *   /zephyr-mcp/bridge-client.js — Serves the bridge client script directly
 */
const httpServer = http.createServer((req, res) => {
  // Handle the bridge client script route specially
  // This is the script that gets injected into HTML pages via the <script> tag
  if (req.url === '/zephyr-mcp/bridge-client.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    fs.createReadStream(BRIDGE_CLIENT_PATH).pipe(res);
    return;
  }

  // Resolve the requested URL to a file path on disk
  // Default to index.html for the root URL
  let urlPath = req.url.split('?')[0]; // Strip query parameters
  if (urlPath === '/') urlPath = '/index.html';

  // Construct the full file path within the framework root directory
  const filePath = path.join(FRAMEWORK_ROOT, urlPath);

  // Security check: Prevent directory traversal attacks
  // Ensure the resolved path is still within the framework root
  if (!filePath.startsWith(FRAMEWORK_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Determine the MIME type from the file extension
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Attempt to read and serve the file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // File not found — return 404
      res.writeHead(404);
      res.end('Not Found: ' + urlPath);
      return;
    }

    // For HTML files: inject the bridge-client.js script tag before </body>
    // This automatically connects the page to the WebSocket bridge
    if (ext === '.html') {
      let html = data.toString();

      // Insert the bridge script right before the closing </body> tag
      // The script connects to our WebSocket bridge and forwards
      // Zephyr.agent calls from the MCP server
      const bridgeTag = '\n  <script src="/zephyr-mcp/bridge-client.js"></script>\n';
      html = html.replace('</body>', bridgeTag + '</body>');

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(html);
    } else {
      // For non-HTML files: serve as-is with appropriate MIME type
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

// ---------------------------------------------------------------------------
// Part 2: WebSocket Bridge
// ---------------------------------------------------------------------------

/**
 * WebSocket server that bridges MCP tool calls to the browser.
 *
 * The bridge maintains a single browser connection. When an MCP tool is called,
 * the bridge sends a JSON message to the browser with:
 *   { id: <uuid>, method: <string>, args: <array> }
 *
 * The browser (bridge-client.js) executes the Zephyr.agent method and sends
 * back the result:
 *   { id: <uuid>, result: <any> }  or  { id: <uuid>, error: <string> }
 *
 * Request/response correlation uses UUIDs stored in a Map.
 */

// The WebSocket server shares the same HTTP server (same port)
const wss = new WebSocketServer({ server: httpServer });

// Reference to the currently connected browser tab
// Only one browser connection is supported at a time (last-connected wins)
let browserSocket = null;

// Map of pending requests awaiting responses from the browser
// Key: request UUID, Value: { resolve, reject } promise callbacks
const pendingRequests = new Map();

// Handle new WebSocket connections from browser tabs
wss.on('connection', (ws) => {
  log('Browser connected');

  // Replace any existing connection (last-connected-wins strategy)
  // This means if you open a second tab, it becomes the active connection
  browserSocket = ws;

  /**
   * Handle messages coming back from the browser.
   * These are responses to requests we sent via callBrowser().
   * Each message has an 'id' that matches a pending request.
   */
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      log('Invalid JSON from browser:', data.toString());
      return;
    }

    // Look up the pending request by its unique ID
    const pending = pendingRequests.get(msg.id);
    if (!pending) {
      log('No pending request for ID:', msg.id);
      return;
    }

    // Resolve or reject the promise based on the response
    if (msg.error) {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve(msg.result);
    }

    // Clean up — remove the fulfilled request from the pending map
    pendingRequests.delete(msg.id);
  });

  // Handle browser disconnect
  ws.on('close', () => {
    log('Browser disconnected');
    // Only clear the reference if this is the active connection
    if (browserSocket === ws) {
      browserSocket = null;
    }
  });
});

/**
 * Send a method call to the browser and wait for the response.
 *
 * This is the core bridge function. MCP tool handlers call this to
 * execute Zephyr.agent methods in the browser context.
 *
 * @param {string} method - Zephyr.agent method name (e.g., 'act', 'getState')
 * @param {Array} args - Arguments to pass to the method
 * @returns {Promise<any>} The result from Zephyr.agent in the browser
 * @throws {Error} If no browser is connected or the call times out
 *
 * @example
 *   // This executes Zephyr.agent.act('#modal', 'open') in the browser
 *   const result = await callBrowser('act', ['#modal', 'open']);
 */
function callBrowser(method, args) {
  return new Promise((resolve, reject) => {
    // Check if a browser is connected
    if (!browserSocket || browserSocket.readyState !== 1) {
      reject(new Error(
        'No browser connected. Open http://localhost:' + PORT +
        ' in your browser to connect the Zephyr bridge.'
      ));
      return;
    }

    // Generate a unique ID for this request so we can match the response
    const id = crypto.randomUUID();

    // Store the promise callbacks keyed by the request ID
    // When the browser responds, we'll look up and resolve/reject this promise
    pendingRequests.set(id, { resolve, reject });

    // Send the request to the browser via WebSocket
    // The bridge-client.js script will receive this and call Zephyr.agent[method](...args)
    browserSocket.send(JSON.stringify({ id, method, args }));

    // Set a timeout to avoid hanging if the browser never responds
    // 10 seconds should be more than enough for any Zephyr.agent call
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Browser call timed out after 10 seconds for method: ' + method));
      }
    }, 10000);
  });
}

// ---------------------------------------------------------------------------
// Part 3: MCP Tool Definitions
// ---------------------------------------------------------------------------

/**
 * Create the MCP server instance.
 * This handles the JSON-RPC protocol over stdio, tool discovery,
 * and tool execution.
 */
const mcpServer = new McpServer({
  name: 'zephyr-framework',
  version: '0.1.0',
});

/**
 * Tool: zephyr_act
 *
 * The most important tool — performs high-level actions on Zephyr components.
 * Agents use this to interact with the UI without knowing DOM APIs.
 *
 * Examples:
 *   zephyr_act({ selector: '#my-modal', action: 'open' })
 *   zephyr_act({ selector: '#color-select', action: 'select', params: { value: 'red' } })
 *   zephyr_act({ selector: '#carousel', action: 'next' })
 */
mcpServer.tool(
  'zephyr_act',
  'Perform an action on a Zephyr UI component. Actions include: open, close, toggle, select, next, prev, goto, show, set, complete. Each component supports different actions — use zephyr_get_schema to see available actions per component.',
  {
    selector: z.string().describe('CSS selector targeting the component (e.g., "#my-modal", "z-select", ".my-class")'),
    action: z.string().describe('Action name — e.g., "open", "close", "select", "next", "prev", "toggle", "show", "set", "complete"'),
    params: z.record(z.any()).optional().describe('Optional parameters for the action — e.g., { value: "red" } for select, { message: "Hello" } for toast show'),
  },
  async ({ selector, action, params }) => {
    // Forward the act() call to the browser via the WebSocket bridge
    const result = await callBrowser('act', [selector, action, params]);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

/**
 * Tool: zephyr_get_state
 *
 * Snapshots the state of all Zephyr components on the page.
 * Returns an array of objects with tag, id, current state attributes,
 * and available actions for each component.
 *
 * Use this to understand what's on the page before taking actions.
 *
 * Example:
 *   zephyr_get_state({})  → all components
 *   zephyr_get_state({ selector: 'z-modal' })  → only modals
 */
mcpServer.tool(
  'zephyr_get_state',
  'Get the current state of all Zephyr components on the page (or a filtered subset). Returns tag name, id, state attributes (data-open, data-active, etc.), and available actions for each component. Use this to understand the current UI state before taking actions.',
  {
    selector: z.string().optional().describe('Optional CSS selector to filter components — e.g., "z-modal" for only modals, "#my-select" for a specific element. Omit to get all Zephyr components.'),
  },
  async ({ selector }) => {
    // Forward getState() to the browser, passing selector if provided
    const result = await callBrowser('getState', selector ? [selector] : []);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

/**
 * Tool: zephyr_describe
 *
 * Returns a detailed description of a specific component instance,
 * including its current state, available actions, slot content preview,
 * events it dispatches, and methods it exposes.
 *
 * More detailed than getState — use this when you need to understand
 * one component deeply before interacting with it.
 *
 * Example:
 *   zephyr_describe({ selector: '#my-select' })
 */
mcpServer.tool(
  'zephyr_describe',
  'Get a detailed description of a specific Zephyr component instance. Returns tag, id, current state, available actions, slot content preview, events, and methods. More detailed than zephyr_get_state — use this to deeply understand one component before interacting with it.',
  {
    selector: z.string().describe('CSS selector for the component to describe — e.g., "#my-modal", "z-tabs"'),
  },
  async ({ selector }) => {
    // Forward describe() to the browser
    const result = await callBrowser('describe', [selector]);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

/**
 * Tool: zephyr_set_state
 *
 * Directly sets or removes data attributes on a Zephyr component.
 * This is a lower-level alternative to zephyr_act — use it when you
 * need fine-grained control over component attributes.
 *
 * Pass null or false to remove an attribute, true or '' to set a boolean
 * attribute, or a string value to set a valued attribute.
 *
 * Example:
 *   zephyr_set_state({ selector: '#dropdown', attributes: { 'data-open': true } })
 *   zephyr_set_state({ selector: '#dropdown', attributes: { 'data-open': null } })  // removes
 */
mcpServer.tool(
  'zephyr_set_state',
  'Set or remove HTML data attributes on a Zephyr component. This is a lower-level alternative to zephyr_act for fine-grained attribute control. Pass null to remove an attribute, true to set a boolean attribute, or a string for a valued attribute.',
  {
    selector: z.string().describe('CSS selector for the target component'),
    attributes: z.record(z.union([z.string(), z.boolean(), z.null()])).describe('Attributes to set or remove — e.g., { "data-open": true } to set, { "data-open": null } to remove'),
  },
  async ({ selector, attributes }) => {
    // Forward setState() to the browser
    const result = await callBrowser('setState', [selector, attributes]);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

/**
 * Tool: zephyr_get_schema
 *
 * Returns the complete component schema — all 13 components with their
 * tags, slots, attributes, events, methods, available actions, and descriptions.
 *
 * This is the agent's reference guide for what Zephyr can do.
 * Call this once at the start to understand available components.
 */
mcpServer.tool(
  'zephyr_get_schema',
  'Get the complete Zephyr component schema. Returns all 13 components with their tags, descriptions, available actions, slots, attributes, events, and methods. Call this once to understand what components are available and how to interact with them.',
  {},
  async () => {
    // Forward getSchema() to the browser
    const result = await callBrowser('getSchema', []);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

/**
 * Tool: zephyr_get_prompt
 *
 * Generates a markdown-formatted prompt describing all Zephyr components
 * currently present on the page, with their current states and available
 * actions.
 *
 * Useful for agents that want to inject Zephyr context into their
 * own system prompts or for understanding the current page at a glance.
 */
mcpServer.tool(
  'zephyr_get_prompt',
  'Generate a markdown-formatted summary of all Zephyr components on the current page with their states and available actions. Useful for understanding the current UI at a glance or for injecting into agent context.',
  {},
  async () => {
    // Forward getPrompt() to the browser
    const result = await callBrowser('getPrompt', []);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

/**
 * Start both the HTTP/WebSocket bridge and the MCP stdio server.
 *
 * The HTTP server provides the browser bridge (HTML pages + WebSocket).
 * The MCP server communicates with the AI agent host via stdin/stdout.
 *
 * Both run simultaneously in the same process.
 */
async function main() {
  // Start the HTTP server and WebSocket bridge
  // This allows the browser to connect and receive Zephyr.agent calls
  httpServer.listen(PORT, () => {
    // Log to stderr (stdout is reserved for MCP JSON-RPC protocol)
    log(`Bridge server running at http://localhost:${PORT}`);
    log('Open that URL in your browser to connect the Zephyr bridge.');
    log('MCP stdio transport is ready for connections.');
  });

  // Start the MCP stdio transport
  // This connects to the MCP host (Claude Desktop, Cursor, etc.) via stdin/stdout
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

// Run the server
main().catch((err) => {
  log('Fatal error:', err);
  process.exit(1);
});

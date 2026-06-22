/**
 * Zephyr + Vercel AI SDK Example Server
 *
 * A minimal Express server that gives an AI agent control over Zephyr UI
 * components using the Vercel AI SDK's tool calling system.
 *
 * Architecture:
 *   Browser (Zephyr + bridge-client.js)
 *     ↕ WebSocket
 *   This server (Express + AI SDK tools)
 *     ↕ API call
 *   Anthropic Claude
 *
 * The agent sees 7 tools that map to Zephyr.agent methods. When the model
 * calls a tool, the execute function forwards it over WebSocket to the
 * browser, where bridge-client.js runs the actual Zephyr.agent call.
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { generateText, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const PORT = process.env.PORT || 3457;
const app = express();
app.use(express.json());
app.use(express.static('public'));

const httpServer = createServer(app);

// ---------------------------------------------------------------------------
// WebSocket Bridge (browser <-> server)
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server: httpServer });
let browserSocket = null;
const pendingRequests = new Map();

wss.on('connection', (ws) => {
  console.log('[bridge] Browser connected');
  browserSocket = ws;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    const pending = pendingRequests.get(msg.id);
    if (!pending) return;
    if (msg.error) pending.reject(new Error(msg.error));
    else pending.resolve(msg.result);
    pendingRequests.delete(msg.id);
  });

  ws.on('close', () => {
    console.log('[bridge] Browser disconnected');
    if (browserSocket === ws) browserSocket = null;
  });
});

function callBrowser(method, args) {
  return new Promise((resolve, reject) => {
    if (!browserSocket || browserSocket.readyState !== 1) {
      reject(new Error('No browser connected. Open http://localhost:' + PORT + ' in your browser.'));
      return;
    }
    const id = crypto.randomUUID();
    pendingRequests.set(id, { resolve, reject });
    browserSocket.send(JSON.stringify({ id, method, args }));
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Browser call timed out for: ' + method));
      }
    }, 10000);
  });
}

// ---------------------------------------------------------------------------
// AI SDK Tool Definitions
// ---------------------------------------------------------------------------

const zephyrTools = {
  zephyr_get_state: tool({
    description:
      'Get the current state of all Zephyr components on the page. Returns tag name, id, state attributes, and available actions. Call this first to understand what is on the page.',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector to filter components (e.g., "z-modal"). Omit for all.'),
    }),
    execute: async ({ selector }) => callBrowser('getState', selector ? [selector] : []),
  }),

  zephyr_describe: tool({
    description:
      'Get a detailed description of a specific component including state, available actions, slots, events, and methods.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector for the component (e.g., "#my-modal", "z-tabs")'),
    }),
    execute: async ({ selector }) => callBrowser('describe', [selector]),
  }),

  zephyr_act: tool({
    description:
      'Perform an action on a Zephyr component. Actions include: open, close, toggle, select, next, prev, goto, show, set, activate. Use zephyr_get_state first to see available actions.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector for the component'),
      action: z.string().describe('Action name (e.g., "open", "close", "select", "next")'),
      params: z.record(z.any()).optional().describe('Action parameters (e.g., { value: "red" } for select)'),
    }),
    execute: async ({ selector, action, params }) =>
      callBrowser('act', params ? [selector, action, params] : [selector, action]),
  }),

  zephyr_set_state: tool({
    description:
      'Set or remove data attributes on a component. Pass null to remove, true for boolean, or a string value.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector for the component'),
      attributes: z.record(z.any()).describe('Attributes to set (e.g., { "data-open": true })'),
    }),
    execute: async ({ selector, attributes }) => callBrowser('setState', [selector, attributes]),
  }),

  zephyr_get_schema: tool({
    description:
      'Get the complete component schema — all available Zephyr components, their actions, slots, events, and methods.',
    inputSchema: z.object({}),
    execute: async () => callBrowser('getSchema', []),
  }),

  zephyr_render: tool({
    description:
      'Create and insert a new Zephyr component into the page. Only registered z-* tags and safe HTML tags are allowed.',
    inputSchema: z.object({
      container: z.string().describe('CSS selector for the container to insert into'),
      spec: z.object({
        tag: z.string().describe('Element tag (e.g., "z-stat", "z-modal")'),
        id: z.string().optional(),
        attributes: z.record(z.string()).optional(),
        text: z.string().optional(),
        children: z.array(z.any()).optional(),
      }),
    }),
    execute: async ({ container, spec }) => callBrowser('render', [container, spec]),
  }),

  zephyr_compose: tool({
    description:
      'Compose a dashboard layout from a declarative spec. Creates a z-dashboard with panels, each containing a component.',
    inputSchema: z.object({
      container: z.string().describe('CSS selector for the container'),
      layout: z.object({
        id: z.string().optional(),
        panels: z.array(z.object({
          id: z.string(),
          colspan: z.number().optional(),
          title: z.string().optional(),
          component: z.any(),
        })),
      }),
    }),
    execute: async ({ container, layout }) => callBrowser('compose', [container, layout]),
  }),

  zephyr_confirm: tool({
    description:
      'Confirm a guarded action that is pending approval. Use after act() returns { pending: true, confirmId }.',
    inputSchema: z.object({
      confirmId: z.string().describe('The confirmId returned by the guarded act() call'),
    }),
    execute: async ({ confirmId }) => callBrowser('confirm', [confirmId]),
  }),

  zephyr_deny: tool({
    description:
      'Deny/cancel a guarded action that is pending approval.',
    inputSchema: z.object({
      confirmId: z.string().describe('The confirmId returned by the guarded act() call'),
    }),
    execute: async ({ confirmId }) => callBrowser('deny', [confirmId]),
  }),

  zephyr_guarded: tool({
    description:
      'List all pending guarded actions awaiting confirmation.',
    inputSchema: z.object({}),
    execute: async () => callBrowser('guarded', []),
  }),

  // ---------------------------------------------------------------------------
  // Visualization tools — Goose-style named tools for automatic data display
  // ---------------------------------------------------------------------------

  zephyr_show_chart: tool({
    description:
      'Show a line, area, or candlestick chart. Use for: time series data, trends over time, historical data, price/stock data (OHLC → candlestick), numeric series over timestamps.',
    inputSchema: z.object({
      container: z.string().describe('CSS selector for the target container'),
      type: z.enum(['line', 'area', 'candlestick', 'histogram']).default('line').describe('Chart type. Use "candlestick" when data has open/high/low/close fields.'),
      data: z.array(z.any()).describe('Array of { time, value } for line/area, or { time, open, high, low, close } for candlestick'),
      title: z.string().optional().describe('Optional chart title'),
    }),
    execute: async ({ container, type, data, title }) =>
      callBrowser('render', [container, {
        tag: 'z-chart', id: 'chart-' + Date.now(),
        attributes: { 'data-type': type, 'data-height': '300', ...(title ? { 'data-title': title } : {}) },
        setup: { method: 'setData', params: { data } }
      }]),
  }),

  zephyr_show_table: tool({
    description:
      'Show a sortable, filterable data table. Use for: tabular data with rows and columns, lists of objects/records, any structured dataset with 3+ fields per row.',
    inputSchema: z.object({
      container: z.string().describe('CSS selector for the target container'),
      columns: z.array(z.object({
        key: z.string(),
        label: z.string(),
        sortable: z.boolean().optional(),
      })).describe('Column definitions'),
      rows: z.array(z.record(z.any())).describe('Row data objects'),
    }),
    execute: async ({ container, columns, rows }) => {
      const id = 'grid-' + Date.now();
      await callBrowser('render', [container, { tag: 'z-data-grid', id }]);
      return callBrowser('act', ['#' + id, 'setColumns', { columns }])
        .then(() => callBrowser('act', ['#' + id, 'setRows', { rows }]));
    },
  }),

  zephyr_show_stats: tool({
    description:
      'Show KPI stat cards. Use for: metrics, performance numbers, dashboard KPIs, any data with a label + value + optional trend direction (up/down/neutral) and trend value (e.g., "+5%").',
    inputSchema: z.object({
      container: z.string().describe('CSS selector for the target container'),
      stats: z.array(z.object({
        label: z.string(),
        value: z.string(),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
        trendValue: z.string().optional().describe('Trend change text, e.g. "+5%" or "-$200"'),
      })),
    }),
    execute: async ({ container, stats }) =>
      callBrowser('compose', [container, {
        tag: 'z-dashboard', id: 'stats-' + Date.now(),
        attributes: { 'data-columns': '1' },
        panels: stats.map((s, i) => ({
          id: 'stat-' + i,
          component: {
            tag: 'z-stat',
            attributes: {
              'data-label': s.label, 'data-value': s.value,
              ...(s.trend ? { 'data-trend': s.trend } : {}),
              ...(s.trendValue ? { 'data-trend-value': s.trendValue } : {}),
            },
          },
        })),
      }]),
  }),

  zephyr_show_list: tool({
    description:
      'Show a sortable list. Use for: ordered items, ranked results, drag-to-reorder lists. Large lists (50+ items) automatically use a virtual scrolling list.',
    inputSchema: z.object({
      container: z.string().describe('CSS selector for the target container'),
      items: z.array(z.object({
        id: z.string(),
        label: z.string(),
      })).describe('List items with id and display label'),
    }),
    execute: async ({ container, items }) => {
      const id = 'list-' + Date.now();
      if (items.length > 50) {
        return callBrowser('render', [container, {
          tag: 'z-virtual-list', id, attributes: { 'data-item-height': '40' },
          setup: { method: 'setItems', params: { items } }
        }]);
      }
      return callBrowser('render', [container, {
        tag: 'z-sortable', id,
        children: items.map(item => ({ tag: 'div', attributes: { 'data-sortable': item.id }, text: item.label })),
      }]);
    },
  }),
};

// ---------------------------------------------------------------------------
// Chat Endpoint
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a UI assistant that controls a web page built with Zephyr Framework.
Zephyr is a zero-dependency web component library with AI-native controls.

Your workflow:
1. Call zephyr_get_state to see what components are on the page
2. Use zephyr_act to interact with them (open modals, switch tabs, select options, etc.)
3. Use zephyr_describe for detailed component inspection
4. Use zephyr_render or zephyr_compose to create new components

When displaying data, prefer the purpose-named visualization tools over raw zephyr_render:
- zephyr_show_chart     — time series, trends, price history, numeric data over time
- zephyr_show_table     — tabular data with rows/columns, records with 3+ fields
- zephyr_show_stats     — KPIs, metrics, label+value pairs with optional trend indicators
- zephyr_show_list      — ordered items, ranked results, drag-to-reorder lists

Always call zephyr_get_state first to understand the page before acting.
Be concise in your responses. Describe what you did after acting.`;

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: SYSTEM_PROMPT,
      tools: zephyrTools,
      stopWhen: stepCountIs(8),
      messages,
    });

    res.json({
      role: 'assistant',
      content: result.text,
      toolCalls: result.steps.flatMap(s =>
        (s.toolCalls || []).map(tc => ({ name: tc.toolName, input: tc.args }))
      ),
      toolResults: result.steps.flatMap(s =>
        (s.toolResults || []).map(tr => ({ name: tr.toolName, result: tr.result }))
      ),
    });
  } catch (err) {
    console.error('[chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`\n  Zephyr + AI SDK example running at http://localhost:${PORT}\n`);
  console.log('  1. Open the URL in your browser');
  console.log('  2. Type a message like "open the modal" in the chat');
  console.log('  3. Watch the agent control the UI\n');
});

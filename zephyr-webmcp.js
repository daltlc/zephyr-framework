/**
 * Zephyr WebMCP Adapter — zephyr-webmcp.js
 *
 * Registers Zephyr's agent capabilities as native WebMCP tools, so any
 * WebMCP-enabled browser agent (Chrome's early preview / origin trial,
 * and other browsers as they ship the standard) can discover and control
 * every Zephyr component on the page — no extension, proxy, or API key.
 *
 * WebMCP is the W3C-incubated standard (Google + Microsoft, Web Machine
 * Learning CG) that lets pages expose JavaScript functions as agent tools:
 *   https://github.com/webmachinelearning/webmcp
 *
 * How it works:
 *   1. The page loads zephyr-framework.js, then this file.
 *   2. The adapter feature-detects the WebMCP API (document.modelContext /
 *      navigator.modelContext) and registers one tool per Zephyr.agent
 *      capability (act, get_state, describe, set_state, get_schema,
 *      get_prompt, visualize).
 *   3. A browser agent discovers the tools and calls them; results return
 *      as structured MCP-style content. Actions guarded with
 *      Zephyr.agent.guard() come back as pending confirmations, keeping
 *      the human in the loop.
 *
 * Usage (auto-registers when WebMCP is available):
 *   <script src="zephyr-framework.js"></script>
 *   <script src="zephyr-webmcp.js"></script>
 *
 * Manual control:
 *   <script src="zephyr-webmcp.js" data-auto="false"></script>
 *   <script> Zephyr.webmcp.register(); </script>
 */

'use strict';

(function () {
  if (typeof window === 'undefined' || !window.Zephyr || !Zephyr.agent) {
    console.warn('[zephyr-webmcp] zephyr-framework.js must be loaded first.');
    return;
  }

  // -------------------------------------------------------------------------
  // Tool definitions — same surface as the Zephyr MCP server, returning
  // MCP-style content blocks ({ content: [{ type: 'text', text }] }).
  // -------------------------------------------------------------------------

  /** Wraps a Zephyr.agent result as a WebMCP tool response. */
  function toContent(result) {
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  const TOOLS = [
    {
      name: 'zephyr_act',
      description: 'Perform an action on a Zephyr UI component (open, close, select, toggle, next, prev, activate, etc.). Guarded actions return a pending confirmation instead of executing — tell the user to confirm in the page.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: "CSS selector for the component, e.g. '#settings-modal'" },
          action: { type: 'string', description: "Action name, e.g. 'open', 'close', 'select', 'next'" },
          params: { type: 'object', description: "Action parameters, e.g. { value: 'red' } for select" }
        },
        required: ['selector', 'action']
      },
      execute({ selector, action, params }) {
        return toContent(Zephyr.agent.act(selector, action, params || {}));
      }
    },
    {
      name: 'zephyr_get_state',
      description: 'Snapshot the state of Zephyr components on the page. Returns tag, id, state attributes, and available actions for each component. Call this first to understand the page.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Optional CSS selector to scope the snapshot; omit for all components' }
        }
      },
      execute({ selector }) {
        return toContent(Zephyr.agent.getState(selector));
      }
    },
    {
      name: 'zephyr_describe',
      description: 'Deep-inspect a single Zephyr component: state, available actions, slots, events, and methods.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the component' }
        },
        required: ['selector']
      },
      execute({ selector }) {
        return toContent(Zephyr.agent.describe(selector));
      }
    },
    {
      name: 'zephyr_set_state',
      description: 'Set or remove data attributes on a Zephyr component directly. Prefer zephyr_act for semantic actions; use this for low-level state changes.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the component' },
          attributes: { type: 'object', description: 'Attributes to set; null/false values remove the attribute' }
        },
        required: ['selector', 'attributes']
      },
      execute({ selector, attributes }) {
        return toContent(Zephyr.agent.setState(selector, attributes || {}));
      }
    },
    {
      name: 'zephyr_get_schema',
      description: 'Get the full Zephyr component reference: every component with its attributes, actions, events, and methods.',
      inputSchema: { type: 'object', properties: {} },
      execute() {
        return toContent(Zephyr.agent.getSchema());
      }
    },
    {
      name: 'zephyr_get_prompt',
      description: 'Generate a markdown summary of the current page state, formatted for an LLM context window.',
      inputSchema: { type: 'object', properties: {} },
      execute() {
        return { content: [{ type: 'text', text: Zephyr.agent.getPrompt() }] };
      }
    },
    {
      name: 'zephyr_visualize',
      description: 'Render data with the best-fit Zephyr component automatically: time series → chart, label/value objects → stat cards, string arrays → sortable list, object arrays → data grid.',
      inputSchema: {
        type: 'object',
        properties: {
          data: { description: 'The data to visualize: array of objects, strings, or { time, value } points' },
          container: { type: 'string', description: 'CSS selector for the target container' },
          hint: { type: 'string', enum: ['chart', 'stats', 'list', 'table'], description: 'Optional override for the auto-detection' },
          title: { type: 'string', description: 'Optional title for chart visualizations' }
        },
        required: ['data', 'container']
      },
      execute({ data, container, hint, title }) {
        return toContent(Zephyr.agent.visualize(data, container, { hint, title }));
      }
    }
  ];

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /** Returns the WebMCP registration surface, or null if unavailable. */
  function findModelContext() {
    const ctx = (typeof document !== 'undefined' && document.modelContext) ||
      (typeof navigator !== 'undefined' && navigator.modelContext) || null;
    return ctx && typeof ctx.registerTool === 'function' ? ctx : null;
  }

  let controller = null;

  Zephyr.webmcp = {
    /** The tool definitions this adapter registers (read-only reference). */
    tools: TOOLS,

    /** True when the browser exposes the WebMCP API. */
    available() {
      return findModelContext() !== null;
    },

    /** True while Zephyr tools are registered with the browser. */
    get registered() {
      return controller !== null;
    },

    /**
     * Registers all Zephyr tools with the browser's WebMCP surface.
     * Safe to call when WebMCP is unavailable (returns false) or when
     * already registered (no-op, returns true).
     * @returns {Promise<boolean>} true when tools are registered
     */
    async register() {
      const ctx = findModelContext();
      if (!ctx) return false;
      if (controller) return true;

      controller = new AbortController();
      try {
        for (const tool of TOOLS) {
          // Wrap execute so a thrown error returns a structured failure
          // instead of breaking the agent's tool call.
          const safeTool = Object.assign({}, tool, {
            async execute(args) {
              try {
                return await tool.execute(args || {});
              } catch (e) {
                return toContent({ success: false, error: e.message });
              }
            }
          });
          await ctx.registerTool(safeTool, { signal: controller.signal });
        }
        return true;
      } catch (e) {
        // Permission denied (Permissions-Policy: tools=()) or API mismatch
        this.unregister();
        console.warn('[zephyr-webmcp] Tool registration failed:', e.message);
        return false;
      }
    },

    /** Unregisters all Zephyr tools (aborts the registration signal). */
    unregister() {
      if (controller) {
        controller.abort();
        controller = null;
      }
    }
  };

  // Auto-register unless the script tag opts out with data-auto="false"
  const script = document.currentScript;
  const auto = !script || script.getAttribute('data-auto') !== 'false';
  if (auto && Zephyr.webmcp.available()) {
    Zephyr.webmcp.register();
  }
})();

/**
 * Zephyr Agent Widget — <z-agent>
 *
 * An embedded AI chat widget that lets users control Zephyr components on a
 * live page through natural language. Drop it into any Zephyr-powered site
 * and visitors can say "open the settings modal" or "switch to the pricing
 * tab" — the agent executes actions directly on the page in real-time.
 *
 * How it works:
 *   1. User types a message in the chat panel
 *   2. Widget sends the message + current page context to an LLM
 *   3. LLM responds with tool calls (zephyr_act, zephyr_get_state, etc.)
 *   4. Widget executes those calls via Zephyr.agent in the browser
 *   5. Results go back to the LLM, which produces a text response
 *   6. Response appears in the chat panel
 *
 * Two API modes:
 *   - Direct:  data-api-key="sk-ant-..." (demo only — key visible in source)
 *   - Proxy:   data-endpoint="https://your-api.com/chat" (production — key on server)
 *
 * Requires zephyr-framework.js to be loaded first (uses Zephyr.agent API).
 * Styles are in zephyr-framework.css (the z-agent section).
 *
 * Usage:
 *   <script src="zephyr-framework.js"></script>
 *   <script src="zephyr-agent-widget.js"></script>
 *   <z-agent data-api-key="sk-ant-..." data-provider="anthropic"></z-agent>
 */

'use strict';

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

/**
 * Tool definitions sent to the LLM so it knows how to interact with Zephyr
 * components. These map 1:1 to the Zephyr.agent API methods.
 *
 * Each tool has a name, description (for the LLM to understand when to use
 * it), and an input_schema (JSON Schema describing the parameters).
 *
 * The tools are intentionally limited to Zephyr.agent methods — the widget
 * cannot execute arbitrary JavaScript. This is the security boundary.
 */
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
    name: 'zephyr_render',
    description: 'Create and insert a new Zephyr component into the page. Use this to dynamically build UI elements. The spec object defines the component tag, id, attributes, and children. Only registered z-* tags and safe HTML tags are allowed.',
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
    description: 'Compose a complete dashboard layout from a declarative spec. Creates a z-dashboard with panels, each containing a component. Use this to build data dashboards dynamically.',
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
// Provider Adapters
// ---------------------------------------------------------------------------

/**
 * Each LLM provider (Anthropic, OpenAI) has a different request/response
 * format. These adapters normalize the differences so the widget's
 * conversation loop doesn't need to care which provider is being used.
 *
 * Each adapter has:
 *   - formatRequest(messages, tools, model, systemPrompt) → { url, headers, body }
 *   - parseResponse(data) → { text, toolCalls[], hasToolCalls }
 *   - formatToolResult(toolUseId, result) → message object for the messages array
 *   - formatAssistantToolUse(response) → message object for the messages array
 */
const PROVIDERS = {
  /**
   * Anthropic Claude adapter.
   * Docs: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
   *
   * Anthropic separates the system prompt from the messages array.
   * Tool calls are returned as content blocks with type "tool_use".
   * Tool results are sent as messages with role "user" containing
   * type "tool_result" content blocks.
   */
  anthropic: {
    /** Default API endpoint for direct browser calls */
    defaultUrl: 'https://api.anthropic.com/v1/messages',

    /** Default model if none specified */
    defaultModel: 'claude-sonnet-4-20250514',

    /**
     * Format the request for Anthropic's Messages API.
     * @param {Array} messages - Conversation history (user/assistant messages)
     * @param {Array} tools - Tool definitions
     * @param {string} model - Model identifier
     * @param {string} systemPrompt - System prompt (sent separately from messages)
     * @param {string} apiKey - API key for direct mode
     * @returns {{ url: string, headers: Object, body: Object }}
     */
    formatRequest(messages, tools, model, systemPrompt, apiKey) {
      return {
        url: this.defaultUrl,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // Required for browser-to-API calls (CORS)
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: {
          model: model || this.defaultModel,
          max_tokens: 1024,
          system: systemPrompt,
          // Filter out system messages — Anthropic uses a separate system field
          messages: messages.filter(m => m.role !== 'system'),
          tools: tools
        }
      };
    },

    /**
     * Parse the Anthropic response into a normalized format.
     * Anthropic returns content as an array of blocks — some text, some tool_use.
     * @param {Object} data - Raw API response
     * @returns {{ text: string, toolCalls: Array, hasToolCalls: boolean }}
     */
    parseResponse(data) {
      // Handle API errors
      if (data.error) {
        return {
          text: 'API error: ' + (data.error.message || JSON.stringify(data.error)),
          toolCalls: [],
          hasToolCalls: false
        };
      }

      // Separate text blocks from tool_use blocks
      const textBlocks = (data.content || []).filter(b => b.type === 'text');
      const toolBlocks = (data.content || []).filter(b => b.type === 'tool_use');

      return {
        text: textBlocks.map(b => b.text).join(''),
        toolCalls: toolBlocks.map(b => ({
          id: b.id,
          name: b.name,
          input: b.input
        })),
        hasToolCalls: toolBlocks.length > 0
      };
    },

    /**
     * Format an assistant message that contains tool calls for the messages array.
     * Anthropic expects the full content array (text + tool_use blocks) to be
     * included when sending tool results back.
     * @param {Object} responseData - Raw API response
     * @returns {{ role: string, content: Array }}
     */
    formatAssistantToolUse(responseData) {
      return {
        role: 'assistant',
        content: responseData.content
      };
    },

    /**
     * Format a tool result message for the messages array.
     * Anthropic expects tool results as user messages with tool_result content.
     * @param {string} toolUseId - The tool_use block's ID
     * @param {*} result - The tool's return value
     * @returns {{ role: string, content: Array }}
     */
    formatToolResult(toolUseId, result) {
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: JSON.stringify(result)
        }]
      };
    }
  },

  /**
   * OpenAI GPT adapter.
   * Docs: https://platform.openai.com/docs/guides/function-calling
   *
   * OpenAI uses a "functions" array (now called "tools") with a slightly
   * different schema format. Tool calls come back in tool_calls array on
   * the assistant message. Tool results are sent as messages with role "tool".
   */
  openai: {
    /** Default API endpoint */
    defaultUrl: 'https://api.openai.com/v1/chat/completions',

    /** Default model if none specified */
    defaultModel: 'gpt-4o',

    /**
     * Format the request for OpenAI's Chat Completions API.
     * OpenAI includes the system prompt as a message in the array.
     * Tools use a "function" wrapper with "parameters" instead of "input_schema".
     */
    formatRequest(messages, tools, model, systemPrompt, apiKey) {
      // Convert Anthropic-style tools to OpenAI function format
      const openaiTools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema
        }
      }));

      // Prepend system message to the messages array
      const allMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'system')
      ];

      return {
        url: this.defaultUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: {
          model: model || this.defaultModel,
          messages: allMessages,
          tools: openaiTools,
          tool_choice: 'auto'
        }
      };
    },

    /**
     * Parse the OpenAI response. Tool calls are on the message's tool_calls array.
     */
    parseResponse(data) {
      if (data.error) {
        return {
          text: 'API error: ' + (data.error.message || JSON.stringify(data.error)),
          toolCalls: [],
          hasToolCalls: false
        };
      }

      const choice = data.choices?.[0];
      if (!choice) {
        return { text: 'No response from model.', toolCalls: [], hasToolCalls: false };
      }

      const msg = choice.message;
      const toolCalls = (msg.tool_calls || []).map(tc => ({
        id: tc.id,
        name: tc.function.name,
        // OpenAI returns arguments as a JSON string — parse it
        input: JSON.parse(tc.function.arguments || '{}')
      }));

      return {
        text: msg.content || '',
        toolCalls,
        hasToolCalls: toolCalls.length > 0
      };
    },

    /**
     * Format the assistant's tool-calling message for the messages array.
     * OpenAI expects the full assistant message with tool_calls included.
     */
    formatAssistantToolUse(responseData) {
      const msg = responseData.choices[0].message;
      return {
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls
      };
    },

    /**
     * Format a tool result. OpenAI uses role "tool" with a tool_call_id.
     */
    formatToolResult(toolCallId, result) {
      return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify(result)
      };
    }
  }
};

// ---------------------------------------------------------------------------
// ZAgent Custom Element
// ---------------------------------------------------------------------------

/**
 * <z-agent> — Embedded AI chat widget for Zephyr-powered pages.
 *
 * Renders a floating chat bubble that opens into a conversation panel.
 * The agent can discover and control all Zephyr components on the page
 * via the Zephyr.agent API.
 *
 * Attributes:
 *   data-endpoint     — Proxy URL for production (POST { messages, tools })
 *   data-api-key      — Direct LLM API key (demo only, visible in source)
 *   data-model        — Model identifier (default depends on provider)
 *   data-provider     — "anthropic" (default) or "openai"
 *   data-position     — "bottom-right" (default), "bottom-left", "top-right", "top-left"
 *   data-open         — Boolean: whether the panel is open
 *   data-placeholder  — Input placeholder text
 *   data-greeting     — Initial assistant message
 *
 * Events:
 *   open    — Panel opened
 *   close   — Panel closed
 *   message — { role, content } — a message was added
 *   action  — { selector, action, params, result } — agent acted on a component
 *   error   — { message } — an error occurred
 *
 * Methods:
 *   open()          — Open the chat panel
 *   close()         — Close the chat panel
 *   send(message)   — Programmatically send a message (returns Promise<string>)
 *   clear()         — Clear conversation history
 *
 * @example
 *   <z-agent data-api-key="sk-ant-..." data-provider="anthropic"></z-agent>
 *
 * @example
 *   <z-agent data-endpoint="https://api.mysite.com/chat"></z-agent>
 */
class ZAgent extends HTMLElement {

  constructor() {
    super();

    // ------------------------------------
    // Internal state
    // ------------------------------------

    /** @private Conversation history — array of provider-formatted messages */
    this._messages = [];

    /** @private Whether the widget is currently waiting for an API response */
    this._loading = false;

    /** @private Maximum tool call iterations per turn (prevents runaway loops) */
    this._maxIterations = 10;

    /** @private Maximum messages to keep in history (sliding window) */
    this._maxMessages = 30;

    /** @private DOM references (set in _buildDOM) */
    this._els = {};

    /** @private Bound event handlers (for cleanup in disconnectedCallback) */
    this._handlers = {};
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Called when the element is added to the DOM. Builds the widget UI,
   * attaches event listeners, and shows the greeting message if configured.
   */
  connectedCallback() {
    this._buildDOM();
    this._attachListeners();

    // Warn if using direct API key mode — it's visible in page source
    if (this.getAttribute('data-api-key') && !this.getAttribute('data-endpoint')) {
      console.warn(
        '[z-agent] API key is visible in page source. ' +
        'Use data-endpoint with a server-side proxy for production.'
      );
    }

    // Show greeting message if configured
    const greeting = this.getAttribute('data-greeting')
      || 'Hi! I can help you interact with components on this page.';
    this._renderMessage('assistant', greeting);
  }

  /**
   * Called when the element is removed from the DOM.
   * Cleans up all event listeners to prevent memory leaks.
   */
  disconnectedCallback() {
    this._cleanup();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Opens the chat panel. Sets data-open attribute and focuses the input.
   * Dispatches an 'open' event.
   */
  open() {
    this.setAttribute('data-open', '');
    this._els.input?.focus();
    this.dispatchEvent(new CustomEvent('open'));
  }

  /**
   * Closes the chat panel. Removes data-open attribute.
   * Dispatches a 'close' event.
   */
  close() {
    this.removeAttribute('data-open');
    this.dispatchEvent(new CustomEvent('close'));
  }

  /**
   * Programmatically sends a message as if the user typed it.
   * Useful for triggering agent actions from other code.
   *
   * @param {string} message - The message text to send
   * @returns {Promise<string>} The assistant's text response
   *
   * @example
   *   const reply = await document.querySelector('z-agent').send('Open the modal');
   *   console.log(reply); // "I opened the modal for you."
   */
  async send(message) {
    if (!message?.trim()) return '';
    return this._handleUserMessage(message.trim());
  }

  /**
   * Clears the conversation history and resets the chat panel.
   * Shows the greeting message again.
   */
  clear() {
    this._messages = [];
    if (this._els.messages) {
      this._els.messages.innerHTML = '';
    }
    const greeting = this.getAttribute('data-greeting')
      || 'Hi! I can help you interact with components on this page.';
    this._renderMessage('assistant', greeting);
  }

  // -----------------------------------------------------------------------
  // DOM Construction
  // -----------------------------------------------------------------------

  /**
   * Builds the widget's DOM structure using createElement (no innerHTML).
   * Creates: FAB button, panel with header/messages/input row.
   *
   * Structure:
   *   z-agent
   *   ├── button.z-agent-fab          (floating action button)
   *   └── div.z-agent-panel           (chat panel)
   *       ├── div.z-agent-header      (title + close button)
   *       ├── div.z-agent-messages    (scrollable message area)
   *       └── div.z-agent-input-row   (input + send button)
   *
   * @private
   */
  _buildDOM() {
    // ---- FAB (Floating Action Button) ----
    const fab = document.createElement('button');
    fab.className = 'z-agent-fab';
    fab.setAttribute('aria-label', 'Open agent chat');
    fab.textContent = '\u{1F4AC}'; // 💬 speech balloon emoji

    // ---- Chat Panel ----
    const panel = document.createElement('div');
    panel.className = 'z-agent-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Agent chat');

    // -- Header --
    const header = document.createElement('div');
    header.className = 'z-agent-header';

    const title = document.createElement('span');
    title.textContent = 'Zephyr Agent';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'z-agent-close';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.textContent = '\u00D7'; // × multiplication sign

    header.appendChild(title);
    header.appendChild(closeBtn);

    // -- Messages area --
    const messages = document.createElement('div');
    messages.className = 'z-agent-messages';
    messages.setAttribute('role', 'log');
    messages.setAttribute('aria-live', 'polite');

    // -- Input row --
    const inputRow = document.createElement('div');
    inputRow.className = 'z-agent-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'z-agent-input';
    input.placeholder = this.getAttribute('data-placeholder')
      || 'Ask about this page...';
    input.setAttribute('aria-label', 'Message');

    const sendBtn = document.createElement('button');
    sendBtn.className = 'z-agent-send';
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.textContent = '\u2192'; // → rightwards arrow

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);

    // -- Assemble panel --
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(inputRow);

    // -- Append to the component --
    this.appendChild(fab);
    this.appendChild(panel);

    // Store DOM references for later use
    this._els = { fab, panel, header, closeBtn, messages, input, sendBtn };
  }

  // -----------------------------------------------------------------------
  // Event Handling
  // -----------------------------------------------------------------------

  /**
   * Attaches all event listeners. Stores bound references for cleanup.
   * @private
   */
  _attachListeners() {
    // FAB click → open panel
    this._handlers.fabClick = () => this.open();
    this._els.fab.addEventListener('click', this._handlers.fabClick);

    // Close button → close panel
    this._handlers.closeClick = () => this.close();
    this._els.closeBtn.addEventListener('click', this._handlers.closeClick);

    // Send button → send message
    this._handlers.sendClick = () => this._onSend();
    this._els.sendBtn.addEventListener('click', this._handlers.sendClick);

    // Enter key in input → send message
    this._handlers.inputKeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._onSend();
      }
    };
    this._els.input.addEventListener('keydown', this._handlers.inputKeydown);

    // Escape key → close panel
    this._handlers.panelKeydown = (e) => {
      if (e.key === 'Escape') this.close();
    };
    this._els.panel.addEventListener('keydown', this._handlers.panelKeydown);
  }

  /**
   * Removes all event listeners. Called from disconnectedCallback.
   * @private
   */
  _cleanup() {
    if (this._els.fab) {
      this._els.fab.removeEventListener('click', this._handlers.fabClick);
    }
    if (this._els.closeBtn) {
      this._els.closeBtn.removeEventListener('click', this._handlers.closeClick);
    }
    if (this._els.sendBtn) {
      this._els.sendBtn.removeEventListener('click', this._handlers.sendClick);
    }
    if (this._els.input) {
      this._els.input.removeEventListener('keydown', this._handlers.inputKeydown);
    }
    if (this._els.panel) {
      this._els.panel.removeEventListener('keydown', this._handlers.panelKeydown);
    }
  }

  /**
   * Handles the send action — reads input, clears it, sends to the LLM.
   * Prevents double-sending while a request is in flight.
   * @private
   */
  _onSend() {
    // Don't send while already waiting for a response
    if (this._loading) return;

    const text = this._els.input.value.trim();
    if (!text) return;

    // Clear input immediately for responsiveness
    this._els.input.value = '';

    // Render the user's message in the chat panel
    this._renderMessage('user', text);

    // Send to the LLM (async — response renders when it arrives)
    this._handleUserMessage(text);
  }

  // -----------------------------------------------------------------------
  // LLM Communication
  // -----------------------------------------------------------------------

  /**
   * Core conversation handler. Takes a user message, builds the context,
   * sends to the LLM, handles tool calls in a loop, and renders the
   * final response.
   *
   * The tool call loop:
   *   1. Send messages + tools to LLM
   *   2. If LLM responds with tool calls → execute them → add results → goto 1
   *   3. If LLM responds with text → render it → done
   *
   * @param {string} userMessage - The user's message text
   * @returns {Promise<string>} The assistant's final text response
   * @private
   */
  async _handleUserMessage(userMessage) {
    // Get the provider adapter (anthropic or openai)
    const providerName = this.getAttribute('data-provider') || 'anthropic';
    const provider = PROVIDERS[providerName];
    if (!provider) {
      this._renderMessage('error', `Unknown provider: ${providerName}`);
      return '';
    }

    // Check that we have credentials
    const endpoint = this.getAttribute('data-endpoint');
    const apiKey = this.getAttribute('data-api-key');
    if (!endpoint && !apiKey) {
      this._renderMessage('error',
        'No API key or endpoint configured. Add data-api-key or data-endpoint to <z-agent>.'
      );
      return '';
    }

    // Add the user message to conversation history
    this._messages.push({ role: 'user', content: userMessage });

    // Trim conversation history to prevent token overflow
    // Keep only the last N messages (system prompt is rebuilt each turn)
    if (this._messages.length > this._maxMessages) {
      this._messages = this._messages.slice(-this._maxMessages);
    }

    // Build the system prompt from the current page state
    // This is regenerated every turn so the LLM always sees up-to-date state
    const systemPrompt = this._buildSystemPrompt();

    // Show typing indicator while we wait
    this._setLoading(true);

    let finalText = '';

    try {
      // ---- Tool call loop ----
      // The LLM might respond with tool calls, which we execute and send
      // results back. This loop continues until the LLM gives a text-only
      // response or we hit the iteration limit.
      let iterations = 0;
      let lastResponseData = null;

      while (iterations < this._maxIterations) {
        iterations++;

        // Call the LLM API
        const responseData = await this._callAPI(
          provider, this._messages, systemPrompt, endpoint, apiKey
        );
        lastResponseData = responseData;

        // Parse the response into a normalized format
        const parsed = provider.parseResponse(responseData);

        // If no tool calls, we're done — render the text response
        if (!parsed.hasToolCalls) {
          finalText = parsed.text;
          // Add the assistant's response to conversation history
          this._messages.push({ role: 'assistant', content: finalText });
          break;
        }

        // The LLM wants to use tools — add its message to history first
        // (required by both Anthropic and OpenAI protocols)
        this._messages.push(provider.formatAssistantToolUse(responseData));

        // Execute each tool call and collect results
        for (const toolCall of parsed.toolCalls) {
          // Execute the tool against Zephyr.agent
          const result = this._executeTool(toolCall.name, toolCall.input);

          // Show what the agent did in the chat (brief action indicator)
          this._renderToolAction(toolCall.name, toolCall.input, result);

          // Visual feedback — briefly highlight the component the agent touched
          if (toolCall.input?.selector) {
            this._pulseComponent(toolCall.input.selector);
          }

          // Dispatch action event so other code can react
          this.dispatchEvent(new CustomEvent('action', {
            detail: {
              selector: toolCall.input?.selector,
              action: toolCall.input?.action,
              params: toolCall.input?.params,
              result
            }
          }));

          // Add tool result to conversation history
          this._messages.push(provider.formatToolResult(toolCall.id, result));
        }

        // If the LLM also included text alongside tool calls, capture it
        if (parsed.text) {
          finalText = parsed.text;
        }
      }

      // If we exhausted the loop without a final text response, show
      // whatever text we accumulated from tool-calling turns
      if (!finalText && iterations >= this._maxIterations) {
        finalText = 'I performed several actions but reached the iteration limit.';
      }

    } catch (err) {
      // API call failed — show the error in the chat
      finalText = '';
      this._renderMessage('error', err.message || 'Failed to reach the AI service.');
      this.dispatchEvent(new CustomEvent('error', {
        detail: { message: err.message }
      }));
    }

    // Hide typing indicator
    this._setLoading(false);

    // Render the final text response (if any)
    if (finalText) {
      this._renderMessage('assistant', finalText);

      // Dispatch message event
      this.dispatchEvent(new CustomEvent('message', {
        detail: { role: 'assistant', content: finalText }
      }));
    }

    return finalText;
  }

  /**
   * Makes the actual HTTP request to the LLM API.
   *
   * Two modes:
   *   - Proxy mode (data-endpoint): POSTs messages+tools to the user's backend.
   *     The backend forwards to whatever LLM it uses and returns the response.
   *   - Direct mode (data-api-key): Calls the LLM API directly from the browser.
   *     Only for demos — the API key is visible in page source.
   *
   * @param {Object} provider - Provider adapter (PROVIDERS.anthropic or .openai)
   * @param {Array} messages - Conversation history
   * @param {string} systemPrompt - System prompt with page context
   * @param {string|null} endpoint - Proxy URL (if set, overrides direct mode)
   * @param {string|null} apiKey - API key for direct mode
   * @returns {Promise<Object>} Raw API response data
   * @private
   */
  async _callAPI(provider, messages, systemPrompt, endpoint, apiKey) {
    const model = this.getAttribute('data-model') || provider.defaultModel;

    if (endpoint) {
      // ---- Proxy mode ----
      // Send a provider-agnostic payload to the user's backend.
      // The backend is responsible for forwarding to the LLM and returning
      // the response in the provider's native format.
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          tools: ZEPHYR_TOOLS,
          system: systemPrompt,
          model,
          provider: this.getAttribute('data-provider') || 'anthropic'
        })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Proxy returned ${res.status}: ${text}`);
      }

      return res.json();

    } else {
      // ---- Direct mode ----
      // Call the LLM API directly from the browser using the API key.
      const { url, headers, body } = provider.formatRequest(
        messages, ZEPHYR_TOOLS, model, systemPrompt, apiKey
      );

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: { message: res.statusText } }));
        // Return the error data so parseResponse can handle it gracefully
        if (errorData.error) return errorData;
        throw new Error(`API returned ${res.status}: ${res.statusText}`);
      }

      return res.json();
    }
  }

  // -----------------------------------------------------------------------
  // System Prompt
  // -----------------------------------------------------------------------

  /**
   * Builds the system prompt sent to the LLM on every turn.
   *
   * Includes:
   *   1. Role description and behavior instructions
   *   2. Current page state from Zephyr.agent.getPrompt()
   *   3. Available components and their actions
   *
   * Regenerated every turn so the LLM always sees the latest page state
   * (e.g., if a modal was opened in a previous turn, the state reflects that).
   *
   * @returns {string} The system prompt
   * @private
   */
  _buildSystemPrompt() {
    // Get the current page state from Zephyr's agent API
    // This includes all components, their states, and available actions
    let pageContext = '';
    if (typeof Zephyr !== 'undefined' && Zephyr.agent?.getPrompt) {
      pageContext = Zephyr.agent.getPrompt();
    }

    return [
      'You are an AI assistant embedded in a web page built with the Zephyr UI framework.',
      'You can see and control all UI components on this page using the provided tools.',
      '',
      'Guidelines:',
      '- Use zephyr_get_state to understand what components are on the page before acting.',
      '- Use zephyr_act to perform actions (open, close, select, toggle, next, prev, etc.).',
      '- Use zephyr_describe for detailed info about a specific component.',
      '- When you perform an action, briefly confirm what you did in plain language.',
      '- If the user asks about something that is not a Zephyr component, answer conversationally.',
      '- Be concise. Most responses should be 1-2 sentences.',
      '- If an action fails, explain what went wrong and suggest alternatives.',
      '',
      pageContext
    ].join('\n');
  }

  // -----------------------------------------------------------------------
  // Tool Execution
  // -----------------------------------------------------------------------

  /**
   * Executes a tool call from the LLM against the Zephyr.agent API.
   *
   * This is the security boundary — only these 5 predefined methods can
   * be called. No eval, no arbitrary JS, no DOM access outside Zephyr.agent.
   *
   * @param {string} name - Tool name (e.g., 'zephyr_act')
   * @param {Object} input - Tool parameters from the LLM
   * @returns {*} The tool's return value (serializable to JSON)
   * @private
   */
  _executeTool(name, input) {
    // Verify Zephyr is loaded
    if (typeof Zephyr === 'undefined' || !Zephyr.agent) {
      return { error: 'Zephyr framework is not loaded on this page.' };
    }

    // Map tool names to Zephyr.agent method calls
    // Each handler receives the input object from the LLM and calls
    // the corresponding Zephyr.agent method with the right arguments
    const handlers = {
      zephyr_get_state: () => Zephyr.agent.getState(input.selector),
      zephyr_describe: () => Zephyr.agent.describe(input.selector),
      zephyr_act: () => Zephyr.agent.act(input.selector, input.action, input.params),
      zephyr_set_state: () => Zephyr.agent.setState(input.selector, input.attributes),
      zephyr_get_schema: () => Zephyr.agent.getSchema(),
      zephyr_render: () => Zephyr.agent.render(input.container, input.spec),
      zephyr_compose: () => Zephyr.agent.compose(input.container, input.layout)
    };

    const handler = handlers[name];
    if (!handler) {
      return { error: 'Unknown tool: ' + name };
    }

    try {
      return handler();
    } catch (err) {
      return { error: err.message };
    }
  }

  // -----------------------------------------------------------------------
  // Message Rendering
  // -----------------------------------------------------------------------

  /**
   * Renders a message bubble in the chat panel.
   * Uses DOM manipulation (not innerHTML) per security standards.
   *
   * @param {'user'|'assistant'|'error'} role - Message role (determines styling)
   * @param {string} text - Message content
   * @private
   */
  _renderMessage(role, text) {
    const msg = document.createElement('div');

    // Apply role-specific CSS class
    msg.className = 'z-agent-msg z-agent-msg-' + role;

    // Set the message text content (safe — textContent doesn't parse HTML)
    msg.textContent = text;

    // Append to the messages area and scroll to bottom
    this._els.messages.appendChild(msg);
    this._scrollToBottom();

    // Dispatch message event for user and assistant messages
    if (role === 'user' || role === 'assistant') {
      this.dispatchEvent(new CustomEvent('message', {
        detail: { role, content: text }
      }));
    }
  }

  /**
   * Renders a small action indicator showing what the agent did.
   * e.g., "Opened #my-modal" or "Selected 'blue' in #color-select"
   *
   * @param {string} toolName - The tool that was called
   * @param {Object} input - The tool's input parameters
   * @param {*} result - The tool's return value
   * @private
   */
  _renderToolAction(toolName, input, result) {
    // Build a human-readable description of the action
    let description = '';

    if (toolName === 'zephyr_act') {
      // "Performed 'open' on #my-modal"
      const target = input.selector || 'component';
      description = `${input.action} \u2192 ${target}`;
      if (input.params) {
        const paramStr = Object.entries(input.params)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        description += ` (${paramStr})`;
      }
    } else if (toolName === 'zephyr_get_state') {
      const count = Array.isArray(result) ? result.length : '?';
      description = `Inspected page \u2014 ${count} components found`;
    } else if (toolName === 'zephyr_describe') {
      description = `Inspected ${input.selector}`;
    } else if (toolName === 'zephyr_set_state') {
      description = `Set attributes on ${input.selector}`;
    } else if (toolName === 'zephyr_get_schema') {
      description = 'Retrieved component schema';
    }

    if (description) {
      const action = document.createElement('div');
      action.className = 'z-agent-msg z-agent-msg-action';
      action.textContent = description;
      this._els.messages.appendChild(action);
      this._scrollToBottom();
    }
  }

  /**
   * Shows or hides the typing indicator (three bouncing dots).
   * Also disables/enables the send button during loading.
   *
   * @param {boolean} loading - Whether to show the indicator
   * @private
   */
  _setLoading(loading) {
    this._loading = loading;

    // Disable send button while loading
    this._els.sendBtn.disabled = loading;

    if (loading) {
      // Create the typing indicator with three dots
      const typing = document.createElement('div');
      typing.className = 'z-agent-typing';
      typing.setAttribute('data-typing', '');

      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'z-agent-typing-dot';
        typing.appendChild(dot);
      }

      this._els.messages.appendChild(typing);
      this._scrollToBottom();
    } else {
      // Remove the typing indicator
      const typing = this._els.messages.querySelector('[data-typing]');
      if (typing) typing.remove();
    }
  }

  /**
   * Scrolls the messages area to the bottom so the latest message is visible.
   * @private
   */
  _scrollToBottom() {
    const el = this._els.messages;
    // Use requestAnimationFrame to ensure the DOM has updated before scrolling
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  // -----------------------------------------------------------------------
  // Visual Feedback
  // -----------------------------------------------------------------------

  /**
   * Briefly highlights a component on the page when the agent acts on it.
   * Adds a CSS class that triggers a pulsing outline animation (defined
   * in zephyr-framework.css). Uses outline instead of border to avoid
   * layout shifts.
   *
   * @param {string} selector - CSS selector of the component to highlight
   * @private
   */
  _pulseComponent(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) return;

      // Add the pulse class (triggers the CSS animation)
      el.classList.add('z-agent-target');

      // Remove it after the animation completes (2 pulses × 0.6s = 1.2s)
      setTimeout(() => {
        el.classList.remove('z-agent-target');
      }, 1500);
    } catch (e) {
      // Invalid selector — silently ignore (the action still executed)
    }
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// Register the custom element so <z-agent> works in HTML
customElements.define('z-agent', ZAgent);

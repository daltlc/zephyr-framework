<p align="center">
  <img src="assets/banner.svg" alt="Zephyr Framework" width="100%">
</p>

<p align="center">
  The first UI framework built for AI agents.<br>
  14 components. Pure CSS interactions. Zero runtime JavaScript.<br><br>
  <strong>MCP server</strong> lets Claude Desktop, Cursor, and any AI agent control your UI with typed tools.<br>
  <strong>A2UI catalog</strong> makes your components discoverable across Google's agent ecosystem.<br>
  <strong>Agent API</strong> gives LLMs structured access to every component on the page.
</p>

---

## Quick start

**30 seconds to a working app with AI agent support:**

```bash
npx create-zephyr-app my-app
cd my-app
npm start
```

Open `http://localhost:3456`. You'll see a page with working components — accordion, tabs, modal, select, dropdown. All CSS-driven, zero runtime JS.

**That's it.** You're running. Edit `index.html` to build your app.

### Connect an AI agent to control the page

The MCP server works with any client that supports the [Model Context Protocol](https://modelcontextprotocol.io/). Here's how to set it up for each:

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zephyr": {
      "command": "npx",
      "args": ["zephyr-mcp"],
      "env": { "ZEPHYR_ROOT": "/path/to/my-app" }
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "zephyr": {
      "command": "npx",
      "args": ["zephyr-mcp"],
      "env": { "ZEPHYR_ROOT": "/path/to/my-app" }
    }
  }
}
```

#### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "zephyr": {
      "command": "npx",
      "args": ["zephyr-mcp"],
      "env": { "ZEPHYR_ROOT": "/path/to/my-app" }
    }
  }
}
```

#### VS Code (with Copilot)

Add to your VS Code `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "zephyr": {
        "command": "npx",
        "args": ["zephyr-mcp"],
        "env": { "ZEPHYR_ROOT": "/path/to/my-app" }
      }
    }
  }
}
```

#### Any other MCP client

The Zephyr MCP server uses **stdio transport** (JSON-RPC 2.0 over stdin/stdout). Any MCP-compatible host can spawn it as a child process. The command is `npx zephyr-mcp` — set `ZEPHYR_ROOT` to your project directory and `ZEPHYR_MCP_PORT` to change the bridge port (default 3456).

After connecting, the agent gets 6 tools: `zephyr_act`, `zephyr_get_state`, `zephyr_describe`, `zephyr_set_state`, `zephyr_get_schema`, `zephyr_get_prompt`. Ask it to open a modal, switch a tab, or inspect the page — it just works.

### Want a chat widget on a live site instead?

```html
<script src="zephyr-agent-widget.js"></script>
<z-agent data-api-key="sk-ant-..." data-provider="anthropic"></z-agent>
```

Visitors type "open the settings modal" and it happens. No MCP, no localhost — works on any deployed page.

### Other install options

```bash
# Add to an existing project
npm install zephyr-framework
```

#### CDN (no install, no build step)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/zephyr-framework/zephyr-framework.min.css">
<script src="https://cdn.jsdelivr.net/npm/zephyr-framework/zephyr-framework.min.js"></script>
```

Or use unpkg:

```html
<link rel="stylesheet" href="https://unpkg.com/zephyr-framework/zephyr-framework.min.css">
<script src="https://unpkg.com/zephyr-framework/zephyr-framework.min.js"></script>
```

#### Manual (copy files)

```html
<link rel="stylesheet" href="zephyr-framework.css">
<script src="zephyr-framework.js"></script>

<z-accordion>
  <z-accordion-item>
    <button slot="trigger">Click me</button>
    <div slot="content"><div>It works.</div></div>
  </z-accordion-item>
</z-accordion>
```

---

## Live Demo — Zephyr Boards

See Zephyr's agent capabilities in action: **[Zephyr Boards](https://zephyr-agent-demo.vercel.app)** — a task board where an AI agent creates, moves, and manages tasks through natural language in real time. ([Source](https://github.com/daltlc/zephyr-agent-demo))

---

## Why agents choose Zephyr

Every UI framework today was built for humans writing code. Zephyr was built for **AI agents driving interfaces**.

When an agent needs to interact with a web UI, it typically has two options — both terrible:

1. **Screenshot parsing** (computer use) — Slow, brittle, expensive. A CSS change breaks everything. Costs thousands of tokens per interaction.
2. **Raw HTML analysis** — The agent parses DOM structure, guesses what elements do, and writes JavaScript to manipulate them. Error-prone, high token cost, fragile.

Zephyr eliminates both problems. Agents get **typed, structured tools** that work every time:

```
Agent thinks: "I need to open the settings modal"
Agent calls:  zephyr_act({ selector: '#settings', action: 'open' })
Agent gets:   { success: true }
```

No screenshots. No DOM parsing. No guessing. One function call.

**Why this works so well:**

- **State lives in `data-*` attributes** — not hidden in JS closures or framework internals. An agent can read `data-open` on any component and instantly know its state.
- **Semantic custom elements** — LLMs understand `<z-modal>`, `<z-select>`, `<z-accordion>` without reading docs. The tag name *is* the documentation.
- **Zero runtime JS** — No framework code runs during interactions, which means no race conditions, no async state to track, no timing issues for agents.
- **Minimal API surface** — The entire agent interface fits in a few hundred tokens. Low context window cost means agents can hold the full Zephyr API in memory while doing other work.

---

## MCP Server — AI agents control your UI

The [Model Context Protocol](https://modelcontextprotocol.io/) server is the killer feature. It turns every Zephyr component on a live page into a tool that Claude Desktop, Cursor, or any MCP-compatible host can call directly.

### How it works

```
Claude Desktop / Cursor / Any MCP Host
    ↕ stdio (JSON-RPC 2.0)
zephyr-mcp/server.js
    ↕ WebSocket (localhost:3456)
Your browser tab
    ↕ direct JavaScript calls
Zephyr.agent API → Your components
```

The agent doesn't see HTML. It sees **typed tools with structured inputs and outputs**. It calls `zephyr_act('#modal', 'open')` and gets `{ success: true }`. It calls `zephyr_get_state()` and gets a JSON array of every component's current state, actions, and metadata.

### Setup

See the [Quick Start](#connect-an-ai-agent-to-control-the-page) above for config examples for Claude Desktop, Cursor, Windsurf, VS Code, and any other MCP client.

If running from the framework repo (not via npm):

```bash
cd zephyr-mcp && npm install
node server.js  # starts bridge on http://localhost:3456
```

Open `http://localhost:3456` in your browser. The agent can now control the page.

### Available tools

| Tool | What it does | Example |
|------|-------------|---------|
| `zephyr_act` | Perform actions on components | `act('#modal', 'open')`, `act('#select', 'select', { value: 'red' })` |
| `zephyr_get_state` | Snapshot all component states | Returns `[{ tag, id, state, actions }]` for every component |
| `zephyr_describe` | Deep-inspect a single component | Returns state, actions, slots, events, ARIA info |
| `zephyr_set_state` | Set/remove data attributes | `setState('#dropdown', { 'data-open': true })` |
| `zephyr_get_schema` | Get the full component reference | All 14 components with actions, events, methods |
| `zephyr_get_prompt` | Generate an LLM context summary | Markdown of current page state for agent context windows |

### What you can build

- **Agent-controlled dashboards** — An agent calls `getSchema()` to learn available components, generates a page with tabs/selects/modals, then controls everything via `act()` — switching views, opening detail panels, selecting filters. No Playwright. No Puppeteer. Just tool calls.
- **AI-powered testing** — Instead of writing brittle E2E scripts, tell Claude: "Test that the accordion opens, closes, and fires the toggle event." The agent uses `getState()` to check component states and `act()` to interact. Tests that describe themselves in natural language.
- **Agent-assisted form filling** — An agent fills complex forms by calling `act('#country', 'select', { value: 'US' })` and `act('#date', 'set', { value: '2026-04-01' })`. These are form-associated components that participate in native FormData, so the form just works — no custom serialization.
- **Live UI debugging** — Working in Claude Code or Cursor and something looks wrong? Ask the agent to inspect the page — it calls `getState()` and instantly sees every component's state as structured JSON. No DevTools, no console logging, no manual inspection.
- **Custom agent skills** — Build skills that leverage Zephyr as their rendering layer. Your skill calls `getSchema()` to know what's available, `act()` to control components, and `getPrompt()` to inject UI context into the agent's working memory.

See [`zephyr-mcp/README.md`](zephyr-mcp/README.md) for the full tool reference, architecture diagram, and troubleshooting.

---

## A2UI Catalog — discoverable across Google's agent ecosystem

[A2UI (Agent-to-UI)](https://a2ui.org/) is Google's protocol for how AI agents describe, discover, and render UIs. Zephyr publishes its components as an A2UI catalog in `zephyr-a2ui-catalog.json`, making them instantly available to any agent in the ecosystem.

Think of it this way: **MCP is the waiter** (it executes actions on a live page) and **A2UI is the menu** (it tells agents what components exist and what they can do). Together, they give agents the complete picture.

- **Agent discovery** — When an A2UI-compatible agent (Gemini, CopilotKit, or any agent using the protocol) needs to build a UI, it browses component catalogs. Zephyr's catalog says: "I have 14 components — here's a modal with open/close, a select with typed options, a carousel with next/prev." The agent picks the right components without integration code.
- **Cross-platform rendering** — A2UI is renderer-agnostic. An agent using Zephyr's catalog could render components as Web Components, Flutter widgets, React components, or any future renderer. Define the component once; any renderer knows how to display it.
- **Structured contracts** — The catalog formally documents what each component accepts (properties), does (actions), reports (events), and provides (ARIA). This powers auto-generated docs, visual component browsers, and validation of agent-generated UIs.
- **Ecosystem positioning** — Google backs A2UI as the standard for agent-driven interfaces (deployed in Gemini Enterprise, Opal). Having a catalog means Zephyr shows up alongside Google's own components when agents search for UI toolkits.

---

## Agent Chat Widget — AI on your live site

The `<z-agent>` widget brings agent control to **deployed production sites**. Drop one tag into your HTML and visitors get a chat interface that can control every Zephyr component on the page through natural language.

```html
<script src="zephyr-framework.js"></script>
<script src="zephyr-agent-widget.js"></script>

<!-- Demo mode (API key in source — not for production) -->
<z-agent data-api-key="sk-ant-..." data-provider="anthropic"></z-agent>

<!-- Production mode (proxy keeps your API key server-side) -->
<z-agent data-endpoint="https://api.mysite.com/agent/chat"></z-agent>
```

A visitor types "open the settings modal" — the agent calls `Zephyr.agent.act('#settings', 'open')` in the browser and the modal opens. The component briefly pulses blue to show what was touched.

**Two API modes:**

| Mode | Attribute | Use case |
|------|-----------|----------|
| Direct | `data-api-key` | Quick demos. Calls LLM API from browser. Key visible in source. |
| Proxy | `data-endpoint` | Production. POST to your backend, which forwards to any LLM. |

**Supports Anthropic and OpenAI** — set `data-provider="anthropic"` (default) or `data-provider="openai"`.

**Attributes:**

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-endpoint` | — | Proxy URL for production |
| `data-api-key` | — | Direct API key for demos |
| `data-provider` | `anthropic` | `anthropic` or `openai` |
| `data-model` | per provider | Model identifier |
| `data-position` | `bottom-right` | `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-placeholder` | `Ask about this page...` | Input placeholder text |
| `data-greeting` | `Hi! I can help you...` | First message shown |

**Methods:** `open()`, `close()`, `send(message)`, `clear()`

**Events:** `open`, `close`, `message` (`{ role, content }`), `action` (`{ selector, action, params, result }`), `error` (`{ message }`)

**How MCP and the widget compare:**

| | MCP Server | `<z-agent>` Widget |
|---|---|---|
| Where it runs | Developer's machine | Any deployed site |
| Who uses it | Developer via Claude Desktop | End users visiting the site |
| Transport | stdio + localhost WebSocket | HTTPS to LLM API or proxy |
| Dependencies | Node.js, npm packages | None (browser-native fetch) |

MCP is for building. The widget is for shipping.

---

## Agent API — programmatic control from JavaScript

The `Zephyr.agent` namespace gives any JavaScript-based agent structured access to components on the page. This is what the MCP server calls under the hood, but you can also use it directly in browser-based agents, testing scripts, or custom tooling.

```javascript
// Snapshot all component states on the page
Zephyr.agent.getState()
// → [{ tag: 'z-modal', id: 'my-modal', state: {}, actions: ['open', 'close'] }, ...]

// Describe a specific component instance
Zephyr.agent.describe('#my-select')
// → { tag, id, state, actions: ['open','close','select'], slots, events, methods }

// Perform high-level actions (no DOM knowledge needed)
Zephyr.agent.act('#my-modal', 'open')
Zephyr.agent.act('#my-select', 'select', { value: 'red' })
Zephyr.agent.act('#carousel', 'next')

// Set/remove attributes directly
Zephyr.agent.setState('#dropdown', { 'data-open': true })

// Watch for state changes across all components
Zephyr.agent.observe((change) => {
  console.log(change.tag, change.attribute, change.newValue);
});

// Get component schema with actions, descriptions
Zephyr.agent.getSchema()

// Generate an LLM-ready prompt for the current page
Zephyr.agent.getPrompt()

// Add data-z-actions attributes for DOM-level discovery
Zephyr.agent.annotate()
```

A full machine-readable schema is available in `zephyr-schema.json`, and an LLM system prompt template in `zephyr-prompt.md`.

---

## How it works

Most "zero-JS" frameworks sacrifice interactivity. Zephyr doesn't. The framework JavaScript registers custom elements and attaches event listeners at page load. From that point on, **no JavaScript executes during user interactions** — all animations, state changes, and visual feedback are driven by CSS.

This is fundamentally different from React, Vue, or Alpine.js, where JavaScript runs on every click, keystroke, and state change.

| Interaction | Mechanism |
|-------------|-----------|
| Accordion open/close | CSS Grid `grid-template-rows: 0fr` to `1fr` transition |
| Tab switching | CSS `:has([data-active])` + View Transitions API |
| Modal animation | Native `<dialog>` + CSS `::backdrop` + keyframes |
| Dropdown toggle | CSS `opacity`/`transform` transition on `[data-open]` |
| Form validation | CSS `:user-invalid` / `:user-valid` pseudo-classes |
| Dark mode | CSS `:has([data-theme="dark"])` cascade |
| Scroll effects | CSS `animation-timeline: view()` |

## Quick start

```html
<link rel="stylesheet" href="zephyr-framework.css">
<script src="zephyr-framework.js"></script>

<z-accordion>
  <z-accordion-item>
    <button slot="trigger">Section title</button>
    <div slot="content">
      <div>Section content goes here.</div>
    </div>
  </z-accordion-item>
</z-accordion>
```

That's it. No build step, no npm, no config files.

---

## Components

### Layout

#### Accordion

```html
<z-accordion>
  <z-accordion-item>
    <button slot="trigger">Section 1</button>
    <div slot="content">
      <div>Content goes here</div>
    </div>
  </z-accordion-item>
</z-accordion>
```

#### Tabs

```html
<z-tabs>
  <div role="tablist">
    <button data-tab="tab1" role="tab">Tab 1</button>
    <button data-tab="tab2" role="tab">Tab 2</button>
  </div>
  <div data-tab-panel="tab1" role="tabpanel">Panel 1</div>
  <div data-tab-panel="tab2" role="tabpanel">Panel 2</div>
</z-tabs>
```

#### Carousel

```html
<z-carousel data-autoplay="3000">
  <div slot="item">Slide 1</div>
  <div slot="item">Slide 2</div>
  <div slot="item">Slide 3</div>
  <button data-prev>Previous</button>
  <button data-next>Next</button>
</z-carousel>
```

### Overlays

#### Modal

```html
<button data-action="open-modal" data-target="my-modal">Open</button>

<z-modal id="my-modal">
  <h2>Modal Title</h2>
  <p>Content</p>
  <button data-action="close-modal" data-target="my-modal">Close</button>
</z-modal>
```

Or programmatically:

```javascript
document.getElementById('my-modal').open();
document.getElementById('my-modal').close();
```

#### Dropdown

```html
<z-dropdown>
  <button slot="trigger">Menu</button>
  <div slot="content">
    <a href="#">Item 1</a>
    <a href="#">Item 2</a>
  </div>
</z-dropdown>
```

#### Toast

```javascript
Zephyr.toast('Message', 3000); // duration in ms
```

### Forms

#### Select

Form-associated custom element. Works with native `<form>` submission via `ElementInternals`.

```html
<form>
  <z-select name="color">
    <button slot="trigger">Choose color</button>
    <div slot="options">
      <div data-value="red">Red</div>
      <div data-value="blue">Blue</div>
    </div>
  </z-select>
</form>
```

#### Combobox

Filterable dropdown with type-ahead. Arrow keys to navigate, Enter to select, Escape to close.

```html
<z-combobox name="language">
  <input type="text" placeholder="Search...">
  <div slot="listbox">
    <div data-value="js">JavaScript</div>
    <div data-value="py">Python</div>
    <div data-value="rs">Rust</div>
  </div>
</z-combobox>
```

#### Date Picker

Wraps native `<input type="date">` with a styled trigger and formatted display.

```html
<z-datepicker name="birthday">
  <button slot="display">Choose a date</button>
</z-datepicker>
```

#### File Upload

Drag-and-drop zone with progress bars. Call `setProgress(index, percent)` to update individual files.

```html
<z-file-upload data-multiple data-accept="image/*">
  <div slot="dropzone">Drop files here or click to browse</div>
  <div slot="filelist"></div>
</z-file-upload>

<script>
  document.querySelector('z-file-upload').addEventListener('upload', (e) => {
    e.detail.files.forEach((file, idx) => {
      // Upload file, then update progress:
      // e.target.setProgress(idx, percentComplete);
    });
  });
</script>
```

### Data

#### Infinite Scroll

Fires `loadmore` when a sentinel enters the viewport. Set `data-loading` during fetches, call `complete()` when done.

```html
<z-infinite-scroll data-root-margin="200px">
  <div id="content"></div>
</z-infinite-scroll>

<script>
  document.querySelector('z-infinite-scroll').addEventListener('loadmore', () => {
    // Fetch and append more items
  });
</script>
```

#### Sortable

Native HTML Drag and Drop. Children with `[data-sortable]` become draggable.

```html
<z-sortable>
  <div data-sortable="1">Item 1</div>
  <div data-sortable="2">Item 2</div>
  <div data-sortable="3">Item 3</div>
</z-sortable>
```

Dispatches `sort` event with `detail: { order }`.

#### Virtual List

Renders only visible items. Handles 10,000+ rows with ~20 DOM nodes.

```html
<z-virtual-list data-item-height="40" data-buffer="5" style="height: 400px;"></z-virtual-list>

<script>
  const list = document.querySelector('z-virtual-list');
  list.setRenderer((item, idx) => `<div>${item.name}</div>`);
  list.setItems(arrayOf10000Items);
</script>
```

---

## Events

All components dispatch DOM events for state changes:

| Component | Event | Detail |
|-----------|-------|--------|
| `z-accordion` | `toggle` | `{ index, open }` |
| `z-modal` | `open` | -- |
| `z-modal` | `close` | -- |
| `z-select` | `change` | -- |
| `z-carousel` | `slide` | `{ index, direction }` |
| `z-dropdown` | `toggle` | `{ open }` |
| `z-toast` | `show` | `{ message }` |
| `z-toast` | `hide` | -- |
| `z-combobox` | `change` | -- |
| `z-combobox` | `input` | -- |
| `z-datepicker` | `change` | -- |
| `z-infinite-scroll` | `loadmore` | -- |
| `z-sortable` | `sort` | `{ order }` |
| `z-file-upload` | `upload` | `{ files }` |

```javascript
document.querySelector('z-carousel').addEventListener('slide', (e) => {
  console.log(`Moved to slide ${e.detail.index}`);
});
```

---

## Theming

Override CSS custom properties to theme all components:

```css
:root {
  --z-transition-duration: 0.3s;
  --z-transition-timing: ease;
  --z-border-radius: 0.5rem;
  --z-border-radius-sm: 0.375rem;
  --z-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --z-shadow-lg: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --z-z-index-dropdown: 50;
  --z-z-index-toast: 1000;
  --z-backdrop-blur: 4px;
  --z-toast-bg: rgb(17 24 39);
  --z-toast-color: white;
}
```

Or target components directly:

```css
z-modal dialog {
  max-width: 600px;
  border-radius: 1rem;
}
```

---

## Advanced features

### Dark mode

```html
<button id="theme-toggle">Toggle Dark Mode</button>
<script>
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.toggleAttribute('data-theme');
  });
</script>
```

CSS automatically applies dark styles via `:has([data-theme="dark"])`.

### Form validation

```html
<label>Email
  <input type="email" required>
</label>
```

Invalid inputs get styled via `label:has(+ input:user-invalid)`. No JavaScript validation needed.

### Loading states

```html
<button>
  <span data-loading></span>
  Submit
</button>
```

Automatically shows a spinner and disables via `button:has([data-loading])`.

### Scroll animations

```html
<div class="fade-in-on-scroll">
  Content fades in as you scroll
</div>
```

Uses `animation-timeline: view()` for scroll-driven animations.

### Container queries

```html
<div class="container">
  <div class="container-sm:grid-cols-2">
    <!-- 2 columns when container > 640px -->
  </div>
</div>
```

Components respond to their container size, not the viewport.

### Component registry

Access component metadata programmatically:

```javascript
Zephyr.components.modal
// { tag: 'z-modal', slots: [], attributes: [], events: ['open', 'close'], methods: ['open()', 'close()'] }
```

---

## Browser support

- Chrome/Edge 111+ (View Transitions)
- Safari 15.4+ (`:has()`)
- Firefox 121+ (Container Queries)

Graceful degradation for older browsers — components work without animations.

## Security

- **No innerHTML with user content**: Components use DOM node manipulation (`appendChild`) rather than `innerHTML` to prevent XSS
- **CSP-compatible**: No inline event handlers; all events attached via `addEventListener`
- **Content trust model**: Slot content is assumed to come from the page author (server-rendered HTML). Sanitize any dynamic user content before insertion
- **No eval or Function constructor**: The framework never evaluates strings as code

## Performance

- **0kb** JavaScript sent to users for interactions
- **GPU-accelerated** CSS animations (transform, opacity only)
- **No layout thrashing** — CSS transitions don't trigger reflow
- **Shared event delegation** — single document-level click-outside handler
- **Cleanup on disconnect** — all intervals and listeners cleaned up via `disconnectedCallback`

## License

[MIT](LICENSE)

<p align="center">
  <img src="assets/banner.svg" alt="Zephyr Framework" width="100%">
</p>

<p align="center">
  14 interactive UI components. ~7kb of setup code runs once at page load.<br>
  After that, every animation, state change, and transition is pure CSS.<br><br>
  <strong>Agent-native:</strong> Built-in MCP server, A2UI catalog, and structured agent API.<br>
  The easiest UI framework for AI agents to discover, understand, and control.
</p>

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

### Agent API

Zephyr is **agent-native** — built for AI agents and LLMs to discover and control components programmatically. The `Zephyr.agent` namespace provides a structured interface:

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

### MCP Server

The [Model Context Protocol](https://modelcontextprotocol.io/) server lets AI agents (Claude Desktop, Cursor, or any MCP host) control Zephyr components on a live page using structured tools instead of screenshot parsing or raw DOM manipulation.

Without MCP, an agent has to take a screenshot and guess what to click, or parse raw HTML and figure out the DOM structure. With MCP, the agent just calls a typed function:

```
Agent thinks: "I need to open the settings modal"
Agent calls:  zephyr_act({ selector: '#settings-modal', action: 'open' })
Agent gets:   { success: true }
```

No screenshot parsing. No HTML analysis. No guessing.

**Setup** (the MCP server is a separate optional package — the core framework stays zero-dependency):

```bash
cd zephyr-mcp && npm install
node server.js  # starts bridge on http://localhost:3456
```

Then add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "zephyr": {
      "command": "node",
      "args": ["/path/to/zephyr-mcp/server.js"]
    }
  }
}
```

**Available tools:**

| Tool | What it does | Example |
|------|-------------|---------|
| `zephyr_act` | Perform actions on components | `act('#modal', 'open')`, `act('#select', 'select', { value: 'red' })` |
| `zephyr_get_state` | Snapshot all component states | Returns `[{ tag, id, state, actions }]` for every component |
| `zephyr_describe` | Deep-inspect a single component | Returns state, actions, slots, events, ARIA info |
| `zephyr_set_state` | Set/remove data attributes | `setState('#dropdown', { 'data-open': true })` |
| `zephyr_get_schema` | Get the full component reference | All 13 components with actions, events, methods |
| `zephyr_get_prompt` | Generate an LLM context summary | Markdown of current page state for agent context windows |

**What you can build with this:**

- **Agent-controlled dashboards** — An agent calls `getSchema()` to learn available components, generates a page with tabs/selects/modals, then controls everything via `act()` — switching views, opening detail panels, selecting filters
- **AI-powered testing** — Instead of writing Playwright scripts, tell Claude: "Test that the accordion opens and closes." The agent uses `getState()` to check states and `act()` to interact
- **Agent-assisted form filling** — An agent fills out complex forms by calling `act('#country', 'select', { value: 'US' })` and `act('#date', 'set', { value: '2026-04-01' })` on form-associated components that participate in native FormData
- **Live UI debugging** — Ask an agent to inspect the page — it calls `getState()` and instantly sees every component's state as structured JSON, no DevTools needed

See [`zephyr-mcp/README.md`](zephyr-mcp/README.md) for the full tool reference, architecture diagram, and troubleshooting.

### A2UI Compatibility

[A2UI (Agent-to-UI)](https://a2ui.org/) is Google's protocol for how AI agents describe and render UIs. Zephyr publishes its components as an A2UI catalog in `zephyr-a2ui-catalog.json`, making them discoverable by any agent in Google's ecosystem.

Think of A2UI as a shared language between agents and rendering engines. The catalog file is Zephyr's entry into that ecosystem:

- **Agent discovery** — When an A2UI-compatible agent (Gemini, CopilotKit, or any agent using the protocol) needs to build a UI, it browses available component catalogs. Zephyr's catalog says: "I have 13 components — here's a modal with open/close, here's a select with typed options, here's a carousel with next/prev." The agent picks the right components without custom integration code
- **Cross-platform rendering** — A2UI is renderer-agnostic. An agent using Zephyr's catalog could render components as Web Components (native), Flutter widgets, React components, or any future renderer. You define the accordion once; any renderer knows how to display it
- **Structured contracts** — The catalog formally documents what each component accepts (properties), what it does (actions), what it reports (events), and what accessibility it provides (ARIA). This powers auto-generated docs, visual component browsers, and validation of agent-generated UIs
- **Ecosystem positioning** — Google backs A2UI as the standard for agent-driven interfaces (deployed in Gemini Enterprise, Opal). Having a catalog means Zephyr shows up alongside Google's own components when agents search for UI toolkits

**How MCP and A2UI work together:**

The A2UI catalog is the **menu** — it tells agents what components exist and what they can do. The MCP server is the **waiter** — it executes those actions on a live page. An agent workflow might be: read the catalog to plan a UI, generate HTML with those components, serve it via MCP, then use MCP tools to interact with the live page.

**Why agents love Zephyr:**
- State lives in `data-*` attributes — no opaque JS closures to reverse-engineer
- Semantic custom elements — LLMs understand `<z-modal>` without docs
- Zero runtime JS — works in any execution context
- Minimal API surface — low token cost for agent context windows

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

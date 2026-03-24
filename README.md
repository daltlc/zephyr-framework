# Zephyr Framework

Zero-JavaScript interactive framework using View Transitions API, CSS `:has()`, container queries, and custom elements.

## Why Zephyr?

Most "zero-JS" frameworks sacrifice interactivity. Zephyr delivers rich interactions without shipping runtime JavaScript to users:

- **View Transitions API** - Smooth animations between states
- **CSS `:has()`** - Parent selectors enable complex state styling
- **Container Queries** - Component-based responsive design
- **Form-Associated Custom Elements** - Native form integration
- **`<dialog>`** - Native modals with backdrop

### How "Zero-JS" Works

The framework JavaScript (~7kb) runs **once at page load** to register custom elements and attach event listeners. After that, **no JavaScript executes during user interactions** -- all animations, state changes, and visual feedback are driven by CSS. This is fundamentally different from React, Vue, or Alpine.js where JavaScript runs on every click, keystroke, and state change.

| What | How |
|------|-----|
| Accordion open/close | CSS Grid `grid-template-rows: 0fr` to `1fr` transition |
| Tab switching | CSS `:has([data-active])` + View Transitions |
| Modal animation | Native `<dialog>` + CSS `::backdrop` + keyframes |
| Dropdown toggle | CSS `opacity`/`transform` transition on `:has([data-open])` |
| Form validation | CSS `:user-invalid` / `:user-valid` pseudo-classes |
| Dark mode | CSS `:has([data-theme="dark"])` cascade |
| Scroll effects | CSS `animation-timeline: view()` |

## Features

- Accordions with smooth open/close
- Tabs with animated transitions
- Dropdowns with auto-positioning
- Modals with backdrop blur
- Carousels with View Transitions
- Custom selects that work with forms
- Toast notifications
- Dark mode via `:has([data-theme="dark"])`
- Form validation styling
- Loading states
- Scroll-driven animations
- Combobox with filterable keyboard navigation
- Date picker with formatted display
- Infinite scroll via IntersectionObserver
- Drag & drop sortable lists
- File upload with drag-and-drop and progress
- Virtual scrolling for large datasets (10,000+ rows)
- Full ARIA support and keyboard navigation

## Installation

```html
<link rel="stylesheet" href="zephyr-framework.css">
<script src="zephyr-framework.js"></script>
```

## Usage

### Accordion

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

**How it works:** CSS Grid `grid-template-rows` transition from `0fr` to `1fr`. The `:has([data-open])` selector triggers the expansion. ARIA attributes (`aria-expanded`, `aria-controls`) are set automatically.

### Tabs

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

**How it works:** View Transitions API animates between panel changes. Container queries handle responsive tab layouts. Arrow keys navigate between tabs.

### Modal

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

**How it works:** Native `<dialog>` element with View Transitions for entrance/exit. CSS `::backdrop` for blur effect. `aria-labelledby` auto-detected from heading.

### Select (Form-Associated)

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

**How it works:** Form-associated custom element integrates with native forms via `ElementInternals`. Value syncs automatically. Arrow keys navigate options.

### Carousel

```html
<z-carousel data-autoplay="3000">
  <div slot="item">Slide 1</div>
  <div slot="item">Slide 2</div>
  <div slot="item">Slide 3</div>
  <button data-prev>Previous</button>
  <button data-next>Next</button>
</z-carousel>
```

**How it works:** View Transitions create slide animations. `view-transition-name: slide` enables custom transitions. Arrow keys navigate slides.

### Dropdown

```html
<z-dropdown>
  <button slot="trigger">Menu</button>
  <div slot="content">
    <a href="#">Item 1</a>
    <a href="#">Item 2</a>
  </div>
</z-dropdown>
```

**How it works:** CSS transforms and opacity for open/close. Click-outside handled by shared event delegation. Escape key closes.

### Toast

```javascript
Zephyr.toast('Message', 3000); // duration in ms
```

**How it works:** Fixed position element with transform animation. Auto-removes after duration. Uses `role="alert"` and `aria-live="polite"`.

### Combobox

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

**How it works:** Filterable dropdown with `role="combobox"` and `aria-autocomplete="list"`. Type to filter, ArrowUp/Down to navigate, Enter to select, Escape to close.

### Date Picker

```html
<z-datepicker name="birthday">
  <button slot="display">Choose a date</button>
</z-datepicker>
```

**How it works:** Wraps native `<input type="date">` with a styled trigger. Calls `showPicker()` on click. Formats the selected date as locale string (e.g., "March 23, 2026"). Form-associated via `ElementInternals`.

### Infinite Scroll

```html
<z-infinite-scroll data-root-margin="200px">
  <div id="content"></div>
</z-infinite-scroll>

<script>
  document.querySelector('z-infinite-scroll').addEventListener('loadmore', () => {
    // Fetch and append more items
    // Set data-loading while fetching to prevent duplicates
    // Call .complete() when all data is loaded
  });
</script>
```

**How it works:** Uses `IntersectionObserver` to watch a sentinel element. Dispatches `loadmore` when the sentinel enters the viewport. Set `data-loading` during async fetches, call `complete()` when done.

### Sortable (Drag & Drop)

```html
<z-sortable>
  <div data-sortable="1">Item 1</div>
  <div data-sortable="2">Item 2</div>
  <div data-sortable="3">Item 3</div>
</z-sortable>
```

**How it works:** Native HTML Drag and Drop API. Children with `[data-sortable]` become draggable. Visual indicators via `data-dragging` and `data-drag-over` attributes. Dispatches `sort` event with `detail: { order }`.

### File Upload

```html
<z-file-upload data-multiple data-accept="image/*">
  <div slot="dropzone">Drop files here or click to browse</div>
  <div slot="filelist"></div>
</z-file-upload>

<script>
  document.querySelector('z-file-upload').addEventListener('upload', (e) => {
    e.detail.files.forEach((file, idx) => {
      // Upload file, update progress:
      // e.target.setProgress(idx, percentComplete);
    });
  });
</script>
```

**How it works:** Styled drag-and-drop zone wrapping native `<input type="file">`. Shows file names, sizes, and progress bars. `data-dragover` attribute for drag hover styling. `setProgress(index, percent)` updates individual progress bars.

### Virtual List

```html
<z-virtual-list data-item-height="40" data-buffer="5" style="height: 400px;"></z-virtual-list>

<script>
  const list = document.querySelector('z-virtual-list');
  list.setRenderer((item, idx) => `<div>${item.name}</div>`);
  list.setItems(arrayOf10000Items);
</script>
```

**How it works:** Renders only visible items plus a buffer zone. Uses a tall spacer div for correct scrollbar size and `will-change: transform` for GPU-accelerated repositioning. Handles 10,000+ items with ~20 DOM nodes.

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

## Advanced Features

### Dark Mode

```html
<button id="theme-toggle">Toggle Dark Mode</button>
<script>
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.toggleAttribute('data-theme');
  });
</script>
```

CSS automatically applies dark styles via `:has([data-theme="dark"])`.

### Form Validation Styling

```html
<label>Email
  <input type="email" required>
</label>
```

Invalid inputs get red styling via `label:has(+ input:user-invalid)`.

### Loading States

```html
<button>
  <span data-loading></span>
  Submit
</button>
```

Button automatically shows spinner and disables via `button:has([data-loading])`.

### Scroll Animations

```html
<div class="fade-in-on-scroll">
  Content fades in as you scroll
</div>
```

Uses `animation-timeline: view()` for scroll-driven animations.

### Container Queries

```html
<div class="container">
  <div class="container-sm:grid-cols-2">
    <!-- 2 columns when container > 640px -->
  </div>
</div>
```

Components respond to their container size, not viewport.

## Customization

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

## Component Registry

Access component metadata programmatically:

```javascript
Zephyr.components.modal
// { tag: 'z-modal', slots: [], attributes: [], events: ['open', 'close'], methods: ['open()', 'close()'] }
```

## State Attribute Conventions

| Attribute | Purpose | Used By |
|-----------|---------|---------|
| `data-open` | Binary open/closed state | Accordion, Select, Dropdown |
| `data-active` | Selected/current item in a set | Tabs, Carousel |
| `data-visible` | Visibility toggle | Toast |
| `data-value` | Item value for selection | Select options |

## Security

- **No innerHTML with user content**: Components use DOM node manipulation (`appendChild`) rather than `innerHTML` to prevent XSS
- **CSP-compatible**: The demo page and framework use no inline event handlers (`onclick`); all events are attached via `addEventListener`
- **Content trust model**: Component slot content is assumed to come from the page author (server-rendered HTML). If injecting dynamic user content into components, sanitize it before insertion
- **No eval or Function constructor**: The framework never evaluates strings as code

## Browser Support

- Chrome/Edge 111+ (View Transitions)
- Safari 15.4+ (`:has()`)
- Firefox 121+ (Container Queries)

Graceful degradation for older browsers - components work without animations.

## Technical Details

### Performance

- **0kb** JavaScript sent to users for interactions
- **GPU-accelerated** CSS animations (transform, opacity only)
- **No layout thrashing** - CSS transitions don't trigger reflow
- **Shared event delegation** - Single document-level click-outside handler
- **Cleanup on disconnect** - All intervals and listeners cleaned up via `disconnectedCallback`
- **Lazy evaluation** - Components only initialize when used

### Form Integration

Custom elements use `ElementInternals` API for native form participation:

```javascript
class ZSelect extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
  }

  set value(v) {
    this._internals.setFormValue(v);
  }
}
```

### View Transitions

```css
::view-transition-old(slide) {
  animation: slide-out 0.4s ease-in-out;
}

::view-transition-new(slide) {
  animation: slide-in 0.4s ease-in-out;
}
```

Elements with `view-transition-name: slide` get custom animations.

## Comparison

| Feature | Zephyr | React | Alpine.js |
|---------|--------|-------|-----------|
| Runtime JS | 0kb* | 45kb+ | 15kb+ |
| Animations | CSS | JS Required | JS Required |
| Forms | Native | Controlled | Manual |
| SSR | Perfect | Complex | N/A |
| ARIA | Automatic | Manual | Manual |
| Learning Curve | HTML/CSS | High | Medium |

*Framework code runs once at page load, no runtime JS for interactions

## Architecture & Stack

```
zephyr-framework/
├── zephyr-framework.js      # Core -- 14 Web Component classes + global API
├── zephyr-framework.css      # Styles -- CSS Layers (reset, components, utilities)
├── demo.css                  # Demo page styles (not part of framework)
├── index.html                # Interactive demo/showcase
├── README.md                 # This file
├── CLAUDE.md                 # Claude Code configuration
├── AGENTS.md                 # Engineering standards & full stack layout
└── claude-roadmap.md         # Improvement roadmap
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Components | Web Components (Custom Elements v1) | Semantic, encapsulated UI |
| Styling | CSS Layers, `:has()`, Container Queries | State-driven styling without JS |
| Animation | View Transitions API, CSS Transitions | GPU-accelerated smooth animations |
| Forms | ElementInternals API | Native form participation |
| Modals | `<dialog>` element | Native modal with backdrop |
| Theming | CSS Custom Properties (`--z-*`) | User-customizable design tokens |
| Layout | CSS Grid, Flexbox, Container Queries | Responsive, component-scoped layout |
| Scroll | Scroll-driven Animations API | Scroll-triggered effects |

## Engineering Standards

This project follows strict engineering principles:

- **DRY**: Shared logic lives in the `ZephyrElement` base class. No copy-pasted patterns.
- **Modular**: Each component is a self-contained custom element. Components communicate via DOM events.
- **Maintainable**: Clear naming conventions, JSDoc on public methods, minimal coupling.
- **Performant**: GPU-accelerated CSS animations only. No layout-triggering properties. Shared event delegation.
- **Secure**: No `innerHTML` with untrusted content. CSP-compatible event handling.
- **Accessible**: ARIA attributes, keyboard navigation, focus management on all components.

See `AGENTS.md` for the full engineering standards and `claude-roadmap.md` for the improvement roadmap.

## License

MIT

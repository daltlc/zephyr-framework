# Zephyr Framework

Zero-JavaScript interactive framework using View Transitions API, CSS `:has()`, container queries, and custom elements.

## Why Zephyr?

Most "zero-JS" frameworks sacrifice interactivity. Zephyr delivers rich interactions without shipping JavaScript to users:

- **View Transitions API** - Smooth animations between states
- **CSS `:has()`** - Parent selectors enable complex state styling
- **Container Queries** - Component-based responsive design
- **Form-Associated Custom Elements** - Native form integration
- **`<dialog>`** - Native modals with backdrop

## Features

- âœ… Accordions with smooth open/close
- âœ… Tabs with animated transitions  
- âœ… Dropdowns with auto-positioning
- âœ… Modals with backdrop blur
- âœ… Carousels with View Transitions
- âœ… Custom selects that work with forms
- âœ… Toast notifications
- âœ… Dark mode via `:has([data-theme="dark"])`
- âœ… Form validation styling
- âœ… Loading states
- âœ… Scroll-driven animations

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

**How it works:** CSS Grid `grid-template-rows` transition from `0fr` to `1fr`. The `:has([data-open])` selector triggers the expansion.

### Tabs

```html
<z-tabs>
  <div role="tablist">
    <button data-tab="tab1">Tab 1</button>
    <button data-tab="tab2">Tab 2</button>
  </div>
  <div data-tab-panel="tab1">Panel 1</div>
  <div data-tab-panel="tab2">Panel 2</div>
</z-tabs>
```

**How it works:** View Transitions API animates between panel changes. Container queries handle responsive tab layouts.

### Modal

```html
<button onclick="document.getElementById('my-modal').open()">Open</button>

<z-modal id="my-modal">
  <h2>Modal Title</h2>
  <p>Content</p>
  <button onclick="document.getElementById('my-modal').close()">Close</button>
</z-modal>
```

**How it works:** Native `<dialog>` element with View Transitions for entrance/exit. CSS `::backdrop` for blur effect.

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

**How it works:** Form-associated custom element integrates with native forms. Value syncs automatically.

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

**How it works:** View Transitions create slide animations. `view-transition-name: slide` enables custom transitions.

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

**How it works:** CSS transforms and opacity for open/close. Click-outside handled by event delegation.

### Toast

```javascript
Zephyr.toast('Message', 3000); // duration in ms
```

**How it works:** Fixed position element with transform animation. Auto-removes after duration.

## Advanced Features

### Dark Mode

```html
<html>
  <body>
    <button onclick="document.body.toggleAttribute('data-theme', 'dark')">
      Toggle Dark Mode
    </button>
  </body>
</html>
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

## Browser Support

- Chrome/Edge 111+ (View Transitions)
- Safari 15.4+ (`:has()`)
- Firefox 121+ (Container Queries)

Graceful degradation for older browsers - components work without animations.

## Technical Details

### Zero Client JS

The framework JS only runs once at page load to:
1. Register custom elements
2. Attach event listeners
3. Set up declarative behaviors

No JS executes during interactions - everything is CSS-driven.

### Performance

- **0kb** JavaScript sent to users for interactions
- **GPU-accelerated** CSS animations
- **No layout thrashing** - CSS transitions don't trigger reflow
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

## Customization

Override CSS variables:

```css
:root {
  --z-transition-duration: 0.3s;
  --z-border-radius: 0.5rem;
  --z-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

Or target components directly:

```css
z-modal dialog {
  max-width: 600px;
  border-radius: 1rem;
}
```

## Comparison

| Feature | Zephyr | React | Alpine.js |
|---------|--------|-------|-----------|
| Client JS | 0kb* | 45kb+ | 15kb+ |
| Animations | CSS | JS Required | JS Required |
| Forms | Native | Controlled | Manual |
| SSR | Perfect | Complex | N/A |
| Learning Curve | HTML/CSS | High | Medium |

*Framework code runs once, no runtime JS for interactions

## Architecture & Stack

```
zephyr-framework/
├── zephyr-framework.js      # Core — 7 Web Component classes + global API
├── zephyr-framework.css      # Styles — CSS Layers (reset, components, utilities)
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
| Theming | CSS Custom Properties | User-customizable design tokens |
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

## Future Enhancements

- Combobox with keyboard navigation
- Date picker using `<input type="date">` enhancement
- Infinite scroll with Intersection Observer
- Drag & drop with native API
- File upload with progress
- Virtual scrolling for large lists

## License

MIT

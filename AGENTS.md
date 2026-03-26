# Zephyr Framework — Agent & Engineering Standards

## Documentation Rule

**Always update code comments, documentation, READMEs, and the demo page (`index.html`) whenever a feature is modified or added.** This includes:

- JSDoc comments on public methods and classes
- `README.md` usage examples and feature list
- `AGENTS.md` stack layout if architecture changes
- `index.html` demo if a component's API changes
- `claude-roadmap.md` — mark items complete or add new items as they emerge

## Engineering Standards

All code in this project must follow these principles:

### DRY (Don't Repeat Yourself)
- Extract shared logic into base class methods or utility functions
- Shared CSS patterns use common selectors or CSS custom properties
- No copy-pasted blocks — if a pattern appears twice, abstract it

### Modular
- Each component is a self-contained custom element class
- Components communicate via DOM events, not direct references
- CSS is scoped to component selectors (`z-*`)
- Framework files are separated from demo files

### Maintainable
- Clear naming conventions (see below)
- JSDoc on all public methods
- Minimal coupling between components
- Progressive enhancement — components degrade gracefully

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Custom elements | `z-` prefix, kebab-case | `z-accordion`, `z-modal` |
| CSS classes | kebab-case | `carousel-controls` |
| Data attributes | `data-` prefix, kebab-case | `data-open`, `data-active` |
| JS classes | PascalCase with `Z` prefix | `ZAccordion`, `ZModal` |
| Private members | underscore prefix | `_currentIndex`, `_transition()` |
| CSS variables | `--z-` prefix | `--z-transition-duration` |
| Events | lowercase, no prefix | `change`, `open`, `close` |

## Testing Standards

- Every component must have unit tests covering: registration, attribute handling, state transitions, event dispatch
- Form-associated components need integration tests verifying `FormData` participation
- Accessibility: validate ARIA attributes and keyboard navigation
- Test harness should be HTML-based (no Node dependency) to match the zero-JS philosophy
- Tests live in a `tests/` directory

## Code Hygiene

- No `innerHTML` for untrusted content — use `cloneNode()` or DOM manipulation
- All event listeners added in `connectedCallback` must be removed in `disconnectedCallback`
- Intervals and timeouts must be stored and cleared on disconnect
- Use CSS custom properties for all themeable values
- `formAssociated` only on components that participate in forms
- All components dispatch events for state changes

## Performance Standards

- All animations use GPU-accelerated properties (`transform`, `opacity`)
- No layout-triggering animations (`width`, `height`, `top`, `left`)
- Document-level event listeners are shared/delegated, not per-instance
- CSS transitions preferred over JS animations
- View Transitions API used with feature detection fallback

## Security Standards

- No `innerHTML` with user-supplied content
- Inline `onclick` handlers should be replaced with delegated event listeners for CSP compatibility
- Document security model for content injection in components
- Sanitize any content that flows from user input into the DOM

## State Attribute Conventions

| Attribute | Purpose | Used By |
|-----------|---------|---------|
| `data-open` | Binary open/closed state | Accordion, Select, Dropdown |
| `data-active` | Selected/current item in a set | Tabs, Carousel |
| `data-visible` | Visibility toggle | Toast |
| `data-value` | Item value for selection | Select options |

## Full Stack Layout

```
zephyr-framework/
├── zephyr-framework.js      # Core framework — Web Components (custom elements)
│   ├── ZephyrElement          # Base class (shared utilities, lifecycle, click-outside)
│   ├── ZAccordionItem         # Registered custom element for accordion items
│   ├── ZAccordion             # Collapsible sections via CSS Grid + ARIA
│   ├── ZModal                 # Native <dialog> wrapper with View Transitions + ARIA
│   ├── ZTabs                  # Tab panels with View Transitions + keyboard nav
│   ├── ZSelect                # Form-associated custom select (ElementInternals) + ARIA
│   ├── ZCarousel              # Slide viewer with autoplay + keyboard nav
│   ├── ZToast                 # Notification system (role=alert)
│   ├── ZDropdown              # Menu dropdown with click-outside + ARIA
│   ├── ZCombobox              # Filterable combobox with keyboard nav + ARIA
│   ├── ZDatepicker            # Enhanced native date input + formatted display
│   ├── ZInfiniteScroll        # IntersectionObserver-based infinite loading
│   ├── ZSortable              # Native Drag & Drop reorderable list
│   ├── ZFileUpload            # Drag-and-drop file upload with progress
│   ├── ZVirtualList           # Virtual scrolling for large datasets
│   ├── window.Zephyr          # Global utility API + component registry
│   └── Zephyr.agent           # Agent API (getState, act, describe, observe, getPrompt, render, compose)
│
├── dashboard/               # Dashboard add-on (optional)
│   ├── zephyr-dashboard.js    # Components: ZStat, ZDashboard, ZDashboardPanel, ZDataGrid, ZChart
│   ├── zephyr-dashboard.css   # Styles (dark mode, container queries)
│   ├── dashboard-demo.html    # Agent Dashboard demo (3 data themes)
│   ├── dashboard-demo.css     # Dashboard demo styles
│   └── dashboard-data.js      # Mock data generators + simulation (demo only)
│
├── zephyr-agent-widget.js   # <z-agent> embedded chat widget (separate from core)
│   └── ZAgent                 # LLM-powered chat with Zephyr.agent tool execution
│
├── zephyr-schema.json        # Machine-readable component schema for agents/LLMs
├── zephyr-prompt.md          # LLM system prompt template for Zephyr usage
├── zephyr-a2ui-catalog.json  # A2UI (Agent-to-UI) catalog definition for Google's agent ecosystem
│
├── zephyr-framework.css      # Core styles (CSS custom properties for theming)
│   ├── :root                  # --z-* design tokens
│   ├── @layer reset           # CSS reset (box-sizing, margins)
│   ├── @layer components      # Component styles + animations
│   │   ├── View Transitions   # Slide/fade transition keyframes
│   │   ├── Accordion          # Grid-based expand/collapse
│   │   ├── Modal              # Dialog + backdrop blur
│   │   ├── Tabs               # Container query responsive tabs
│   │   ├── Floating Panel     # Shared select/dropdown positioning
│   │   ├── Select             # Select-specific overrides
│   │   ├── Carousel           # Slide transitions
│   │   ├── Toast              # Fixed-position notification
│   │   ├── Dropdown           # Dropdown-specific overrides
│   │   ├── Combobox           # Filterable dropdown listbox
│   │   ├── Date Picker        # Hidden native input + styled trigger
│   │   ├── Infinite Scroll    # Sentinel + loading spinner
│   │   ├── Sortable           # Drag states (dragging, drag-over)
│   │   ├── File Upload        # Drop zone + progress bars
│   │   ├── Virtual List       # Spacer + viewport positioning
│   │   ├── Dark Mode          # :has([data-theme="dark"]) theming
│   │   ├── Loading States     # Spinner animation
│   │   ├── Form Validation    # :user-invalid/:user-valid styling
│   │   └── Scroll Animations  # animation-timeline: view()
│   └── @layer utilities       # Container query grid utilities
│
├── zephyr-mcp/               # zephyr-mcp — MCP server package
│   ├── server.js              # MCP stdio server + HTTP/WebSocket bridge
│   ├── bridge-client.js       # Browser-side WebSocket bridge script
│   ├── package.json           # npm deps: @modelcontextprotocol/sdk, zod, ws
│   └── README.md              # MCP setup and tool reference
│
├── create-zephyr-framework/        # CLI scaffolder for new projects
│   ├── index.js               # npx create-zephyr-framework CLI entry point
│   ├── template/
│   │   └── index.html         # Starter page with example components
│   └── package.json           # Zero deps — uses only Node built-ins
│
├── build.js                  # esbuild minification script (node build.js)
├── zephyr-framework.d.ts     # TypeScript declarations for all components + APIs
├── package.json              # Root npm package: zephyr-framework
├── demo.css                  # Demo page styles (NOT part of framework)
├── index.html                # Demo/showcase page
├── README.md                 # Documentation + usage guide
├── CLAUDE.md                 # Claude Code configuration
├── AGENTS.md                 # This file — standards & architecture
└── claude-roadmap.md         # Improvement roadmap
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Components | Web Components (Custom Elements v1) | Semantic, encapsulated UI components |
| Styling | CSS Layers, `:has()`, Container Queries | State-driven styling without JS |
| Animation | View Transitions API, CSS Transitions | GPU-accelerated smooth animations |
| Forms | ElementInternals API | Native form participation |
| Modals | `<dialog>` element | Native modal with backdrop |
| Theming | CSS Custom Properties | User-customizable design tokens |
| Layout | CSS Grid, Flexbox, Container Queries | Responsive, component-scoped layout |
| Scroll | Scroll-driven Animations API | Scroll-triggered effects |
| Agent API | Zephyr.agent namespace | Structured LLM/agent interface |
| MCP | Model Context Protocol server | Remote agent tool integration |
| A2UI | Agent-to-UI catalog | Google agent ecosystem discovery |
| Agent Widget | `<z-agent>` custom element | Embedded chat for live deployed sites |

### Browser Support

- Chrome/Edge 111+ (View Transitions)
- Safari 15.4+ (`:has()`)
- Firefox 121+ (Container Queries)
- Graceful degradation for older browsers

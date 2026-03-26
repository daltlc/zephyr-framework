# Zephyr Framework — Improvement Roadmap

Prioritized improvements for DRY, modular, maintainable, production-ready code. All items are self-contained to the codebase — no CI/CD or infrastructure assumptions.

---

## Priority 1: Security

### 1.1 Replace innerHTML in ZModal
- **File**: `zephyr-framework.js` line 81
- **Issue**: `dialog.innerHTML = this.innerHTML` is an XSS vector if user content is injected into modal markup
- **Fix**: Move child nodes into dialog using DOM manipulation (`while (this.firstChild) dialog.appendChild(this.firstChild)`) instead of serializing/parsing HTML

### 1.2 Remove Inline Event Handlers from Demo
- **File**: `index.html` (lines 497, 510, 511, 522)
- **Issue**: `onclick="..."` attributes are incompatible with strict Content Security Policy (CSP)
- **Fix**: Replace with `data-action` attributes and delegated event listeners, or attach listeners in a `<script>` block at the bottom

### 1.3 Document Security Model
- **File**: `README.md`
- **Issue**: No documentation on safe content injection patterns
- **Fix**: Add a Security section explaining that component content should come from trusted sources, and document safe patterns for dynamic content

---

## Priority 2: DRY Violations

### 2.1 Extract Toggle Pattern to Base Class
- **Files**: `zephyr-framework.js` lines 136-142 (ZSelect), lines 240-247 (ZDropdown)
- **Issue**: Identical `hasAttribute('data-open') ? removeAttribute : setAttribute` logic duplicated
- **Fix**: Add `_toggleOpen()` method to `ZephyrElement` base class

### 2.2 Extract Click-Outside Handler
- **Files**: `zephyr-framework.js` lines 153-157 (ZSelect), lines 249-253 (ZDropdown)
- **Issue**: Same document-level click-outside listener added per instance
- **Fix**: Add `_attachClickOutside()` to `ZephyrElement` that registers a shared handler and stores a reference for cleanup

### 2.3 Extract View Transition Wrapper
- **Files**: `zephyr-framework.js` — ZModal.open(), ZModal.close(), ZCarousel._transition(), ZToast.show()
- **Issue**: `if (document.startViewTransition) { document.startViewTransition(() => fn()) } else { fn() }` repeated 4 times
- **Fix**: Add static `ZephyrElement.withTransition(fn)` utility method

### 2.4 Unify Floating Panel CSS
- **File**: `zephyr-framework.css` lines 196-217 (select options), lines 298-318 (dropdown content)
- **Issue**: Nearly identical absolute positioning, opacity, transform, and transition styles
- **Fix**: Extract shared `[data-z-floating]` attribute styles, apply to both components

---

## Priority 3: Performance

### 3.1 Share Document-Level Click Listeners
- **Files**: `zephyr-framework.js` lines 153-157 (ZSelect), lines 249-253 (ZDropdown)
- **Issue**: Each component instance adds its own `document.addEventListener('click', ...)` — N instances = N listeners
- **Fix**: Single delegated listener that checks `closest('z-select, z-dropdown')` and closes all non-matching open panels

### 3.2 Clean Up Carousel Autoplay Interval
- **File**: `zephyr-framework.js` lines 211-214
- **Issue**: `setInterval` reference is never stored or cleared — causes memory leak and zombie animations when element is removed
- **Fix**: Store interval ID in `this._autoplayInterval`, clear in `disconnectedCallback()`

### 3.3 Implement disconnectedCallback Across All Components
- **File**: `zephyr-framework.js`
- **Issue**: No component implements `disconnectedCallback()` — event listeners and intervals are never cleaned up
- **Fix**: Add `disconnectedCallback()` to `ZephyrElement` base class, override in components that add document-level listeners or intervals

### 3.4 Implement CSS Custom Properties for Theming
- **File**: `zephyr-framework.css`
- **Issue**: README documents `--z-transition-duration`, `--z-border-radius`, `--z-shadow` but they're never defined or used — all values are hardcoded
- **Fix**: Define variables in `:root` and use `var()` throughout component styles:
  ```css
  :root {
    --z-transition-duration: 0.3s;
    --z-border-radius: 0.5rem;
    --z-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }
  ```

---

## Priority 4: Accessibility

### 4.1 Accordion ARIA
- **File**: `zephyr-framework.js` (ZAccordion), `zephyr-framework.css`
- **Missing**: `aria-expanded`, `aria-controls`, `role="region"`, `id` linkage
- **Fix**: In `attachTemplate()`, set `aria-expanded="false"` on triggers, add `aria-controls` pointing to content `id`, toggle `aria-expanded` on click

### 4.2 Tabs ARIA & Keyboard Navigation
- **File**: `zephyr-framework.js` (ZTabs)
- **Missing**: `aria-selected`, `aria-controls`, `tabindex` management, arrow key navigation
- **Fix**: Set `aria-selected` on active tab, `tabindex="-1"` on inactive tabs, handle ArrowLeft/ArrowRight/Home/End keys

### 4.3 Select ARIA
- **File**: `zephyr-framework.js` (ZSelect)
- **Missing**: `role="listbox"`, `role="option"`, `aria-expanded`, `aria-activedescendant`
- **Fix**: Add roles to options container and items, set `aria-expanded` on trigger, manage `aria-activedescendant` for keyboard navigation

### 4.4 Dropdown ARIA
- **File**: `zephyr-framework.js` (ZDropdown)
- **Missing**: `aria-expanded`, `aria-haspopup="true"`
- **Fix**: Set `aria-haspopup="true"` on trigger, toggle `aria-expanded`

### 4.5 Modal ARIA
- **File**: `zephyr-framework.js` (ZModal)
- **Missing**: `aria-labelledby`, `aria-describedby`
- **Fix**: Auto-detect heading in modal content, set `aria-labelledby` on dialog

### 4.6 Keyboard Navigation
- **File**: `zephyr-framework.js` (all components)
- **Missing**: No keyboard handling for Escape (close), Enter/Space (activate), Arrow keys (navigate)
- **Fix**: Add keyboard event listeners in base class or per-component:
  - Escape → close open dropdowns/selects/modals
  - Enter/Space → toggle accordion items, activate tabs
  - ArrowUp/Down → navigate select options, dropdown items
  - ArrowLeft/Right → navigate tabs, carousel slides

---

## Priority 5: Naming & Code Hygiene

### 5.1 Register z-accordion-item
- **File**: `zephyr-framework.js`
- **Issue**: `z-accordion-item` is used in HTML as a custom element but never defined via `customElements.define()`
- **Fix**: Create minimal `ZAccordionItem` class and register it

### 5.2 Standardize Lifecycle Pattern
- **File**: `zephyr-framework.js`
- **Issue**: `ZCarousel` overrides `connectedCallback()` directly while other components use `attachTemplate()` — inconsistent
- **Fix**: Move all component setup into `attachTemplate()` and/or `attachBehaviors()`, keep `connectedCallback()` in base class only

### 5.3 Move formAssociated to Only Form Components
- **File**: `zephyr-framework.js` line 7
- **Issue**: `static formAssociated = true` is on `ZephyrElement` base class but only `ZSelect` needs form integration — causes unnecessary `attachInternals()` calls on all components
- **Fix**: Remove from base class, add only to `ZSelect`

### 5.4 Add JSDoc Comments
- **File**: `zephyr-framework.js`
- **Issue**: No documentation on public API methods
- **Fix**: Add JSDoc to: `ZephyrElement`, `ZModal.open()`, `ZModal.close()`, `ZCarousel.next()`, `ZCarousel.prev()`, `ZToast.show()`, `Zephyr.modal()`, `Zephyr.toast()`

### 5.5 Standardize Private Member Naming
- **File**: `zephyr-framework.js`
- **Issue**: Inconsistent — `_currentIndex`, `_transition()` have underscores but `attachTemplate`, `attachBehaviors` (which are also internal) don't
- **Fix**: Use underscore prefix for all truly private members. `attachTemplate`/`attachBehaviors` are protected (designed for override) so no underscore is correct — just document the convention

---

## Priority 6: Consistency

### 6.1 Document State Attribute Convention
- **Files**: `AGENTS.md`, `README.md`
- **Issue**: Different state attributes used — `data-open`, `data-active`, `data-visible` — without documented reasoning
- **Fix**: Document convention:
  - `data-open` — binary open/closed state (expandable panels)
  - `data-active` — selected/current item in a set (tabs, slides)
  - `data-visible` — visibility toggle (notifications)

### 6.2 Add Event Dispatching to All Components
- **File**: `zephyr-framework.js`
- **Issue**: Only `ZSelect` dispatches a `change` event — other components silently change state
- **Fix**: Add custom events:
  - `ZAccordion` → `toggle` event on item open/close
  - `ZModal` → `open` and `close` events
  - `ZCarousel` → `slide` event with `detail: { index }`
  - `ZDropdown` → `toggle` event
  - `ZToast` → `show` and `hide` events

### 6.3 Demo Page CSS Layer Alignment
- **File**: `index.html`
- **Issue**: Demo styles are outside any CSS layer, which means they always win over `@layer components` — this works by accident but isn't intentional
- **Fix**: Either wrap demo styles in `@layer demo` or document that consumer styles intentionally override framework layers

---

## Priority 7: Architecture

### 7.1 Separate Demo Styles from Framework
- **Files**: `index.html` → new `demo.css`
- **Issue**: 360 lines of demo-specific CSS embedded in `index.html`
- **Fix**: Extract to `demo.css`, link from `index.html`

### 7.2 CSS Custom Properties Theming System
- **File**: `zephyr-framework.css`
- **Issue**: The customization section in README shows CSS variables that don't exist in the framework
- **Fix**: Define all themeable properties as CSS custom properties with sensible defaults, use `var()` references throughout

### 7.3 Component Event Registry
- **File**: `zephyr-framework.js`
- **Issue**: No programmatic way to discover component capabilities
- **Fix**: Add `Zephyr.components` map listing each component's tag, attributes, events, slots, and methods

### 7.4 Build Script for Minification
- **File**: new `build.sh`
- **Issue**: No minified production files
- **Fix**: Simple shell script using `terser` (JS) and `csso` (CSS) or a single `esbuild` call — keeps zero-dependency philosophy for the framework itself while offering optimized output

---

## Priority 8: Testing

### 8.1 Create Test Harness
- **File**: new `tests/index.html`
- **Issue**: Zero test coverage, no test infrastructure
- **Fix**: Create a minimal HTML-based test runner (no npm) with assertion helpers — stays true to the zero-JS-dependency philosophy

### 8.2 Component Unit Tests
- **Files**: new `tests/test-accordion.html`, `tests/test-modal.html`, etc.
- **Fix**: For each component, test:
  - Custom element registration
  - Attribute/state changes
  - Event dispatching
  - DOM structure after initialization

### 8.3 Form Integration Tests
- **File**: new `tests/test-form-integration.html`
- **Fix**: Verify `ZSelect` value appears in `FormData`, form submission includes custom element values

### 8.4 Accessibility Audit
- **File**: new `tests/test-a11y.html`
- **Fix**: Automated ARIA attribute checks, keyboard navigation tests, focus management validation

---

## Completed Items

- [x] **1.1** Replace innerHTML in ZModal — now uses `while (this.firstChild) dialog.appendChild(this.firstChild)`
- [x] **1.2** Remove inline onclick handlers — demo uses `data-action` + delegated event listener
- [x] **1.3** Document security model — Security section added to README
- [x] **2.1** Extract toggle pattern — `_toggleOpen()` method on `ZephyrElement` base class
- [x] **2.2** Extract click-outside handler — shared `_attachClickOutside()` with `Set`-based registry
- [x] **2.3** Extract view transition wrapper — `ZephyrElement.withTransition(fn)` static method
- [x] **2.4** Unify floating panel CSS — shared `z-select [slot="options"], z-dropdown [slot="content"]` selector
- [x] **3.1** Share document-level click listeners — single delegated listener iterates `_clickOutsideElements` Set
- [x] **3.2** Clean up carousel autoplay — stored in `_autoplayInterval`, cleared in `_cleanup()`
- [x] **3.3** Implement disconnectedCallback — base class calls `_cleanup()`, carousel clears interval, toast clears timeout
- [x] **3.4** Implement CSS custom properties — `--z-*` tokens defined in `:root`, used throughout
- [x] **4.1** Accordion ARIA — `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`
- [x] **4.2** Tabs ARIA & keyboard nav — `aria-selected`, `aria-controls`, `tabindex`, ArrowLeft/Right/Home/End
- [x] **4.3** Select ARIA — `role="listbox"`, `role="option"`, `aria-expanded`, `aria-haspopup`
- [x] **4.4** Dropdown ARIA — `aria-expanded`, `aria-haspopup="true"`
- [x] **4.5** Modal ARIA — `aria-labelledby` auto-detected from heading
- [x] **4.6** Keyboard navigation — Escape/Enter/Space/Arrow keys implemented per component
- [x] **5.1** Register z-accordion-item — `ZAccordionItem` class registered
- [x] **5.2** Standardize lifecycle — ZCarousel now uses `attachTemplate()` instead of overriding `connectedCallback()`
- [x] **5.3** Move formAssociated — removed from base class, added only to `ZSelect`
- [x] **5.4** Add JSDoc comments — all public methods and classes documented
- [x] **6.1** Document state attribute convention — added to README and AGENTS.md
- [x] **6.2** Add event dispatching — all components dispatch events (toggle, open, close, slide, show, hide)
- [x] **6.3** Demo page CSS — extracted to `demo.css`, documented that consumer styles override framework layers
- [x] **7.1** Separate demo styles — extracted 360 lines to `demo.css`
- [x] **7.2** CSS custom properties theming — 11 `--z-*` tokens defined and used throughout
- [x] **7.3** Component event registry — `Zephyr.components` map with tags, slots, attributes, events, methods
- [x] **8.1** Create test harness — `tests/harness.js` with `TestSuite`, `Assertions`, helpers
- [x] **8.2** Component unit tests — test files for all 7 components
- [x] **8.3** Form integration tests — `tests/test-form-integration.html` verifies FormData participation
- [x] **5.5** Standardize private naming — convention documented in JS file header comment
- [x] **8.2** Component unit tests — expanded to 14 test files covering all components including 6 new ones
- [x] **Future: Combobox** — `ZCombobox` with keyboard navigation, filtering, form association
- [x] **Future: Date Picker** — `ZDatepicker` wrapping native `<input type="date">` with formatted display
- [x] **Future: Infinite Scroll** — `ZInfiniteScroll` with IntersectionObserver, loadmore events, loading guards
- [x] **Future: Sortable** — `ZSortable` with native Drag and Drop API, sort events, MutationObserver
- [x] **Future: File Upload** — `ZFileUpload` with drop zone, progress tracking, XSS-safe rendering
- [x] **Future: Virtual List** — `ZVirtualList` with DOM recycling, spacer/viewport pattern, 10k+ row support

---

## Priority 9 — Agent-Native Features

- [x] **9.1** Machine-readable component schema — `zephyr-schema.json` with full component definitions (tags, slots, attributes, events, methods, ARIA, examples)
- [x] **9.2** Agent API (`Zephyr.agent`) — `getState()`, `setState()`, `describe()`, `act()`, `observe()`, `unobserve()`, `getSchema()`, `getPrompt()`, `annotate()`
- [x] **9.3** Action mappings — high-level actions per component (open, close, select, next, prev, toggle, etc.)
- [x] **9.4** LLM prompt template — `zephyr-prompt.md` for injecting Zephyr knowledge into any agent
- [x] **9.5** Dynamic prompt generation — `Zephyr.agent.getPrompt()` scoped to components on current page
- [x] **9.6** DOM annotations — `Zephyr.agent.annotate()` adds `data-z-actions` and `data-z-description` for agent discovery
- [x] **9.7** Agent API tests — `tests/test-agent-api.html` covering all agent methods
- [x] **9.8** Agent API demo — interactive demo card in `index.html`
- [x] **9.9** MCP Server — `zephyr-mcp/` package with stdio MCP server, HTTP file server, WebSocket bridge to browser, 6 MCP tools mapping to Zephyr.agent API
- [x] **9.10** A2UI Compatibility — `zephyr-a2ui-catalog.json` exporting all 13 components in Google's Agent-to-UI catalog format with properties, actions, events, state attributes, and ARIA

---

## Priority 10 — npm Packaging & Distribution

- [x] **10.1** Root `package.json` for `zephyr-framework` npm package — zero deps, `files` whitelist, `sideEffects: true`, proper metadata and keywords
- [x] **10.2** Updated `@zephyr-framework/mcp` package — `peerDependencies` on `zephyr-framework`, `files` field, `repository` field
- [x] **10.3** Framework root resolution in MCP server — `resolveFrameworkRoot()` with ZEPHYR_ROOT env var, cwd detection, monorepo fallback; `node_modules/zephyr-framework/` fallback in HTTP handler
- [x] **10.4** `create-zephyr-app` CLI scaffolder — `npx create-zephyr-app my-app` creates project with deps, starter page, and `npm start` wired to MCP server
- [x] **10.5** Starter template — `create-zephyr-app/template/index.html` with 5 example components (accordion, tabs, modal, select, dropdown) and MCP integration comments
- [x] **10.6** Updated documentation — Install section in README, npm setup in MCP README, stack layout in AGENTS.md

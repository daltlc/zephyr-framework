# Zephyr Framework — Agent Reference

You are working with **Zephyr**, a zero-JS web component framework. State lives in HTML `data-*` attributes. CSS drives all animations. No build step, no dependencies.

## Core Concepts

- **Custom elements** use the `z-` prefix: `<z-modal>`, `<z-select>`, `<z-tabs>`
- **State is in the DOM**: `data-open`, `data-active`, `data-visible`, `data-value`
- **CSS reads state**: `:has([data-open])` selectors drive all visual changes
- **Form components** use `ElementInternals` — they participate in native `<form>` and `FormData`
- **No runtime JS** for interactions — JS runs once at page load to register elements

## Agent API

Interact with components programmatically via `Zephyr.agent`:

```js
// Snapshot all component states on the page
Zephyr.agent.getState()
// → [{ tag: 'z-modal', id: 'my-modal', state: {}, actions: ['open', 'close'] }, ...]

// Describe a specific component
Zephyr.agent.describe('#my-select')
// → { tag: 'z-select', state: {}, actions: ['open','close','select'], slots: {...}, ... }

// Perform an action
Zephyr.agent.act('#my-modal', 'open')
Zephyr.agent.act('#my-select', 'select', { value: 'red' })
Zephyr.agent.act('#carousel', 'next')

// Set/remove attributes directly
Zephyr.agent.setState('#dropdown', { 'data-open': true })
Zephyr.agent.setState('#dropdown', { 'data-open': null })  // remove

// Watch for state changes
Zephyr.agent.observe((change) => {
  console.log(change.tag, change.attribute, change.newValue);
});

// Get the component schema
Zephyr.agent.getSchema()

// Generate a prompt for this page's components
Zephyr.agent.getPrompt()
```

## Component Quick Reference

### z-accordion
Collapsible sections with CSS Grid transitions.
```html
<z-accordion>
  <z-accordion-item>
    <button slot="trigger">Title</button>
    <div slot="content">Content</div>
  </z-accordion-item>
</z-accordion>
```
**Actions:** `toggle({ index })` | **Events:** `toggle` → `{ index, open }`

### z-modal
Dialog wrapping native `<dialog>` with View Transitions.
```html
<z-modal id="my-modal">
  <h2>Title</h2>
  <p>Content</p>
</z-modal>
```
**Actions:** `open`, `close` | **Events:** `open`, `close`

### z-tabs
Tab panels with keyboard navigation.
```html
<z-tabs>
  <div role="tablist">
    <button data-tab="one" role="tab">Tab 1</button>
    <button data-tab="two" role="tab">Tab 2</button>
  </div>
  <div data-tab-panel="one" role="tabpanel">Panel 1</div>
  <div data-tab-panel="two" role="tabpanel">Panel 2</div>
</z-tabs>
```
**Actions:** `activate({ tab })` | **State:** `data-active` on active tab/panel

### z-select (form-associated)
Custom select with form integration.
```html
<z-select name="color">
  <button slot="trigger">Choose</button>
  <div slot="options">
    <div data-value="red">Red</div>
    <div data-value="blue">Blue</div>
  </div>
</z-select>
```
**Actions:** `open`, `close`, `select({ value })` | **Events:** `change`

### z-carousel
Slide viewer with autoplay.
```html
<z-carousel data-autoplay="3000">
  <div slot="item">Slide 1</div>
  <div slot="item">Slide 2</div>
  <button data-prev>Prev</button>
  <button data-next>Next</button>
</z-carousel>
```
**Actions:** `next`, `prev`, `goto({ index })` | **Events:** `slide` → `{ index, direction }`

### z-toast
Notification popup.
```js
Zephyr.toast('Saved!', 3000);
// or: Zephyr.agent.act('z-toast', 'show', { message: 'Saved!', duration: 3000 })
```
**Actions:** `show({ message, duration })` | **Events:** `show`, `hide`

### z-dropdown
Menu dropdown with click-outside.
```html
<z-dropdown>
  <button slot="trigger">Menu</button>
  <div slot="content"><a href="#">Item</a></div>
</z-dropdown>
```
**Actions:** `open`, `close` | **Events:** `toggle` → `{ open }`

### z-combobox (form-associated)
Filterable dropdown with keyboard nav.
```html
<z-combobox name="lang">
  <input type="text" placeholder="Search...">
  <div slot="listbox">
    <div data-value="js">JavaScript</div>
    <div data-value="py">Python</div>
  </div>
</z-combobox>
```
**Actions:** `open`, `close`, `select({ value })` | **Events:** `change`, `input`

### z-datepicker (form-associated)
Styled native date input.
```html
<z-datepicker name="date">
  <button slot="display">Pick a date</button>
</z-datepicker>
```
**Actions:** `open`, `set({ value: 'YYYY-MM-DD' })` | **Events:** `change`

### z-infinite-scroll
IntersectionObserver-based loading.
```html
<z-infinite-scroll data-root-margin="200px">
  <div id="items"></div>
</z-infinite-scroll>
```
**Actions:** `complete` | **Events:** `loadmore` | **State:** `data-loading`, `data-done`

### z-sortable
Drag & drop reorderable list.
```html
<z-sortable>
  <div data-sortable="a">Item A</div>
  <div data-sortable="b">Item B</div>
</z-sortable>
```
**Events:** `sort` → `{ order: [{ index, value }] }`

### z-file-upload
Drag-and-drop file upload.
```html
<z-file-upload data-multiple data-accept="image/*">
  <div slot="dropzone">Drop files here</div>
  <div slot="filelist"></div>
</z-file-upload>
```
**Events:** `upload` → `{ files }` | **Methods:** `setProgress(index, percent)`

### z-virtual-list
Virtual scrolling for large datasets.
```html
<z-virtual-list data-item-height="40" style="height:400px;"></z-virtual-list>
```
**Actions:** `setItems({ items })` | **Methods:** `setItems(array)`, `setRenderer(fn)`

## Theming

Override CSS custom properties:
```css
:root {
  --z-transition-duration: 0.3s;
  --z-border-radius: 0.5rem;
  --z-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --z-toast-bg: rgb(17 24 39);
  --z-toast-color: white;
}
```

## Dashboard Components (optional add-on: zephyr-dashboard.js)

### z-stat — KPI Card
```html
<z-stat data-label="Users" data-value="1,234" data-trend="up" data-trend-value="+5%"></z-stat>
```
Actions: `setValue({ value, trend, trendValue })`, `setLabel({ label })`

### z-dashboard — Grid Layout
```html
<z-dashboard data-columns="3">
  <z-dashboard-panel data-panel="chart" data-colspan="2">...</z-dashboard-panel>
  <z-dashboard-panel data-panel="stats">...</z-dashboard-panel>
</z-dashboard>
```
Actions: `addPanel({ id, colspan, rowspan })`, `removePanel({ id })`, `movePanel({ id, position })`, `setColumns({ columns })`

### z-data-grid — Data Table
```js
const grid = document.querySelector('z-data-grid');
grid.setColumns([{ key: 'name', label: 'Name', sortable: true }]);
grid.setRows([{ name: 'Alice' }, { name: 'Bob' }]);
```
Actions: `setColumns({ columns })`, `setRows({ rows })`, `sort({ column, direction })`, `filter({ query })`

### z-chart — Charts (lightweight-charts)
```html
<z-chart data-type="candlestick" data-height="300"></z-chart>
```
Actions: `setType({ type })`, `setData({ data })`, `addPoint({ point })`, `addSeries({ type, data })`, `setTimeRange({ from, to })`

## Render API — Dynamic Component Creation

```js
// Create a single component
Zephyr.agent.render('#container', {
  tag: 'z-stat', id: 'my-stat',
  attributes: { 'data-label': 'Revenue', 'data-value': '$1.2M', 'data-trend': 'up' }
});

// Compose an entire dashboard
Zephyr.agent.compose('#container', {
  tag: 'z-dashboard', id: 'dash', attributes: { 'data-columns': '3' },
  panels: [
    { id: 'chart', colspan: 2, component: { tag: 'z-chart', id: 'main-chart', attributes: { 'data-type': 'line' } } },
    { id: 'kpi', component: { tag: 'z-stat', id: 'users', attributes: { 'data-label': 'Users', 'data-value': '1,234' } } }
  ]
});
```

## Common Agent Patterns

```js
// Read all form values
const state = Zephyr.agent.getState('z-select, z-combobox, z-datepicker');

// Open a modal, wait for close
Zephyr.agent.act('#confirm-dialog', 'open');

// Build a dashboard dynamically
Zephyr.agent.compose('#app', {
  tag: 'z-dashboard', id: 'dash', attributes: { 'data-columns': '3' },
  panels: [
    { id: 'chart', colspan: 2, component: { tag: 'z-chart', attributes: { 'data-type': 'line' } } },
    { id: 'stats', component: { tag: 'z-stat', attributes: { 'data-label': 'KPI', 'data-value': '42' } } }
  ]
});
```

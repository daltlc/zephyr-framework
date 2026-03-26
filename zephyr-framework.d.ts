/**
 * Zephyr Framework — TypeScript Declarations
 * @version 0.1.2
 */

// ---------------------------------------------------------------------------
// Component Elements
// ---------------------------------------------------------------------------

/** Base class for all Zephyr components. */
export declare class ZephyrElement extends HTMLElement {
  connectedCallback(): void;
  disconnectedCallback(): void;
  /** Override in subclasses to set up component DOM structure. */
  attachTemplate(): void;
  /** Auto-wires declarative behaviors from data attributes. */
  attachBehaviors(): void;
  /** Wraps a DOM mutation in a View Transition if available. */
  static withTransition(fn: () => void): void;
}

/** Minimal custom element for accordion items. */
export declare class ZAccordionItem extends HTMLElement {}

/** Collapsible accordion using CSS Grid transitions. Dispatches 'toggle' events. */
export declare class ZAccordion extends ZephyrElement {}

/** Modal dialog wrapping native <dialog> with View Transitions. */
export declare class ZModal extends ZephyrElement {
  /** Opens the modal with a View Transition animation. */
  open(): void;
  /** Closes the modal with a View Transition animation. */
  close(): void;
}

/** Tab panel component with keyboard navigation and View Transitions. */
export declare class ZTabs extends ZephyrElement {}

/** Form-associated custom select using ElementInternals. */
export declare class ZSelect extends ZephyrElement {
  static formAssociated: true;
  /** The current selected value. */
  value: string;
}

/** Slide carousel with autoplay and View Transitions. */
export declare class ZCarousel extends ZephyrElement {
  /** Transitions to the next slide. */
  next(): void;
  /** Transitions to the previous slide. */
  prev(): void;
}

/** Toast notification component. */
export declare class ZToast extends ZephyrElement {
  /**
   * Displays a toast message for the given duration.
   * @param message - The message to display
   * @param duration - Duration in milliseconds before auto-hide (default: 3000)
   */
  show(message: string, duration?: number): void;
}

/** Dropdown menu with click-outside handling. */
export declare class ZDropdown extends ZephyrElement {}

/** Filterable combobox with keyboard navigation and form association. */
export declare class ZCombobox extends ZephyrElement {
  static formAssociated: true;
  /** The current selected value. */
  value: string;
}

/** Enhanced date picker wrapping native input[type="date"]. */
export declare class ZDatepicker extends ZephyrElement {
  static formAssociated: true;
  /** The current date value (YYYY-MM-DD format). */
  value: string;
}

/** IntersectionObserver-based infinite scroll container. */
export declare class ZInfiniteScroll extends ZephyrElement {
  /** Call when all data has been loaded to stop observing. */
  complete(): void;
}

/** Drag & drop sortable list using the native HTML Drag and Drop API. */
export declare class ZSortable extends ZephyrElement {}

/** File upload component with drag-and-drop zone and progress display. */
export declare class ZFileUpload extends ZephyrElement {
  /**
   * Updates the progress bar for a specific file.
   * @param index - File index in the list
   * @param percent - Progress percentage (0-100)
   */
  setProgress(index: number, percent: number): void;
}

/** Virtual scrolling list for efficiently rendering large datasets. */
export declare class ZVirtualList extends ZephyrElement {
  /**
   * Sets the data items for the list.
   * @param items - Array of data objects to render
   */
  setItems(items: any[]): void;
  /**
   * Sets the render function that converts a data item to HTML.
   * @param fn - Renderer function returning an HTML string
   */
  setRenderer(fn: (item: any, index: number) => string): void;
}

// ---------------------------------------------------------------------------
// Custom Element Tag Name Map
// ---------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'z-accordion-item': ZAccordionItem;
    'z-accordion': ZAccordion;
    'z-modal': ZModal;
    'z-tabs': ZTabs;
    'z-select': ZSelect;
    'z-carousel': ZCarousel;
    'z-toast': ZToast;
    'z-dropdown': ZDropdown;
    'z-combobox': ZCombobox;
    'z-datepicker': ZDatepicker;
    'z-infinite-scroll': ZInfiniteScroll;
    'z-sortable': ZSortable;
    'z-file-upload': ZFileUpload;
    'z-virtual-list': ZVirtualList;
  }
}

// ---------------------------------------------------------------------------
// Component Registry Entry
// ---------------------------------------------------------------------------

interface ZephyrComponentDef {
  tag: string;
  slots: string[];
  attributes: string[];
  events: string[];
  methods: string[];
}

// ---------------------------------------------------------------------------
// Agent API Types
// ---------------------------------------------------------------------------

interface ZephyrComponentState {
  tag: string;
  id: string | null;
  state: Record<string, string | true>;
  actions: string[];
}

interface ZephyrComponentDescription extends ZephyrComponentState {
  description: string;
  slots: Record<string, string | null>;
  events: string[];
  methods: string[];
}

interface ZephyrActResult {
  success: boolean;
  error?: string;
}

interface ZephyrSetStateResult {
  success: boolean;
  state?: Record<string, string | true>;
  error?: string;
}

interface ZephyrObserverDetail {
  element: Element;
  tag: string;
  attribute: string;
  oldValue: string | null;
  newValue: string | null;
}

interface ZephyrAgentAPI {
  /** Returns the enriched component schema with descriptions, actions, and examples. */
  getSchema(): Record<string, ZephyrComponentDef & { actions: string[]; description: string }>;

  /**
   * Snapshots the state of all Zephyr components on the page.
   * @param selector - Optional CSS selector to scope the query
   */
  getState(selector?: string): ZephyrComponentState[];

  /**
   * Sets or removes data attributes on a Zephyr component.
   * @param selector - CSS selector for the target element
   * @param attributes - Attributes to set (null/false to remove)
   */
  setState(selector: string, attributes: Record<string, string | boolean | null>): ZephyrSetStateResult;

  /**
   * Returns a structured description of a specific component instance.
   * @param selector - CSS selector for the target element
   */
  describe(selector: string): ZephyrComponentDescription | { error: string };

  /**
   * Performs a high-level action on a Zephyr component.
   * @param selector - CSS selector for the target element
   * @param action - Action name (e.g., 'open', 'close', 'select', 'next')
   * @param params - Action parameters
   */
  act(selector: string, action: string, params?: Record<string, any>): ZephyrActResult;

  /**
   * Observes state attribute changes on all Zephyr components.
   * @param callback - Called with change details on every state mutation
   */
  observe(callback: (detail: ZephyrObserverDetail) => void): void;

  /**
   * Removes an observer callback.
   * @param callback - The callback to remove
   */
  unobserve(callback: (detail: ZephyrObserverDetail) => void): void;

  /** Generates a markdown prompt describing all Zephyr components on the page. */
  getPrompt(): string;

  /** Annotates all Zephyr components with data-z-actions for agent discovery. */
  annotate(): void;
}

// ---------------------------------------------------------------------------
// Global Zephyr API
// ---------------------------------------------------------------------------

interface ZephyrAPI {
  /**
   * Returns a modal element by ID.
   * @param id - The modal element's ID attribute
   */
  modal(id: string): ZModal | null;

  /**
   * Displays a toast notification.
   * @param message - The message to display
   * @param duration - Duration in milliseconds (default: 3000)
   */
  toast(message: string, duration?: number): void;

  /** Registry of all Zephyr components and their capabilities. */
  components: Record<string, ZephyrComponentDef>;

  /** Structured interface for AI agents and LLMs. */
  agent: ZephyrAgentAPI;
}

declare global {
  interface Window {
    Zephyr: ZephyrAPI;
  }

  /** Global Zephyr API. */
  var Zephyr: ZephyrAPI;
}

export {};

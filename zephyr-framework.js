/**
 * Zephyr - Zero-JS Interactive Framework
 * Uses View Transitions, CSS :has(), container queries, and HTML primitives
 *
 * @description A component framework that delivers rich interactions without
 * shipping JavaScript to users for runtime interactions. JS runs once at page
 * load to register custom elements and attach event listeners.
 *
 * Naming conventions:
 *   - Public/protected methods: camelCase (attachTemplate, attachBehaviors)
 *   - Private members: underscore prefix (_currentIndex, _transition)
 *   - formAssociated: only on components that participate in forms
 *
 * State attribute conventions:
 *   - data-open: binary open/closed state (accordion, select, dropdown)
 *   - data-active: selected/current item in a set (tabs, carousel slides)
 *   - data-visible: visibility toggle (toast notifications)
 */

/**
 * Base class for all Zephyr components.
 * Provides shared utilities for view transitions, toggle behavior,
 * click-outside handling, and lifecycle management.
 */
class ZephyrElement extends HTMLElement {
  connectedCallback() {
    this.attachTemplate();
    this.attachBehaviors();
  }

  disconnectedCallback() {
    this._cleanup();
  }

  /** Override in subclasses to set up component DOM structure. */
  attachTemplate() {}

  /** Auto-wires declarative behaviors from data attributes. */
  attachBehaviors() {
    this.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = this.querySelector(el.dataset.toggle);
        if (target) {
          target.toggleAttribute('data-open');
        }
      });
    });

    this.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = el.dataset.tab;
        const group = el.closest('[data-tab-group]');

        group.querySelectorAll('[data-tab]').forEach(t => {
          t.removeAttribute('data-active');
          t.setAttribute('aria-selected', 'false');
          t.setAttribute('tabindex', '-1');
        });
        group.querySelectorAll('[data-tab-panel]').forEach(p => p.removeAttribute('data-active'));

        el.setAttribute('data-active', '');
        el.setAttribute('aria-selected', 'true');
        el.setAttribute('tabindex', '0');
        group.querySelector(`[data-tab-panel="${tabName}"]`)?.setAttribute('data-active', '');
      });
    });
  }

  /**
   * Wraps a DOM mutation in a View Transition if the API is available.
   * Falls back to executing the function directly in unsupported browsers.
   * @param {Function} fn - The DOM mutation to perform
   */
  static withTransition(fn) {
    if (document.startViewTransition) {
      document.startViewTransition(() => fn());
    } else {
      fn();
    }
  }

  /** Toggles the data-open attribute on this element. */
  _toggleOpen() {
    const isOpen = this.hasAttribute('data-open');
    if (isOpen) {
      this.removeAttribute('data-open');
    } else {
      this.setAttribute('data-open', '');
    }
    return !isOpen;
  }

  /**
   * Registers this element with the shared click-outside handler.
   * When a click occurs outside this element, data-open is removed.
   */
  _attachClickOutside() {
    ZephyrElement._clickOutsideElements.add(this);
  }

  /** Removes this element from the click-outside registry. */
  _detachClickOutside() {
    ZephyrElement._clickOutsideElements.delete(this);
  }

  /** Override in subclasses to clean up listeners, intervals, etc. */
  _cleanup() {
    this._detachClickOutside();
  }
}

/** Shared registry of elements that need click-outside handling. */
ZephyrElement._clickOutsideElements = new Set();

/** Single delegated click-outside listener (shared across all instances). */
document.addEventListener('click', (e) => {
  ZephyrElement._clickOutsideElements.forEach(el => {
    if (!el.contains(e.target)) {
      el.removeAttribute('data-open');
      const trigger = el.querySelector('[slot="trigger"]');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
  });
});

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------

/** Minimal registration for z-accordion-item so it is a proper custom element. */
class ZAccordionItem extends HTMLElement {}

/**
 * Collapsible accordion component.
 * Uses CSS Grid grid-template-rows transition with :has([data-open]) selector.
 * Dispatches 'toggle' events when items open/close.
 */
class ZAccordion extends ZephyrElement {
  attachTemplate() {
    const items = Array.from(this.querySelectorAll('z-accordion-item'));
    items.forEach((item, idx) => {
      const trigger = item.querySelector('[slot="trigger"]');
      const content = item.querySelector('[slot="content"]');

      if (trigger && content) {
        const contentId = `accordion-content-${this._uid()}-${idx}`;
        trigger.setAttribute('data-toggle', `#${contentId}`);
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', contentId);
        content.id = contentId;
        content.setAttribute('role', 'region');
        content.setAttribute('aria-labelledby', trigger.id || `accordion-trigger-${this._uid()}-${idx}`);
        if (!trigger.id) trigger.id = `accordion-trigger-${this._uid()}-${idx}`;

        trigger.addEventListener('click', () => {
          const isOpen = content.hasAttribute('data-open');
          trigger.setAttribute('aria-expanded', String(!isOpen));
          this.dispatchEvent(new CustomEvent('toggle', {
            bubbles: true,
            detail: { index: idx, open: !isOpen }
          }));
        });

        trigger.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            trigger.click();
          }
        });
      }
    });
  }

  /** Generates a simple unique ID for this accordion instance. */
  _uid() {
    if (!this.__uid) this.__uid = Math.random().toString(36).slice(2, 8);
    return this.__uid;
  }
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

/**
 * Modal dialog component wrapping native <dialog>.
 * Uses View Transitions API for smooth entrance/exit animations.
 * Dispatches 'open' and 'close' events.
 */
class ZModal extends ZephyrElement {
  attachTemplate() {
    const dialog = document.createElement('dialog');

    // Move child nodes into dialog (avoids innerHTML XSS risk)
    while (this.firstChild) {
      dialog.appendChild(this.firstChild);
    }
    this.appendChild(dialog);

    // Auto-detect heading for aria-labelledby
    const heading = dialog.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      if (!heading.id) heading.id = `modal-heading-${Math.random().toString(36).slice(2, 8)}`;
      dialog.setAttribute('aria-labelledby', heading.id);
    }

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        this.close();
      }
    });

    // Escape key is handled natively by <dialog>, but we dispatch event
    dialog.addEventListener('close', () => {
      this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    });
  }

  /** Opens the modal dialog with a View Transition animation. */
  open() {
    const dialog = this.querySelector('dialog');
    ZephyrElement.withTransition(() => dialog.showModal());
    this.dispatchEvent(new CustomEvent('open', { bubbles: true }));
  }

  /** Closes the modal dialog with a View Transition animation. */
  close() {
    const dialog = this.querySelector('dialog');
    ZephyrElement.withTransition(() => dialog.close());
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

/**
 * Tab panel component with View Transitions.
 * Uses container queries for responsive tab layouts.
 * Supports keyboard navigation: ArrowLeft/Right, Home, End.
 */
class ZTabs extends ZephyrElement {
  attachTemplate() {
    this.setAttribute('data-tab-group', '');

    const tabs = Array.from(this.querySelectorAll('[data-tab]'));
    const panels = Array.from(this.querySelectorAll('[data-tab-panel]'));

    // Wire up ARIA relationships
    tabs.forEach((tab, idx) => {
      const panelName = tab.dataset.tab;
      const panel = this.querySelector(`[data-tab-panel="${panelName}"]`);
      const tabId = `tab-${panelName}-${Math.random().toString(36).slice(2, 8)}`;
      const panelId = `panel-${panelName}-${Math.random().toString(36).slice(2, 8)}`;

      tab.id = tabId;
      tab.setAttribute('aria-controls', panelId);
      tab.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      tab.setAttribute('tabindex', idx === 0 ? '0' : '-1');

      if (panel) {
        panel.id = panelId;
        panel.setAttribute('aria-labelledby', tabId);
      }
    });

    // Activate first tab
    if (tabs[0] && panels[0]) {
      tabs[0].setAttribute('data-active', '');
      panels[0].setAttribute('data-active', '');
    }

    // Keyboard navigation on tablist
    const tablist = this.querySelector('[role="tablist"]');
    if (tablist) {
      tablist.addEventListener('keydown', (e) => {
        const currentTab = tabs.find(t => t.hasAttribute('data-active'));
        const currentIdx = tabs.indexOf(currentTab);
        let nextIdx = -1;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          nextIdx = (currentIdx + 1) % tabs.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
        } else if (e.key === 'Home') {
          nextIdx = 0;
        } else if (e.key === 'End') {
          nextIdx = tabs.length - 1;
        }

        if (nextIdx >= 0) {
          e.preventDefault();
          tabs[nextIdx].click();
          tabs[nextIdx].focus();
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Select (form-associated)
// ---------------------------------------------------------------------------

/**
 * Custom select component that integrates with native HTML forms.
 * Uses ElementInternals API for form participation.
 * Dispatches 'change' events on selection.
 * Supports keyboard navigation: ArrowUp/Down, Enter, Escape.
 */
class ZSelect extends ZephyrElement {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._value = '';
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = v;
    this._internals.setFormValue(v);
  }

  attachTemplate() {
    const button = this.querySelector('[slot="trigger"]');
    const options = this.querySelector('[slot="options"]');
    const items = Array.from(options.querySelectorAll('[data-value]'));

    // ARIA setup
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-haspopup', 'listbox');
    options.setAttribute('role', 'listbox');
    items.forEach(item => item.setAttribute('role', 'option'));

    button.addEventListener('click', () => {
      const isOpen = this._toggleOpen();
      button.setAttribute('aria-expanded', String(isOpen));
    });

    items.forEach(item => {
      item.addEventListener('click', () => {
        this.value = item.dataset.value;
        button.textContent = item.textContent;
        this.removeAttribute('data-open');
        button.setAttribute('aria-expanded', 'false');
        this.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    // Keyboard navigation
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.removeAttribute('data-open');
        button.setAttribute('aria-expanded', 'false');
        button.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this.hasAttribute('data-open')) {
          this.setAttribute('data-open', '');
          button.setAttribute('aria-expanded', 'true');
        }
        const focused = items.find(i => i === document.activeElement);
        const idx = focused ? items.indexOf(focused) : -1;
        const next = e.key === 'ArrowDown'
          ? items[(idx + 1) % items.length]
          : items[(idx - 1 + items.length) % items.length];
        next.setAttribute('tabindex', '0');
        next.focus();
      } else if (e.key === 'Enter' && document.activeElement.hasAttribute('data-value')) {
        document.activeElement.click();
      }
    });

    this._attachClickOutside();
  }

  _cleanup() {
    super._cleanup();
  }
}

// ---------------------------------------------------------------------------
// Carousel
// ---------------------------------------------------------------------------

/**
 * Slide carousel with View Transitions and optional autoplay.
 * Dispatches 'slide' events with detail: { index, direction }.
 * Supports keyboard navigation: ArrowLeft/Right.
 */
class ZCarousel extends ZephyrElement {
  attachTemplate() {
    this._currentIndex = 0;
    this._items = Array.from(this.querySelectorAll('[slot="item"]'));
    this._autoplayInterval = null;

    this._items.forEach((item, idx) => {
      item.setAttribute('data-index', idx);
      if (idx === 0) item.setAttribute('data-active', '');
    });

    const prevBtn = this.querySelector('[data-prev]');
    const nextBtn = this.querySelector('[data-next]');

    prevBtn?.addEventListener('click', () => this.prev());
    nextBtn?.addEventListener('click', () => this.next());

    // Keyboard navigation
    this.setAttribute('tabindex', '0');
    this.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
    });

    if (this.hasAttribute('data-autoplay')) {
      this._startAutoplay();
    }
  }

  /** Transitions to the previous slide. */
  prev() {
    this._transition(-1);
  }

  /** Transitions to the next slide. */
  next() {
    this._transition(1);
  }

  _transition(direction) {
    const nextIndex = (this._currentIndex + direction + this._items.length) % this._items.length;
    ZephyrElement.withTransition(() => this._updateSlide(nextIndex));
    this.dispatchEvent(new CustomEvent('slide', {
      bubbles: true,
      detail: { index: nextIndex, direction: direction > 0 ? 'next' : 'prev' }
    }));
  }

  _updateSlide(nextIndex) {
    this._items[this._currentIndex].removeAttribute('data-active');
    this._items[nextIndex].setAttribute('data-active', '');
    this._currentIndex = nextIndex;
  }

  _startAutoplay() {
    const interval = parseInt(this.dataset.autoplay) || 3000;
    this._autoplayInterval = setInterval(() => this.next(), interval);
  }

  _cleanup() {
    super._cleanup();
    if (this._autoplayInterval) {
      clearInterval(this._autoplayInterval);
      this._autoplayInterval = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Toast / Notification
// ---------------------------------------------------------------------------

/**
 * Toast notification component.
 * Dispatches 'show' and 'hide' events.
 * @example Zephyr.toast('Hello!', 3000)
 */
class ZToast extends ZephyrElement {
  /**
   * Displays a toast message for the given duration.
   * @param {string} message - The message to display
   * @param {number} [duration=3000] - Duration in milliseconds before auto-hide
   */
  show(message, duration = 3000) {
    this.textContent = message;
    this.setAttribute('data-visible', '');
    this.setAttribute('role', 'alert');
    this.setAttribute('aria-live', 'polite');
    this.dispatchEvent(new CustomEvent('show', { bubbles: true, detail: { message } }));

    this._hideTimeout = setTimeout(() => {
      ZephyrElement.withTransition(() => this.removeAttribute('data-visible'));
      this.dispatchEvent(new CustomEvent('hide', { bubbles: true }));
    }, duration);
  }

  _cleanup() {
    super._cleanup();
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Dropdown
// ---------------------------------------------------------------------------

/**
 * Dropdown menu component with click-outside handling.
 * Dispatches 'toggle' events when opened/closed.
 * Supports Escape key to close.
 */
class ZDropdown extends ZephyrElement {
  attachTemplate() {
    const trigger = this.querySelector('[slot="trigger"]');

    // ARIA setup
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-haspopup', 'true');
    }

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = this._toggleOpen();
      trigger.setAttribute('aria-expanded', String(isOpen));
      this.dispatchEvent(new CustomEvent('toggle', {
        bubbles: true,
        detail: { open: isOpen }
      }));
    });

    // Escape key closes dropdown
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.hasAttribute('data-open')) {
        this.removeAttribute('data-open');
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.focus();
        this.dispatchEvent(new CustomEvent('toggle', {
          bubbles: true,
          detail: { open: false }
        }));
      }
    });

    this._attachClickOutside();
  }

  _cleanup() {
    super._cleanup();
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

customElements.define('z-accordion-item', ZAccordionItem);
customElements.define('z-accordion', ZAccordion);
customElements.define('z-modal', ZModal);
customElements.define('z-tabs', ZTabs);
customElements.define('z-select', ZSelect);
customElements.define('z-carousel', ZCarousel);
customElements.define('z-toast', ZToast);
customElements.define('z-dropdown', ZDropdown);

// ---------------------------------------------------------------------------
// Global Utilities
// ---------------------------------------------------------------------------

/**
 * Global Zephyr API.
 * @namespace Zephyr
 */
window.Zephyr = {
  /**
   * Returns a modal element by ID.
   * @param {string} id - The modal element's ID attribute
   * @returns {ZModal|null}
   */
  modal(id) {
    return document.getElementById(id);
  },

  /**
   * Displays a toast notification. Creates a z-toast element if none exists.
   * @param {string} message - The message to display
   * @param {number} [duration=3000] - Duration in milliseconds
   */
  toast(message, duration) {
    const toast = document.querySelector('z-toast') || document.createElement('z-toast');
    if (!document.body.contains(toast)) {
      document.body.appendChild(toast);
    }
    toast.show(message, duration);
  },

  /**
   * Registry of all Zephyr components and their capabilities.
   * @type {Object.<string, {tag: string, slots: string[], attributes: string[], events: string[], methods: string[]}>}
   */
  components: {
    accordion: {
      tag: 'z-accordion',
      slots: ['trigger', 'content'],
      attributes: ['data-open'],
      events: ['toggle'],
      methods: []
    },
    modal: {
      tag: 'z-modal',
      slots: [],
      attributes: [],
      events: ['open', 'close'],
      methods: ['open()', 'close()']
    },
    tabs: {
      tag: 'z-tabs',
      slots: [],
      attributes: ['data-tab', 'data-tab-panel', 'data-active'],
      events: [],
      methods: []
    },
    select: {
      tag: 'z-select',
      slots: ['trigger', 'options'],
      attributes: ['data-open', 'data-value', 'name'],
      events: ['change'],
      methods: ['value']
    },
    carousel: {
      tag: 'z-carousel',
      slots: ['item'],
      attributes: ['data-autoplay', 'data-active'],
      events: ['slide'],
      methods: ['next()', 'prev()']
    },
    toast: {
      tag: 'z-toast',
      slots: [],
      attributes: ['data-visible'],
      events: ['show', 'hide'],
      methods: ['show(message, duration)']
    },
    dropdown: {
      tag: 'z-dropdown',
      slots: ['trigger', 'content'],
      attributes: ['data-open'],
      events: ['toggle'],
      methods: []
    }
  }
};

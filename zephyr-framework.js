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
// Combobox
// ---------------------------------------------------------------------------

/**
 * Combobox component with filterable options and keyboard navigation.
 * Combines a text input with a dropdown listbox.
 * Dispatches 'change' events on selection, 'input' events on filter.
 * Supports ArrowUp/Down, Enter, Escape.
 */
class ZCombobox extends ZephyrElement {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._value = '';
  }

  get value() { return this._value; }
  set value(v) {
    this._value = v;
    this._internals.setFormValue(v);
  }

  attachTemplate() {
    const input = this.querySelector('input');
    const listbox = this.querySelector('[slot="listbox"]');
    const items = Array.from(listbox.querySelectorAll('[data-value]'));

    // ARIA setup
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    listbox.setAttribute('role', 'listbox');
    items.forEach(item => {
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', '-1');
    });

    let activeIdx = -1;

    const showList = () => {
      this.setAttribute('data-open', '');
      input.setAttribute('aria-expanded', 'true');
    };

    const hideList = () => {
      this.removeAttribute('data-open');
      input.setAttribute('aria-expanded', 'false');
      activeIdx = -1;
      items.forEach(i => i.removeAttribute('data-highlighted'));
    };

    const selectItem = (item) => {
      this.value = item.dataset.value;
      input.value = item.textContent.trim();
      hideList();
      this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const filterItems = (query) => {
      const q = query.toLowerCase();
      let visibleCount = 0;
      items.forEach(item => {
        const matches = item.textContent.toLowerCase().includes(q);
        item.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
      });
      if (visibleCount > 0 && query.length > 0) {
        showList();
      } else if (query.length === 0) {
        items.forEach(i => i.style.display = '');
        showList();
      }
      activeIdx = -1;
    };

    const highlightIdx = (idx) => {
      const visible = items.filter(i => i.style.display !== 'none');
      if (visible.length === 0) return;
      activeIdx = ((idx % visible.length) + visible.length) % visible.length;
      items.forEach(i => i.removeAttribute('data-highlighted'));
      visible[activeIdx].setAttribute('data-highlighted', '');
      visible[activeIdx].scrollIntoView({ block: 'nearest' });
    };

    input.addEventListener('focus', () => {
      filterItems(input.value);
    });

    input.addEventListener('input', () => {
      filterItems(input.value);
      this.dispatchEvent(new Event('input', { bubbles: true }));
    });

    input.addEventListener('keydown', (e) => {
      const visible = items.filter(i => i.style.display !== 'none');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!this.hasAttribute('data-open')) showList();
        highlightIdx(activeIdx + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this.hasAttribute('data-open')) showList();
        highlightIdx(activeIdx - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && visible[activeIdx]) {
          selectItem(visible[activeIdx]);
        }
      } else if (e.key === 'Escape') {
        hideList();
        input.focus();
      }
    });

    items.forEach(item => {
      item.addEventListener('click', () => selectItem(item));
    });

    this._attachClickOutside();
    this._hideList = hideList;
  }

  _cleanup() {
    super._cleanup();
  }
}

// ---------------------------------------------------------------------------
// Date Picker
// ---------------------------------------------------------------------------

/**
 * Enhanced date picker wrapping native <input type="date">.
 * Provides a styled trigger that displays the formatted date.
 * Dispatches 'change' events on date selection.
 */
class ZDatepicker extends ZephyrElement {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._value = '';
  }

  get value() { return this._value; }
  set value(v) {
    this._value = v;
    this._internals.setFormValue(v);
  }

  attachTemplate() {
    const display = this.querySelector('[slot="display"]');
    let input = this.querySelector('input[type="date"]');

    if (!input) {
      input = document.createElement('input');
      input.type = 'date';
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;
      this.appendChild(input);
    }

    // Style the native input to be visually hidden but functional
    input.classList.add('z-datepicker-native');

    const placeholder = display?.textContent || 'Select date';

    if (display) {
      display.setAttribute('role', 'button');
      display.setAttribute('tabindex', '0');
      display.setAttribute('aria-label', 'Choose date');

      display.addEventListener('click', () => {
        input.showPicker?.() || input.focus();
      });

      display.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input.showPicker?.() || input.focus();
        }
      });
    }

    input.addEventListener('change', () => {
      this.value = input.value;
      if (display && input.value) {
        const date = new Date(input.value + 'T00:00:00');
        display.textContent = date.toLocaleDateString(undefined, {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        display.setAttribute('data-has-value', '');
      } else if (display) {
        display.textContent = placeholder;
        display.removeAttribute('data-has-value');
      }
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Initialize from existing value
    if (input.value) {
      input.dispatchEvent(new Event('change'));
    }
  }
}

// ---------------------------------------------------------------------------
// Infinite Scroll
// ---------------------------------------------------------------------------

/**
 * Infinite scroll container using IntersectionObserver.
 * Watches a sentinel element at the bottom and dispatches 'loadmore'
 * when it becomes visible, signaling the consumer to append content.
 * Set data-loading attribute while fetching to prevent duplicate events.
 */
class ZInfiniteScroll extends ZephyrElement {
  attachTemplate() {
    // Create sentinel element
    this._sentinel = document.createElement('div');
    this._sentinel.classList.add('z-infinite-sentinel');
    this._sentinel.setAttribute('aria-hidden', 'true');
    this.appendChild(this._sentinel);

    this._observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAttribute('data-loading') && !this.hasAttribute('data-done')) {
          this.dispatchEvent(new CustomEvent('loadmore', { bubbles: true }));
        }
      });
    }, {
      root: this.hasAttribute('data-root') ? this : null,
      rootMargin: this.dataset.rootMargin || '200px',
      threshold: 0
    });

    this._observer.observe(this._sentinel);
  }

  /** Call when all data has been loaded to stop observing. */
  complete() {
    this.setAttribute('data-done', '');
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  _cleanup() {
    super._cleanup();
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Sortable (Drag & Drop)
// ---------------------------------------------------------------------------

/**
 * Drag & drop sortable list using the native HTML Drag and Drop API.
 * Children with [data-sortable] become draggable.
 * Dispatches 'sort' event with detail: { order } after reorder.
 */
class ZSortable extends ZephyrElement {
  attachTemplate() {
    this._draggedEl = null;

    const items = () => Array.from(this.querySelectorAll('[data-sortable]'));

    const setupItem = (item) => {
      item.setAttribute('draggable', 'true');
      item.setAttribute('role', 'listitem');

      item.addEventListener('dragstart', (e) => {
        this._draggedEl = item;
        item.setAttribute('data-dragging', '');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      });

      item.addEventListener('dragend', () => {
        item.removeAttribute('data-dragging');
        this._draggedEl = null;
        // Remove all drop indicators
        items().forEach(i => i.removeAttribute('data-drag-over'));
        this._emitOrder();
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this._draggedEl && this._draggedEl !== item) {
          item.setAttribute('data-drag-over', '');
        }
      });

      item.addEventListener('dragleave', () => {
        item.removeAttribute('data-drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.removeAttribute('data-drag-over');
        if (this._draggedEl && this._draggedEl !== item) {
          const allItems = items();
          const fromIdx = allItems.indexOf(this._draggedEl);
          const toIdx = allItems.indexOf(item);
          if (fromIdx < toIdx) {
            item.after(this._draggedEl);
          } else {
            item.before(this._draggedEl);
          }
        }
      });
    };

    this.setAttribute('role', 'list');
    items().forEach(setupItem);

    // Observe for dynamically added items
    this._mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.hasAttribute('data-sortable')) {
            setupItem(node);
          }
        });
      });
    });
    this._mutationObserver.observe(this, { childList: true });
  }

  _emitOrder() {
    const order = Array.from(this.querySelectorAll('[data-sortable]'))
      .map((el, idx) => ({ index: idx, value: el.dataset.sortable || el.textContent.trim() }));
    this.dispatchEvent(new CustomEvent('sort', { bubbles: true, detail: { order } }));
  }

  _cleanup() {
    super._cleanup();
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
  }
}

// ---------------------------------------------------------------------------
// File Upload
// ---------------------------------------------------------------------------

/**
 * File upload component with drag-and-drop zone and progress display.
 * Wraps a native <input type="file"> with a styled drop zone.
 * Dispatches 'upload' event with detail: { files } when files are selected.
 * Handles drag-over visual state via data-dragover attribute.
 */
class ZFileUpload extends ZephyrElement {
  attachTemplate() {
    const dropZone = this.querySelector('[slot="dropzone"]') || this;
    let fileInput = this.querySelector('input[type="file"]');
    const fileList = this.querySelector('[slot="filelist"]');

    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = this.hasAttribute('data-multiple');
      fileInput.accept = this.dataset.accept || '';
      fileInput.classList.add('z-file-input-hidden');
      this.appendChild(fileInput);
    }

    // ARIA
    dropZone.setAttribute('role', 'button');
    dropZone.setAttribute('tabindex', '0');
    dropZone.setAttribute('aria-label', 'Drop files here or click to browse');

    // Click to browse
    dropZone.addEventListener('click', (e) => {
      if (e.target === fileInput) return;
      fileInput.click();
    });

    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      this.setAttribute('data-dragover', '');
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (!this.contains(e.relatedTarget)) {
        this.removeAttribute('data-dragover');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.removeAttribute('data-dragover');
      const files = Array.from(e.dataTransfer.files);
      this._handleFiles(files, fileList);
    });

    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      this._handleFiles(files, fileList);
    });
  }

  _handleFiles(files, fileList) {
    if (files.length === 0) return;

    // Render file list if container exists
    if (fileList) {
      fileList.replaceChildren();
      files.forEach(file => {
        const item = document.createElement('div');
        item.classList.add('z-file-item');

        const name = document.createElement('span');
        name.classList.add('z-file-name');
        name.textContent = file.name;

        const size = document.createElement('span');
        size.classList.add('z-file-size');
        size.textContent = this._formatSize(file.size);

        const progress = document.createElement('div');
        progress.classList.add('z-file-progress');
        const bar = document.createElement('div');
        bar.classList.add('z-file-progress-bar');
        progress.appendChild(bar);

        item.append(name, size, progress);
        fileList.appendChild(item);
      });
    }

    this.dispatchEvent(new CustomEvent('upload', {
      bubbles: true,
      detail: { files }
    }));
  }

  /**
   * Updates the progress bar for a specific file.
   * @param {number} index - File index in the list
   * @param {number} percent - Progress percentage (0-100)
   */
  setProgress(index, percent) {
    const bars = this.querySelectorAll('.z-file-progress-bar');
    if (bars[index]) {
      bars[index].style.width = `${Math.min(100, Math.max(0, percent))}%`;
      if (percent >= 100) {
        bars[index].closest('.z-file-item')?.setAttribute('data-complete', '');
      }
    }
  }

  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// ---------------------------------------------------------------------------
// Virtual List
// ---------------------------------------------------------------------------

/**
 * Virtual scrolling list for efficiently rendering large datasets.
 * Only renders items visible in the viewport plus a buffer.
 * Set data-item-height for fixed row height, data-buffer for overscan count.
 * Call setItems(array) to provide data, provide a render function via setRenderer(fn).
 *
 * @example
 *   const list = document.querySelector('z-virtual-list');
 *   list.setRenderer((item, idx) => `<div class="row">${item.name}</div>`);
 *   list.setItems(arrayOf10000Items);
 */
class ZVirtualList extends ZephyrElement {
  attachTemplate() {
    this._items = [];
    this._renderer = (item, idx) => `<div>${item}</div>`;
    this._itemHeight = parseInt(this.dataset.itemHeight) || 40;
    this._buffer = parseInt(this.dataset.buffer) || 5;

    // Create inner structure
    this._spacer = document.createElement('div');
    this._spacer.classList.add('z-virtual-spacer');
    this._viewport = document.createElement('div');
    this._viewport.classList.add('z-virtual-viewport');

    this.appendChild(this._spacer);
    this._spacer.appendChild(this._viewport);

    this.setAttribute('role', 'list');
    this.style.overflow = 'auto';

    this._onScroll = () => this._render();
    this.addEventListener('scroll', this._onScroll, { passive: true });
  }

  /**
   * Sets the data items for the list.
   * @param {Array} items - Array of data objects to render
   */
  setItems(items) {
    this._items = items;
    this._spacer.style.height = `${items.length * this._itemHeight}px`;
    this._render();
  }

  /**
   * Sets the render function that converts a data item to HTML.
   * The returned HTML is injected via innerHTML — callers are responsible
   * for escaping any user-supplied content to prevent XSS.
   * @param {function(item: *, index: number): string} fn - Renderer function
   */
  setRenderer(fn) {
    this._renderer = fn;
    this._render();
  }

  _render() {
    if (!this._items.length) return;

    const scrollTop = this.scrollTop;
    const viewportHeight = this.clientHeight;

    const startIdx = Math.max(0, Math.floor(scrollTop / this._itemHeight) - this._buffer);
    const endIdx = Math.min(
      this._items.length,
      Math.ceil((scrollTop + viewportHeight) / this._itemHeight) + this._buffer
    );

    this._viewport.style.transform = `translateY(${startIdx * this._itemHeight}px)`;

    const fragment = document.createDocumentFragment();
    for (let i = startIdx; i < endIdx; i++) {
      const el = document.createElement('div');
      el.classList.add('z-virtual-item');
      el.setAttribute('role', 'listitem');
      el.style.height = `${this._itemHeight}px`;
      el.innerHTML = this._renderer(this._items[i], i);
      fragment.appendChild(el);
    }

    this._viewport.replaceChildren(fragment);
  }

  _cleanup() {
    super._cleanup();
    this.removeEventListener('scroll', this._onScroll);
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
customElements.define('z-combobox', ZCombobox);
customElements.define('z-datepicker', ZDatepicker);
customElements.define('z-infinite-scroll', ZInfiniteScroll);
customElements.define('z-sortable', ZSortable);
customElements.define('z-file-upload', ZFileUpload);
customElements.define('z-virtual-list', ZVirtualList);

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
    },
    combobox: {
      tag: 'z-combobox',
      slots: ['listbox'],
      attributes: ['data-open', 'data-value', 'name'],
      events: ['change', 'input'],
      methods: ['value']
    },
    datepicker: {
      tag: 'z-datepicker',
      slots: ['display'],
      attributes: ['name'],
      events: ['change'],
      methods: ['value']
    },
    infiniteScroll: {
      tag: 'z-infinite-scroll',
      slots: [],
      attributes: ['data-loading', 'data-done', 'data-root-margin'],
      events: ['loadmore'],
      methods: ['complete()']
    },
    sortable: {
      tag: 'z-sortable',
      slots: [],
      attributes: ['data-sortable'],
      events: ['sort'],
      methods: []
    },
    fileUpload: {
      tag: 'z-file-upload',
      slots: ['dropzone', 'filelist'],
      attributes: ['data-multiple', 'data-accept', 'data-dragover'],
      events: ['upload'],
      methods: ['setProgress(index, percent)']
    },
    virtualList: {
      tag: 'z-virtual-list',
      slots: [],
      attributes: ['data-item-height', 'data-buffer'],
      events: [],
      methods: ['setItems(array)', 'setRenderer(fn)']
    }
  },

  // -------------------------------------------------------------------------
  // Agent API — Structured interface for LLMs and AI agents
  // -------------------------------------------------------------------------

  /**
   * Agent API namespace. Provides structured methods for AI agents and LLMs
   * to discover, inspect, and interact with Zephyr components on the page.
   * @namespace Zephyr.agent
   */
  agent: {
    /** @private State attributes tracked by the agent API. */
    _stateAttrs: ['data-open', 'data-active', 'data-visible', 'data-value', 'data-loading', 'data-done', 'data-dragover'],

    /** @private Observer state. */
    _observer: null,
    _callbacks: null,
    _diffCallbacks: null,

    /** @private Recording state. */
    _recording: null,

    /** @private Locked components: Map<Element, string> (element → agent ID). */
    _locks: new Map(),

    /** @private Action mappings per component tag. */
    _actions: {
      'z-accordion': {
        toggle(el, params) {
          const items = Array.from(el.querySelectorAll('z-accordion-item'));
          const item = typeof params?.index === 'number' ? items[params.index] : items[0];
          if (item) {
            const trigger = item.querySelector('[slot="trigger"]');
            if (trigger) trigger.click();
          }
        }
      },
      'z-modal': {
        open(el) { el.open(); },
        close(el) { el.close(); }
      },
      'z-tabs': {
        activate(el, params) {
          if (params?.tab) {
            const tab = el.querySelector(`[data-tab="${params.tab}"]`);
            if (tab) tab.click();
          }
        }
      },
      'z-select': {
        open(el) {
          el.setAttribute('data-open', '');
          const trigger = el.querySelector('[slot="trigger"]');
          if (trigger) trigger.setAttribute('aria-expanded', 'true');
        },
        close(el) {
          el.removeAttribute('data-open');
          const trigger = el.querySelector('[slot="trigger"]');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        },
        select(el, params) {
          if (params?.value) {
            const opt = el.querySelector(`[data-value="${params.value}"]`);
            if (opt) opt.click();
          }
        }
      },
      'z-carousel': {
        next(el) { el.next(); },
        prev(el) { el.prev(); },
        goto(el, params) {
          if (typeof params?.index === 'number') {
            const items = Array.from(el.querySelectorAll('[slot="item"]'));
            const current = items.findIndex(i => i.hasAttribute('data-active'));
            const diff = params.index - current;
            if (diff > 0) for (let i = 0; i < diff; i++) el.next();
            else if (diff < 0) for (let i = 0; i < -diff; i++) el.prev();
          }
        }
      },
      'z-toast': {
        show(el, params) {
          el.show(params?.message || '', params?.duration || 3000);
        }
      },
      'z-dropdown': {
        open(el) {
          el.setAttribute('data-open', '');
          const trigger = el.querySelector('[slot="trigger"]');
          if (trigger) trigger.setAttribute('aria-expanded', 'true');
        },
        close(el) {
          el.removeAttribute('data-open');
          const trigger = el.querySelector('[slot="trigger"]');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
      },
      'z-combobox': {
        open(el) {
          el.setAttribute('data-open', '');
          const input = el.querySelector('input');
          if (input) input.setAttribute('aria-expanded', 'true');
        },
        close(el) {
          el.removeAttribute('data-open');
          const input = el.querySelector('input');
          if (input) input.setAttribute('aria-expanded', 'false');
        },
        select(el, params) {
          if (params?.value) {
            const opt = el.querySelector(`[data-value="${params.value}"]`);
            if (opt) opt.click();
          }
        }
      },
      'z-datepicker': {
        open(el) {
          const input = el.querySelector('input[type="date"]');
          if (input) input.showPicker?.() || input.focus();
        },
        set(el, params) {
          if (params?.value) {
            const input = el.querySelector('input[type="date"]');
            if (input) {
              input.value = params.value;
              input.dispatchEvent(new Event('change'));
            }
          }
        }
      },
      'z-infinite-scroll': {
        complete(el) { el.complete(); }
      },
      'z-virtual-list': {
        setItems(el, params) {
          if (params?.items) el.setItems(params.items);
        }
      }
    },

    /**
     * Returns the enriched component schema with descriptions, actions, and examples.
     * @returns {Object} Component schema keyed by component name
     */
    getSchema() {
      const schema = {};
      for (const [name, def] of Object.entries(Zephyr.components)) {
        const tag = def.tag;
        const actions = Zephyr.agent._actions[tag];
        schema[name] = {
          ...def,
          actions: actions ? Object.keys(actions) : [],
          description: Zephyr.agent._descriptions[name] || ''
        };
      }
      return schema;
    },

    /** @private Component descriptions for schema enrichment. */
    _descriptions: {
      accordion: 'Collapsible accordion with CSS Grid transitions',
      modal: 'Modal dialog wrapping native <dialog> with View Transitions',
      tabs: 'Tab panel component with keyboard navigation',
      select: 'Form-associated custom select with ElementInternals',
      carousel: 'Slide carousel with autoplay and View Transitions',
      toast: 'Toast notification system',
      dropdown: 'Dropdown menu with click-outside handling',
      combobox: 'Filterable combobox with keyboard navigation',
      datepicker: 'Enhanced native date input with styled trigger',
      infiniteScroll: 'IntersectionObserver-based infinite loading',
      sortable: 'Drag & drop reorderable list',
      fileUpload: 'Drag-and-drop file upload with progress bars',
      virtualList: 'Virtual scrolling list for large datasets'
    },

    /**
     * Snapshots the state of all Zephyr components on the page (or a subset).
     * Returns plain objects safe for JSON serialization.
     * @param {string} [selector] - Optional CSS selector to scope the query
     * @returns {Array<{tag: string, id: string|null, state: Object, actions: string[]}>}
     */
    getState(selector) {
      const tags = Object.values(Zephyr.components).map(c => c.tag);
      const elements = selector
        ? document.querySelectorAll(selector)
        : document.querySelectorAll(tags.join(','));

      return Array.from(elements).map(el => {
        const tag = el.tagName.toLowerCase();
        const state = {};
        Zephyr.agent._stateAttrs.forEach(attr => {
          if (el.hasAttribute(attr)) {
            state[attr] = el.getAttribute(attr) || true;
          }
        });
        // Read value from form-associated components
        if (typeof el.value === 'string' && el.value) {
          state.value = el.value;
        }
        const actions = Zephyr.agent._actions[tag];
        return {
          tag,
          id: el.id || null,
          state,
          actions: actions ? Object.keys(actions) : []
        };
      });
    },

    /**
     * Sets or removes data attributes on a Zephyr component.
     * @param {string} selector - CSS selector for the target element
     * @param {Object} attributes - Attributes to set (null/false to remove)
     * @returns {{success: boolean, state?: Object, error?: string}}
     */
    setState(selector, attributes) {
      const el = document.querySelector(selector);
      if (!el) return { success: false, error: 'Element not found: ' + selector };
      Object.entries(attributes).forEach(([key, value]) => {
        if (value === null || value === false) {
          el.removeAttribute(key);
        } else if (value === true || value === '') {
          el.setAttribute(key, '');
        } else {
          el.setAttribute(key, String(value));
        }
      });
      const state = {};
      Zephyr.agent._stateAttrs.forEach(attr => {
        if (el.hasAttribute(attr)) {
          state[attr] = el.getAttribute(attr) || true;
        }
      });
      return { success: true, state };
    },

    /**
     * Returns a structured description of a specific component instance.
     * @param {string} selector - CSS selector for the target element
     * @returns {{tag: string, id: string|null, state: Object, actions: string[], slots: Object, description: string}|{error: string}}
     */
    describe(selector) {
      const el = document.querySelector(selector);
      if (!el) return { error: 'Element not found: ' + selector };

      const tag = el.tagName.toLowerCase();
      const name = Object.keys(Zephyr.components).find(
        k => Zephyr.components[k].tag === tag
      );
      const def = name ? Zephyr.components[name] : null;
      const actions = Zephyr.agent._actions[tag];

      // Read current state
      const state = {};
      Zephyr.agent._stateAttrs.forEach(attr => {
        if (el.hasAttribute(attr)) {
          state[attr] = el.getAttribute(attr) || true;
        }
      });
      if (typeof el.value === 'string' && el.value) {
        state.value = el.value;
      }

      // Enumerate slot content
      const slots = {};
      if (def && def.slots.length) {
        def.slots.forEach(slotName => {
          const slotEl = el.querySelector(`[slot="${slotName}"]`);
          slots[slotName] = slotEl ? slotEl.textContent.trim().slice(0, 100) : null;
        });
      }

      return {
        tag,
        id: el.id || null,
        description: (name && Zephyr.agent._descriptions[name]) || '',
        state,
        actions: actions ? Object.keys(actions) : [],
        slots,
        events: def ? def.events : [],
        methods: def ? def.methods : []
      };
    },

    /**
     * Performs a high-level action on a Zephyr component.
     * @param {string} selector - CSS selector for the target element
     * @param {string} action - Action name (e.g., 'open', 'close', 'select', 'next')
     * @param {Object} [params] - Action parameters (e.g., { value: 'red' })
     * @returns {{success: boolean, error?: string}}
     */
    act(selector, action, params) {
      const el = document.querySelector(selector);
      if (!el) return { success: false, error: 'Element not found: ' + selector };

      // Check if component is locked by another agent
      const lockOwner = Zephyr.agent._locks.get(el);
      if (lockOwner) {
        const agentId = (params && params._agentId) || null;
        if (lockOwner !== agentId) {
          return { success: false, error: `Component is locked by agent '${lockOwner}'. Unlock it first or pass matching _agentId in params.` };
        }
      }

      const tag = el.tagName.toLowerCase();
      const componentActions = Zephyr.agent._actions[tag];
      if (!componentActions) return { success: false, error: 'No actions for: ' + tag };

      const fn = componentActions[action];
      if (!fn) return { success: false, error: `Unknown action '${action}' for ${tag}. Available: ${Object.keys(componentActions).join(', ')}` };

      // Capture call if recording is active
      if (Zephyr.agent._recording) {
        Zephyr.agent._recording.push({ selector, action, params: params || null, timestamp: Date.now() });
      }

      fn(el, params);
      return { success: true };
    },

    /**
     * Observes state attribute changes on all Zephyr components.
     * Uses a single MutationObserver, lazily initialized on first call.
     * @param {function({element: Element, tag: string, attribute: string, oldValue: string|null, newValue: string|null}): void} callback
     */
    observe(callback) {
      if (!Zephyr.agent._callbacks) {
        Zephyr.agent._callbacks = new Set();
      }
      if (!Zephyr.agent._observer) {
        Zephyr.agent._observer = new MutationObserver((mutations) => {
          mutations.forEach(m => {
            const detail = {
              element: m.target,
              tag: m.target.tagName.toLowerCase(),
              attribute: m.attributeName,
              oldValue: m.oldValue,
              newValue: m.target.getAttribute(m.attributeName)
            };
            Zephyr.agent._callbacks.forEach(cb => cb(detail));
            // Fire diff callbacks with enriched structure
            if (Zephyr.agent._diffCallbacks && Zephyr.agent._diffCallbacks.size) {
              const diff = {
                component: m.target.tagName.toLowerCase(),
                id: m.target.id || null,
                property: m.attributeName,
                from: m.oldValue,
                to: m.target.getAttribute(m.attributeName),
                timestamp: Date.now()
              };
              Zephyr.agent._diffCallbacks.forEach(cb => cb(diff));
            }
          });
        });
        Zephyr.agent._observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeOldValue: true,
          attributeFilter: Zephyr.agent._stateAttrs
        });
      }
      Zephyr.agent._callbacks.add(callback);
    },

    /**
     * Removes an observer callback. Disconnects the MutationObserver when no callbacks remain.
     * @param {function} callback - The callback to remove
     */
    unobserve(callback) {
      if (Zephyr.agent._callbacks) {
        Zephyr.agent._callbacks.delete(callback);
        const diffCount = Zephyr.agent._diffCallbacks ? Zephyr.agent._diffCallbacks.size : 0;
        if (Zephyr.agent._callbacks.size === 0 && diffCount === 0 && Zephyr.agent._observer) {
          Zephyr.agent._observer.disconnect();
          Zephyr.agent._observer = null;
        }
      }
    },

    /**
     * Generates a markdown prompt describing all Zephyr components currently on the page.
     * Useful for injecting into an LLM's context window.
     * @returns {string} Markdown-formatted component reference
     */
    getPrompt() {
      const components = Zephyr.agent.getState();
      if (components.length === 0) {
        return '# Zephyr Components\n\nNo Zephyr components found on this page.';
      }

      let prompt = '# Zephyr Components on This Page\n\n';
      prompt += 'Interact via: `Zephyr.agent.act(selector, action, params)`\n\n';

      components.forEach(c => {
        const label = c.id ? `#${c.id}` : c.tag;
        prompt += `## ${c.tag} (${label})\n`;
        prompt += `- **State:** ${Object.keys(c.state).length ? JSON.stringify(c.state) : 'default'}\n`;
        prompt += `- **Actions:** ${c.actions.length ? c.actions.join(', ') : 'none'}\n`;
        prompt += '\n';
      });

      return prompt;
    },

    /**
     * Observes state changes with structured diff objects.
     * Emits enriched diffs with component name, id, timestamps.
     * Reuses the same MutationObserver as observe().
     * @param {function({component: string, id: string|null, property: string, from: string|null, to: string|null, timestamp: number}): void} callback
     */
    observeDiffs(callback) {
      if (!Zephyr.agent._diffCallbacks) {
        Zephyr.agent._diffCallbacks = new Set();
      }
      // Ensure the shared MutationObserver is running (reuse observe's setup)
      if (!Zephyr.agent._observer) {
        if (!Zephyr.agent._callbacks) {
          Zephyr.agent._callbacks = new Set();
        }
        Zephyr.agent._observer = new MutationObserver((mutations) => {
          mutations.forEach(m => {
            const detail = {
              element: m.target,
              tag: m.target.tagName.toLowerCase(),
              attribute: m.attributeName,
              oldValue: m.oldValue,
              newValue: m.target.getAttribute(m.attributeName)
            };
            Zephyr.agent._callbacks.forEach(cb => cb(detail));
            if (Zephyr.agent._diffCallbacks && Zephyr.agent._diffCallbacks.size) {
              const diff = {
                component: m.target.tagName.toLowerCase(),
                id: m.target.id || null,
                property: m.attributeName,
                from: m.oldValue,
                to: m.target.getAttribute(m.attributeName),
                timestamp: Date.now()
              };
              Zephyr.agent._diffCallbacks.forEach(cb => cb(diff));
            }
          });
        });
        Zephyr.agent._observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeOldValue: true,
          attributeFilter: Zephyr.agent._stateAttrs
        });
      }
      Zephyr.agent._diffCallbacks.add(callback);
    },

    /**
     * Removes a diff observer callback. Disconnects the MutationObserver when no callbacks remain.
     * @param {function} callback - The callback to remove
     */
    unobserveDiffs(callback) {
      if (Zephyr.agent._diffCallbacks) {
        Zephyr.agent._diffCallbacks.delete(callback);
        const obsCount = Zephyr.agent._callbacks ? Zephyr.agent._callbacks.size : 0;
        if (Zephyr.agent._diffCallbacks.size === 0 && obsCount === 0 && Zephyr.agent._observer) {
          Zephyr.agent._observer.disconnect();
          Zephyr.agent._observer = null;
        }
      }
    },

    /**
     * Enables or disables headless mode. Suppresses all CSS transitions and
     * animations for faster agent-driven operations. Components still update
     * state normally, just without visual delay.
     * @param {boolean} [enabled] - true to enable, false to disable. Omit to toggle.
     * @returns {boolean} Current headless state after the call
     */
    headless(enabled) {
      const el = document.documentElement;
      if (typeof enabled === 'undefined') {
        enabled = !el.hasAttribute('data-z-headless');
      }
      if (enabled) {
        el.setAttribute('data-z-headless', '');
      } else {
        el.removeAttribute('data-z-headless');
      }
      return el.hasAttribute('data-z-headless');
    },

    /**
     * Starts recording agent actions. Every act() call is captured with
     * selector, action, params, and timestamp. Only one recording can be
     * active at a time.
     * @returns {{stop: function(): Array<{selector: string, action: string, params: Object|null, timestamp: number}>}} Recording handle with stop() method
     * @throws {Error} If a recording is already in progress
     */
    record() {
      if (Zephyr.agent._recording) {
        throw new Error('A recording is already in progress. Call stop() on the current recording first.');
      }
      Zephyr.agent._recording = [];
      const recording = Zephyr.agent._recording;
      return {
        /** Stops recording and returns the captured actions. */
        stop() {
          Zephyr.agent._recording = null;
          return recording;
        }
      };
    },

    /**
     * Replays a recorded sequence of agent actions.
     * @param {Array<{selector: string, action: string, params: Object|null, timestamp: number}>} recording - Array of recorded actions
     * @param {Object} [options] - Replay options
     * @param {number} [options.delay=0] - Milliseconds between each action (ignored if realtime is true)
     * @param {boolean} [options.realtime=false] - If true, uses original timestamps to space out actions
     * @returns {Promise<Array<{selector: string, action: string, result: Object}>>} Resolves with results of each action
     */
    replay(recording, options) {
      const delay = (options && options.delay) || 0;
      const realtime = (options && options.realtime) || false;

      return new Promise((resolve) => {
        const results = [];
        let i = 0;

        function next() {
          if (i >= recording.length) {
            resolve(results);
            return;
          }
          const entry = recording[i];
          const result = Zephyr.agent.act(entry.selector, entry.action, entry.params);
          results.push({ selector: entry.selector, action: entry.action, result });
          i++;

          if (i < recording.length) {
            let wait = delay;
            if (realtime && recording[i]) {
              wait = recording[i].timestamp - entry.timestamp;
              if (wait < 0) wait = 0;
            }
            if (wait > 0) {
              setTimeout(next, wait);
            } else {
              next();
            }
          } else {
            resolve(results);
          }
        }

        next();
      });
    },

    /**
     * Locks a component so only the specified agent can act on it.
     * Other agents' act() calls will be rejected until unlocked.
     * @param {string} selector - CSS selector for the component to lock
     * @param {string} agentId - Unique identifier for the locking agent
     * @returns {{success: boolean, error?: string}}
     */
    lock(selector, agentId) {
      if (!agentId || typeof agentId !== 'string') {
        return { success: false, error: 'agentId is required and must be a string' };
      }
      const el = document.querySelector(selector);
      if (!el) return { success: false, error: 'Element not found: ' + selector };

      const existing = Zephyr.agent._locks.get(el);
      if (existing && existing !== agentId) {
        return { success: false, error: `Component is already locked by agent '${existing}'` };
      }
      Zephyr.agent._locks.set(el, agentId);
      el.setAttribute('data-z-locked', agentId);
      return { success: true };
    },

    /**
     * Unlocks a component. Only the locking agent (or a force unlock) can unlock it.
     * @param {string} selector - CSS selector for the component to unlock
     * @param {string} agentId - The agent requesting the unlock
     * @param {Object} [options] - Unlock options
     * @param {boolean} [options.force=false] - Force unlock regardless of owner
     * @returns {{success: boolean, error?: string}}
     */
    unlock(selector, agentId, options) {
      const el = document.querySelector(selector);
      if (!el) return { success: false, error: 'Element not found: ' + selector };

      const existing = Zephyr.agent._locks.get(el);
      if (!existing) return { success: true }; // Already unlocked

      const force = options && options.force;
      if (!force && existing !== agentId) {
        return { success: false, error: `Component is locked by agent '${existing}', not '${agentId}'. Use { force: true } to override.` };
      }
      Zephyr.agent._locks.delete(el);
      el.removeAttribute('data-z-locked');
      return { success: true };
    },

    /**
     * Returns all currently locked components and their owning agents.
     * @returns {Array<{selector: string, agentId: string}>}
     */
    locks() {
      const result = [];
      Zephyr.agent._locks.forEach((agentId, el) => {
        const id = el.id ? '#' + el.id : el.tagName.toLowerCase();
        result.push({ selector: id, agentId });
      });
      return result;
    },

    /**
     * Opt-in: Annotates all Zephyr components on the page with data-z-actions
     * attributes for DOM-level agent discovery.
     */
    annotate() {
      const tags = Object.values(Zephyr.components).map(c => c.tag);
      document.querySelectorAll(tags.join(',')).forEach(el => {
        const tag = el.tagName.toLowerCase();
        const actions = Zephyr.agent._actions[tag];
        if (actions) {
          el.setAttribute('data-z-actions', Object.keys(actions).join(','));
        }
        const name = Object.keys(Zephyr.components).find(
          k => Zephyr.components[k].tag === tag
        );
        if (name && Zephyr.agent._descriptions[name]) {
          el.setAttribute('data-z-description', Zephyr.agent._descriptions[name]);
        }
      });
    }
  }
};

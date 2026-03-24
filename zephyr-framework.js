/**
 * Zephyr - Zero-JS Interactive Framework
 * Uses View Transitions, CSS :has(), container queries, and HTML primitives
 */

class ZephyrElement extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this._internals = this.attachInternals();
    this._value = '';
  }

  connectedCallback() {
    this.attachTemplate();
    this.attachBehaviors();
  }

  attachTemplate() {
    // Override in subclasses
  }

  attachBehaviors() {
    // Auto-wire declarative behaviors from data attributes
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
        
        group.querySelectorAll('[data-tab]').forEach(t => t.removeAttribute('data-active'));
        group.querySelectorAll('[data-tab-panel]').forEach(p => p.removeAttribute('data-active'));
        
        el.setAttribute('data-active', '');
        group.querySelector(`[data-tab-panel="${tabName}"]`)?.setAttribute('data-active', '');
      });
    });
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = v;
    this._internals.setFormValue(v);
  }
}

// Accordion Component
class ZAccordion extends ZephyrElement {
  attachTemplate() {
    const items = Array.from(this.querySelectorAll('z-accordion-item'));
    items.forEach((item, idx) => {
      const trigger = item.querySelector('[slot="trigger"]');
      const content = item.querySelector('[slot="content"]');
      
      if (trigger && content) {
        trigger.setAttribute('data-toggle', `#accordion-content-${idx}`);
        content.id = `accordion-content-${idx}`;
      }
    });
  }
}

// Modal Component
class ZModal extends ZephyrElement {
  attachTemplate() {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = this.innerHTML;
    this.innerHTML = '';
    this.appendChild(dialog);

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        this.close();
      }
    });
  }

  open() {
    const dialog = this.querySelector('dialog');
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        dialog.showModal();
      });
    } else {
      dialog.showModal();
    }
  }

  close() {
    const dialog = this.querySelector('dialog');
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        dialog.close();
      });
    } else {
      dialog.close();
    }
  }
}

// Tabs Component
class ZTabs extends ZephyrElement {
  attachTemplate() {
    this.setAttribute('data-tab-group', '');
    const firstTab = this.querySelector('[data-tab]');
    const firstPanel = this.querySelector('[data-tab-panel]');
    
    if (firstTab && firstPanel) {
      firstTab.setAttribute('data-active', '');
      firstPanel.setAttribute('data-active', '');
    }
  }
}

// Select Component (form-associated)
class ZSelect extends ZephyrElement {
  attachTemplate() {
    const button = this.querySelector('[slot="trigger"]');
    const options = this.querySelector('[slot="options"]');
    const items = options.querySelectorAll('[data-value]');

    button.addEventListener('click', () => {
      if (this.hasAttribute('data-open')) {
        this.removeAttribute('data-open');
      } else {
        this.setAttribute('data-open', '');
      }
    });

    items.forEach(item => {
      item.addEventListener('click', () => {
        this.value = item.dataset.value;
        button.textContent = item.textContent;
        this.removeAttribute('data-open');
        this.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        this.removeAttribute('data-open');
      }
    });
  }
}

// Carousel Component
class ZCarousel extends ZephyrElement {
  connectedCallback() {
    super.connectedCallback();
    this._currentIndex = 0;
    this._items = Array.from(this.querySelectorAll('[slot="item"]'));
    
    this._items.forEach((item, idx) => {
      item.setAttribute('data-index', idx);
      if (idx === 0) item.setAttribute('data-active', '');
    });

    const prevBtn = this.querySelector('[data-prev]');
    const nextBtn = this.querySelector('[data-next]');

    prevBtn?.addEventListener('click', () => this.prev());
    nextBtn?.addEventListener('click', () => this.next());

    // Auto-scroll support
    if (this.hasAttribute('data-autoplay')) {
      this._startAutoplay();
    }
  }

  prev() {
    this._transition(-1);
  }

  next() {
    this._transition(1);
  }

  _transition(direction) {
    const nextIndex = (this._currentIndex + direction + this._items.length) % this._items.length;
    
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        this._updateSlide(nextIndex);
      });
    } else {
      this._updateSlide(nextIndex);
    }
  }

  _updateSlide(nextIndex) {
    this._items[this._currentIndex].removeAttribute('data-active');
    this._items[nextIndex].setAttribute('data-active', '');
    this._currentIndex = nextIndex;
  }

  _startAutoplay() {
    const interval = parseInt(this.dataset.autoplay) || 3000;
    setInterval(() => this.next(), interval);
  }
}

// Toast/Notification Component
class ZToast extends ZephyrElement {
  show(message, duration = 3000) {
    this.textContent = message;
    this.setAttribute('data-visible', '');
    
    setTimeout(() => {
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          this.removeAttribute('data-visible');
        });
      } else {
        this.removeAttribute('data-visible');
      }
    }, duration);
  }
}

// Dropdown Component
class ZDropdown extends ZephyrElement {
  attachTemplate() {
    const trigger = this.querySelector('[slot="trigger"]');
    
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.hasAttribute('data-open')) {
        this.removeAttribute('data-open');
      } else {
        this.setAttribute('data-open', '');
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        this.removeAttribute('data-open');
      }
    });
  }
}

// Register all components
customElements.define('z-accordion', ZAccordion);
customElements.define('z-modal', ZModal);
customElements.define('z-tabs', ZTabs);
customElements.define('z-select', ZSelect);
customElements.define('z-carousel', ZCarousel);
customElements.define('z-toast', ZToast);
customElements.define('z-dropdown', ZDropdown);

// Global utilities
window.Zephyr = {
  modal(id) {
    return document.getElementById(id);
  },
  toast(message, duration) {
    const toast = document.querySelector('z-toast') || document.createElement('z-toast');
    if (!document.body.contains(toast)) {
      document.body.appendChild(toast);
    }
    toast.show(message, duration);
  }
};

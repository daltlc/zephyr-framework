/**
 * Zephyr Runtime — Agent execution surface add-on
 * Provides z-stream, z-stream-entry, z-command, and z-ticker components.
 * Requires zephyr-framework.js to be loaded first.
 *
 * @description Extends the core Zephyr framework with a terminal-style
 * activity stream where events flow, agents respond inline, and UI panels
 * appear on demand. The organizing principle is time, not space.
 */

// ---------------------------------------------------------------------------
// z-stream-entry — Individual row in the activity stream
// ---------------------------------------------------------------------------

/**
 * A single entry in the activity stream. Typed, timestamped, collapsible.
 * CSS-driven collapse via grid-template-rows: 0fr/1fr.
 * @example
 * <z-stream-entry data-type="trade" data-status="success">
 *   <span slot="header">BUY 100 AAPL @ MARKET</span>
 *   <div slot="content"><div>Order filled at $198.50</div></div>
 * </z-stream-entry>
 */
class ZStreamEntry extends HTMLElement {
  static observedAttributes = ['data-type', 'data-status', 'data-collapsed', 'data-pinned'];

  connectedCallback() {
    if (this._built) return;
    this._built = true;

    if (!this.hasAttribute('data-timestamp')) {
      this.setAttribute('data-timestamp', new Date().toISOString());
    }

    // Build internal structure from slots
    this._gutterEl = document.createElement('div');
    this._gutterEl.classList.add('z-entry-gutter');

    this._headerEl = document.createElement('div');
    this._headerEl.classList.add('z-entry-header');
    this._headerEl.setAttribute('role', 'button');
    this._headerEl.setAttribute('tabindex', '0');

    this._tsEl = document.createElement('time');
    this._tsEl.classList.add('z-entry-ts');

    this._contentWrap = document.createElement('div');
    this._contentWrap.classList.add('z-entry-content-wrap');

    this._contentEl = document.createElement('div');
    this._contentEl.classList.add('z-entry-content');
    this._contentWrap.appendChild(this._contentEl);

    this._actionsEl = document.createElement('div');
    this._actionsEl.classList.add('z-entry-actions');

    // Move slot content into structure
    const headerSlot = this.querySelector('[slot="header"]');
    const contentSlot = this.querySelector('[slot="content"]');
    const iconSlot = this.querySelector('[slot="icon"]');

    if (iconSlot) {
      this._gutterEl.appendChild(iconSlot);
      iconSlot.removeAttribute('slot');
    }
    if (headerSlot) {
      this._headerEl.appendChild(headerSlot);
      headerSlot.removeAttribute('slot');
    }
    if (contentSlot) {
      this._contentEl.appendChild(contentSlot);
      contentSlot.removeAttribute('slot');
    }

    // Timestamp display
    this._syncTimestamp();

    // Action buttons
    this._pinBtn = document.createElement('button');
    this._pinBtn.classList.add('z-entry-btn', 'z-entry-pin');
    this._pinBtn.textContent = '\u{1F4CC}';
    this._pinBtn.title = 'Pin';
    this._pinBtn.setAttribute('aria-label', 'Pin entry');

    this._collapseBtn = document.createElement('button');
    this._collapseBtn.classList.add('z-entry-btn', 'z-entry-collapse');
    this._collapseBtn.textContent = '\u25B2';
    this._collapseBtn.title = 'Collapse';
    this._collapseBtn.setAttribute('aria-label', 'Collapse entry');

    this._dismissBtn = document.createElement('button');
    this._dismissBtn.classList.add('z-entry-btn', 'z-entry-dismiss');
    this._dismissBtn.textContent = '\u00D7';
    this._dismissBtn.title = 'Dismiss';
    this._dismissBtn.setAttribute('aria-label', 'Dismiss entry');

    this._actionsEl.appendChild(this._pinBtn);
    this._actionsEl.appendChild(this._collapseBtn);
    this._actionsEl.appendChild(this._dismissBtn);

    // Detect whether this entry has collapsible content
    this._hasContent = this._contentEl.children.length > 0 || this._contentEl.textContent.trim().length > 0;
    if (!this._hasContent) {
      this.setAttribute('data-no-content', '');
      this._headerEl.removeAttribute('role');
      this._headerEl.removeAttribute('tabindex');
      this._collapseBtn.hidden = true;
    }

    // Build top row
    this._topRow = document.createElement('div');
    this._topRow.classList.add('z-entry-top');
    this._topRow.appendChild(this._gutterEl);
    this._topRow.appendChild(this._headerEl);
    this._topRow.appendChild(this._tsEl);
    this._topRow.appendChild(this._actionsEl);

    this.appendChild(this._topRow);
    if (this._hasContent) {
      this.appendChild(this._contentWrap);
    }

    // Event listeners
    this._onHeaderClick = () => { if (this._hasContent) this.toggleCollapse(); };
    this._headerEl.addEventListener('click', this._onHeaderClick);
    this._headerEl.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && this._hasContent) {
        e.preventDefault();
        this.toggleCollapse();
      }
    });

    this._pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePin();
    });

    this._collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });

    this._dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss();
    });
  }

  disconnectedCallback() {
    if (this._autoCollapseTimer) clearTimeout(this._autoCollapseTimer);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'data-collapsed') {
      this._collapseBtn.textContent = this.hasAttribute('data-collapsed') ? '\u25BC' : '\u25B2';
    }
  }

  _syncTimestamp() {
    const iso = this.getAttribute('data-timestamp');
    if (!iso || !this._tsEl) return;
    const d = new Date(iso);
    this._tsEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this._tsEl.setAttribute('datetime', iso);
  }

  /** Toggle collapsed state. */
  toggleCollapse() {
    if (this.hasAttribute('data-collapsed')) {
      this.removeAttribute('data-collapsed');
      this.dispatchEvent(new CustomEvent('expand', { bubbles: true }));
    } else {
      this.setAttribute('data-collapsed', '');
      this.dispatchEvent(new CustomEvent('collapse', { bubbles: true }));
    }
  }

  /** Toggle pinned state. */
  togglePin() {
    if (this.hasAttribute('data-pinned')) {
      this.removeAttribute('data-pinned');
    } else {
      this.setAttribute('data-pinned', '');
      if (this._autoCollapseTimer) {
        clearTimeout(this._autoCollapseTimer);
        this._autoCollapseTimer = null;
      }
    }
    this.dispatchEvent(new CustomEvent(this.hasAttribute('data-pinned') ? 'pin' : 'unpin', { bubbles: true }));
  }

  /** Remove entry from stream with animation. */
  dismiss() {
    this.setAttribute('data-dismissing', '');
    this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true }));
    this.addEventListener('transitionend', () => this.remove(), { once: true });
    // Fallback removal if no transition fires
    setTimeout(() => { if (this.parentNode) this.remove(); }, 400);
  }

  /**
   * Set the entry's status (pending, running, success, error).
   * @param {string} status
   */
  setStatus(status) {
    this.setAttribute('data-status', status);
  }

  /**
   * Set the header text content.
   * @param {string} text
   */
  setHeader(text) {
    if (!this._headerEl) return;
    const existing = this._headerEl.firstChild;
    if (existing && existing.nodeType === 3) {
      existing.textContent = text;
    } else {
      const span = document.createElement('span');
      span.textContent = text;
      this._headerEl.insertBefore(span, this._headerEl.firstChild);
    }
  }

  /**
   * Set or append content HTML-safe text.
   * @param {string} text
   * @param {boolean} [append=false]
   */
  setContent(text, append) {
    if (!this._contentEl) return;
    if (append) {
      const p = document.createElement('div');
      p.textContent = text;
      this._contentEl.appendChild(p);
    } else {
      this._contentEl.textContent = text;
    }
    // Enable expand behavior if content was added after construction
    if (!this._hasContent && text) {
      this._hasContent = true;
      this.removeAttribute('data-no-content');
      this._headerEl.setAttribute('role', 'button');
      this._headerEl.setAttribute('tabindex', '0');
      this._collapseBtn.hidden = false;
      if (!this._contentWrap.parentNode) {
        this.appendChild(this._contentWrap);
      }
    }
  }

  /**
   * Schedule auto-collapse after delay (ms). Cancelled by pinning.
   * @param {number} delay
   */
  autoCollapse(delay) {
    if (this.hasAttribute('data-pinned')) return;
    this._autoCollapseTimer = setTimeout(() => {
      if (!this.hasAttribute('data-pinned') && !this.hasAttribute('data-collapsed')) {
        this.setAttribute('data-collapsed', '');
        this.dispatchEvent(new CustomEvent('collapse', { bubbles: true }));
      }
    }, delay);
  }
}

// ---------------------------------------------------------------------------
// z-stream — The activity stream container
// ---------------------------------------------------------------------------

/**
 * Scrolling, append-only activity stream. Holds z-stream-entry children.
 * Auto-scrolls to bottom; pauses when user scrolls up.
 * @example
 * <z-stream data-autoscroll data-max-entries="500">
 * </z-stream>
 */
class ZStream extends HTMLElement {
  static observedAttributes = ['data-max-entries', 'data-filter'];

  connectedCallback() {
    if (this._built) return;
    this._built = true;

    this._entryCount = 0;

    // Jump-to-latest pill
    this._jumpPill = document.createElement('button');
    this._jumpPill.classList.add('z-stream-jump');
    this._jumpPill.textContent = '\u2193 Jump to latest';
    this._jumpPill.setAttribute('aria-label', 'Jump to latest entry');
    this._jumpPill.hidden = true;
    this.appendChild(this._jumpPill);

    this._jumpPill.addEventListener('click', () => {
      this._scrollToBottom();
      this._jumpPill.hidden = true;
    });

    // Auto-scroll detection
    this._isUserScrolled = false;
    this._onScroll = () => {
      const threshold = 80;
      const atBottom = this.scrollHeight - this.scrollTop - this.clientHeight < threshold;
      this._isUserScrolled = !atBottom;
      this._jumpPill.hidden = atBottom;
    };
    this.addEventListener('scroll', this._onScroll, { passive: true });
  }

  disconnectedCallback() {
    this.removeEventListener('scroll', this._onScroll);
  }

  _scrollToBottom() {
    const last = this.querySelector('z-stream-entry:last-of-type');
    if (last) {
      last.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  /**
   * Append an entry to the stream.
   * @param {Object} spec - Entry specification
   * @param {string} spec.type - Entry type: event|agent|command|ui|alert|trade|system
   * @param {string} spec.header - Header text (always visible)
   * @param {string} [spec.content] - Body text
   * @param {string} [spec.status] - Status: pending|running|success|error
   * @param {boolean} [spec.pinned] - Pin this entry
   * @param {string} [spec.id] - Entry ID
   * @param {string} [spec.source] - Source agent/system name
   * @param {Object} [spec.component] - Inline Zephyr component spec (for type="ui")
   * @param {number} [spec.autoCollapse] - Auto-collapse after N ms
   * @returns {ZStreamEntry} The created entry element
   */
  append(spec) {
    const entry = document.createElement('z-stream-entry');
    if (spec.id) entry.id = spec.id;
    if (spec.type) entry.setAttribute('data-type', spec.type);
    if (spec.status) entry.setAttribute('data-status', spec.status);
    if (spec.pinned) entry.setAttribute('data-pinned', '');
    if (spec.source) entry.setAttribute('data-source', spec.source);

    // Header
    const header = document.createElement('span');
    header.setAttribute('slot', 'header');
    header.textContent = spec.header || '';
    entry.appendChild(header);

    // Content
    if (spec.content || spec.component) {
      const content = document.createElement('div');
      content.setAttribute('slot', 'content');

      if (spec.content) {
        const textDiv = document.createElement('div');
        textDiv.textContent = spec.content;
        content.appendChild(textDiv);
      }

      if (spec.component) {
        // Render inline Zephyr component using agent render API
        const placeholder = document.createElement('div');
        placeholder.classList.add('z-entry-component');
        content.appendChild(placeholder);
        entry.appendChild(content);

        // Insert entry first so render can find the container
        this._insertEntry(entry);

        // Use Zephyr.agent.render if available
        if (window.Zephyr && Zephyr.agent && Zephyr.agent._buildElement) {
          const result = Zephyr.agent._buildElement(spec.component);
          if (result.element) {
            placeholder.appendChild(result.element);
          }
        }
      } else {
        entry.appendChild(content);
        this._insertEntry(entry);
      }
    } else {
      this._insertEntry(entry);
    }

    // Auto-collapse
    if (spec.autoCollapse) {
      entry.autoCollapse(spec.autoCollapse);
    }

    return entry;
  }

  _insertEntry(entry) {
    // Insert before the jump pill
    if (this._jumpPill && this._jumpPill.parentNode === this) {
      this.insertBefore(entry, this._jumpPill);
    } else {
      this.appendChild(entry);
    }

    this._entryCount++;

    // Prune if over max
    const max = parseInt(this.getAttribute('data-max-entries'), 10);
    if (max && this._entryCount > max) {
      this._prune(this._entryCount - max);
    }

    // Auto-scroll
    if (!this._isUserScrolled && !this.hasAttribute('data-paused')) {
      requestAnimationFrame(() => this._scrollToBottom());
    }

    this.dispatchEvent(new CustomEvent('entry-add', {
      bubbles: true,
      detail: { id: entry.id, type: entry.getAttribute('data-type'), timestamp: entry.getAttribute('data-timestamp') }
    }));
  }

  _prune(count) {
    const entries = this.querySelectorAll('z-stream-entry:not([data-pinned])');
    let removed = 0;
    for (const entry of entries) {
      if (removed >= count) break;
      entry.remove();
      this._entryCount--;
      removed++;
    }
  }

  /** Remove all entries. */
  clear() {
    this.querySelectorAll('z-stream-entry').forEach(e => e.remove());
    this._entryCount = 0;
    this._jumpPill.hidden = true;
  }

  /**
   * Filter visible entries by type.
   * @param {string|null} type - Type to show (null to show all)
   */
  filter(type) {
    this.querySelectorAll('z-stream-entry').forEach(e => {
      if (!type) {
        e.removeAttribute('data-filtered');
      } else {
        const t = e.getAttribute('data-type');
        if (t !== type) e.setAttribute('data-filtered', '');
        else e.removeAttribute('data-filtered');
      }
    });
    this.setAttribute('data-filter', type || '');
  }

  /** Pause auto-scroll. */
  pause() {
    this.setAttribute('data-paused', '');
    this._isUserScrolled = true;
  }

  /** Resume auto-scroll. */
  resume() {
    this.removeAttribute('data-paused');
    this._isUserScrolled = false;
    this._scrollToBottom();
    this._jumpPill.hidden = true;
  }

  /**
   * Get entries, optionally filtered by type.
   * @param {string} [type]
   * @returns {ZStreamEntry[]}
   */
  getEntries(type) {
    const sel = type ? `z-stream-entry[data-type="${type}"]` : 'z-stream-entry';
    return Array.from(this.querySelectorAll(sel));
  }
}

// ---------------------------------------------------------------------------
// z-command — Unified command/chat input
// ---------------------------------------------------------------------------

/**
 * Single input bar for commands (slash prefix) and chat (natural language).
 * Emits 'submit' events for the host environment to handle.
 * @example
 * <z-command data-placeholder="Ask the agent or type /command..."></z-command>
 */
class ZCommand extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;

    this._history = [];
    this._historyIdx = -1;
    this._currentInput = '';

    // Mode indicator
    this._modeEl = document.createElement('span');
    this._modeEl.classList.add('z-cmd-mode');
    this._modeEl.textContent = '\u276F'; // chat mode default

    // Input
    this._input = document.createElement('input');
    this._input.type = 'text';
    this._input.classList.add('z-cmd-input');
    this._input.placeholder = this.getAttribute('data-placeholder') || 'Ask the agent or type /command...';
    this._input.setAttribute('aria-label', 'Command input');
    this._input.autocomplete = 'off';
    this._input.spellcheck = false;

    // Send button
    this._sendBtn = document.createElement('button');
    this._sendBtn.classList.add('z-cmd-send');
    this._sendBtn.textContent = '\u23CE'; // return symbol
    this._sendBtn.setAttribute('aria-label', 'Send');

    this.appendChild(this._modeEl);
    this.appendChild(this._input);
    this.appendChild(this._sendBtn);

    // Mode detection
    this._input.addEventListener('input', () => {
      const val = this._input.value;
      const isCmd = val.startsWith('/');
      this.setAttribute('data-mode', isCmd ? 'command' : 'chat');
      this._modeEl.textContent = isCmd ? '/' : '\u276F';
    });

    // Submit
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._submit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._navigateHistory(1);
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('clear', { bubbles: true }));
      }
    });

    this._sendBtn.addEventListener('click', () => this._submit());
  }

  _submit() {
    const text = this._input.value.trim();
    if (!text) return;

    const mode = text.startsWith('/') ? 'command' : 'chat';

    // Add to history
    if (!this._history.length || this._history[this._history.length - 1] !== text) {
      this._history.push(text);
    }
    this._historyIdx = -1;
    this._currentInput = '';

    this._input.value = '';
    this.setAttribute('data-mode', 'chat');
    this._modeEl.textContent = '\u276F';

    this.dispatchEvent(new CustomEvent('submit', {
      bubbles: true,
      detail: { text, mode, timestamp: new Date().toISOString() }
    }));
  }

  _navigateHistory(dir) {
    if (!this._history.length) return;

    if (this._historyIdx === -1) {
      this._currentInput = this._input.value;
    }

    const newIdx = this._historyIdx === -1
      ? (dir === -1 ? this._history.length - 1 : -1)
      : this._historyIdx + dir;

    if (newIdx < 0 || newIdx >= this._history.length) {
      this._historyIdx = -1;
      this._input.value = this._currentInput;
      return;
    }

    this._historyIdx = newIdx;
    this._input.value = this._history[newIdx];

    // Update mode indicator
    const isCmd = this._input.value.startsWith('/');
    this.setAttribute('data-mode', isCmd ? 'command' : 'chat');
    this._modeEl.textContent = isCmd ? '/' : '\u276F';
  }

  /** Programmatically submit text. */
  submit(text) {
    if (text !== undefined) this._input.value = text;
    this._submit();
  }

  /** Focus the input. */
  focus() {
    if (this._input) this._input.focus();
  }

  /** Get command history. */
  getHistory() {
    return [...this._history];
  }

  /** Update placeholder text. */
  setPlaceholder(text) {
    if (this._input) this._input.placeholder = text;
    this.setAttribute('data-placeholder', text);
  }
}

// ---------------------------------------------------------------------------
// z-ticker — Live data ticker strip
// ---------------------------------------------------------------------------

/**
 * Horizontal scrolling ticker strip for live data points.
 * CSS-driven scroll animation, pauses on hover.
 * @example
 * <z-ticker data-speed="40"></z-ticker>
 * <script>
 *   document.querySelector('z-ticker').setItems([
 *     { label: 'AAPL', value: '$198.50', trend: 'up', trendValue: '+1.75%' },
 *     { label: 'SPY', value: '$528.40', trend: 'up', trendValue: '+0.53%' }
 *   ]);
 * </script>
 */
class ZTicker extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;

    this._track = document.createElement('div');
    this._track.classList.add('z-ticker-track');
    this.appendChild(this._track);
    this._items = [];
  }

  /**
   * Set all ticker items.
   * @param {Array<{label: string, value: string, trend?: string, trendValue?: string}>} items
   */
  setItems(items) {
    this._items = items;
    this._renderTrack();
  }

  /**
   * Update a single item by label.
   * @param {string} label
   * @param {string} value
   * @param {string} [trend]
   * @param {string} [trendValue]
   */
  updateItem(label, value, trend, trendValue) {
    const item = this._items.find(i => i.label === label);
    if (item) {
      item.value = value;
      if (trend !== undefined) item.trend = trend;
      if (trendValue !== undefined) item.trendValue = trendValue;
    }
    // Update DOM directly for performance
    const els = this._track.querySelectorAll('.z-ticker-item');
    els.forEach(el => {
      if (el.querySelector('.z-ticker-label')?.textContent === label) {
        const valEl = el.querySelector('.z-ticker-value');
        const trendEl = el.querySelector('.z-ticker-trend');
        if (valEl) valEl.textContent = value;
        if (trendEl && trendValue !== undefined) {
          const arrow = trend === 'up' ? '\u25B2' : trend === 'down' ? '\u25BC' : '';
          trendEl.textContent = arrow + ' ' + trendValue;
          trendEl.className = 'z-ticker-trend';
          if (trend) trendEl.classList.add('z-ticker-trend--' + trend);
        }
      }
    });
  }

  /**
   * Append an item.
   * @param {Object} item
   */
  addItem(item) {
    this._items.push(item);
    this._renderTrack();
  }

  _renderTrack() {
    this._track.innerHTML = '';
    // Duplicate items for seamless scroll loop
    const allItems = [...this._items, ...this._items];

    for (const item of allItems) {
      const el = document.createElement('div');
      el.classList.add('z-ticker-item');

      const label = document.createElement('span');
      label.classList.add('z-ticker-label');
      label.textContent = item.label;

      const value = document.createElement('span');
      value.classList.add('z-ticker-value');
      value.textContent = item.value;

      el.appendChild(label);
      el.appendChild(value);

      if (item.trendValue) {
        const trend = document.createElement('span');
        trend.classList.add('z-ticker-trend');
        if (item.trend) trend.classList.add('z-ticker-trend--' + item.trend);
        const arrow = item.trend === 'up' ? '\u25B2' : item.trend === 'down' ? '\u25BC' : '';
        trend.textContent = arrow + ' ' + item.trendValue;
        el.appendChild(trend);
      }

      this._track.appendChild(el);
    }

    // Set animation duration based on item count and speed
    const speed = parseInt(this.getAttribute('data-speed'), 10) || 40;
    const totalWidth = this._items.length * 200; // approx width per item
    const duration = totalWidth / speed;
    this._track.style.animationDuration = duration + 's';
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

customElements.define('z-stream-entry', ZStreamEntry);
customElements.define('z-stream', ZStream);
customElements.define('z-command', ZCommand);
customElements.define('z-ticker', ZTicker);

// ---------------------------------------------------------------------------
// Extend Zephyr.components registry and agent API
// ---------------------------------------------------------------------------

if (window.Zephyr) {
  // Register new components in the registry
  Object.assign(Zephyr.components, {
    stream: {
      tag: 'z-stream',
      slots: [],
      attributes: ['data-autoscroll', 'data-max-entries', 'data-filter', 'data-paused'],
      events: ['entry-add', 'entry-collapse', 'entry-pin'],
      methods: ['append(spec)', 'clear()', 'filter(type)', 'pause()', 'resume()', 'getEntries(type)']
    },
    streamEntry: {
      tag: 'z-stream-entry',
      slots: ['icon', 'header', 'content', 'actions'],
      attributes: ['data-type', 'data-status', 'data-collapsed', 'data-pinned', 'data-timestamp', 'data-source'],
      events: ['collapse', 'expand', 'dismiss', 'pin', 'unpin'],
      methods: ['toggleCollapse()', 'togglePin()', 'dismiss()', 'setStatus(status)', 'setHeader(text)', 'setContent(text)', 'autoCollapse(delay)']
    },
    command: {
      tag: 'z-command',
      slots: [],
      attributes: ['data-mode', 'data-placeholder', 'data-history'],
      events: ['submit', 'clear'],
      methods: ['submit(text)', 'focus()', 'getHistory()', 'setPlaceholder(text)']
    },
    ticker: {
      tag: 'z-ticker',
      slots: [],
      attributes: ['data-speed'],
      events: [],
      methods: ['setItems(items)', 'updateItem(label, value, trend, trendValue)', 'addItem(item)']
    }
  });

  // Register agent actions
  Object.assign(Zephyr.agent._actions, {
    'z-stream': {
      append(el, params) {
        return el.append(params || {});
      },
      clear(el) {
        el.clear();
      },
      filter(el, params) {
        el.filter(params?.type || null);
      },
      pause(el) {
        el.pause();
      },
      resume(el) {
        el.resume();
      }
    },
    'z-stream-entry': {
      collapse(el) {
        if (!el.hasAttribute('data-collapsed')) el.toggleCollapse();
      },
      expand(el) {
        if (el.hasAttribute('data-collapsed')) el.toggleCollapse();
      },
      pin(el) {
        if (!el.hasAttribute('data-pinned')) el.togglePin();
      },
      unpin(el) {
        if (el.hasAttribute('data-pinned')) el.togglePin();
      },
      dismiss(el) {
        el.dismiss();
      },
      setStatus(el, params) {
        if (params?.status) el.setStatus(params.status);
      }
    },
    'z-command': {
      submit(el, params) {
        el.submit(params?.text);
      },
      focus(el) {
        el.focus();
      },
      setPlaceholder(el, params) {
        if (params?.text) el.setPlaceholder(params.text);
      }
    },
    'z-ticker': {
      setItems(el, params) {
        if (params?.items) el.setItems(params.items);
      },
      updateItem(el, params) {
        if (params?.label && params?.value) {
          el.updateItem(params.label, params.value, params.trend, params.trendValue);
        }
      },
      addItem(el, params) {
        if (params) el.addItem(params);
      }
    }
  });

  // Register agent descriptions
  Object.assign(Zephyr.agent._descriptions, {
    stream: 'Activity stream — append-only scrolling container for timestamped entries',
    streamEntry: 'Individual entry in the activity stream with type, status, collapse',
    command: 'Unified command/chat input bar with history and mode detection',
    ticker: 'Horizontal scrolling ticker strip for live data (prices, stats)'
  });

  // Extend tracked state attributes
  Zephyr.agent._stateAttrs.push(
    'data-type', 'data-status', 'data-collapsed', 'data-pinned',
    'data-timestamp', 'data-source', 'data-mode', 'data-filter', 'data-filtered'
  );

  // -------------------------------------------------------------------------
  // Zephyr.agent.stream() — Sugar for appending to a stream with components
  // -------------------------------------------------------------------------

  /**
   * Append an entry to a stream, optionally with an inline Zephyr component.
   * @param {string} streamSelector - CSS selector for the z-stream
   * @param {Object} entrySpec - Entry specification (same as z-stream.append())
   * @returns {Object} { success, entryId?, selector?, error? }
   */
  Zephyr.agent.stream = function(streamSelector, entrySpec) {
    const stream = document.querySelector(streamSelector);
    if (!stream || stream.tagName.toLowerCase() !== 'z-stream') {
      return { success: false, error: 'Stream not found: ' + streamSelector };
    }

    const id = entrySpec.id || 'entry-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    entrySpec.id = id;

    try {
      const entry = stream.append(entrySpec);
      return { success: true, entryId: id, selector: '#' + id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // -------------------------------------------------------------------------
  // Data Source API — Pull-based data loop for live updates
  // -------------------------------------------------------------------------

  /** @private Registered data sources. */
  Zephyr.agent._sources = new Map();

  /** @private Active source intervals. */
  Zephyr.agent._sourceIntervals = new Map();

  /** @private Source→component connections. */
  Zephyr.agent._sourceConnections = new Map();

  /**
   * Register a data source that polls on an interval.
   * @param {string} name - Source identifier
   * @param {Object} config
   * @param {number} config.interval - Polling interval in ms
   * @param {Function} config.fetch - Async function returning data
   * @param {Function} [config.transform] - Optional transform before delivery
   */
  Zephyr.agent.registerSource = function(name, config) {
    Zephyr.agent._sources.set(name, config);
    if (!Zephyr.agent._sourceConnections.has(name)) {
      Zephyr.agent._sourceConnections.set(name, []);
    }

    // Start polling
    if (Zephyr.agent._sourceIntervals.has(name)) {
      clearInterval(Zephyr.agent._sourceIntervals.get(name));
    }

    const poll = async () => {
      try {
        let data = await config.fetch();
        if (config.transform) data = config.transform(data);

        const connections = Zephyr.agent._sourceConnections.get(name) || [];
        for (const conn of connections) {
          const el = document.querySelector(conn.selector);
          if (el && typeof el[conn.method] === 'function') {
            el[conn.method](data);
          }
        }
      } catch (err) {
        // Silent failure — sources are best-effort
      }
    };

    // Initial fetch
    poll();

    const intervalId = setInterval(poll, config.interval);
    Zephyr.agent._sourceIntervals.set(name, intervalId);
  };

  /**
   * Connect a data source to a component method.
   * @param {string} sourceId - Registered source name
   * @param {string} selector - CSS selector for the target component
   * @param {string} method - Method name to call with data
   */
  Zephyr.agent.connectSource = function(sourceId, selector, method) {
    if (!Zephyr.agent._sourceConnections.has(sourceId)) {
      Zephyr.agent._sourceConnections.set(sourceId, []);
    }
    Zephyr.agent._sourceConnections.get(sourceId).push({ selector, method });
  };

  /**
   * Unregister a data source and stop polling.
   * @param {string} name
   */
  Zephyr.agent.removeSource = function(name) {
    if (Zephyr.agent._sourceIntervals.has(name)) {
      clearInterval(Zephyr.agent._sourceIntervals.get(name));
      Zephyr.agent._sourceIntervals.delete(name);
    }
    Zephyr.agent._sources.delete(name);
    Zephyr.agent._sourceConnections.delete(name);
  };
}

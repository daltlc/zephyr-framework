/**
 * Zephyr A2UI Renderer — zephyr-a2ui.js
 *
 * A client-side renderer for Google's A2UI (Agent-to-UI) protocol v0.8:
 *   https://a2ui.org/specification/v0.8-a2ui/
 *
 * A2UI agents stream declarative UI as JSONL messages (surfaceUpdate,
 * dataModelUpdate, beginRendering). This renderer consumes those messages and
 * builds real DOM — using Zephyr components where they fit (z-modal,
 * z-datepicker) and accessible native elements everywhere else. It is the
 * "other half" of zephyr-a2ui-catalog.json: the catalog tells agents what
 * Zephyr can render; this file does the rendering.
 *
 * Usage:
 *   <script src="zephyr-framework.js"></script>
 *   <script src="zephyr-a2ui.js"></script>
 *   <script>
 *     const surface = Zephyr.a2ui.createSurface('#output', {
 *       onAction(userAction) {
 *         // forward to the agent (A2A message, fetch, websocket, …)
 *       }
 *     });
 *     surface.handleMessage(jsonlLineOrObject);  // per streamed message
 *     // or: surface.processStream(jsonlText);   // a batch of JSONL lines
 *   </script>
 *
 * Security: all agent-supplied text lands via textContent (never innerHTML),
 * and URLs are restricted to http(s)/data schemes — consistent with the
 * framework's content trust model.
 */

'use strict';

(function () {
  if (typeof window === 'undefined' || !window.Zephyr) {
    console.warn('[zephyr-a2ui] zephyr-framework.js must be loaded first.');
    return;
  }

  // -------------------------------------------------------------------------
  // Data model helpers
  // -------------------------------------------------------------------------

  /** Splits an A2UI data path ("/user/name" or "user/name") into segments. */
  function pathSegments(path) {
    return String(path || '').split('/').filter(Boolean);
  }

  function getPath(obj, path) {
    let cur = obj;
    for (const seg of pathSegments(path)) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[seg];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    const segs = pathSegments(path);
    if (!segs.length) return;
    let cur = obj;
    for (let i = 0; i < segs.length - 1; i++) {
      if (typeof cur[segs[i]] !== 'object' || cur[segs[i]] === null) cur[segs[i]] = {};
      cur = cur[segs[i]];
    }
    cur[segs[segs.length - 1]] = value;
  }

  /**
   * Converts a dataModelUpdate `contents` adjacency list — entries of
   * { key, valueString | valueNumber | valueBoolean | valueMap } — into a
   * plain object. valueMap nests recursively. Plain values pass through so
   * lenient producers also work.
   */
  function contentsToObject(contents) {
    const out = {};
    for (const entry of contents || []) {
      if (!entry || typeof entry !== 'object' || !('key' in entry)) continue;
      if ('valueMap' in entry) out[entry.key] = contentsToObject(entry.valueMap);
      else if ('valueString' in entry) out[entry.key] = entry.valueString;
      else if ('valueNumber' in entry) out[entry.key] = entry.valueNumber;
      else if ('valueBoolean' in entry) out[entry.key] = entry.valueBoolean;
      else if ('valueArray' in entry) out[entry.key] = entry.valueArray;
      else if ('value' in entry) out[entry.key] = entry.value;
    }
    return out;
  }

  /** Only http(s) and data URLs may reach src/href attributes. */
  function safeUrl(url) {
    return /^(https?:|data:)/i.test(String(url || '')) ? String(url) : '';
  }

  // -------------------------------------------------------------------------
  // Surface
  // -------------------------------------------------------------------------

  class A2uiSurface {
    constructor(container, options) {
      this._container = container;
      this._options = options || {};
      this._components = new Map();   // id → component spec ({ Text: {...} })
      this._dataModel = {};
      this._root = null;
      this._ready = false;            // set by beginRendering
      this._bindings = [];            // live { el, apply } pairs for path-bound text
      this.surfaceId = this._options.surfaceId || null;
    }

    /**
     * Handles one A2UI server message (a parsed object or a raw JSONL line).
     * Returns { success, error? } rather than throwing — agent streams are
     * untrusted input.
     */
    handleMessage(msg) {
      try {
        if (typeof msg === 'string') {
          const line = msg.trim();
          if (!line) return { success: true };
          msg = JSON.parse(line);
        }
        if (msg.surfaceUpdate) this._onSurfaceUpdate(msg.surfaceUpdate);
        else if (msg.dataModelUpdate) this._onDataModelUpdate(msg.dataModelUpdate);
        else if (msg.beginRendering) this._onBeginRendering(msg.beginRendering);
        else return { success: false, error: 'Unknown A2UI message: ' + Object.keys(msg).join(', ') };
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    /** Processes a chunk of JSONL text (one message per line). */
    processStream(text) {
      return String(text).split('\n').map(line => this.handleMessage(line));
    }

    /** Current data model (read-only by convention). */
    get dataModel() {
      return this._dataModel;
    }

    // --- message handlers ---------------------------------------------------

    _onSurfaceUpdate(update) {
      if (update.surfaceId && !this.surfaceId) this.surfaceId = update.surfaceId;
      for (const c of update.components || []) {
        if (c && c.id && c.component) this._components.set(c.id, c.component);
      }
      if (this._ready) this._render();
    }

    _onDataModelUpdate(update) {
      if (update.surfaceId && !this.surfaceId) this.surfaceId = update.surfaceId;
      const value = Array.isArray(update.contents)
        ? contentsToObject(update.contents)
        : update.contents;
      if (update.path && pathSegments(update.path).length) {
        setPath(this._dataModel, update.path, value);
      } else if (value && typeof value === 'object') {
        Object.assign(this._dataModel, value);
      }
      // Data-only changes refresh bound nodes in place — no full re-render,
      // so input focus survives
      if (this._ready) this._refreshBindings();
    }

    _onBeginRendering(msg) {
      if (msg.surfaceId && !this.surfaceId) this.surfaceId = msg.surfaceId;
      this._root = msg.root;
      this._ready = true;
      this._render();
    }

    // --- binding ------------------------------------------------------------

    /**
     * Resolves an A2UI BoundValue ({ literalString | literalNumber |
     * literalBoolean | literalArray | path }) against the data model.
     * Relative paths resolve against `scope` (template item data) first.
     */
    _resolve(bound, scope) {
      if (bound == null || typeof bound !== 'object') return bound;
      if ('path' in bound) {
        const isRelative = !String(bound.path).startsWith('/');
        let v;
        if (isRelative && scope !== undefined) v = getPath(scope, bound.path);
        if (v === undefined) v = getPath(this._dataModel, bound.path);
        if (v !== undefined) return v;
      }
      if ('literalString' in bound) return bound.literalString;
      if ('literalNumber' in bound) return bound.literalNumber;
      if ('literalBoolean' in bound) return bound.literalBoolean;
      if ('literalArray' in bound) return bound.literalArray;
      return undefined;
    }

    /** Registers a live binding so dataModelUpdate refreshes the node in place. */
    _bind(el, bound, scope, apply) {
      if (bound && typeof bound === 'object' && 'path' in bound) {
        this._bindings.push({ el, apply: () => apply(this._resolve(bound, scope)) });
      }
    }

    _refreshBindings() {
      this._bindings = this._bindings.filter(b => b.el.isConnected);
      for (const b of this._bindings) b.apply();
    }

    /** Sends a userAction message to the host app via the onAction callback. */
    _emitAction(action, sourceComponentId, scope) {
      const context = {};
      for (const entry of action.context || []) {
        if (entry && entry.key) context[entry.key] = this._resolve(entry.value, scope);
      }
      const userAction = {
        name: action.name,
        surfaceId: this.surfaceId || 'default',
        sourceComponentId,
        timestamp: new Date().toISOString(),
        context
      };
      if (typeof this._options.onAction === 'function') {
        this._options.onAction(userAction);
      }
      this._container.dispatchEvent(new CustomEvent('a2ui-action', {
        bubbles: true, detail: userAction
      }));
    }

    // --- rendering ----------------------------------------------------------

    _render() {
      if (!this._root) return;
      this._bindings = [];
      this._container.textContent = '';
      const rootEl = this._build(this._root, undefined);
      if (rootEl) this._container.appendChild(rootEl);
    }

    /** Builds the DOM element for a component id (recursive). */
    _build(id, scope) {
      const spec = this._components.get(id);
      if (!spec) return null;
      const type = Object.keys(spec)[0];
      const props = spec[type] || {};
      const renderer = Zephyr.a2ui.renderers[type] || Zephyr.a2ui.renderers.__unknown;
      const el = renderer(props, { surface: this, id, scope, type });
      if (el) el.setAttribute('data-a2ui-id', id);
      return el;
    }

    /** Appends a container's children (explicitList or template) to el. */
    _appendChildren(el, children, scope) {
      if (!children) return;
      if (Array.isArray(children.explicitList)) {
        for (const childId of children.explicitList) {
          const child = this._build(childId, scope);
          if (child) el.appendChild(child);
        }
      } else if (children.template) {
        const items = this._resolve({ path: children.template.dataBinding }, scope);
        if (Array.isArray(items)) {
          for (const item of items) {
            const child = this._build(children.template.componentId, item);
            if (child) el.appendChild(child);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Renderer registry (A2UI standard catalog → DOM / Zephyr components)
  // Extend or override via Zephyr.a2ui.renderers — the "widget registry"
  // from the A2UI client implementation guide.
  // -------------------------------------------------------------------------

  function flexbox(direction, props, ctx) {
    const el = document.createElement('div');
    el.style.display = 'flex';
    el.style.flexDirection = direction;
    el.style.gap = '0.5rem';
    const align = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }[props.alignment];
    if (align) el.style.alignItems = align;
    ctx.surface._appendChildren(el, props.children, ctx.scope);
    return el;
  }

  /** Shared helper for two-way bound form inputs. */
  function bindInput(input, props, key, ctx, readValue) {
    const bound = props[key];
    const initial = ctx.surface._resolve(bound, ctx.scope);
    if (initial !== undefined) {
      if (input.type === 'checkbox') input.checked = Boolean(initial);
      else input.value = String(initial);
    }
    ctx.surface._bind(input, bound, ctx.scope, (v) => {
      if (input.type === 'checkbox') input.checked = Boolean(v);
      else if (document.activeElement !== input) input.value = v == null ? '' : String(v);
    });
    if (bound && typeof bound === 'object' && bound.path) {
      input.addEventListener('input', () => {
        setPath(ctx.surface._dataModel, bound.path, readValue(input));
      });
    }
  }

  function labelled(labelText, input) {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.flexDirection = input.type === 'checkbox' ? 'row' : 'column';
    label.style.gap = '0.25rem';
    const span = document.createElement('span');
    span.textContent = labelText || '';
    if (input.type === 'checkbox') label.append(input, span);
    else label.append(span, input);
    return label;
  }

  const renderers = {
    Text(props, ctx) {
      const hint = String(props.usageHint || '');
      const el = document.createElement(/^h[1-6]$/.test(hint) ? hint : 'p');
      el.style.margin = '0';
      const apply = (v) => { el.textContent = v == null ? '' : String(v); };
      apply(ctx.surface._resolve(props.text, ctx.scope));
      ctx.surface._bind(el, props.text, ctx.scope, apply);
      return el;
    },

    Image(props, ctx) {
      const el = document.createElement('img');
      el.src = safeUrl(ctx.surface._resolve(props.url, ctx.scope));
      el.alt = String(ctx.surface._resolve(props.altText, ctx.scope) || '');
      el.style.maxWidth = '100%';
      return el;
    },

    Video(props, ctx) {
      const el = document.createElement('video');
      el.src = safeUrl(ctx.surface._resolve(props.url, ctx.scope));
      el.controls = true;
      el.style.maxWidth = '100%';
      return el;
    },

    AudioPlayer(props, ctx) {
      const el = document.createElement('audio');
      el.src = safeUrl(ctx.surface._resolve(props.url, ctx.scope));
      el.controls = true;
      return el;
    },

    Row(props, ctx) { return flexbox('row', props, ctx); },
    Column(props, ctx) { return flexbox('column', props, ctx); },
    List(props, ctx) { return flexbox('column', props, ctx); },

    Card(props, ctx) {
      const el = document.createElement('section');
      el.className = 'z-a2ui-card';
      if (props.child) {
        const child = ctx.surface._build(props.child, ctx.scope);
        if (child) el.appendChild(child);
      }
      ctx.surface._appendChildren(el, props.children, ctx.scope);
      return el;
    },

    Divider() {
      return document.createElement('hr');
    },

    Button(props, ctx) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'z-a2ui-button';
      if (props.child) {
        const child = ctx.surface._build(props.child, ctx.scope);
        if (child) el.appendChild(child);
      } else {
        el.textContent = String(ctx.surface._resolve(props.label, ctx.scope) || 'Button');
      }
      if (props.action) {
        el.addEventListener('click', () => ctx.surface._emitAction(props.action, ctx.id, ctx.scope));
      }
      return el;
    },

    TextField(props, ctx) {
      const input = document.createElement('input');
      input.type = 'text';
      bindInput(input, props, 'text', ctx, (i) => i.value);
      return labelled(ctx.surface._resolve(props.label, ctx.scope), input);
    },

    Checkbox(props, ctx) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      bindInput(input, props, 'value', ctx, (i) => i.checked);
      return labelled(ctx.surface._resolve(props.label, ctx.scope), input);
    },

    Slider(props, ctx) {
      const input = document.createElement('input');
      input.type = 'range';
      if (props.minValue != null) input.min = ctx.surface._resolve(props.minValue, ctx.scope);
      if (props.maxValue != null) input.max = ctx.surface._resolve(props.maxValue, ctx.scope);
      bindInput(input, props, 'value', ctx, (i) => Number(i.value));
      return labelled(ctx.surface._resolve(props.label, ctx.scope), input);
    },

    DateTimeInput(props, ctx) {
      const input = document.createElement('input');
      input.type = props.enableTime ? 'datetime-local' : 'date';
      bindInput(input, props, 'value', ctx, (i) => i.value);
      return labelled(ctx.surface._resolve(props.label, ctx.scope), input);
    },

    MultipleChoice(props, ctx) {
      const select = document.createElement('select');
      for (const opt of props.options || []) {
        const option = document.createElement('option');
        option.value = String(ctx.surface._resolve(opt.value, ctx.scope) ?? '');
        option.textContent = String(ctx.surface._resolve(opt.label, ctx.scope) ?? option.value);
        select.appendChild(option);
      }
      bindInput(select, props, 'selection', ctx, (i) => i.value);
      return labelled(ctx.surface._resolve(props.label, ctx.scope), select);
    },

    Modal(props, ctx) {
      // Render with Zephyr's modal when available so agents get the native
      // dialog behavior (backdrop, Escape, focus handling)
      const el = document.createElement(window.customElements.get('z-modal') ? 'z-modal' : 'div');
      if (props.child) {
        const child = ctx.surface._build(props.child, ctx.scope);
        if (child) el.appendChild(child);
      }
      ctx.surface._appendChildren(el, props.children, ctx.scope);
      return el;
    },

    /** Fallback for catalog types without a registered renderer. */
    __unknown(props, ctx) {
      const el = document.createElement('div');
      el.setAttribute('data-a2ui-type', ctx.type);
      if (props.child) {
        const child = ctx.surface._build(props.child, ctx.scope);
        if (child) el.appendChild(child);
      }
      ctx.surface._appendChildren(el, props.children, ctx.scope);
      return el;
    }
  };

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  Zephyr.a2ui = {
    /** Renderer registry — extend with custom catalog components. */
    renderers,

    /**
     * Creates an A2UI surface bound to a container element.
     * @param {string|Element} container - CSS selector or element
     * @param {Object} [options]
     * @param {function(Object)} [options.onAction] - Receives userAction messages
     * @param {string} [options.surfaceId] - Explicit surface id
     * @returns {A2uiSurface}
     */
    createSurface(container, options) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) throw new Error('[zephyr-a2ui] Container not found: ' + container);
      return new A2uiSurface(el, options);
    }
  };
})();

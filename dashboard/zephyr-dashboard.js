/**
 * Zephyr Dashboard — Optional add-on for data-dense dashboard UIs
 * Provides z-stat, z-data-grid, z-chart, z-dashboard, and z-dashboard-panel components.
 * Requires zephyr-framework.js to be loaded first.
 *
 * @description Extends the core Zephyr framework with dashboard-oriented components
 * for agent-composed data interfaces. Each component integrates with Zephyr.agent
 * for full AI agent control.
 */

// ---------------------------------------------------------------------------
// z-stat — KPI stat card with label, value, and trend indicator
// ---------------------------------------------------------------------------

/**
 * Stat card component for displaying a single KPI with trend.
 * Dispatches 'change' events when value updates.
 * @example
 * <z-stat data-label="BTC Price" data-value="$67,234" data-trend="up" data-trend-value="+2.4%"></z-stat>
 */
class ZStat extends ZephyrElement {
  static observedAttributes = ['data-label', 'data-value', 'data-trend', 'data-trend-value'];

  attachTemplate() {
    this.setAttribute('role', 'status');
    this.setAttribute('aria-live', 'polite');

    this._labelEl = document.createElement('div');
    this._labelEl.classList.add('z-stat-label');

    this._valueEl = document.createElement('div');
    this._valueEl.classList.add('z-stat-value');

    this._trendEl = document.createElement('div');
    this._trendEl.classList.add('z-stat-trend');

    this.appendChild(this._labelEl);
    this.appendChild(this._valueEl);
    this.appendChild(this._trendEl);

    this._syncFromAttributes();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (this._labelEl) this._syncFromAttributes();
  }

  _syncFromAttributes() {
    this._labelEl.textContent = this.dataset.label || '';
    this._valueEl.textContent = this.dataset.value || '';
    const trendVal = this.dataset.trendValue || '';
    const trend = this.dataset.trend || 'neutral';
    const arrow = trend === 'up' ? '\u25B2' : trend === 'down' ? '\u25BC' : '';
    this._trendEl.textContent = arrow + (arrow && trendVal ? ' ' : '') + trendVal;

    this.setAttribute('aria-label',
      (this.dataset.label || '') + ': ' +
      (this.dataset.value || '') +
      (trendVal ? ' (' + trendVal + ')' : '')
    );
  }

  /**
   * Updates the stat value and trend.
   * @param {string} value - Display value
   * @param {string} [trend] - 'up', 'down', or 'neutral'
   * @param {string} [trendValue] - Trend text (e.g., "+2.4%")
   */
  setValue(value, trend, trendValue) {
    if (value !== undefined) this.setAttribute('data-value', value);
    if (trend !== undefined) this.setAttribute('data-trend', trend);
    if (trendValue !== undefined) this.setAttribute('data-trend-value', trendValue);
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value, trend, trendValue } }));
  }
}

// ---------------------------------------------------------------------------
// z-dashboard-panel — Individual panel within a dashboard grid
// ---------------------------------------------------------------------------

/**
 * Dashboard panel container. Used as a child of z-dashboard.
 * @example
 * <z-dashboard-panel data-panel="chart-1" data-colspan="2" data-title="Price Chart">
 *   <z-chart data-type="line"></z-chart>
 * </z-dashboard-panel>
 */
class ZDashboardPanel extends HTMLElement {
  connectedCallback() {
    this.setAttribute('role', 'group');
    if (this.dataset.title) {
      this.setAttribute('aria-label', this.dataset.title);
      // Add a visible title header if one doesn't exist
      if (!this.querySelector('.z-panel-title')) {
        const title = document.createElement('div');
        title.classList.add('z-panel-title');
        title.textContent = this.dataset.title;
        this.insertBefore(title, this.firstChild);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// z-dashboard — Responsive grid layout container for dashboard panels
// ---------------------------------------------------------------------------

/**
 * Dashboard layout component using CSS Grid.
 * Arranges z-dashboard-panel children in a responsive grid.
 * Dispatches 'panel-add' and 'panel-remove' events.
 * @example
 * <z-dashboard data-columns="3">
 *   <z-dashboard-panel data-panel="stats" data-colspan="2">...</z-dashboard-panel>
 * </z-dashboard>
 */
class ZDashboard extends ZephyrElement {
  attachTemplate() {
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Dashboard');

    const cols = this.dataset.columns || '3';
    const gap = this.dataset.gap || '1rem';
    this.style.setProperty('--z-dashboard-columns', cols);
    this.style.setProperty('--z-dashboard-gap', gap);
  }

  /**
   * Adds a new panel to the dashboard.
   * @param {Object} config - Panel configuration
   * @param {string} config.id - Panel identifier (set as data-panel)
   * @param {number} [config.colspan] - Column span
   * @param {number} [config.rowspan] - Row span
   * @param {string} [config.title] - Panel title
   * @param {number} [config.position] - Insert position index
   * @returns {ZDashboardPanel} The created panel element
   */
  addPanel(config) {
    const panel = document.createElement('z-dashboard-panel');
    panel.setAttribute('data-panel', config.id);
    if (config.colspan) panel.setAttribute('data-colspan', String(config.colspan));
    if (config.rowspan) panel.setAttribute('data-rowspan', String(config.rowspan));
    if (config.title) panel.setAttribute('data-title', config.title);

    if (typeof config.position === 'number' && config.position < this.children.length) {
      this.insertBefore(panel, this.children[config.position]);
    } else {
      this.appendChild(panel);
    }

    this.dispatchEvent(new CustomEvent('panel-add', { bubbles: true, detail: { id: config.id } }));
    return panel;
  }

  /**
   * Removes a panel by its data-panel id.
   * @param {string} id - The panel's data-panel value
   */
  removePanel(id) {
    const panel = this.querySelector(`[data-panel="${id}"]`);
    if (panel) {
      panel.remove();
      this.dispatchEvent(new CustomEvent('panel-remove', { bubbles: true, detail: { id } }));
    }
  }

  /**
   * Moves a panel to a new position.
   * @param {string} id - The panel's data-panel value
   * @param {number} position - New position index
   */
  movePanel(id, position) {
    const panel = this.querySelector(`[data-panel="${id}"]`);
    if (!panel) return;
    panel.remove();
    if (position < this.children.length) {
      this.insertBefore(panel, this.children[position]);
    } else {
      this.appendChild(panel);
    }
  }
}

// ---------------------------------------------------------------------------
// z-data-grid — Sortable, filterable data table
// ---------------------------------------------------------------------------

/**
 * Data grid component with sorting and filtering.
 * Dispatches 'sort', 'filter', and 'select' events.
 * Uses textContent for all cell values (XSS-safe).
 * @example
 * <z-data-grid id="my-grid"></z-data-grid>
 * <script>
 *   const grid = document.getElementById('my-grid');
 *   grid.setColumns([{ key: 'name', label: 'Name', sortable: true }]);
 *   grid.setRows([{ name: 'Alice' }, { name: 'Bob' }]);
 * </script>
 */
class ZDataGrid extends ZephyrElement {
  attachTemplate() {
    this._columns = [];
    this._rows = [];
    this._filteredRows = [];
    this._sortColumn = null;
    this._sortDirection = 'none';
    this._filterQuery = '';

    // Build DOM structure
    this._toolbar = document.createElement('div');
    this._toolbar.classList.add('z-grid-toolbar');
    this._filterInput = document.createElement('input');
    this._filterInput.type = 'text';
    this._filterInput.placeholder = 'Filter...';
    this._filterInput.classList.add('z-grid-filter');
    this._filterInput.setAttribute('aria-label', 'Filter table');
    this._filterInput.addEventListener('input', () => {
      this._filterQuery = this._filterInput.value;
      this._applyFilter();
    });
    this._toolbar.appendChild(this._filterInput);

    this._headerEl = document.createElement('div');
    this._headerEl.classList.add('z-grid-header');
    this._headerEl.setAttribute('role', 'row');

    this._bodyEl = document.createElement('div');
    this._bodyEl.classList.add('z-grid-body');
    this._bodyEl.setAttribute('role', 'rowgroup');

    this._footerEl = document.createElement('div');
    this._footerEl.classList.add('z-grid-footer');

    this.setAttribute('role', 'table');
    this.appendChild(this._toolbar);
    this.appendChild(this._headerEl);
    this.appendChild(this._bodyEl);
    this.appendChild(this._footerEl);
  }

  /**
   * Sets the column definitions.
   * @param {Array<{key: string, label: string, sortable?: boolean, width?: string, align?: string}>} columns
   */
  setColumns(columns) {
    this._columns = columns;
    this._renderHeader();
    this._renderRows();
  }

  /**
   * Sets the row data.
   * @param {Array<Object>} rows - Array of data objects keyed by column key
   */
  setRows(rows) {
    this._rows = rows;
    this._applyFilter();
  }

  /**
   * Sorts by a column.
   * @param {string} column - Column key
   * @param {string} [direction='asc'] - 'asc' or 'desc'
   */
  sort(column, direction) {
    this._sortColumn = column;
    this._sortDirection = direction || 'asc';
    this.setAttribute('data-sort-column', column);
    this.setAttribute('data-sort-direction', this._sortDirection);

    this._filteredRows.sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return this._sortDirection === 'desc' ? -cmp : cmp;
    });

    this._renderRows();
    this._renderHeader(); // Update sort indicators
    this.dispatchEvent(new CustomEvent('sort', { bubbles: true, detail: { column, direction: this._sortDirection } }));
  }

  /**
   * Filters rows by a query string (matches against all string columns).
   * @param {string} query - Filter text
   */
  filter(query) {
    this._filterQuery = query || '';
    this._filterInput.value = this._filterQuery;
    this._applyFilter();
  }

  _applyFilter() {
    const q = this._filterQuery.toLowerCase();
    this._filteredRows = q
      ? this._rows.filter(row =>
          this._columns.some(col => {
            const val = row[col.key];
            return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
          })
        )
      : [...this._rows];

    // Re-apply sort
    if (this._sortColumn) {
      this._filteredRows.sort((a, b) => {
        const aVal = a[this._sortColumn];
        const bVal = b[this._sortColumn];
        const cmp = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
        return this._sortDirection === 'desc' ? -cmp : cmp;
      });
    }

    this.setAttribute('data-row-count', String(this._filteredRows.length));
    this._renderRows();
    this._footerEl.textContent = this._filteredRows.length + ' of ' + this._rows.length + ' rows';

    if (this._filterQuery) {
      this.dispatchEvent(new CustomEvent('filter', { bubbles: true, detail: { query: this._filterQuery, count: this._filteredRows.length } }));
    }
  }

  _renderHeader() {
    this._headerEl.textContent = '';
    for (const col of this._columns) {
      const cell = document.createElement('div');
      cell.classList.add('z-grid-cell', 'z-grid-header-cell');
      cell.setAttribute('role', 'columnheader');
      cell.setAttribute('data-column', col.key);
      if (col.width) cell.style.width = col.width;
      if (col.align) cell.style.textAlign = col.align;

      cell.textContent = col.label || col.key;

      if (this._sortColumn === col.key) {
        cell.setAttribute('data-sort', this._sortDirection);
        cell.setAttribute('aria-sort', this._sortDirection === 'asc' ? 'ascending' : 'descending');
      } else {
        cell.removeAttribute('data-sort');
        cell.setAttribute('aria-sort', 'none');
      }

      if (col.sortable !== false) {
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
          const newDir = this._sortColumn === col.key && this._sortDirection === 'asc' ? 'desc' : 'asc';
          this.sort(col.key, newDir);
        });
      }

      this._headerEl.appendChild(cell);
    }
  }

  _renderRows() {
    this._bodyEl.textContent = '';
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < this._filteredRows.length; i++) {
      const row = this._filteredRows[i];
      const rowEl = document.createElement('div');
      rowEl.classList.add('z-grid-row');
      rowEl.setAttribute('role', 'row');
      rowEl.setAttribute('data-index', String(i));

      for (const col of this._columns) {
        const cell = document.createElement('div');
        cell.classList.add('z-grid-cell');
        cell.setAttribute('role', 'cell');
        if (col.width) cell.style.width = col.width;
        if (col.align) cell.style.textAlign = col.align;

        const val = row[col.key];
        cell.textContent = val !== null && val !== undefined ? String(val) : '';
        rowEl.appendChild(cell);
      }

      fragment.appendChild(rowEl);
    }

    this._bodyEl.appendChild(fragment);
  }

  _cleanup() {
    super._cleanup();
    this._columns = [];
    this._rows = [];
    this._filteredRows = [];
  }
}

// ---------------------------------------------------------------------------
// z-chart — Lightweight-charts wrapper for financial/time-series charts
// ---------------------------------------------------------------------------

/**
 * Chart component wrapping TradingView's lightweight-charts library.
 * Loads the library lazily from CDN on first use.
 * Supports candlestick, line, area, and histogram chart types.
 * @example
 * <z-chart data-type="line" data-title="Temperature"></z-chart>
 */
class ZChart extends ZephyrElement {
  /** @private Shared promise for library loading — only one script tag ever created. */
  static _libraryReady = null;

  static _loadLibrary() {
    if (ZChart._libraryReady) return ZChart._libraryReady;
    if (window.LightweightCharts) {
      ZChart._libraryReady = Promise.resolve();
      return ZChart._libraryReady;
    }
    ZChart._libraryReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lightweight-charts@4/dist/lightweight-charts.standalone.production.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load lightweight-charts'));
      document.head.appendChild(script);
    });
    return ZChart._libraryReady;
  }

  attachTemplate() {
    this._container = document.createElement('div');
    this._container.classList.add('z-chart-container');
    this.appendChild(this._container);

    this._chart = null;
    this._series = null;
    this._additionalSeries = [];

    ZChart._loadLibrary()
      .then(() => this._initChart())
      .catch(() => {
        this._container.textContent = 'Chart library unavailable';
        this._container.classList.add('z-chart-fallback');
      });
  }

  _initChart() {
    if (!window.LightweightCharts || !this._container) return;

    const isDark = document.documentElement.dataset.theme === 'dark' ||
      getComputedStyle(document.documentElement).getPropertyValue('--midnight').trim();

    const { createChart } = window.LightweightCharts;
    this._chart = createChart(this._container, {
      width: this._container.clientWidth,
      height: parseInt(this.dataset.height) || 300,
      layout: {
        textColor: isDark ? '#9ba3bf' : '#333',
        background: { type: 'solid', color: 'transparent' },
        fontFamily: 'inherit'
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        timeVisible: true
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
      },
      crosshair: {
        mode: 0 // Normal
      }
    });

    this._series = this._createSeries(this.dataset.type || 'line');

    // If data was set before chart initialized, apply it now
    if (this._pendingData) {
      this._series.setData(this._pendingData);
      this._pendingData = null;
    }

    this._resizeObserver = new ResizeObserver(() => {
      if (this._chart && this._container) {
        this._chart.applyOptions({ width: this._container.clientWidth });
      }
    });
    this._resizeObserver.observe(this._container);
  }

  _createSeries(type) {
    if (!this._chart) return null;
    const opts = {};
    switch (type) {
      case 'candlestick':
        return this._chart.addCandlestickSeries({
          upColor: '#22c55e', downColor: '#ef4444',
          borderUpColor: '#22c55e', borderDownColor: '#ef4444',
          wickUpColor: '#22c55e', wickDownColor: '#ef4444'
        });
      case 'area':
        return this._chart.addAreaSeries({
          topColor: 'rgba(99, 102, 241, 0.4)',
          bottomColor: 'rgba(99, 102, 241, 0.02)',
          lineColor: '#6366f1', lineWidth: 2
        });
      case 'histogram':
        return this._chart.addHistogramSeries({
          color: '#6366f1'
        });
      case 'line':
      default:
        return this._chart.addLineSeries({
          color: '#6366f1', lineWidth: 2
        });
    }
  }

  /**
   * Changes the chart type by recreating the series.
   * @param {string} type - 'candlestick', 'line', 'area', or 'histogram'
   */
  setType(type) {
    if (!this._chart) {
      this.setAttribute('data-type', type);
      return;
    }

    // Store current data
    let currentData = null;
    if (this._series) {
      try { currentData = this._series.data(); } catch (_) { /* no data */ }
      this._chart.removeSeries(this._series);
    }

    this.setAttribute('data-type', type);
    this._series = this._createSeries(type);

    if (currentData && currentData.length && this._series) {
      this._series.setData(currentData);
    }
  }

  /**
   * Sets the chart data.
   * @param {Array} data - Array of { time, value } or { time, open, high, low, close }
   */
  setData(data) {
    if (!this._series) {
      this._pendingData = data;
      return;
    }
    this._series.setData(data);
    this._chart.timeScale().fitContent();
  }

  /**
   * Appends a single data point for real-time updates.
   * @param {Object} point - Data point { time, value } or { time, open, high, low, close }
   */
  addPoint(point) {
    if (!this._series) return;
    this._series.update(point);
  }

  /**
   * Adds an additional series overlay.
   * @param {Object} config - { type, data, options }
   * @returns {Object|null} The created series
   */
  addSeries(config) {
    if (!this._chart) return null;
    const series = this._createSeries(config.type || 'line');
    if (config.options && series) {
      series.applyOptions(config.options);
    }
    if (config.data && series) {
      series.setData(config.data);
    }
    this._additionalSeries.push(series);
    return series;
  }

  /**
   * Sets the visible time range.
   * @param {number} from - Start timestamp (seconds)
   * @param {number} to - End timestamp (seconds)
   */
  setTimeRange(from, to) {
    if (!this._chart) return;
    this._chart.timeScale().setVisibleRange({ from, to });
  }

  _cleanup() {
    super._cleanup();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._chart) {
      this._chart.remove();
      this._chart = null;
    }
    this._series = null;
    this._additionalSeries = [];
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

customElements.define('z-stat', ZStat);
customElements.define('z-dashboard-panel', ZDashboardPanel);
customElements.define('z-dashboard', ZDashboard);
customElements.define('z-data-grid', ZDataGrid);
customElements.define('z-chart', ZChart);

// ---------------------------------------------------------------------------
// Extend Zephyr.components registry and agent API
// ---------------------------------------------------------------------------

if (window.Zephyr) {
  // Register new components in the registry
  Object.assign(Zephyr.components, {
    stat: {
      tag: 'z-stat',
      slots: [],
      attributes: ['data-label', 'data-value', 'data-trend', 'data-trend-value'],
      events: ['change'],
      methods: ['setValue(value, trend, trendValue)']
    },
    dashboard: {
      tag: 'z-dashboard',
      slots: [],
      attributes: ['data-columns', 'data-gap'],
      events: ['panel-add', 'panel-remove'],
      methods: ['addPanel(config)', 'removePanel(id)', 'movePanel(id, position)']
    },
    dataGrid: {
      tag: 'z-data-grid',
      slots: [],
      attributes: ['data-sort-column', 'data-sort-direction', 'data-row-count'],
      events: ['sort', 'filter', 'select'],
      methods: ['setColumns(columns)', 'setRows(rows)', 'sort(column, direction)', 'filter(query)']
    },
    chart: {
      tag: 'z-chart',
      slots: [],
      attributes: ['data-type', 'data-title', 'data-height'],
      events: ['click'],
      methods: ['setType(type)', 'setData(data)', 'addPoint(point)', 'addSeries(config)', 'setTimeRange(from, to)']
    }
  });

  // Register agent actions
  Object.assign(Zephyr.agent._actions, {
    'z-stat': {
      setValue(el, params) {
        el.setValue(params?.value, params?.trend, params?.trendValue);
      },
      setLabel(el, params) {
        if (params?.label) el.setAttribute('data-label', params.label);
      }
    },
    'z-dashboard': {
      addPanel(el, params) {
        el.addPanel(params || {});
      },
      removePanel(el, params) {
        if (params?.id) el.removePanel(params.id);
      },
      movePanel(el, params) {
        if (params?.id !== undefined && params?.position !== undefined) {
          el.movePanel(params.id, params.position);
        }
      },
      setColumns(el, params) {
        if (params?.columns) {
          el.setAttribute('data-columns', String(params.columns));
          el.style.setProperty('--z-dashboard-columns', String(params.columns));
        }
      }
    },
    'z-data-grid': {
      setColumns(el, params) {
        if (params?.columns) el.setColumns(params.columns);
      },
      setRows(el, params) {
        if (params?.rows) el.setRows(params.rows);
      },
      sort(el, params) {
        if (params?.column) el.sort(params.column, params.direction);
      },
      filter(el, params) {
        el.filter(params?.query || '');
      }
    },
    'z-chart': {
      setType(el, params) {
        if (params?.type) el.setType(params.type);
      },
      setData(el, params) {
        if (params?.data) el.setData(params.data);
      },
      addPoint(el, params) {
        if (params?.point) el.addPoint(params.point);
      },
      addSeries(el, params) {
        el.addSeries(params || {});
      },
      setTimeRange(el, params) {
        if (params?.from !== undefined && params?.to !== undefined) {
          el.setTimeRange(params.from, params.to);
        }
      }
    }
  });

  // Register agent descriptions
  Object.assign(Zephyr.agent._descriptions, {
    stat: 'KPI stat card with label, value, and trend indicator',
    dashboard: 'Responsive grid layout container for dashboard panels',
    dataGrid: 'Sortable, filterable data table with virtual scrolling',
    chart: 'Chart component (candlestick, line, area, histogram) via lightweight-charts'
  });

  // Extend tracked state attributes
  Zephyr.agent._stateAttrs.push('data-trend', 'data-sort-column', 'data-sort-direction', 'data-row-count', 'data-label', 'data-trend-value');
}

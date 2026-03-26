/**
 * Zephyr Dashboard — Mock Data System
 * Demo-only file: generates realistic data for the dashboard demo page.
 * Not part of the core framework or dashboard add-on.
 */

window.ZephyrDashboardData = {
  _simulations: [],

  // -----------------------------------------------------------------------
  // Generators
  // -----------------------------------------------------------------------

  generators: {
    /**
     * Generates a time-series of { time, value } points.
     */
    timeSeries({ count = 200, start, interval = 60, baseValue = 100, volatility = 0.02, trend = 0 } = {}) {
      const startTime = start || Math.floor(Date.now() / 1000) - count * interval;
      const data = [];
      let value = baseValue;
      for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.5) * 2 * volatility * value + trend * value;
        value = Math.max(0.01, value + change);
        data.push({
          time: startTime + i * interval,
          value: parseFloat(value.toFixed(2))
        });
      }
      return data;
    },

    /**
     * Generates candlestick (OHLC) data.
     */
    candlestick({ count = 200, start, interval = 3600, baseValue = 100, volatility = 0.015 } = {}) {
      const startTime = start || Math.floor(Date.now() / 1000) - count * interval;
      const data = [];
      let prevClose = baseValue;
      for (let i = 0; i < count; i++) {
        const open = prevClose + (Math.random() - 0.5) * volatility * prevClose * 0.5;
        const range = volatility * open;
        const close = open + (Math.random() - 0.5) * range * 2;
        const high = Math.max(open, close) + Math.random() * range;
        const low = Math.min(open, close) - Math.random() * range;
        data.push({
          time: startTime + i * interval,
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(Math.max(0.01, low).toFixed(2)),
          close: parseFloat(close.toFixed(2))
        });
        prevClose = close;
      }
      return data;
    },

    /**
     * Generates a random stat value.
     */
    stat({ baseValue = 100, volatility = 0.05, format = 'number', prefix = '', suffix = '' } = {}) {
      const change = (Math.random() - 0.5) * 2 * volatility;
      const value = baseValue * (1 + change);
      const trendDir = change > 0.005 ? 'up' : change < -0.005 ? 'down' : 'neutral';
      const trendPct = (change * 100).toFixed(1);
      const trendValue = (change >= 0 ? '+' : '') + trendPct + '%';

      let formatted;
      if (format === 'currency') {
        formatted = prefix + '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
      } else if (format === 'percent') {
        formatted = prefix + value.toFixed(1) + '%' + suffix;
      } else if (format === 'integer') {
        formatted = prefix + Math.round(value).toLocaleString('en-US') + suffix;
      } else {
        formatted = prefix + value.toFixed(2) + suffix;
      }

      return { value: formatted, trend: trendDir, trendValue };
    }
  },

  // -----------------------------------------------------------------------
  // Real-time simulation
  // -----------------------------------------------------------------------

  /**
   * Starts real-time updates on a component.
   * @param {string} selector - CSS selector for the target component
   * @param {Object} config - Simulation config
   */
  simulate(selector, config = {}) {
    const el = document.querySelector(selector);
    if (!el) return;

    const interval = config.interval || 2000;
    const tag = el.tagName.toLowerCase();

    const id = setInterval(() => {
      const el = document.querySelector(selector);
      if (!el) return;

      if (tag === 'z-stat') {
        const stat = ZephyrDashboardData.generators.stat(config);
        Zephyr.agent.act(selector, 'setValue', stat);
      } else if (tag === 'z-chart') {
        const lastTime = config._lastTime || Math.floor(Date.now() / 1000);
        const lastValue = config._lastValue || config.baseValue || 100;
        const vol = config.volatility || 0.005;
        const change = (Math.random() - 0.5) * 2 * vol * lastValue;
        const newValue = Math.max(0.01, lastValue + change);
        const newTime = lastTime + (config.pointInterval || 60);

        if (config.type === 'candlestick') {
          const open = lastValue;
          const close = newValue;
          const range = vol * open;
          Zephyr.agent.act(selector, 'addPoint', {
            point: {
              time: newTime,
              open: parseFloat(open.toFixed(2)),
              high: parseFloat(Math.max(open, close, open + Math.random() * range).toFixed(2)),
              low: parseFloat(Math.max(0.01, Math.min(open, close) - Math.random() * range).toFixed(2)),
              close: parseFloat(close.toFixed(2))
            }
          });
        } else {
          Zephyr.agent.act(selector, 'addPoint', {
            point: { time: newTime, value: parseFloat(newValue.toFixed(2)) }
          });
        }

        config._lastTime = newTime;
        config._lastValue = newValue;
      } else if (tag === 'z-data-grid' && config.updateRow) {
        config.updateRow(el);
      }
    }, interval);

    ZephyrDashboardData._simulations.push({ id, selector });
  },

  /** Stops all running simulations. */
  stopAll() {
    for (const sim of ZephyrDashboardData._simulations) {
      clearInterval(sim.id);
    }
    ZephyrDashboardData._simulations = [];
  },

  // -----------------------------------------------------------------------
  // Data Themes
  // -----------------------------------------------------------------------

  themes: {
    crypto: {
      name: 'Crypto Markets',
      build(container) {
        const gen = ZephyrDashboardData.generators;

        // Generate initial data
        const btcData = gen.candlestick({ count: 200, baseValue: 67234, volatility: 0.012, interval: 3600 });
        const ethData = gen.timeSeries({ count: 200, baseValue: 3456, volatility: 0.015, interval: 3600 });
        const volumeData = gen.timeSeries({ count: 200, baseValue: 42000000, volatility: 0.3, interval: 3600 }).map(d => ({
          time: d.time,
          value: Math.abs(d.value),
          color: d.value > 42000000 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'
        }));

        const lastBtc = btcData[btcData.length - 1].close;
        const lastEth = ethData[ethData.length - 1].value;

        Zephyr.agent.compose(container, {
          tag: 'z-dashboard', id: 'dash', attributes: { 'data-columns': '4' },
          panels: [
            { id: 'btc-chart', colspan: 2, rowspan: 2, title: 'BTC / USD', component: { tag: 'z-chart', id: 'chart-btc', attributes: { 'data-type': 'candlestick', 'data-height': '340' } } },
            { id: 'btc-price', title: 'Bitcoin', component: { tag: 'z-stat', id: 'stat-btc', attributes: { 'data-label': 'BTC Price', 'data-value': '$' + lastBtc.toLocaleString('en-US', { minimumFractionDigits: 2 }), 'data-trend': 'up', 'data-trend-value': '+2.4%' } } },
            { id: 'eth-price', title: 'Ethereum', component: { tag: 'z-stat', id: 'stat-eth', attributes: { 'data-label': 'ETH Price', 'data-value': '$' + lastEth.toLocaleString('en-US', { minimumFractionDigits: 2 }), 'data-trend': 'down', 'data-trend-value': '-0.8%' } } },
            { id: 'volume', title: '24h Volume', component: { tag: 'z-stat', id: 'stat-vol', attributes: { 'data-label': '24h Volume', 'data-value': '$42.1B', 'data-trend': 'up', 'data-trend-value': '+5.2%' } } },
            { id: 'mcap', title: 'Market Cap', component: { tag: 'z-stat', id: 'stat-mcap', attributes: { 'data-label': 'Total Market Cap', 'data-value': '$2.34T', 'data-trend': 'neutral', 'data-trend-value': '+0.1%' } } },
            { id: 'eth-chart', colspan: 2, title: 'ETH / USD', component: { tag: 'z-chart', id: 'chart-eth', attributes: { 'data-type': 'area', 'data-height': '220' } } },
            { id: 'vol-chart', colspan: 2, title: 'Volume', component: { tag: 'z-chart', id: 'chart-vol', attributes: { 'data-type': 'histogram', 'data-height': '220' } } },
            { id: 'market-table', colspan: 4, title: 'Top Tokens', component: { tag: 'z-data-grid', id: 'grid-tokens' } }
          ]
        });

        // Set chart data after DOM insertion (async chart init)
        setTimeout(() => {
          const chartBtc = document.getElementById('chart-btc');
          const chartEth = document.getElementById('chart-eth');
          const chartVol = document.getElementById('chart-vol');
          if (chartBtc) chartBtc.setData(btcData);
          if (chartEth) chartEth.setData(ethData);
          if (chartVol) chartVol.setData(volumeData);
        }, 500);

        // Set grid data
        const grid = document.getElementById('grid-tokens');
        if (grid) {
          grid.setColumns([
            { key: 'rank', label: '#', width: '3rem', align: 'center' },
            { key: 'name', label: 'Name', width: '8rem' },
            { key: 'price', label: 'Price', align: 'right' },
            { key: 'change', label: '24h %', align: 'right' },
            { key: 'mcap', label: 'Market Cap', align: 'right' },
            { key: 'volume', label: 'Volume', align: 'right' }
          ]);
          const tokens = [
            { rank: 1, name: 'Bitcoin', price: '$67,234.50', change: '+2.4%', mcap: '$1.32T', volume: '$28.4B' },
            { rank: 2, name: 'Ethereum', price: '$3,456.12', change: '-0.8%', mcap: '$415.2B', volume: '$12.1B' },
            { rank: 3, name: 'BNB', price: '$584.30', change: '+1.2%', mcap: '$87.6B', volume: '$1.8B' },
            { rank: 4, name: 'Solana', price: '$142.87', change: '+5.6%', mcap: '$63.4B', volume: '$3.2B' },
            { rank: 5, name: 'XRP', price: '$0.5234', change: '-1.1%', mcap: '$28.9B', volume: '$1.4B' },
            { rank: 6, name: 'Cardano', price: '$0.4512', change: '+0.3%', mcap: '$16.1B', volume: '$520M' },
            { rank: 7, name: 'Avalanche', price: '$35.67', change: '+3.8%', mcap: '$13.2B', volume: '$890M' },
            { rank: 8, name: 'Dogecoin', price: '$0.0823', change: '-2.1%', mcap: '$11.7B', volume: '$650M' },
            { rank: 9, name: 'Polkadot', price: '$6.89', change: '+1.7%', mcap: '$9.8B', volume: '$320M' },
            { rank: 10, name: 'Polygon', price: '$0.7845', change: '+4.2%', mcap: '$7.3B', volume: '$410M' }
          ];
          grid.setRows(tokens);
        }

        // Start simulations
        ZephyrDashboardData.simulate('#stat-btc', { baseValue: lastBtc, volatility: 0.003, format: 'currency', interval: 2000 });
        ZephyrDashboardData.simulate('#stat-eth', { baseValue: lastEth, volatility: 0.004, format: 'currency', interval: 2500 });
        ZephyrDashboardData.simulate('#stat-vol', { baseValue: 42.1, volatility: 0.02, format: 'number', prefix: '$', suffix: 'B', interval: 3000 });
        ZephyrDashboardData.simulate('#stat-mcap', { baseValue: 2.34, volatility: 0.001, format: 'number', prefix: '$', suffix: 'T', interval: 4000 });
        ZephyrDashboardData.simulate('#chart-btc', { baseValue: lastBtc, volatility: 0.003, type: 'candlestick', interval: 3000, pointInterval: 3600 });
        ZephyrDashboardData.simulate('#chart-eth', { baseValue: lastEth, volatility: 0.004, interval: 2500, pointInterval: 3600 });
      }
    },

    server: {
      name: 'Server Monitoring',
      build(container) {
        const gen = ZephyrDashboardData.generators;

        const cpuData = gen.timeSeries({ count: 200, baseValue: 45, volatility: 0.08, interval: 60 });
        const latencyData = gen.timeSeries({ count: 200, baseValue: 120, volatility: 0.12, interval: 60 });
        const errorData = gen.timeSeries({ count: 200, baseValue: 12, volatility: 0.4, interval: 60 }).map(d => ({
          time: d.time,
          value: Math.max(0, Math.round(d.value)),
          color: d.value > 20 ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.4)'
        }));

        Zephyr.agent.compose(container, {
          tag: 'z-dashboard', id: 'dash', attributes: { 'data-columns': '4' },
          panels: [
            { id: 'cpu', title: 'CPU Usage', component: { tag: 'z-stat', id: 'stat-cpu', attributes: { 'data-label': 'CPU Usage', 'data-value': '45.2%', 'data-trend': 'neutral', 'data-trend-value': '+0.3%' } } },
            { id: 'mem', title: 'Memory', component: { tag: 'z-stat', id: 'stat-mem', attributes: { 'data-label': 'Memory Usage', 'data-value': '72.8%', 'data-trend': 'up', 'data-trend-value': '+1.2%' } } },
            { id: 'err', title: 'Errors', component: { tag: 'z-stat', id: 'stat-err', attributes: { 'data-label': 'Error Rate', 'data-value': '0.12%', 'data-trend': 'down', 'data-trend-value': '-0.05%' } } },
            { id: 'conn', title: 'Connections', component: { tag: 'z-stat', id: 'stat-conn', attributes: { 'data-label': 'Active Connections', 'data-value': '1,247', 'data-trend': 'up', 'data-trend-value': '+48' } } },
            { id: 'cpu-chart', colspan: 2, title: 'CPU Over Time', component: { tag: 'z-chart', id: 'chart-cpu', attributes: { 'data-type': 'area', 'data-height': '260' } } },
            { id: 'latency-chart', colspan: 2, title: 'Request Latency (ms)', component: { tag: 'z-chart', id: 'chart-latency', attributes: { 'data-type': 'line', 'data-height': '260' } } },
            { id: 'error-chart', colspan: 4, title: 'Errors per Minute', component: { tag: 'z-chart', id: 'chart-errors', attributes: { 'data-type': 'histogram', 'data-height': '180' } } },
            { id: 'fleet-table', colspan: 4, title: 'Server Fleet', component: { tag: 'z-data-grid', id: 'grid-fleet' } }
          ]
        });

        setTimeout(() => {
          const chartCpu = document.getElementById('chart-cpu');
          const chartLatency = document.getElementById('chart-latency');
          const chartErrors = document.getElementById('chart-errors');
          if (chartCpu) chartCpu.setData(cpuData);
          if (chartLatency) chartLatency.setData(latencyData);
          if (chartErrors) chartErrors.setData(errorData);
        }, 500);

        const grid = document.getElementById('grid-fleet');
        if (grid) {
          grid.setColumns([
            { key: 'host', label: 'Hostname', width: '10rem' },
            { key: 'status', label: 'Status', width: '5rem' },
            { key: 'cpu', label: 'CPU %', align: 'right' },
            { key: 'mem', label: 'Memory %', align: 'right' },
            { key: 'uptime', label: 'Uptime', align: 'right' },
            { key: 'region', label: 'Region' }
          ]);
          grid.setRows([
            { host: 'web-prod-01', status: 'healthy', cpu: '42%', mem: '68%', uptime: '45d 12h', region: 'us-east-1' },
            { host: 'web-prod-02', status: 'healthy', cpu: '38%', mem: '71%', uptime: '45d 12h', region: 'us-east-1' },
            { host: 'web-prod-03', status: 'warning', cpu: '87%', mem: '92%', uptime: '12d 4h', region: 'us-west-2' },
            { host: 'api-prod-01', status: 'healthy', cpu: '55%', mem: '64%', uptime: '30d 8h', region: 'eu-west-1' },
            { host: 'api-prod-02', status: 'healthy', cpu: '49%', mem: '59%', uptime: '30d 8h', region: 'eu-west-1' },
            { host: 'worker-01', status: 'healthy', cpu: '72%', mem: '81%', uptime: '22d 16h', region: 'us-east-1' },
            { host: 'worker-02', status: 'degraded', cpu: '95%', mem: '88%', uptime: '3d 2h', region: 'us-west-2' },
            { host: 'cache-01', status: 'healthy', cpu: '12%', mem: '45%', uptime: '60d 0h', region: 'us-east-1' }
          ]);
        }

        ZephyrDashboardData.simulate('#stat-cpu', { baseValue: 45.2, volatility: 0.03, format: 'percent', interval: 2000 });
        ZephyrDashboardData.simulate('#stat-mem', { baseValue: 72.8, volatility: 0.01, format: 'percent', interval: 3000 });
        ZephyrDashboardData.simulate('#stat-err', { baseValue: 0.12, volatility: 0.15, format: 'percent', interval: 2500 });
        ZephyrDashboardData.simulate('#stat-conn', { baseValue: 1247, volatility: 0.02, format: 'integer', interval: 2000 });
        ZephyrDashboardData.simulate('#chart-cpu', { baseValue: 45, volatility: 0.03, interval: 2000, pointInterval: 60 });
        ZephyrDashboardData.simulate('#chart-latency', { baseValue: 120, volatility: 0.05, interval: 2000, pointInterval: 60 });
      }
    },

    iot: {
      name: 'IoT Sensors',
      build(container) {
        const gen = ZephyrDashboardData.generators;

        const tempData = gen.timeSeries({ count: 200, baseValue: 22.5, volatility: 0.01, trend: 0.0001, interval: 300 });
        const humidityData = gen.timeSeries({ count: 200, baseValue: 58, volatility: 0.015, interval: 300 });

        Zephyr.agent.compose(container, {
          tag: 'z-dashboard', id: 'dash', attributes: { 'data-columns': '4' },
          panels: [
            { id: 'sensors', title: 'Active Sensors', component: { tag: 'z-stat', id: 'stat-sensors', attributes: { 'data-label': 'Active Sensors', 'data-value': '147', 'data-trend': 'up', 'data-trend-value': '+3' } } },
            { id: 'temp', title: 'Temperature', component: { tag: 'z-stat', id: 'stat-temp', attributes: { 'data-label': 'Avg Temperature', 'data-value': '22.5 C', 'data-trend': 'neutral', 'data-trend-value': '+0.1 C' } } },
            { id: 'humidity', title: 'Humidity', component: { tag: 'z-stat', id: 'stat-humidity', attributes: { 'data-label': 'Avg Humidity', 'data-value': '58%', 'data-trend': 'down', 'data-trend-value': '-2%' } } },
            { id: 'battery', title: 'Battery', component: { tag: 'z-stat', id: 'stat-battery', attributes: { 'data-label': 'Avg Battery', 'data-value': '73%', 'data-trend': 'down', 'data-trend-value': '-0.5%' } } },
            { id: 'temp-chart', colspan: 2, rowspan: 2, title: 'Temperature (5min avg)', component: { tag: 'z-chart', id: 'chart-temp', attributes: { 'data-type': 'line', 'data-height': '340' } } },
            { id: 'humidity-chart', colspan: 2, rowspan: 2, title: 'Humidity (%)', component: { tag: 'z-chart', id: 'chart-humidity', attributes: { 'data-type': 'area', 'data-height': '340' } } },
            { id: 'sensor-table', colspan: 4, title: 'Sensor Readings', component: { tag: 'z-data-grid', id: 'grid-sensors' } }
          ]
        });

        setTimeout(() => {
          const chartTemp = document.getElementById('chart-temp');
          const chartHumidity = document.getElementById('chart-humidity');
          if (chartTemp) chartTemp.setData(tempData);
          if (chartHumidity) chartHumidity.setData(humidityData);
        }, 500);

        const grid = document.getElementById('grid-sensors');
        if (grid) {
          grid.setColumns([
            { key: 'id', label: 'Sensor ID', width: '7rem' },
            { key: 'type', label: 'Type', width: '6rem' },
            { key: 'value', label: 'Value', align: 'right' },
            { key: 'unit', label: 'Unit', width: '4rem' },
            { key: 'battery', label: 'Battery', align: 'right' },
            { key: 'lastSeen', label: 'Last Seen' }
          ]);
          grid.setRows([
            { id: 'SENS-001', type: 'Temp', value: '22.4', unit: 'C', battery: '89%', lastSeen: '2s ago' },
            { id: 'SENS-002', type: 'Humidity', value: '57.2', unit: '%', battery: '76%', lastSeen: '5s ago' },
            { id: 'SENS-003', type: 'Temp', value: '23.1', unit: 'C', battery: '92%', lastSeen: '1s ago' },
            { id: 'SENS-004', type: 'Pressure', value: '1013.2', unit: 'hPa', battery: '45%', lastSeen: '8s ago' },
            { id: 'SENS-005', type: 'Light', value: '342', unit: 'lux', battery: '81%', lastSeen: '3s ago' },
            { id: 'SENS-006', type: 'Temp', value: '21.8', unit: 'C', battery: '67%', lastSeen: '12s ago' },
            { id: 'SENS-007', type: 'Humidity', value: '62.1', unit: '%', battery: '54%', lastSeen: '4s ago' },
            { id: 'SENS-008', type: 'Motion', value: '1', unit: 'bool', battery: '88%', lastSeen: '1s ago' },
            { id: 'SENS-009', type: 'CO2', value: '412', unit: 'ppm', battery: '71%', lastSeen: '6s ago' },
            { id: 'SENS-010', type: 'Temp', value: '24.0', unit: 'C', battery: '33%', lastSeen: '15s ago' }
          ]);
        }

        ZephyrDashboardData.simulate('#stat-temp', { baseValue: 22.5, volatility: 0.005, format: 'number', suffix: ' C', interval: 3000 });
        ZephyrDashboardData.simulate('#stat-humidity', { baseValue: 58, volatility: 0.008, format: 'percent', interval: 3000 });
        ZephyrDashboardData.simulate('#stat-sensors', { baseValue: 147, volatility: 0.005, format: 'integer', interval: 5000 });
        ZephyrDashboardData.simulate('#stat-battery', { baseValue: 73, volatility: 0.002, format: 'percent', interval: 10000 });
        ZephyrDashboardData.simulate('#chart-temp', { baseValue: 22.5, volatility: 0.003, interval: 3000, pointInterval: 300 });
        ZephyrDashboardData.simulate('#chart-humidity', { baseValue: 58, volatility: 0.005, interval: 3000, pointInterval: 300 });
      }
    }
  }
};

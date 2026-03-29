/**
 * Zephyr Browser  - Webview Preload (The WebMCP Bridge)
 *
 * This is the conceptual heart of the WebMCP pattern. It bridges the
 * Electron main process (where the AI agent runs) to the webpage
 * (where Zephyr components live) via IPC.
 *
 * In a future WebMCP standard, this would be built into the browser as
 * `navigator.webmcp`  - a native API for agent-to-webpage communication.
 * For now, we achieve the same thing with Electron's contextBridge.
 *
 * Message format (identical to zephyr-mcp/bridge-client.js):
 *   Request:  { id, method, args }    - main → webview
 *   Response: { id, result }          - webview → main
 *   Error:    { id, error }           - webview → main
 *
 * Security model:
 *   - The webpage has NO access to the main process
 *   - API keys NEVER cross this bridge
 *   - Only Zephyr.agent methods can be called (validated in the injected script)
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ---------------------------------------------------------------------------
// Expose a minimal bridge API to the webpage's isolated world
// ---------------------------------------------------------------------------

contextBridge.exposeInMainWorld('zephyrBridge', {
  /**
   * Register a callback for incoming agent commands.
   * The callback receives { id, method, args } messages.
   */
  onExecute: (callback) => {
    ipcRenderer.on('zephyr:execute', (_event, msg) => {
      callback(msg);
    });
  },

  /**
   * Send a successful result back to the main process.
   * @param {string} id - Request correlation ID
   * @param {any} result - The Zephyr.agent method return value
   */
  sendResult: (id, result) => {
    ipcRenderer.send('zephyr:result', { id, result });
  },

  /**
   * Send an error back to the main process.
   * @param {string} id - Request correlation ID
   * @param {string} error - Error message
   */
  sendError: (id, error) => {
    ipcRenderer.send('zephyr:result', { id, error });
  }
});

// ---------------------------------------------------------------------------
// Wire the bridge to Zephyr.agent after the page loads
// ---------------------------------------------------------------------------

/**
 * After the DOM is ready, inject a script that connects zephyrBridge
 * to Zephyr.agent. This mirrors what bridge-client.js does for WebSocket,
 * but uses the IPC-backed zephyrBridge instead.
 *
 * We poll for Zephyr.agent because the framework script may not have
 * executed yet when DOMContentLoaded fires.
 */
window.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      'use strict';

      function connectBridge() {
        if (!window.zephyrBridge || !window.Zephyr || !window.Zephyr.agent) {
          // Framework not ready yet  - retry in 100ms
          setTimeout(connectBridge, 100);
          return;
        }

        // Listen for agent commands from the main process
        window.zephyrBridge.onExecute(function(msg) {
          try {
            var fn = Zephyr.agent[msg.method];

            if (typeof fn !== 'function') {
              throw new Error('Unknown Zephyr.agent method: ' + msg.method);
            }

            // Execute the Zephyr.agent method (all are synchronous)
            var result = fn.apply(Zephyr.agent, msg.args || []);

            // Send result back to the main process
            window.zephyrBridge.sendResult(msg.id, result);

          } catch (err) {
            window.zephyrBridge.sendError(msg.id, err.message);
          }
        });

        console.log('[WebMCP] Bridge connected  - Zephyr.agent methods available to agent process');
      }

      connectBridge();
    })();
  `;
  document.head.appendChild(script);

  // Notify main process that the bridge is ready
  // (small delay to let the injected script initialize)
  setTimeout(() => {
    ipcRenderer.send('webview:ready');
  }, 500);
});

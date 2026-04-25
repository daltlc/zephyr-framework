/**
 * Zephyr MCP Bridge Client
 *
 * This script runs in the browser and connects back to the MCP server's
 * WebSocket bridge. When the MCP server receives a tool call from an AI agent
 * (e.g., "open modal #my-modal"), it forwards the request over WebSocket to
 * this script, which executes the corresponding Zephyr.agent method and
 * sends the result back.
 *
 * This script is automatically injected into HTML pages served by the MCP
 * server — you don't need to add it manually.
 *
 * Communication flow:
 *   MCP Host → stdio → server.js → WebSocket → this script → Zephyr.agent API
 *   Zephyr.agent result → this script → WebSocket → server.js → stdio → MCP Host
 */
(function () {
  'use strict';

  // Connect to the WebSocket bridge running on the same host and port
  // as the HTTP server that served this page
  const wsUrl = `ws://${location.hostname}:${location.port}`;
  const ws = new WebSocket(wsUrl);

  /**
   * Handle incoming messages from the MCP server bridge.
   * Each message is a JSON object with:
   *   - id: unique request identifier for correlating responses
   *   - method: name of the Zephyr.agent method to call (e.g., 'act', 'getState')
   *   - args: array of arguments to pass to the method
   */
  ws.addEventListener('message', function (event) {
    // Parse the incoming message from the MCP bridge server
    var msg = JSON.parse(event.data);

    try {
      // Look up the requested method on the Zephyr.agent namespace
      // Valid methods: act, getState, setState, describe, getSchema, getPrompt, annotate
      var fn = Zephyr.agent[msg.method];

      // Guard against calling non-existent methods
      if (typeof fn !== 'function') {
        throw new Error('Unknown Zephyr.agent method: ' + msg.method);
      }

      // Execute the Zephyr.agent method with the provided arguments
      // All Zephyr.agent methods are synchronous (no async/await needed)
      var result = fn.apply(Zephyr.agent, msg.args || []);

      // Send the successful result back to the MCP server
      // The server correlates this response using the request ID
      ws.send(JSON.stringify({ id: msg.id, result: result }));

    } catch (err) {
      // Send the error message back so the MCP tool can report failure
      ws.send(JSON.stringify({ id: msg.id, error: err.message }));
    }
  });

  // Log connection status to the browser console for debugging
  ws.addEventListener('open', function () {
    console.log('[Zephyr MCP] Bridge connected to ' + wsUrl);
  });

  // Log disconnection so the user knows the bridge is no longer active
  ws.addEventListener('close', function () {
    console.log('[Zephyr MCP] Bridge disconnected');
  });

  // Log WebSocket errors (e.g., connection refused if server is down)
  ws.addEventListener('error', function (err) {
    console.error('[Zephyr MCP] Bridge error:', err);
  });
})();

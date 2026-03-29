/**
 * Zephyr Browser  - Agent Panel Preload
 *
 * Exposes a safe IPC bridge for the agent panel HTML.
 * The panel uses this to send user messages to the main process
 * and receive agent responses, tool calls, and status updates.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentBridge', {
  /** Send a user message to the agent loop in the main process */
  sendMessage: (text) => ipcRenderer.invoke('agent:send-message', text),

  /** Clear conversation history */
  clearChat: () => ipcRenderer.invoke('agent:clear'),

  /** Get current status (API key present, webview connected, model) */
  getStatus: () => ipcRenderer.invoke('agent:get-status'),

  // --- Listeners for main → panel messages ---

  /** Receive assistant text responses */
  onMessage: (cb) => ipcRenderer.on('agent:message', (_e, text) => cb(text)),

  /** Receive tool call notifications (name + input) */
  onToolCall: (cb) => ipcRenderer.on('agent:tool-call', (_e, data) => cb(data)),

  /** Receive tool result notifications (name + result) */
  onToolResult: (cb) => ipcRenderer.on('agent:tool-result', (_e, data) => cb(data)),

  /** Receive status changes (thinking, idle, error) */
  onStatus: (cb) => ipcRenderer.on('agent:status', (_e, status) => cb(status)),

  /** Receive error messages */
  onError: (cb) => ipcRenderer.on('agent:error', (_e, msg) => cb(msg)),

  /** Receive config from main process (demo page URL, preload path, etc.) */
  onConfig: (cb) => ipcRenderer.on('agent:config', (_e, config) => cb(config)),

  /** Receive webview ready notification */
  onWebviewReady: (cb) => ipcRenderer.on('agent:webview-ready', () => cb()),

  // --- Webview relay channels ---
  // The main process sends tool calls here; the panel forwards them to <webview>

  /** Receive execute commands to relay to the webview */
  onRelayExecute: (cb) => ipcRenderer.on('zephyr:relay-execute', (_e, msg) => cb(msg)),

  /** Forward webview results back to main process */
  relayResult: (data) => ipcRenderer.send('zephyr:result', data),

  /** Forward webview ready signal to main process */
  relayWebviewReady: () => ipcRenderer.send('webview:ready')
});

/**
 * Zephyr Browser  - Agent Panel Renderer Logic
 *
 * Handles the chat UI: sending messages, displaying responses,
 * showing tool calls, and managing the educational splash screen.
 * Communicates with the main process via agentBridge (exposed by agent-preload.js).
 */

'use strict';

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------

const splash = document.getElementById('splash');
const chat = document.getElementById('chat');
const messagesEl = document.getElementById('messages');
const thinking = document.getElementById('thinking');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const modelLabel = document.getElementById('model-label');
const webview = document.getElementById('zephyr-webview');
const resizeHandle = document.getElementById('resize-handle');
const paneLeft = document.querySelector('.pane-left');
const paneRight = document.querySelector('.pane-right');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let isSending = false;
let isWebviewReady = false;

// ---------------------------------------------------------------------------
// Resizable Split Pane
// ---------------------------------------------------------------------------

(function initResize() {
  let isDragging = false;

  resizeHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    resizeHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    // Prevent webview from stealing mouse events during drag
    webview.style.pointerEvents = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const containerWidth = document.body.clientWidth;
    const leftWidth = Math.max(200, Math.min(e.clientX, containerWidth - 250));
    const rightWidth = containerWidth - leftWidth - 5; // 5px for handle
    paneLeft.style.flex = `0 0 ${leftWidth}px`;
    paneRight.style.flex = `0 0 ${rightWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    webview.style.pointerEvents = '';
  });
})();

// ---------------------------------------------------------------------------
// Splash → Chat transition
// ---------------------------------------------------------------------------

startBtn.addEventListener('click', () => {
  splash.classList.add('hidden');
  chat.classList.add('active');
  input.focus();
});

// ---------------------------------------------------------------------------
// Webview Configuration
// ---------------------------------------------------------------------------

/**
 * Receive config from main process and set up the webview.
 * The main process sends the demo page URL and preload path
 * after the panel finishes loading.
 */
window.agentBridge.onConfig((config) => {
  // Set the webview source and preload
  webview.setAttribute('preload', `file://${config.preloadPath}`);
  webview.setAttribute('src', config.demoPageUrl);

  // Update status
  if (config.hasApiKey) {
    statusDot.className = 'status-dot status-dot--pending';
    statusText.innerHTML = '<span class="status-dot status-dot--pending" id="status-dot"></span> Loading page...';
  } else {
    statusDot.className = 'status-dot status-dot--error';
    statusText.innerHTML = '<span class="status-dot status-dot--error"></span> No API key  - start with ANTHROPIC_API_KEY=... npm start';
  }

  // Show model
  modelLabel.textContent = config.model;
});

/**
 * Webview bridge is connected  - agent can now talk to the page.
 */
window.agentBridge.onWebviewReady(() => {
  isWebviewReady = true;
  statusDot.className = 'status-dot status-dot--ok';
  statusText.innerHTML = '<span class="status-dot status-dot--ok"></span> Connected';
});

// ---------------------------------------------------------------------------
// Webview IPC Relay
//
// Electron's <webview> IPC doesn't go directly to ipcMain. Instead,
// the webview fires 'ipc-message' events on the DOM element. We listen
// for those and relay them to the main process via agentBridge.
//
// This is the key architectural detail: the agent panel acts as a
// message router between the main process and the webview.
// ---------------------------------------------------------------------------

// Relay: webview → main process (results from Zephyr.agent calls)
webview.addEventListener('ipc-message', (event) => {
  if (event.channel === 'zephyr:result') {
    window.agentBridge.relayResult(event.args[0]);
  } else if (event.channel === 'webview:ready') {
    window.agentBridge.relayWebviewReady();
  }
});

// Relay: main process → webview (execute Zephyr.agent commands)
window.agentBridge.onRelayExecute((msg) => {
  webview.send('zephyr:execute', msg);
});

// Also listen for webview dom-ready as a fallback
webview.addEventListener('dom-ready', () => {
  // Give the bridge script time to initialize
  setTimeout(() => {
    if (!isWebviewReady) {
      isWebviewReady = true;
      statusDot.className = 'status-dot status-dot--ok';
      statusText.innerHTML = '<span class="status-dot status-dot--ok"></span> Connected';
    }
  }, 1000);
});

// ---------------------------------------------------------------------------
// Message Sending
// ---------------------------------------------------------------------------

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isSending) return;

  isSending = true;
  input.value = '';
  sendBtn.disabled = true;

  // Render user message
  renderMessage('user', text);

  // Send to main process (agent loop)
  await window.agentBridge.sendMessage(text);

  isSending = false;
  sendBtn.disabled = false;
  input.focus();
}

sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ---------------------------------------------------------------------------
// Message Rendering
// ---------------------------------------------------------------------------

/**
 * Render a chat message bubble.
 * @param {'user'|'assistant'|'error'} role
 * @param {string} text
 */
function renderMessage(role, text) {
  const el = document.createElement('div');
  el.className = `message message--${role}`;
  el.textContent = text;

  // Insert before the thinking indicator
  messagesEl.insertBefore(el, thinking);
  scrollToBottom();
}

/**
 * Render a tool call indicator.
 * @param {object} data - { name, input }
 * @returns {HTMLElement} The tool call element (for updating with results)
 */
function renderToolCall(data) {
  const el = document.createElement('div');
  el.className = 'tool-call';

  const nameEl = document.createElement('div');
  nameEl.className = 'tool-call__name';
  nameEl.textContent = data.name;
  el.appendChild(nameEl);

  // Show a brief summary of the input
  if (data.input) {
    const detailEl = document.createElement('div');
    detailEl.className = 'tool-call__detail';

    // Format tool input as a readable summary
    const parts = [];
    if (data.input.selector) parts.push(data.input.selector);
    if (data.input.action) parts.push(data.input.action);
    if (data.input.params) parts.push(JSON.stringify(data.input.params));
    detailEl.textContent = parts.join(' → ') || JSON.stringify(data.input).slice(0, 100);

    el.appendChild(detailEl);
  }

  messagesEl.insertBefore(el, thinking);
  scrollToBottom();
  return el;
}

/**
 * Update a tool call element with its result.
 * @param {HTMLElement} el - The tool call element
 * @param {object} data - { name, result }
 */
function updateToolResult(el, data) {
  if (!el) return;

  const resultEl = document.createElement('div');
  resultEl.className = 'tool-call__result';

  // Show a brief summary of the result
  const resultStr = JSON.stringify(data.result);
  if (data.result && data.result.success !== undefined) {
    resultEl.textContent = data.result.success ? 'Done' : 'Failed: ' + (data.result.error || '');
  } else if (resultStr.length > 80) {
    resultEl.textContent = resultStr.slice(0, 80) + '...';
  } else {
    resultEl.textContent = resultStr;
  }

  el.appendChild(resultEl);
  scrollToBottom();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------------------------------------------------------------------------
// IPC Listeners  - Main Process → Panel
// ---------------------------------------------------------------------------

/** Track the last tool call element so we can update it with results */
let lastToolCallEl = null;

window.agentBridge.onMessage((text) => {
  renderMessage('assistant', text);
});

window.agentBridge.onToolCall((data) => {
  lastToolCallEl = renderToolCall(data);
});

window.agentBridge.onToolResult((data) => {
  updateToolResult(lastToolCallEl, data);
  lastToolCallEl = null;
});

window.agentBridge.onStatus((status) => {
  if (status === 'thinking') {
    thinking.classList.add('active');
    scrollToBottom();
  } else {
    thinking.classList.remove('active');
  }
});

window.agentBridge.onError((msg) => {
  renderMessage('error', msg);
  thinking.classList.remove('active');
});

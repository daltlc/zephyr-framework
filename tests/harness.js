/**
 * Zephyr Test Harness
 * Minimal HTML-based test runner — no npm, no Node, no build step.
 * Open any test HTML file in a browser to run tests.
 *
 * Usage in test files:
 *   const t = new TestSuite('Component Name');
 *   t.test('description', async (assert) => {
 *     assert.ok(true, 'should be truthy');
 *     assert.equal(1, 1, 'should be equal');
 *     assert.notEqual(1, 2, 'should not be equal');
 *     assert.hasAttribute(el, 'data-open', 'should have attribute');
 *     assert.notHasAttribute(el, 'data-open', 'should not have attribute');
 *   });
 *   t.run();
 */

class TestSuite {
  constructor(name) {
    this.name = name;
    this._tests = [];
    this._passed = 0;
    this._failed = 0;
    this._results = [];
  }

  /**
   * Registers a test case.
   * @param {string} description - What this test verifies
   * @param {function} fn - Async function receiving an assert object
   */
  test(description, fn) {
    this._tests.push({ description, fn });
  }

  /** Runs all registered tests and renders results to the page. */
  async run() {
    const container = document.createElement('div');
    container.id = 'test-results';
    container.style.cssText = 'font-family: monospace; padding: 2rem; max-width: 800px; margin: 0 auto;';

    const title = document.createElement('h1');
    title.textContent = `Tests: ${this.name}`;
    title.style.cssText = 'font-size: 1.5rem; margin-bottom: 1rem;';
    container.appendChild(title);

    for (const { description, fn } of this._tests) {
      const assert = new Assertions();
      try {
        await fn(assert);
        if (assert.failures.length === 0) {
          this._passed++;
          this._addResult(container, 'PASS', description, null);
        } else {
          this._failed++;
          this._addResult(container, 'FAIL', description, assert.failures.join('; '));
        }
      } catch (err) {
        this._failed++;
        this._addResult(container, 'FAIL', description, err.message);
      }
    }

    const summary = document.createElement('div');
    summary.style.cssText = `
      margin-top: 1.5rem; padding: 1rem; border-radius: 0.5rem;
      background: ${this._failed === 0 ? '#d4edda' : '#f8d7da'};
      color: ${this._failed === 0 ? '#155724' : '#721c24'};
      font-weight: bold;
    `;
    summary.textContent = `${this._passed} passed, ${this._failed} failed, ${this._tests.length} total`;
    container.appendChild(summary);

    document.body.appendChild(container);
  }

  _addResult(container, status, description, error) {
    const row = document.createElement('div');
    row.style.cssText = `
      padding: 0.5rem; margin: 0.25rem 0; border-radius: 0.25rem;
      background: ${status === 'PASS' ? '#f0fff0' : '#fff0f0'};
      border-left: 4px solid ${status === 'PASS' ? '#28a745' : '#dc3545'};
    `;
    row.innerHTML = `<strong>${status}</strong> ${description}`;
    if (error) {
      row.innerHTML += `<br><small style="color: #dc3545; margin-left: 1rem;">${error}</small>`;
    }
    container.appendChild(row);
  }
}

class Assertions {
  constructor() {
    this.failures = [];
  }

  ok(value, msg) {
    if (!value) this.failures.push(msg || `Expected truthy, got ${value}`);
  }

  equal(actual, expected, msg) {
    if (actual !== expected) {
      this.failures.push(msg || `Expected ${expected}, got ${actual}`);
    }
  }

  notEqual(actual, expected, msg) {
    if (actual === expected) {
      this.failures.push(msg || `Expected not ${expected}`);
    }
  }

  hasAttribute(el, attr, msg) {
    if (!el.hasAttribute(attr)) {
      this.failures.push(msg || `Expected element to have attribute "${attr}"`);
    }
  }

  notHasAttribute(el, attr, msg) {
    if (el.hasAttribute(attr)) {
      this.failures.push(msg || `Expected element to NOT have attribute "${attr}"`);
    }
  }

  hasRole(el, role, msg) {
    if (el.getAttribute('role') !== role) {
      this.failures.push(msg || `Expected role="${role}", got role="${el.getAttribute('role')}"`);
    }
  }

  contains(el, selector, msg) {
    if (!el.querySelector(selector)) {
      this.failures.push(msg || `Expected element to contain "${selector}"`);
    }
  }
}

/** Helper to wait for custom elements to initialize. */
function waitForElements() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** Helper to simulate a click event on an element. */
function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Helper to simulate a keyboard event. */
function keydown(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

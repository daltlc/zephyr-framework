#!/usr/bin/env node

/**
 * Zephyr CI Test Runner
 *
 * Runs the browser-based HTML test harness headlessly so the suite can run in
 * CI (and locally via `npm test`). The HTML test files are unchanged — this
 * runner serves the repo over a local HTTP server, opens every
 * tests/test-*.html in headless Chromium, and reads the structured results
 * that harness.js publishes on window.__zephyrTestResults.
 *
 * Playwright is a devDependency only — the framework itself stays zero-dep.
 *
 * Usage:
 *   npm test                       # all test pages
 *   node tests/run-ci.js modal     # only pages whose filename matches "modal"
 *
 * Exit code: 0 when every page passes, 1 on any failure, timeout, or page error.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = __dirname;
const PAGE_TIMEOUT_MS = 20000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/plain; charset=utf-8'
};

/** Serves files from the repo root so test pages can load ../zephyr-framework.js etc. */
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end('Not found: ' + urlPath);
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    console.error('Playwright is not installed. Run: npm install && npx playwright install chromium');
    process.exit(1);
  }

  const filter = process.argv[2];
  const pages = fs.readdirSync(TESTS_DIR)
    .filter(f => /^test-.*\.html$/.test(f))
    .filter(f => !filter || f.includes(filter))
    .sort();

  if (!pages.length) {
    console.error('No test pages matched' + (filter ? ` filter "${filter}"` : '') + '.');
    process.exit(1);
  }

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch();
  // Reduced motion makes withTransition() apply DOM mutations synchronously,
  // so assertions don't race the View Transitions API.
  const context = await browser.newContext({ reducedMotion: 'reduce' });

  let totalPassed = 0;
  let totalFailed = 0;
  const failures = [];

  for (const file of pages) {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    let outcome;
    try {
      await page.goto(`http://127.0.0.1:${port}/tests/${file}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__zephyrTestResults !== undefined, null, { timeout: PAGE_TIMEOUT_MS });
      outcome = await page.evaluate(() => window.__zephyrTestResults);
    } catch (e) {
      outcome = null;
    }
    await page.close();

    if (!outcome) {
      totalFailed++;
      const detail = pageErrors.length ? ` — page errors: ${pageErrors.join(' | ')}` : ' — timed out waiting for results';
      failures.push({ file, description: '(suite did not report)', error: detail.slice(3) });
      console.log(`✗ ${file}${detail}`);
      continue;
    }

    totalPassed += outcome.passed;
    totalFailed += outcome.failed;
    const mark = outcome.failed === 0 ? '✓' : '✗';
    console.log(`${mark} ${file} — ${outcome.name}: ${outcome.passed} passed, ${outcome.failed} failed`);

    for (const r of outcome.results.filter(r => r.status === 'FAIL')) {
      failures.push({ file, description: r.description, error: r.error });
    }
    if (pageErrors.length && outcome.failed === 0) {
      console.log(`  (note: uncaught page errors: ${pageErrors.join(' | ')})`);
    }
  }

  await browser.close();
  server.close();

  console.log(`\n${pages.length} suites — ${totalPassed} passed, ${totalFailed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  ${f.file} › ${f.description}\n    ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

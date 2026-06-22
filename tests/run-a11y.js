#!/usr/bin/env node

/**
 * Zephyr Accessibility Audit
 *
 * Runs axe-core against the demo pages (every component in its real markup)
 * in headless Chromium and fails on serious/critical violations.
 *
 * Usage:
 *   node tests/run-a11y.js            # audit index.html + visualizer.html
 *   node tests/run-a11y.js --all      # also audit every tests/test-*.html page
 *
 * Exit code: 0 when no serious/critical violations, 1 otherwise.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const { chromium } = require('playwright');
  const { AxeBuilder } = require('@axe-core/playwright');

  const pages = ['index.html', 'visualizer.html'];
  if (process.argv.includes('--all')) {
    pages.push(...fs.readdirSync(path.join(ROOT, 'tests'))
      .filter(f => /^test-.*\.html$/.test(f))
      .map(f => 'tests/' + f));
  }

  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch();
  const context = await browser.newContext({ reducedMotion: 'reduce' });

  let failed = false;

  for (const file of pages) {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/${file}`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    const minor = results.violations.filter(v => v.impact !== 'serious' && v.impact !== 'critical');

    const mark = blocking.length ? '✗' : '✓';
    console.log(`${mark} ${file} — ${blocking.length} serious/critical, ${minor.length} minor`);

    for (const v of blocking) {
      failed = true;
      console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      for (const node of v.nodes.slice(0, 5)) {
        console.log(`    ${node.html.slice(0, 120)}`);
      }
    }
    for (const v of minor) {
      console.log(`  (minor) [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
    }

    await page.close();
  }

  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

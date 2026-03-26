#!/usr/bin/env node

/**
 * Zephyr Framework — Build Script
 * Minifies JS and CSS using esbuild.
 * Run: node build.js
 */

const { build } = require('esbuild');
const { readFileSync } = require('fs');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

async function run() {
  // Minify framework JS
  await build({
    entryPoints: ['zephyr-framework.js'],
    outfile: 'zephyr-framework.min.js',
    minify: true,
    banner: { js: `/* Zephyr Framework v${pkg.version} | MIT License */` },
  });

  // Minify agent widget JS
  await build({
    entryPoints: ['zephyr-agent-widget.js'],
    outfile: 'zephyr-agent-widget.min.js',
    minify: true,
    banner: { js: `/* Zephyr Agent Widget v${pkg.version} | MIT License */` },
  });

  // Minify framework CSS
  await build({
    entryPoints: ['zephyr-framework.css'],
    outfile: 'zephyr-framework.min.css',
    minify: true,
    banner: { css: `/* Zephyr Framework v${pkg.version} | MIT License */` },
  });

  // Minify dashboard add-on JS
  await build({
    entryPoints: ['dashboard/zephyr-dashboard.js'],
    outfile: 'dashboard/zephyr-dashboard.min.js',
    minify: true,
    banner: { js: `/* Zephyr Dashboard v${pkg.version} | MIT License */` },
  });

  // Minify dashboard add-on CSS
  await build({
    entryPoints: ['dashboard/zephyr-dashboard.css'],
    outfile: 'dashboard/zephyr-dashboard.min.css',
    minify: true,
    banner: { css: `/* Zephyr Dashboard v${pkg.version} | MIT License */` },
  });

  // Report sizes
  const files = [
    ['zephyr-framework.js', 'zephyr-framework.min.js'],
    ['zephyr-agent-widget.js', 'zephyr-agent-widget.min.js'],
    ['zephyr-framework.css', 'zephyr-framework.min.css'],
    ['dashboard/zephyr-dashboard.js', 'dashboard/zephyr-dashboard.min.js'],
    ['dashboard/zephyr-dashboard.css', 'dashboard/zephyr-dashboard.min.css'],
  ];

  console.log('\nZephyr Framework — Build Complete\n');
  for (const [src, min] of files) {
    const srcSize = readFileSync(src).length;
    const minSize = readFileSync(min).length;
    const pct = ((1 - minSize / srcSize) * 100).toFixed(0);
    console.log(`  ${src.padEnd(30)} ${(srcSize / 1024).toFixed(1)}KB → ${(minSize / 1024).toFixed(1)}KB (${pct}% smaller)`);
  }
  console.log('');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * create-zephyr-framework
 *
 * CLI scaffolder for new Zephyr Framework projects. Creates a ready-to-run
 * project with the framework, MCP server, and a starter page — all wired up.
 *
 * Usage:
 *   npx create-zephyr-framework my-app    — creates ./my-app/ with everything set up
 *   npx create-zephyr-framework .         — scaffolds in the current directory
 *   npx create-zephyr-framework           — prints usage instructions
 *
 * What it creates:
 *   my-app/
 *   ├── package.json       — deps: zephyr-framework, zephyr-mcp
 *   ├── index.html          — starter page with example components
 *   └── node_modules/       — installed dependencies
 *
 * After scaffolding:
 *   cd my-app
 *   npm start               — starts MCP server on http://localhost:3456
 *
 * Zero npm dependencies — uses only Node.js built-in modules (fs, path,
 * child_process). This keeps the install fast and the package tiny.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// ANSI color helpers for terminal output
// ---------------------------------------------------------------------------

/**
 * Wrap text in ANSI color codes for terminal output.
 * Falls back to plain text if the terminal doesn't support colors.
 */
const color = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
};

// ---------------------------------------------------------------------------
// Usage message — shown when no arguments are provided or --help is passed
// ---------------------------------------------------------------------------

const USAGE = `
${color.bold('create-zephyr-framework')} — Scaffold a new Zephyr Framework project

${color.bold('Usage:')}
  npx create-zephyr-framework ${color.cyan('<project-name>')}
  npx create-zephyr-framework ${color.cyan('.')}  ${color.dim('(scaffold in current directory)')}

${color.bold('Example:')}
  npx create-zephyr-framework my-dashboard
  cd my-dashboard
  npm start

${color.bold('What you get:')}
  - 14 CSS-driven web components (zero runtime JS)
  - MCP server for Claude Desktop / Cursor integration
  - Starter page with accordion, tabs, modal, select, dropdown
  - Run ${color.cyan('npm start')} to serve the page + MCP bridge on localhost:3456
`;

// ---------------------------------------------------------------------------
// Main scaffolding logic
// ---------------------------------------------------------------------------

/**
 * Validate that a project name is safe to use as a directory name and
 * npm package name. Allows lowercase letters, numbers, hyphens, underscores,
 * and dots (standard npm naming rules).
 *
 * @param {string} name - The project name to validate
 * @returns {boolean} True if the name is valid
 */
function isValidName(name) {
  return /^[a-z0-9._-]+$/i.test(name);
}

/**
 * Generate the package.json content for a new Zephyr project.
 * The generated project depends on:
 *   - zephyr-framework (core CSS components)
 *   - zephyr-mcp (MCP server for agent integration)
 *
 * The "start" script runs the MCP server binary, which serves the project
 * files and starts the WebSocket bridge for Claude Desktop.
 *
 * @param {string} name - The project name (used as the npm package name)
 * @returns {string} JSON string of the package.json contents
 */
function generatePackageJson(name) {
  const pkg = {
    name: name,
    version: '0.1.0',
    private: true,
    description: 'A Zephyr Framework app — agent-native UI with MCP integration',
    scripts: {
      // "zephyr-mcp" is the bin command from zephyr-framework-mcp
      // It starts the HTTP server (serves index.html + framework files)
      // and the MCP stdio transport (for Claude Desktop / Cursor)
      start: 'zephyr-mcp',
    },
    dependencies: {
      'zephyr-framework': '^0.2.0',
      'zephyr-framework-mcp': '^0.1.0',
    },
  };

  // Pretty-print with 2-space indent for readability
  return JSON.stringify(pkg, null, 2) + '\n';
}

/**
 * Copy the template index.html into the project directory.
 * The template is a minimal starter page with 5 example components
 * (accordion, tabs, modal, select, dropdown) and comments explaining
 * how the MCP integration works.
 *
 * @param {string} projectDir - Absolute path to the project directory
 */
function copyTemplate(projectDir) {
  // The template lives alongside this script in the npm package
  const templateDir = path.join(__dirname, 'template');
  const templateFile = path.join(templateDir, 'index.html');

  // Read the template and write it to the project directory
  const content = fs.readFileSync(templateFile, 'utf8');
  fs.writeFileSync(path.join(projectDir, 'index.html'), content);
}

/**
 * Run npm install in the project directory to install dependencies.
 * Uses execSync so we can show the npm output in real-time.
 * If npm fails (network issues, etc.), we catch the error and print
 * instructions for the user to run it manually.
 *
 * @param {string} projectDir - Absolute path to the project directory
 * @returns {boolean} True if npm install succeeded
 */
function installDependencies(projectDir) {
  console.log(`\n${color.cyan('Installing dependencies...')}\n`);

  try {
    // stdio: 'inherit' streams npm's output directly to the terminal
    // so the user sees the progress in real-time
    execSync('npm install', {
      cwd: projectDir,
      stdio: 'inherit',
    });
    return true;
  } catch (err) {
    // npm install failed — usually a network issue or registry problem
    console.log(`\n${color.yellow('Warning:')} npm install failed.`);
    console.log(`You can install dependencies manually:`);
    console.log(`  cd ${path.basename(projectDir)} && npm install\n`);
    return false;
  }
}

/**
 * Print the success message with next steps.
 * Includes instructions for starting the dev server and connecting
 * Claude Desktop via MCP.
 *
 * @param {string} projectName - The project name (for display)
 * @param {string} projectDir - Absolute path to the project directory
 */
function printSuccess(projectName, projectDir) {
  // Calculate the Claude Desktop config path based on platform
  const isWindows = process.platform === 'win32';
  const configPath = isWindows
    ? '%APPDATA%\\Claude\\claude_desktop_config.json'
    : '~/Library/Application Support/Claude/claude_desktop_config.json';

  console.log(`
${color.green('Success!')} Created ${color.bold(projectName)} at ${color.dim(projectDir)}

${color.bold('Next steps:')}

  ${color.cyan(`cd ${projectName}`)}
  ${color.cyan('npm start')}

  This starts the Zephyr MCP server on ${color.cyan('http://localhost:3456')}
  Open that URL in your browser to see your app.

${color.bold('Connect Claude Desktop:')}

  Add this to ${color.dim(configPath)}:

  {
    "mcpServers": {
      "zephyr": {
        "command": "npx",
        "args": ["zephyr-mcp"],
        "env": {
          "ZEPHYR_ROOT": "${projectDir}"
        }
      }
    }
  }

  Then ask Claude: ${color.dim('"What components are on the page?"')}
  Or: ${color.dim('"Open the modal and switch to the Agent API tab"')}
`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/**
 * Main function — parses arguments and orchestrates the scaffolding.
 *
 * Flow:
 *   1. Parse the project name from CLI arguments
 *   2. Create the project directory (or use current dir for ".")
 *   3. Write package.json with framework + MCP dependencies
 *   4. Copy the template index.html with example components
 *   5. Run npm install to pull in dependencies
 *   6. Print next steps (start server, connect Claude Desktop)
 */
function main() {
  // Get the project name from the first CLI argument
  // e.g., "npx create-zephyr-framework my-app" → process.argv = ['node', 'index.js', 'my-app']
  const projectName = process.argv[2];

  // No argument or help flag — show usage and exit
  if (!projectName || projectName === '--help' || projectName === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  // Determine the target directory
  // "." means scaffold in the current working directory
  const useCurrentDir = projectName === '.';
  const projectDir = useCurrentDir
    ? process.cwd()
    : path.resolve(process.cwd(), projectName);

  // Validate the project name (skip validation for ".")
  if (!useCurrentDir && !isValidName(projectName)) {
    console.error(
      `${color.red('Error:')} Invalid project name "${projectName}".`
    );
    console.error(
      'Use only lowercase letters, numbers, hyphens, underscores, and dots.'
    );
    process.exit(1);
  }

  // Create the directory if it doesn't exist
  if (!useCurrentDir) {
    if (fs.existsSync(projectDir)) {
      // Directory exists — check if it's empty
      const contents = fs.readdirSync(projectDir);
      if (contents.length > 0) {
        console.error(
          `${color.red('Error:')} Directory "${projectName}" already exists and is not empty.`
        );
        console.error('Please choose a different name or empty the directory.');
        process.exit(1);
      }
    } else {
      // Create the project directory
      fs.mkdirSync(projectDir, { recursive: true });
    }
  } else {
    // Scaffolding in current directory — warn if package.json already exists
    if (fs.existsSync(path.join(projectDir, 'package.json'))) {
      console.error(
        `${color.red('Error:')} package.json already exists in this directory.`
      );
      console.error(
        'Use a new directory name or remove the existing package.json first.'
      );
      process.exit(1);
    }
  }

  // Display what we're creating
  const displayName = useCurrentDir ? path.basename(projectDir) : projectName;
  console.log(
    `\n${color.bold('Creating Zephyr app:')} ${color.cyan(displayName)}\n`
  );

  // Step 1: Write package.json with zephyr-framework + MCP dependencies
  console.log(`  ${color.green('+')} package.json`);
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    generatePackageJson(displayName)
  );

  // Step 2: Copy the template index.html with example components
  console.log(`  ${color.green('+')} index.html`);
  copyTemplate(projectDir);

  // Step 3: Install npm dependencies (zephyr-framework + zephyr-mcp)
  installDependencies(projectDir);

  // Step 4: Print success message with next steps
  printSuccess(useCurrentDir ? '.' : projectName, projectDir);
}

// Run the CLI
main();

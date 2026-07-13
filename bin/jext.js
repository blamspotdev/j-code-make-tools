#!/usr/bin/env node
'use strict';

const { pack } = require('../src/pack');
const { validate } = require('../src/validate');
const { init } = require('../src/init');
const { index } = require('../src/indexcmd');
const { interactive } = require('../src/interactive');
const { CliError, paint, C } = require('../src/util');
const pkg = require('../package.json');

const USAGE = `jext — JCode extension make tools (v${pkg.version})

Usage:
  jext interactive                                  Guided, menu-driven mode (also: run "jext" with no args in a terminal)
  jext pack <extensionDir> [-o <out.jext|outDir>] [--no-build]
                                                    Build (npm run build, if any) + compile into a .jext
  jext validate <extensionDir|file.jext>            Validate a .jehm header or a built .jext
  jext init [dir] [--type <t>] [--name <n>] [--id <uniqueName>] [--publisher <p>]
                                                    Scaffold a new extension (.jehm + manifest)
  jext index <marketplaceDir> [--dist <folder>]     Regenerate marketplace.yaml from packed .jext files
  jext help | --version

Types: language, templates, app, dbmanager, scm, vm, formatter, theme, icons
`;

// Tiny flag parser: collects --key value / --key=value into flags, the rest into positionals.
function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o') {
      flags.out = argv[++i];
    } else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positionals.push(a);
    }
  }
  return { flags, positionals };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE);
    return;
  }
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
    console.log(pkg.version);
    return;
  }
  // No command: drop into the wizard when a person is at a terminal, otherwise print usage
  // (so piping / CI never hangs waiting for input).
  if (!cmd) {
    if (process.stdin.isTTY) return interactive();
    process.stdout.write(USAGE);
    return;
  }
  if (cmd === 'interactive' || cmd === 'wizard' || cmd === 'menu' || cmd === 'i') {
    return interactive();
  }

  const { flags, positionals } = parseArgs(rest);
  switch (cmd) {
    case 'pack': {
      if (!positionals[0]) throw new CliError('pack: missing <extensionDir>');
      pack(positionals[0], { out: flags.out, noBuild: flags['no-build'] === true });
      break;
    }
    case 'validate': {
      if (!positionals[0]) throw new CliError('validate: missing <extensionDir|file.jext>');
      const okFlag = validate(positionals[0]);
      if (!okFlag) process.exitCode = 1;
      break;
    }
    case 'init': {
      init(positionals[0] || '.', { type: flags.type, name: flags.name, id: flags.id, publisher: flags.publisher });
      break;
    }
    case 'index': {
      if (!positionals[0]) throw new CliError('index: missing <marketplaceDir>');
      index(positionals[0], { dist: flags.dist });
      break;
    }
    default:
      throw new CliError(`unknown command "${cmd}". Run "jext help".`);
  }
}

main().catch((e) => {
  if (e instanceof CliError) {
    console.error(paint(C.red, 'error: ') + e.message);
    process.exit(1);
  }
  throw e;
});

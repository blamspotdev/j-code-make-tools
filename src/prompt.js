'use strict';

// A tiny, dependency-free prompt toolkit for the interactive wizard: text questions with defaults,
// yes/no confirms, and numbered menus — without pulling in inquirer.
//
// It is built on classic `readline` with a line *queue* rather than readline/promises' question(),
// because that API loses buffered lines when stdin is a pipe (every line arrives before the next
// question() attaches its listener). A single persistent 'line' handler feeds a queue, so no input
// is ever dropped — the wizard works both when typed at a TTY and when driven by piped/scripted
// input. EOF (Ctrl+D or end of a pipe) throws EOFError, which the wizard treats as "quit".
const readline = require('node:readline');
const { stdin, stdout } = require('node:process');

const useColor = stdout.isTTY && !process.env.NO_COLOR;
const C = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', cyan: '\x1b[36m' };
const paint = (col, s) => (useColor ? col + s + C.reset : s);

class EOFError extends Error {}

function createPrompter() {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
  const buffered = [];   // lines read but not yet consumed
  const waiters = [];    // resolvers waiting for the next line
  let closed = false;
  rl.on('line', (line) => {
    const w = waiters.shift();
    if (w) w(line); else buffered.push(line);
  });
  rl.on('close', () => {
    closed = true;
    let w; while ((w = waiters.shift())) w(null);
  });
  function readLine() {
    if (buffered.length) return Promise.resolve(buffered.shift());
    if (closed) return Promise.resolve(null);
    return new Promise((resolve) => waiters.push(resolve));
  }
  async function question(text) {
    stdout.write(text);
    const line = await readLine();
    if (line == null) throw new EOFError();
    return line;
  }

  // Ask for a line of text. `default` is used on empty input; `required` re-asks on empty;
  // `validate(value)` returns an error string to re-ask, or null/undefined to accept.
  async function ask(prompt, opts = {}) {
    const { default: def = '', required = false, validate } = opts;
    const suffix = def ? paint(C.dim, ` [${def}]`) : '';
    for (;;) {
      const raw = (await question(`${prompt}${suffix}: `)).trim();
      const val = raw || def;
      if (required && !val) { console.log(paint(C.yellow, '  (required)')); continue; }
      if (validate && val) {
        const err = validate(val);
        if (err) { console.log(paint(C.yellow, '  ' + err)); continue; }
      }
      return val;
    }
  }

  async function confirm(prompt, def = true) {
    const hint = def ? 'Y/n' : 'y/N';
    const raw = (await question(`${prompt} ${paint(C.dim, '[' + hint + ']')}: `)).trim().toLowerCase();
    if (!raw) return def;
    return raw[0] === 'y';
  }

  // Numbered menu. `options` is [{ label, value }]; returns the chosen value.
  async function choose(prompt, options) {
    console.log(prompt);
    options.forEach((o, i) => console.log('  ' + paint(C.cyan, String(i + 1)) + ') ' + o.label));
    for (;;) {
      const raw = (await question(paint(C.dim, 'choice') + ': ')).trim();
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
      console.log(paint(C.yellow, '  enter a number 1–' + options.length));
    }
  }

  return {
    ask,
    confirm,
    choose,
    close: () => rl.close(),
    title: (s) => console.log(paint(C.cyan, s)),
    dim: (s) => console.log(paint(C.dim, s)),
    note: (s) => console.log(s),
    ok: (s) => console.log(paint(C.green, '✓ ') + s),
    warn: (s) => console.log(paint(C.yellow, 'warning: ') + s),
    error: (s) => console.error(paint(C.red, 'error: ') + s),
    step: (s) => console.log(paint(C.cyan, '• ') + s),
  };
}

module.exports = { createPrompter, EOFError };

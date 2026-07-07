'use strict';

// Guided, menu-driven front-end for the `jext` commands. It only gathers answers (with sane
// defaults + light validation) and then calls the exact same library functions the flag-based CLI
// uses — pack / validate / init / index — so behaviour and output stay identical.
const fs = require('fs');
const path = require('path');
const { createPrompter, EOFError } = require('./prompt');
const { EXTENSION_TYPES } = require('./spec');
const { pack } = require('./pack');
const { validate } = require('./validate');
const { init, slug } = require('./init');
const { index } = require('./indexcmd');
const { CliError } = require('./util');

const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

async function interactive() {
  const p = createPrompter();
  p.title('jext — interactive extension maker');
  p.dim('Answer the prompts; Enter accepts the [default]. Ctrl+C to quit.');
  console.log('');
  try {
    for (;;) {
      const action = await p.choose('What would you like to do?', [
        { label: 'Pack an extension into a .jext', value: 'pack' },
        { label: 'Validate an extension folder or a .jext', value: 'validate' },
        { label: 'Scaffold a new extension (init)', value: 'init' },
        { label: 'Rebuild a marketplace index', value: 'index' },
        { label: 'Quit', value: 'quit' },
      ]);
      if (action === 'quit') break;
      console.log('');
      try {
        if (action === 'pack') await doPack(p);
        else if (action === 'validate') await doValidate(p);
        else if (action === 'init') await doInit(p);
        else if (action === 'index') await doIndex(p);
      } catch (e) {
        // Keep the wizard alive on a recoverable error; only unexpected bugs propagate.
        if (e instanceof CliError) p.error(e.message);
        else throw e;
      }
      console.log('');
      if (!(await p.confirm('Do something else?', true))) break;
      console.log('');
    }
  } catch (e) {
    if (!(e instanceof EOFError)) throw e; // piped input ended / Ctrl+D → quit quietly
  } finally {
    p.close();
  }
}

async function doPack(p) {
  const dir = await p.ask('Extension folder', {
    default: '.',
    required: true,
    validate: (v) => (!exists(v) ? `folder not found: ${v}`
      : !exists(path.join(v, 'extension.yaml')) ? `no extension.yaml in "${v}" (run init first)`
      : null),
  });
  const build = await p.confirm('Run the build step (npm run build, if the extension has one)?', true);
  const out = await p.ask('Output — a folder or a *.jext path (blank = beside the folder)', { default: '' });
  console.log('');
  pack(dir, { out: out || undefined, noBuild: !build });
}

async function doValidate(p) {
  const target = await p.ask('Extension folder or .jext file', {
    default: '.',
    required: true,
    validate: (v) => (exists(v) ? null : `not found: ${v}`),
  });
  console.log('');
  const okFlag = validate(target);
  console.log('');
  if (okFlag) p.ok('valid'); else p.error('invalid — see the messages above');
}

async function doInit(p) {
  const type = await p.choose('Extension type', EXTENSION_TYPES.map((t) => ({ label: t, value: t })));
  const name = await p.ask('Display name', { default: 'My Extension', required: true });
  const suggestedId = `jcode.${type === 'language' ? 'lang' : type}.${slug(name)}`;
  const id = await p.ask('Unique id', { default: suggestedId, required: true });
  const publisher = await p.ask('Publisher', { default: 'you', required: true });
  const dir = await p.ask('Target folder', { default: slug(name), required: true });
  if (exists(path.join(dir, 'extension.yaml'))
      && !(await p.confirm(`"${dir}" already has an extension.yaml — continue (existing files are kept)?`, false))) {
    return;
  }
  console.log('');
  init(dir, { type, name, id, publisher });
}

async function doIndex(p) {
  const dir = await p.ask('Marketplace folder', {
    default: '.',
    required: true,
    validate: (v) => (exists(v) ? null : `not found: ${v}`),
  });
  const dist = await p.ask('dist subfolder (holds the .jext files)', { default: 'dist' });
  console.log('');
  index(dir, { dist: dist || undefined });
}

module.exports = { interactive };

'use strict';

const fs = require('fs');
const path = require('path');
const jehm = require('./jehm');
const { JEHM_SCHEMA, JEHM_FILE, EXTENSION_TYPES } = require('./spec');
const { fail, ok, step, warn } = require('./util');

// Scaffold a new extension folder with a .jehm header + a functional manifest stub.
function init(dir, opts = {}) {
  const target = path.resolve(dir || '.');
  fs.mkdirSync(target, { recursive: true });

  const type = opts.type || 'language';
  if (!EXTENSION_TYPES.includes(type)) fail(`--type must be one of ${EXTENSION_TYPES.join(', ')}`);
  const name = opts.name || path.basename(target);
  const uniqueName = opts.id || `jcode.${type === 'language' ? 'lang' : type}.${slug(name)}`;

  const header = {
    schema: JEHM_SCHEMA,
    uniqueName,
    name,
    version: '1.0.0',
    type,
    publisher: opts.publisher || 'you',
    shortDescription: `A JCode ${type} extension.`,
    minJCodeVersion: '1.0.0',
    targetJCodeVersion: '1.0.0',
    category: type === 'language' ? 'Languages' : type === 'templates' ? 'Templates' : 'Other',
    subcategory: '',
    requires: { sdks: [], lsps: [], extensions: [] },
    suggests: { sdks: [], lsps: [], extensions: [] },
    images: { icon: '', samples: [], walkthrough: [] },
    entry: { manifest: 'extension.yaml', ui: null, libs: [] },
    // Per-package integrity is recorded in .jext-manifest.json at pack time.
    // Signed fingerprints are planned; leave null for now.
    fingerprint: { algo: 'sha256', value: null },
  };

  const body = `# ${name}\n\nDescribe your extension here. This Markdown body is the long\ndescription shown in the marketplace. Reference screenshots from \`media/\`:\n\n<!-- ![Sample](media/sample-1.png) -->\n`;

  writeOnce(path.join(target, JEHM_FILE), jehm.stringify(header, body));
  writeOnce(path.join(target, 'extension.yaml'), manifestStub(uniqueName, name, type));
  fs.mkdirSync(path.join(target, 'media'), { recursive: true });
  writeOnce(path.join(target, 'README.md'), `# ${name}\n\nA JCode ${type} extension. See \`${JEHM_FILE}\` and \`extension.yaml\`.\n`);

  ok(`initialized ${type} extension "${uniqueName}" in ${path.relative(process.cwd(), target) || '.'}`);
  step(`next: edit ${JEHM_FILE} + extension.yaml, then "jext pack ${path.relative(process.cwd(), target) || '.'}"`);
}

function manifestStub(id, name, type) {
  if (type === 'language') {
    return `id: ${id}\nname: ${name}\nversion: 1.0.0\ntype: language\nlanguage:\n  id: ${slug(name)}\n  extensions: [".ext"]\n  comment: { line: "//", blockStart: "/*", blockEnd: "*/" }\n  keywords: []\n  types: []\n  completions: []\n  helpers: []\n`;
  }
  if (type === 'templates') {
    return `id: ${id}\nname: ${name}\nversion: 1.0.0\ntype: templates\ntemplates: []\n`;
  }
  return `id: ${id}\nname: ${name}\nversion: 1.0.0\ntype: ${type}\n`;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ext';
}

function writeOnce(p, content) {
  if (fs.existsSync(p)) {
    warn(`${path.basename(p)} already exists — left unchanged`);
    return;
  }
  fs.writeFileSync(p, content);
}

module.exports = { init, slug };

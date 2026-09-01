'use strict';

const fs = require('fs');
const path = require('path');
const { EXTENSION_TYPES } = require('./spec');
const { fail, ok, step, warn } = require('./util');

// Scaffold a new extension folder: one extension.yaml carrying both the marketplace header and the
// functional manifest, plus media/ and a README.
function init(dir, opts = {}) {
  const target = path.resolve(dir || '.');
  fs.mkdirSync(target, { recursive: true });

  const type = opts.type || 'language';
  if (!EXTENSION_TYPES.includes(type)) fail(`--type must be one of ${EXTENSION_TYPES.join(', ')}`);
  const name = opts.name || path.basename(target);
  const id = opts.id || `jcode.${idSegment(type)}.${slug(name)}`;

  writeOnce(path.join(target, 'extension.yaml'), manifest(id, name, type, opts.publisher || 'you'));
  fs.mkdirSync(path.join(target, 'media'), { recursive: true });
  writeOnce(
    path.join(target, 'README.md'),
    `# ${name}

A JCode ${type} extension. See \`extension.yaml\`.
`,
  );

  ok(`initialized ${type} extension "${id}" in ${path.relative(process.cwd(), target) || '.'}`);
  step(`next: edit extension.yaml, then "jext pack ${path.relative(process.cwd(), target) || '.'}"`);
}

// The middle segment of a default id: `jcode.lang.foo` for a language pack, `jcode.<type>.foo`
// otherwise, so a generated id reads the way the published ones do.
function idSegment(type) {
  return type === 'language' ? 'lang' : type.replace(/-/g, '');
}

function manifest(id, name, type, publisher) {
  const head =
    `id: ${id}
` +
    `name: ${name}
` +
    `version: 1.0.0
` +
    `type: ${type}
` +
    `publisher: ${publisher}
` +
    `description: A JCode ${type} extension.
` +
    `minJCodeVersion: "1.0.0"
` +
    `
` +
    `images:
` +
    `  icon: media/icon.png
`;
  return head + body(type, name);
}

// The type-specific section. Only the shapes a scaffold can usefully pre-fill; everything else is
// documented rather than stubbed, so `jext validate` passes on a fresh folder.
function body(type, name) {
  if (type === 'language') {
    return (
      `
languages:
` +
      `  - languageId: ${slug(name)}
` +
      `    fileExtensions: [".ext"]
` +
      `    lineComment: "//"
` +
      `    blockCommentStart: "/*"
` +
      `    blockCommentEnd: "*/"
` +
      `    keywords: []
` +
      `    types: []
`
    );
  }
  if (type === 'templates') return `
templates: []
`;
  if (['iconpack', 'icon-pack', 'icons', 'icon-theme'].includes(type)) {
    return (
      `
# Art goes in ui-icons/ and/or files-icons/, each with an index.yaml beside it.
` +
      `# Several variants? One directory each: ui-icons/outlined/index.yaml, ui-icons/filled/…
` +
      `# Both are found by convention, so nothing needs declaring here.
` +
      `# See docs/ICON-PACKS.md.
`
    );
  }
  if (['app', 'dbmanager', 'scm', 'vm'].includes(type)) {
    return `
entry:
  ui: www/index.html
`;
  }
  return '';
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

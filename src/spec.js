'use strict';

// Canonical constants for the JEHM header and the JEXT package formats.
// Keep this in sync with docs/JEHM-SPEC.md and docs/JEXT-SPEC.md and with the
// JCode app's parser (feature/marketplace).

const JEHM_FILE = 'extension.jehm';
const JEXT_MANIFEST = '.jext-manifest.json';
const JEHM_SCHEMA = 1;
const JEXT_FORMAT = 1;

// Extension types the marketplace/app understands. `language` and `templates`
// are functional today; the rest are reserved for forward compatibility.
const EXTENSION_TYPES = ['language', 'templates', 'formatter', 'theme', 'icons'];

// Frontmatter fields that must be present and non-empty.
const REQUIRED_FIELDS = [
  'schema',
  'uniqueName',
  'name',
  'version',
  'type',
  'shortDescription',
  'minJCodeVersion',
  'targetJCodeVersion',
];

// Files never included in a .jext package.
const ALWAYS_IGNORE = [
  '.git',
  '.github',
  'node_modules',
  '.jextignore',
  JEXT_MANIFEST,
];

module.exports = {
  JEHM_FILE,
  JEXT_MANIFEST,
  JEHM_SCHEMA,
  JEXT_FORMAT,
  EXTENSION_TYPES,
  REQUIRED_FIELDS,
  ALWAYS_IGNORE,
};

'use strict';

// Canonical constants for the JEXT package format.
// Keep this in sync with docs/JEXT-SPEC.md and with the JCode app's parser (feature/marketplace).

const JEXT_MANIFEST = '.jext-manifest.json';
const JEXT_FORMAT = 1;

// Extension types the marketplace/app understands. `language` and `templates`
// are functional today; the rest are reserved for forward compatibility.
const EXTENSION_TYPES = [
  'language',
  'templates',
  'formatter',
  'theme',
  // An icon pack. The app accepts all four spellings (ExtensionType.from); `iconpack` is canonical.
  'iconpack',
  'icon-pack',
  'icons',
  'icon-theme',
  'app',
  'dbmanager',
  'scm',
  'vm',
];

// The header fields `pack` normalizes out of extension.yaml live in pack.js (normalizeHeader), and
// the ones it insists on live beside them (validateHeader). There is no separate schema here: the
// .jehm frontmatter that needed one was retired into extension.yaml.

// Files never included in a .jext package. Includes the build toolchain — extensions author their
// UI in TypeScript under src/ and `jext pack` builds the deployable www/ (see pack.js runBuild), so
// the source and build config never ship inside the package.
const ALWAYS_IGNORE = [
  '.git',
  '.github',
  '.gitignore',
  'node_modules',
  'src',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'build.mjs',
  '.jextignore',
  JEXT_MANIFEST,
];

module.exports = {
  JEXT_MANIFEST,
  JEXT_FORMAT,
  EXTENSION_TYPES,
  ALWAYS_IGNORE,
};

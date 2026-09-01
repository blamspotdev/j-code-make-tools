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
  'longDescription',
  'samples',
  'maxJCodeVersion',
];

// Optional frontmatter fields the toolchain recognizes. `supportedDistros` /
// `supportedArches` declare which distro ids / arch keys ("arm64", "amd64") an
// extension supports; absent/empty means "every distro/arch". They flow through
// `jext index` into the marketplace so the app can gate availability by the
// active environment. Validation does not reject unlisted fields.
const OPTIONAL_FIELDS = [
  'publisher',
  'authors',
  'category',
  'subcategory',
  'supportedDistros',
  'supportedArches',
  'requires',
  'suggests',
  'images',
  'entry',
  'fingerprint',
];

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
  JEHM_FILE,
  JEXT_MANIFEST,
  JEHM_SCHEMA,
  JEXT_FORMAT,
  EXTENSION_TYPES,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  ALWAYS_IGNORE,
};

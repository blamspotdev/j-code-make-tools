'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');
const { JEXT_MANIFEST, JEXT_FORMAT, EXTENSION_TYPES, ALWAYS_IGNORE } = require('./spec');
const { sha256, sha256File, walkFiles, versionRangeError, fail, step, ok, warn } = require('./util');

// The extension header now lives in extension.yaml (the .jehm file was retired). Normalize the fields
// the package manifest + marketplace need. `id` is the install id (formerly `uniqueName`).
function readHeader(extDir) {
  const yamlPath = path.join(extDir, 'extension.yaml');
  if (!fs.existsSync(yamlPath)) {
    fail(`no extension.yaml at the extension root (${extDir}). Run "jext init" to create one.`);
  }
  let y;
  try {
    y = yaml.load(fs.readFileSync(yamlPath, 'utf8')) || {};
  } catch (e) {
    fail(`extension.yaml is not valid YAML: ${e.message}`);
  }
  return {
    uniqueName: y.id || y.uniqueName,
    name: y.name,
    version: y.version,
    type: y.type,
    publisher: y.publisher,
    authors: y.authors,
    shortDescription: y.shortDescription || y.description,
    longDescription: y.longDescription,
    samples: y.samples,
    minJCodeVersion: y.minJCodeVersion,
    targetJCodeVersion: y.targetJCodeVersion,
    maxJCodeVersion: y.maxJCodeVersion,
    category: y.category,
    subcategory: y.subcategory,
    supportedArches: y.supportedArches,
    supportedDistros: y.supportedDistros,
    images: y.images,
    entry: y.entry,
  };
}

function validateHeader(h) {
  const errs = [];
  for (const k of ['uniqueName', 'name', 'version', 'type']) {
    if (!h[k]) errs.push(`missing required field "${k === 'uniqueName' ? 'id' : k}"`);
  }
  if (h.type && !EXTENSION_TYPES.includes(h.type)) errs.push(`unknown type "${h.type}" (allowed: ${EXTENSION_TYPES.join(', ')})`);
  const range = versionRangeError(h.minJCodeVersion, h.maxJCodeVersion);
  if (range) errs.push(range);
  return errs;
}

// If the extension declares a `build` script (package.json), run it for production before packing.
// Extensions author their UI in TypeScript under src/ and emit the deployable www/ here; the source
// and build config are excluded from the package by ALWAYS_IGNORE. Skip with `--no-build`.
function runBuild(extDir) {
  const pkgPath = path.join(extDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {
    fail(`package.json is not valid JSON: ${e.message}`);
  }
  if (!pkg.scripts || !pkg.scripts.build) return;

  const win = process.platform === 'win32';
  if (!fs.existsSync(path.join(extDir, 'node_modules'))) {
    step('installing build dependencies (npm install)…');
    const i = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: extDir, stdio: 'inherit', shell: win });
    if (i.status !== 0) fail('npm install failed');
  }
  step('building extension for production (npm run build)…');
  const b = spawnSync('npm', ['run', 'build'], { cwd: extDir, stdio: 'inherit', shell: win });
  if (b.status !== 0) fail('extension build (npm run build) failed');
  ok('production build complete');
}

function readJextIgnore(extDir) {
  const p = path.join(extDir, '.jextignore');
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

// Compile an extension folder into a .jext package. Returns the output path.
function pack(extDir, opts = {}) {
  if (!fs.existsSync(extDir) || !fs.statSync(extDir).isDirectory()) {
    fail(`not a directory: ${extDir}`);
  }
  const header = readHeader(extDir);
  const errs = validateHeader(header);
  if (errs.length) {
    fail(`extension.yaml header is invalid:\n  - ${errs.join('\n  - ')}`);
  }

  // Produce the deployable www/ from TypeScript source before we collect files.
  if (!opts.noBuild) runBuild(extDir);

  // Functional payload + referenced asset checks.
  const manifestRel = (header.entry && header.entry.manifest) || 'extension.yaml';
  if (['language', 'templates', 'formatter'].includes(header.type)) {
    if (!fs.existsSync(path.join(extDir, manifestRel))) {
      fail(`type "${header.type}" needs its functional manifest "${manifestRel}" (entry.manifest) — not found`);
    }
  }
  for (const imgRel of collectImagePaths(header)) {
    if (!fs.existsSync(path.join(extDir, imgRel))) {
      warn(`images: referenced file "${imgRel}" does not exist — it won't be in the package`);
    }
  }

  const ignore = ALWAYS_IGNORE.concat(readJextIgnore(extDir));
  const files = walkFiles(extDir, ignore).filter((rel) => !rel.endsWith('.jext'));
  if (!files.includes('extension.yaml')) fail('internal: extension.yaml was excluded from the package');

  step(`packing ${files.length} files from ${path.basename(extDir)}`);

  // Per-file digests + a deterministic package fingerprint (order-independent).
  const fileEntries = files.map((rel) => {
    const abs = path.join(extDir, rel);
    return { path: rel, sha256: sha256File(abs), size: fs.statSync(abs).size };
  });
  const fingerprintValue = sha256(fileEntries.map((f) => `${f.path}\t${f.sha256}`).join('\n'));

  const pkgManifest = {
    jext: JEXT_FORMAT,
    uniqueName: header.uniqueName,
    name: header.name,
    version: header.version,
    type: header.type,
    minJCodeVersion: header.minJCodeVersion,
    targetJCodeVersion: header.targetJCodeVersion,
    maxJCodeVersion: header.maxJCodeVersion,
    files: fileEntries,
    fingerprint: { algo: 'sha256', value: fingerprintValue },
  };

  const zip = new AdmZip();
  for (const rel of files) {
    zip.addLocalFile(path.join(extDir, rel), path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel));
  }
  zip.addFile(JEXT_MANIFEST, Buffer.from(JSON.stringify(pkgManifest, null, 2) + '\n', 'utf8'));

  const outName = `${header.uniqueName}-${header.version}.jext`;
  // `-o foo.jext` is an exact file; anything else (or omitted) is a directory.
  let outPath;
  if (opts.out && opts.out.toLowerCase().endsWith('.jext')) {
    outPath = path.resolve(opts.out);
  } else {
    outPath = path.join(path.resolve(opts.out || process.cwd()), outName);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  zip.writeZip(outPath);

  ok(`wrote ${path.relative(process.cwd(), outPath) || outPath}`);
  step(`fingerprint sha256:${fingerprintValue.slice(0, 16)}…`);
  return { outPath, fingerprint: fingerprintValue, manifest: pkgManifest, header };
}

function collectImagePaths(header) {
  const imgs = [];
  const i = header.images || {};
  if (i.icon) imgs.push(i.icon);
  for (const s of i.samples || []) imgs.push(s);
  for (const w of i.walkthrough || []) if (w && w.image) imgs.push(w.image);
  return imgs;
}

module.exports = { pack, collectImagePaths, readHeader, validateHeader };

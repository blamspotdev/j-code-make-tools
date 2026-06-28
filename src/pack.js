'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const jehm = require('./jehm');
const { JEHM_FILE, JEXT_MANIFEST, JEXT_FORMAT, ALWAYS_IGNORE } = require('./spec');
const { sha256, sha256File, walkFiles, fail, step, ok, warn } = require('./util');

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
  const jehmPath = path.join(extDir, JEHM_FILE);
  if (!fs.existsSync(jehmPath)) {
    fail(`no ${JEHM_FILE} at the extension root (${extDir}). Run "jext init" to create one.`);
  }

  const { header } = jehm.parseFile(jehmPath);
  const errs = jehm.validateHeader(header);
  if (errs.length) {
    fail(`${JEHM_FILE} is invalid:\n  - ${errs.join('\n  - ')}`);
  }

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
  if (!files.includes(JEHM_FILE)) fail(`internal: ${JEHM_FILE} was excluded from the package`);

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

module.exports = { pack, collectImagePaths };

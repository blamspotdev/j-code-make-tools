'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');
const { validateIconPack } = require('./iconpacks');
const jehm = require('./jehm');
const { collectImagePaths, readHeader, validateHeader } = require('./pack');
const { JEHM_FILE, JEXT_MANIFEST } = require('./spec');
const { sha256, fail, ok, step, warn } = require('./util');

// Validate either an extension directory or a built .jext package.
function validate(target) {
  if (!fs.existsSync(target)) fail(`not found: ${target}`);
  const stat = fs.statSync(target);
  if (stat.isDirectory()) return validateDir(target);
  if (target.endsWith('.jext')) return validatePackage(target);
  fail(`don't know how to validate "${target}" — pass an extension folder or a .jext file`);
}

function validateDir(dir) {
  // The header moved into extension.yaml (the .jehm was retired), and `pack` already reads it from
  // there — so validating a modern package must not still insist on a file it no longer ships, and
  // must hold it to the rules `pack` will apply rather than the .jehm schema's longer required list.
  // The two disagreeing means `jext validate` can refuse a package `jext pack` happily builds.
  const legacy = path.join(dir, JEHM_FILE);
  const hasLegacyHeader = fs.existsSync(legacy);
  const header = hasLegacyHeader ? jehm.parseFile(legacy).header : readHeader(dir);
  const errs = hasLegacyHeader ? jehm.validateHeader(header) : validateHeader(header);
  const manifestRel = (header.entry && header.entry.manifest) || 'extension.yaml';
  if (['language', 'templates', 'formatter'].includes(header.type) && !fs.existsSync(path.join(dir, manifestRel))) {
    errs.push(`functional manifest "${manifestRel}" not found`);
  }
  for (const img of collectImagePaths(header)) {
    if (!fs.existsSync(path.join(dir, img))) warn(`image "${img}" referenced in header but not present`);
  }
  // Icon sets are found by convention, so this runs for every extension, not only a declared pack.
  const icons = validateIconPack(dir, header, readManifest(dir, manifestRel));
  errs.push(...icons.errs);
  icons.warns.forEach((w) => warn(w));
  icons.notes.forEach((n) => step(n));
  finish(header, errs, dir);
  return errs.length === 0;
}

// The functional manifest, for the sections the .jehm header does not carry (contributes.*).
// A missing or unreadable one is not an error here — validateDir already reports that where it is.
function readManifest(dir, manifestRel) {
  const file = path.join(dir, manifestRel);
  if (!fs.existsSync(file)) return null;
  try {
    const doc = yaml.load(fs.readFileSync(file, 'utf8'));
    return doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : null;
  } catch (e) {
    warn(`${manifestRel}: invalid YAML — ${e.message}`);
    return null;
  }
}

function validatePackage(jextPath) {
  let zip;
  try {
    zip = new AdmZip(jextPath);
  } catch (e) {
    fail(`cannot read .jext (not a valid zip?): ${e.message}`);
  }
  const jehmEntry = zip.getEntry(JEHM_FILE);
  if (!jehmEntry) fail(`${path.basename(jextPath)} has no ${JEHM_FILE}`);
  const { header } = jehm.parse(zip.readAsText(jehmEntry), JEHM_FILE);
  const errs = jehm.validateHeader(header);

  const manEntry = zip.getEntry(JEXT_MANIFEST);
  if (!manEntry) {
    errs.push(`missing ${JEXT_MANIFEST}`);
  } else {
    let man;
    try {
      man = JSON.parse(zip.readAsText(manEntry));
    } catch (e) {
      errs.push(`${JEXT_MANIFEST} is not valid JSON: ${e.message}`);
    }
    if (man) {
      for (const f of man.files || []) {
        const e = zip.getEntry(f.path);
        if (!e) {
          errs.push(`manifest lists "${f.path}" but it's missing from the package`);
          continue;
        }
        const got = sha256(zip.readFile(e));
        if (got !== f.sha256) errs.push(`checksum mismatch for "${f.path}"`);
      }
      const recomputed = sha256((man.files || []).map((f) => `${f.path}\t${f.sha256}`).join('\n'));
      if (man.fingerprint && man.fingerprint.value && man.fingerprint.value !== recomputed) {
        errs.push(`package fingerprint does not match its file list`);
      } else {
        step(`fingerprint sha256:${recomputed.slice(0, 16)}… verified`);
      }
    }
  }
  finish(header, errs, path.basename(jextPath));
  return errs.length === 0;
}

function finish(header, errs, label) {
  if (errs.length) {
    fail(`${label} is invalid:\n  - ${errs.join('\n  - ')}`);
  }
  ok(`${header.uniqueName} ${header.version} (${header.type}) — valid`);
}

module.exports = { validate };

'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const jehm = require('./jehm');
const { collectImagePaths } = require('./pack');
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
  const jehmPath = path.join(dir, JEHM_FILE);
  if (!fs.existsSync(jehmPath)) fail(`no ${JEHM_FILE} at ${dir}`);
  const { header } = jehm.parseFile(jehmPath);
  const errs = jehm.validateHeader(header);
  const manifestRel = (header.entry && header.entry.manifest) || 'extension.yaml';
  if (['language', 'templates', 'formatter'].includes(header.type) && !fs.existsSync(path.join(dir, manifestRel))) {
    errs.push(`functional manifest "${manifestRel}" not found`);
  }
  for (const img of collectImagePaths(header)) {
    if (!fs.existsSync(path.join(dir, img))) warn(`image "${img}" referenced in header but not present`);
  }
  finish(header, errs, dir);
  return errs.length === 0;
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

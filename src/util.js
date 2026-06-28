'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
function paint(c, s) {
  return useColor ? c + s + C.reset : s;
}

function info(msg) {
  console.log(msg);
}
function step(msg) {
  console.log(paint(C.cyan, '• ') + msg);
}
function ok(msg) {
  console.log(paint(C.green, '✓ ') + msg);
}
function warn(msg) {
  console.warn(paint(C.yellow, 'warning: ') + msg);
}
class CliError extends Error {}
function fail(msg) {
  throw new CliError(msg);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

// SemVer (major.minor.patch, optional -prerelease) comparison. Returns -1/0/1.
function parseSemver(v) {
  const m = String(v).trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null };
}
function isSemver(v) {
  return parseSemver(v) != null;
}
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (const k of ['major', 'minor', 'patch']) {
    if (pa[k] !== pb[k]) return pa[k] < pb[k] ? -1 : 1;
  }
  // A version with a pre-release is lower than the same without one.
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && pb.pre) return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0;
  return 0;
}

// Recursively list files under `dir` as POSIX-relative paths, skipping any path
// segment in `ignore` (exact segment match).
function walkFiles(dir, ignore) {
  const ignoreSet = new Set(ignore || []);
  const out = [];
  (function rec(abs, rel) {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (ignoreSet.has(entry.name)) continue;
      const childAbs = path.join(abs, entry.name);
      const childRel = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        rec(childAbs, childRel);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  })(dir, '');
  out.sort();
  return out;
}

module.exports = {
  paint,
  C,
  info,
  step,
  ok,
  warn,
  fail,
  CliError,
  sha256,
  sha256File,
  parseSemver,
  isSemver,
  compareSemver,
  walkFiles,
};

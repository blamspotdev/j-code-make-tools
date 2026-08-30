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
/**
 * Every file under `dir`, minus what `ignore` excludes.
 *
 * An entry is matched by BASE NAME at any depth -- `build` drops every `build` directory in the
 * tree. That is usually what someone means and occasionally the opposite: an extension whose Gradle
 * root is its package root has to exclude the wrapper directory `gradle/`, and doing it by name also
 * dropped `languages/gradle/`, silently shipping a language pack short of a language.
 *
 * An entry beginning with `/` is anchored to the package root instead, so `/gradle` excludes the
 * wrapper and leaves `languages/gradle` alone. Unanchored entries keep their old meaning.
 */
function walkFiles(dir, ignore) {
  const names = new Set();
  const rooted = new Set();
  for (const entry of ignore || []) {
    if (entry.startsWith('/')) rooted.add(entry.slice(1).replace(/\/+$/, ''));
    else names.add(entry);
  }
  const out = [];
  (function rec(abs, rel) {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? rel + '/' + entry.name : entry.name;
      if (names.has(entry.name) || rooted.has(childRel)) continue;
      const childAbs = path.join(abs, entry.name);
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

// A ceiling below the floor describes no JCode at all — the app would refuse the package on every
// version there is. Returns a problem string, or null when the pair is fine (either side may be
// absent, and a non-semver value is left to the semver check to report).
function versionRangeError(min, max) {
  if (!min || !max || !isSemver(min) || !isSemver(max)) return null;
  if (compareSemver(min, max) <= 0) return null;
  return `"maxJCodeVersion" (${max}) is below "minJCodeVersion" (${min}) — no JCode version can run this`;
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
  versionRangeError,
  walkFiles,
};

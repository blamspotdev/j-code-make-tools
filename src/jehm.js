'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const { JEHM_SCHEMA, EXTENSION_TYPES, REQUIRED_FIELDS } = require('./spec');
const { isSemver, versionRangeError, fail } = require('./util');

// A .jehm file is YAML frontmatter delimited by `---` lines, followed by a
// Markdown body. Returns { header: object, body: string }.
function parse(content, sourceLabel) {
  const label = sourceLabel || 'extension.jehm';
  const text = content.replace(/^﻿/, ''); // strip BOM
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/);
  if (!m) {
    fail(`${label}: missing YAML frontmatter (file must start with a "---" line, header fields, then a "---" line)`);
  }
  let header;
  try {
    header = yaml.load(m[1]) || {};
  } catch (e) {
    fail(`${label}: invalid YAML frontmatter — ${e.message}`);
  }
  if (typeof header !== 'object' || Array.isArray(header)) {
    fail(`${label}: frontmatter must be a YAML mapping`);
  }
  return { header, body: (m[2] || '').trim() };
}

function parseFile(filePath) {
  return parse(fs.readFileSync(filePath, 'utf8'), filePath);
}

// Returns an array of human-readable problem strings ([] when valid).
function validateHeader(header) {
  const errs = [];
  for (const f of REQUIRED_FIELDS) {
    const v = header[f];
    if (v === undefined || v === null || v === '') errs.push(`missing required field "${f}"`);
  }
  if (header.schema !== undefined && header.schema !== JEHM_SCHEMA) {
    errs.push(`unsupported "schema" ${header.schema} (this tool writes/reads schema ${JEHM_SCHEMA})`);
  }
  if (header.type !== undefined && !EXTENSION_TYPES.includes(header.type)) {
    errs.push(`"type" must be one of ${EXTENSION_TYPES.join(', ')} (got "${header.type}")`);
  }
  if (header.uniqueName !== undefined && !/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(String(header.uniqueName))) {
    errs.push(`"uniqueName" should be reverse-DNS, lower-case, e.g. "jcode.lang.csharp" (got "${header.uniqueName}")`);
  }
  for (const f of ['version', 'minJCodeVersion', 'targetJCodeVersion', 'maxJCodeVersion']) {
    if (header[f] !== undefined && header[f] !== null && header[f] !== '' && !isSemver(header[f])) {
      errs.push(`"${f}" must be semver (major.minor.patch), got "${header[f]}"`);
    }
  }
  const range = versionRangeError(header.minJCodeVersion, header.maxJCodeVersion);
  if (range) errs.push(range);
  return errs;
}

// Render a header object + markdown body back into .jehm text (used by `init`).
function stringify(header, body) {
  const fm = yaml.dump(header, { lineWidth: 100, noRefs: true, sortKeys: false });
  return `---\n${fm}---\n\n${(body || '').trim()}\n`;
}

module.exports = { parse, parseFile, validateHeader, stringify };

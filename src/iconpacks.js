'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Icon-pack layout and index checks. Keep in sync with docs/ICON-PACKS.md and with the JCode app
// (feature/marketplace IconPackLayout, core/design IconPackLoader).
//
// A pack ships a UI icon set, a file icon set, or both. The indexes are found by convention unless
// `contributes.iconSets` names them; see resolve() for the order.

const INDEX_NAMES = ['index.yaml', 'index.yml'];
const UI_DIR = 'ui-icons';
const FILES_DIR = 'files-icons';
const UI_FLAT = ['ui-icons.yaml', 'ui-icons.yml'];
const FILES_FLAT = ['files-icons.yaml', 'files-icons.yml'];

// Types the app treats as an icon pack (ExtensionType.from).
const ICON_PACK_TYPES = ['iconpack', 'icon-pack', 'icons', 'icontheme', 'icon-theme'];

// Art formats the app can decode (IconArtLoader.SUPPORTED).
const ART_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];

// JCodeIcon slot names, lowercased. A UI index keys its icons by these.
const UI_SLOTS = new Set(
  (
    'Run Stop Terminal ' +
    'Files Folder OpenFolder NewFolder NewFile ' +
    'Sdk Lsp Scm Settings Search Extensions Sources Destinations Code Database Vm ' +
    'Add Minus Close Refresh Paste Collapse MoreVert Save Undo Redo Discard ' +
    'Continue Pause Rerun StepInto StepOver StepOut ' +
    'Output Logs Problems Radar Debug Tasks Chat Cursor ' +
    'Browser DevTools Image ' +
    'DropDown ChevronDown ChevronUp ChevronRight ArrowUp ArrowBack ArrowForward MenuToggle Help ' +
    'Copy Cut Delete Open Rename SelectAll Clear Definition References Format ' +
    'Preview Pin Palette CommandPalette ScreenRotation Fullscreen KeepAwake ' +
    'Lock LockOpen ' +
    'TextIncrease TextDecrease GoToLine ' +
    'Trash Restore'
  )
    .split(/\s+/)
    .map((s) => s.toLowerCase()),
);

function isIconPackType(type) {
  return ICON_PACK_TYPES.includes(String(type || '').toLowerCase());
}

// The sets inside `rel`: itself when it holds an index, otherwise each subdirectory that does.
// Sorted by name so the order a pack's variants are offered in does not depend on the filesystem.
function setsIn(dir, rel) {
  const abs = path.join(dir, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];
  const own = INDEX_NAMES.map((n) => path.join(rel, n)).find((r) => fs.existsSync(path.join(dir, r)));
  if (own) return [own];
  return fs
    .readdirSync(abs)
    .filter((name) => fs.statSync(path.join(abs, name)).isDirectory())
    .sort()
    .map((name) => INDEX_NAMES.map((n) => path.join(rel, name, n)).find((r) => fs.existsSync(path.join(dir, r))))
    .filter(Boolean);
}

function asList(value) {
  if (value === undefined || value === null || value === '') return [];
  return (Array.isArray(value) ? value : [value]).map((v) => String(v).trim()).filter(Boolean);
}

// Where a pack's indexes are. `declared` is `contributes.iconSets` (or undefined); each half may be
// a single path or a list, naming an index file or a directory. Returns { ui, files, errs } with
// paths relative to `dir`.
function resolve(dir, declared) {
  const errs = [];
  const find = (value, conventionalDir, flat, label) => {
    const declaredPaths = asList(value);
    if (declaredPaths.length === 0) {
      const found = setsIn(dir, conventionalDir);
      if (found.length) return found;
      return flat.filter((rel) => fs.existsSync(path.join(dir, rel)));
    }
    const out = [];
    for (const rel of declaredPaths) {
      const abs = path.join(dir, rel);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        out.push(rel);
        continue;
      }
      const inside = setsIn(dir, rel);
      // A declared path that resolves to nothing is NOT quietly replaced by a conventional index:
      // the pack said where its icons are, and being wrong about that is worth reporting.
      if (inside.length === 0) errs.push(`${label} points at "${rel}", which holds no index.yaml`);
      out.push(...inside);
    }
    return out;
  };
  const sets = declared && typeof declared === 'object' ? declared : {};
  return {
    ui: find(sets.ui, UI_DIR, UI_FLAT, '`contributes.iconSets.ui`'),
    files: find(sets.files, FILES_DIR, FILES_FLAT, '`contributes.iconSets.files`'),
    errs,
  };
}

function loadIndex(dir, rel, errs) {
  let doc;
  try {
    doc = yaml.load(fs.readFileSync(path.join(dir, rel), 'utf8'));
  } catch (e) {
    errs.push(`${rel}: invalid YAML — ${e.message}`);
    return null;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    errs.push(`${rel}: must be a YAML mapping`);
    return null;
  }
  return doc;
}

// Where an index's art lives: `base:` relative to the index, defaulting to the index's directory.
function baseDirOf(dir, indexRel, doc) {
  const parent = path.dirname(path.join(dir, indexRel));
  const declared = doc.base ? String(doc.base).trim() : '';
  if (!declared) return parent;
  const candidate = path.join(parent, declared);
  return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : parent;
}

// Checks one `icons:` entry: shorthand string or `{ file: … }` mapping.
function checkArt(base, packRoot, raw, label, errs) {
  const file = raw && typeof raw === 'object' ? raw.file : raw;
  if (typeof file !== 'string' || file.trim() === '') {
    errs.push(`${label}: no art file — use "name.svg" or "{ file: name.svg }"`);
    return null;
  }
  const abs = path.resolve(base, file.trim());
  // Art must stay inside the package: the app refuses a path that climbs out of it.
  const root = path.resolve(packRoot);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    errs.push(`${label}: "${file}" is outside the package`);
    return null;
  }
  if (!ART_EXTENSIONS.includes(path.extname(abs).toLowerCase())) {
    errs.push(`${label}: "${file}" is not a supported format (${ART_EXTENSIONS.join(', ')})`);
    return null;
  }
  if (!fs.existsSync(abs)) {
    errs.push(`${label}: "${file}" not found`);
    return null;
  }
  return abs;
}

function checkUiIndex(dir, rel, errs, warns) {
  const doc = loadIndex(dir, rel, errs);
  if (!doc) return;
  const base = baseDirOf(dir, rel, doc);
  const icons = doc.icons && typeof doc.icons === 'object' ? doc.icons : {};
  const slots = Object.keys(icons);
  if (slots.length === 0) {
    errs.push(`${rel}: defines no \`icons:\` — the set would never be offered`);
    return;
  }
  let usable = 0;
  for (const slot of slots) {
    if (!UI_SLOTS.has(slot.toLowerCase())) {
      warns.push(`${rel}: "${slot}" is not a JCodeIcon slot — ignored`);
      continue;
    }
    if (checkArt(base, dir, icons[slot], `${rel} › ${slot}`, errs)) usable++;
  }
  const aliases = doc.aliases && typeof doc.aliases === 'object' ? doc.aliases : {};
  for (const [slot, target] of Object.entries(aliases)) {
    if (!UI_SLOTS.has(String(slot).toLowerCase())) {
      warns.push(`${rel}: alias "${slot}" is not a JCodeIcon slot — ignored`);
    } else if (!Object.keys(icons).some((k) => k.toLowerCase() === String(target).toLowerCase())) {
      warns.push(`${rel}: alias "${slot}" points at "${target}", which is not defined — ignored`);
    }
  }
  if (usable === 0) errs.push(`${rel}: no usable icons — the set would never be offered`);
}

function checkFileIndex(dir, rel, errs, warns) {
  const doc = loadIndex(dir, rel, errs);
  if (!doc) return;
  const base = baseDirOf(dir, rel, doc);
  const icons = doc.icons && typeof doc.icons === 'object' ? doc.icons : {};
  const ids = Object.keys(icons);
  if (ids.length === 0) {
    errs.push(`${rel}: defines no \`icons:\` — the set would never be offered`);
    return;
  }
  for (const id of ids) checkArt(base, dir, icons[id], `${rel} › ${id}`, errs);

  const aliases = doc.aliases && typeof doc.aliases === 'object' ? doc.aliases : {};
  const known = new Set([...ids, ...Object.keys(aliases)]);
  for (const [alias, target] of Object.entries(aliases)) {
    if (!ids.includes(String(target))) {
      warns.push(`${rel}: alias "${alias}" points at "${target}", which is not defined — ignored`);
    }
  }

  // A rule pointing at an icon the pack never defined is silently dropped by the app, so the pack
  // installs and simply never draws that icon. Say so here instead.
  for (const key of ['files', 'folders']) {
    const rules = Array.isArray(doc[key]) ? doc[key] : [];
    rules.forEach((rule, i) => {
      const at = `${rel} › ${key}[${i}]`;
      if (!rule || typeof rule !== 'object') {
        warns.push(`${at}: not a mapping — ignored`);
        return;
      }
      if (!rule.icon) {
        warns.push(`${at}: no \`icon:\` — ignored`);
        return;
      }
      if (!known.has(String(rule.icon))) {
        warns.push(`${at}: \`icon: ${rule.icon}\` is not defined — the rule never matches`);
      }
      if (rule.openIcon && !known.has(String(rule.openIcon))) {
        warns.push(`${at}: \`openIcon: ${rule.openIcon}\` is not defined — ignored`);
      }
      const predicates = ['names', 'globs', 'patterns', 'extensions', 'glob', 'pattern'];
      if (!predicates.some((p) => rule[p] !== undefined)) {
        warns.push(`${at}: no ${predicates.slice(0, 4).join('/')} — the rule never matches`);
      }
      for (const raw of [].concat(rule.patterns || [], rule.pattern ? [rule.pattern] : [])) {
        try {
          new RegExp(String(raw));
        } catch (e) {
          warns.push(`${at}: pattern "${raw}" is not a valid regular expression — ignored`);
        }
      }
    });
  }

  const defaults = doc.defaults && typeof doc.defaults === 'object' ? doc.defaults : {};
  for (const key of ['file', 'folder', 'folderOpen']) {
    if (defaults[key] && !known.has(String(defaults[key]))) {
      warns.push(`${rel}: \`defaults.${key}: ${defaults[key]}\` is not defined — ignored`);
    }
  }
}

/**
 * Validates the icon-pack half of an extension directory.
 *
 * Returns { errs, warns, notes }. An extension that ships no index and does not claim to be an icon
 * pack produces nothing — this is a no-op for every other kind of extension.
 */
function validateIconPack(dir, header, manifest) {
  const errs = [];
  const warns = [];
  const notes = [];
  const declared = manifest && manifest.contributes ? manifest.contributes.iconSets : undefined;
  const { ui, files, errs: resolveErrs } = resolve(dir, declared);
  errs.push(...resolveErrs);

  const claimsIconPack = isIconPackType(header && header.type);
  if (ui.length === 0 && files.length === 0) {
    if (claimsIconPack) {
      errs.push(
        '`type: iconpack` but no icon index found — add `ui-icons/index.yaml`, ' +
          '`files-icons/index.yaml`, or `contributes.iconSets`',
      );
    }
    return { errs, warns, notes };
  }
  if (!claimsIconPack) {
    notes.push('provides icon sets; `type: iconpack` classifies it as one in the marketplace');
  }
  for (const rel of ui) {
    checkUiIndex(dir, rel, errs, warns);
    notes.push(`UI icon set: ${rel}`);
  }
  for (const rel of files) {
    checkFileIndex(dir, rel, errs, warns);
    notes.push(`file icon set: ${rel}`);
  }
  if (ui.length && !files.length) notes.push('UI icons only — file icons stay as chosen');
  if (files.length && !ui.length) notes.push('file icons only — UI icons stay as chosen');
  if (ui.length + files.length > 1) {
    notes.push(`${ui.length} UI and ${files.length} file icon set(s) — each is offered separately in Settings`);
  }
  return { errs, warns, notes };
}

module.exports = { validateIconPack, resolve, isIconPackType, ICON_PACK_TYPES, UI_SLOTS, ART_EXTENSIONS };

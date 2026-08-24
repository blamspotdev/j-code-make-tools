'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');
const jehm = require('./jehm');
const { JEHM_FILE, JEXT_MANIFEST } = require('./spec');
const { fail, ok, step, warn } = require('./util');

// Regenerate an index from the .jext packages in <marketplaceDir>/<distDir>
// (default "dist"), written to <marketplaceDir>/<out> (default "marketplace.yaml").
// The app reads this index to browse, then downloads the referenced .jext to install.
// Naming both lets one marketplace serve several app generations at once: a frozen
// dist/ + marketplace.yaml for older builds beside a dist_v2/ + marketplace_v2.yaml.
function index(marketplaceDir, opts = {}) {
  const root = path.resolve(marketplaceDir || '.');
  const distName = opts.dist || 'dist';
  const distDir = path.join(root, distName);
  if (!fs.existsSync(distDir)) fail(`no ${distName}/ folder in ${root} — pack extensions into it first`);

  const jexts = fs
    .readdirSync(distDir)
    .filter((f) => f.endsWith('.jext'))
    .sort();
  if (!jexts.length) warn(`no .jext files in ${distName}/`);

  // Preserve the marketplace's own header fields if an index already exists.
  const indexPath = path.join(root, opts.out || 'marketplace.yaml');
  let top = { name: 'JCode Marketplace', publisher: 'jcode', version: '1.0.0', description: 'Registry of installable JCode extensions (.jext packages).' };
  if (fs.existsSync(indexPath)) {
    try {
      const prev = yaml.load(fs.readFileSync(indexPath, 'utf8')) || {};
      for (const k of ['name', 'publisher', 'version', 'description']) if (prev[k]) top[k] = prev[k];
    } catch (_) {
      /* fall back to defaults */
    }
  }

  const extensions = [];
  for (const file of jexts) {
    const buf = fs.readFileSync(path.join(distDir, file));
    let header;
    let fingerprint = null;
    let iconRel = null;
    let iconBytes = null;

    if (buf.length > 9 && buf.subarray(0, 4).toString('ascii') === 'JEXT' && buf[4] === 2) {
      // Signed + encrypted (format 2): the CLEAR header carries the marketplace metadata + icon,
      // so we can index without the AES key.
      const headerLen = buf.readUInt32BE(5);
      header = JSON.parse(buf.subarray(9, 9 + headerLen).toString('utf8'));
      fingerprint = header.packageFingerprint ? { algo: 'sha256', value: header.packageFingerprint } : null;
      iconRel = (header.images && header.images.icon) || 'media/icon.png';
      iconBytes = header.icon ? Buffer.from(header.icon, 'base64') : null;
    } else {
      // Plain zip (format 1): prefer the merged extension.yaml, fall back to a legacy extension.jehm.
      const zip = new AdmZip(buf);
      const yEntry = zip.getEntry('extension.yaml');
      if (yEntry) {
        const y = yaml.load(zip.readAsText(yEntry)) || {};
        header = {
          uniqueName: y.id || y.uniqueName, name: y.name, version: y.version, type: y.type,
          publisher: y.publisher, authors: y.authors, shortDescription: y.shortDescription || y.description,
          longDescription: y.longDescription, samples: y.samples,
          minJCodeVersion: y.minJCodeVersion, targetJCodeVersion: y.targetJCodeVersion,
          maxJCodeVersion: y.maxJCodeVersion,
          category: y.category, subcategory: y.subcategory, supportedArches: y.supportedArches,
          supportedDistros: y.supportedDistros, images: y.images, requires: y.requires, suggests: y.suggests,
        };
      } else {
        const jEntry = zip.getEntry(JEHM_FILE);
        if (!jEntry) { warn(`${file}: no extension.yaml or ${JEHM_FILE} — skipped`); continue; }
        header = jehm.parse(zip.readAsText(jEntry), `${file}!${JEHM_FILE}`).header;
      }
      const manEntry = zip.getEntry(JEXT_MANIFEST);
      if (manEntry) { try { fingerprint = JSON.parse(zip.readAsText(manEntry)).fingerprint || null; } catch (_) { /* ignore */ } }
      iconRel = (header.images && header.images.icon) || 'media/icon.png';
      const iEntry = zip.getEntry(iconRel);
      iconBytes = iEntry ? iEntry.getData() : null;
    }

    if (!header || !header.uniqueName) { warn(`${file}: no id/uniqueName — skipped`); continue; }
    const entry = {
      uniqueName: header.uniqueName,
      name: header.name,
      publisher: header.publisher || null,
      type: header.type,
      version: header.version,
      category: header.category || null,
      subcategory: header.subcategory || null,
      shortDescription: header.shortDescription || null,
      minJCodeVersion: header.minJCodeVersion,
      targetJCodeVersion: header.targetJCodeVersion,
      jext: `${distName}/${file}`,
      fingerprint: fingerprint,
    };
    // Only when declared: an absent ceiling must not appear as a null in every entry.
    if (header.maxJCodeVersion) entry.maxJCodeVersion = header.maxJCodeVersion;
    // The detail page has room for more than one sentence and the app already reads both — they
    // simply never reached the index, so every extension read as a single line.
    if (header.longDescription) entry.longDescription = header.longDescription;
    if (header.samples) entry.samples = header.samples;
    if (header.authors) entry.authors = header.authors;
    if (header.requires) entry.requires = header.requires;
    if (header.suggests) entry.suggests = header.suggests;
    if (header.supportedDistros) entry.supportedDistros = header.supportedDistros;
    if (header.supportedArches) entry.supportedArches = header.supportedArches;
    if (header.images) entry.images = header.images;
    // Publish the package icon out to dist/icons/ so the app can show it before install
    // (the rest of the package's media only exists inside the .jext).
    if (iconBytes) {
      const ext = path.extname(iconRel || '') || '.png';
      const iconsDir = path.join(distDir, 'icons');
      fs.mkdirSync(iconsDir, { recursive: true });
      const iconName = `${header.uniqueName}${ext}`;
      fs.writeFileSync(path.join(iconsDir, iconName), iconBytes);
      entry.icon = `${distName}/icons/${iconName}`;
    } else if (iconRel) {
      warn(`${file}: icon "${iconRel}" not found in package`);
    }
    extensions.push(entry);
    step(`indexed ${header.uniqueName} ${header.version}`);
  }

  extensions.sort((a, b) => a.uniqueName.localeCompare(b.uniqueName));
  const out = Object.assign({}, top, { extensions });
  const header =
    `# The \`extensions:\` list is generated by \`jext index\` from ${distName}/*.jext —\n` +
    '# edit each extension\'s .jehm and re-pack, do not hand-edit entries.\n' +
    '# The top-level fields (name/publisher/version/description) are preserved\n' +
    '# across runs, so edit those here.\n';
  const yamlText = header + yaml.dump(out, { lineWidth: 100, noRefs: true, sortKeys: false });
  fs.writeFileSync(indexPath, yamlText);
  ok(`wrote ${path.relative(process.cwd(), indexPath) || indexPath} (${extensions.length} extensions)`);
}

module.exports = { index };

# j-code-make-tools

JCode extension making tools. Compile an extension folder into a **`.jext`**
package (a zip, like VS Code's `.vsix`) and validate its **`.jehm`** header.

## Install

```bash
cd j-code-make-tools
npm install
# optional: make `jext` available globally
npm link
```

Or run without linking: `node bin/jext.js <command>`.

## Commands

```bash
jext init my-ext --type language --name "My Lang"   # scaffold .jehm + manifest
jext validate path/to/extension                     # validate the folder's .jehm
jext pack path/to/extension -o dist/                 # folder -> <id>-<ver>.jext
jext validate dist/jcode.lang.csharp-1.0.0.jext      # verify a built package
jext index path/to/j-code-marketplace                # regenerate marketplace.yaml from dist/*.jext
```

## What it produces

- **`.jehm`** — the extension header: YAML frontmatter (metadata) + Markdown body.
  See [`docs/JEHM-SPEC.md`](docs/JEHM-SPEC.md).
- **`.jext`** — the distributable package: a zip of the extension + a generated
  `.jext-manifest.json` (per-file SHA-256 + an order-independent fingerprint).
  See [`docs/JEXT-SPEC.md`](docs/JEXT-SPEC.md).

The JCode app installs extensions **only** from `.jext` packages, verifying the
fingerprint and the `minJCodeVersion` before extracting.

> No GitHub Actions / CI: everything runs locally via this CLI.

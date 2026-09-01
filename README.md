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

## Interactive mode

Prefer a guided flow over remembering flags? Run the wizard:

```bash
jext interactive     # or just `jext` with no arguments in a terminal
```

It presents a menu — **pack**, **validate**, **init**, **index** — and asks for each input with a
sensible `[default]` (Enter accepts it), then runs the same underlying command. Ctrl+C quits. In a
non-interactive shell (pipe / CI) a bare `jext` prints usage instead of prompting.

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

## Writing an extension

- [**`docs/CREATING-EXTENSIONS.md`**](docs/CREATING-EXTENSIONS.md) — the walkthrough:
  what the manifest holds, worked `language` and `templates` examples, icons, and how
  the app installs the result.
- [**`docs/EXTENSION-API.md`**](docs/EXTENSION-API.md) — the bridge a web-frontend
  extension (`type: app`, `type: dbmanager`) talks to the IDE and the Linux runtime
  through.
- [**`docs/ICON-PACKS.md`**](docs/ICON-PACKS.md) — `type: iconpack`: the two icon sets
  (UI chrome and file/folder badges), the index format, and how art is matched to files.

These lived in the marketplace repo. They belong with the tool that builds what they
describe: the marketplace publishes finished packages, and an author reading about
how to make one should not have to start in the repo that distributes them.

> No GitHub Actions / CI: everything runs locally via this CLI.

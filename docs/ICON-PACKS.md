# Making a JCode icon pack

An icon pack is an ordinary `.jext` extension whose payload is art plus an index. JCode draws its
icons from two independent sets, chosen separately:

| Set | Replaces | Chosen in |
|---|---|---|
| **UI icons** | The app's own chrome — toolbars, tabs, menus, panel headers, the activity rail | Settings ▸ Appearance ▸ **UI icons** |
| **File icons** | The badge on every file and folder JCode lists — Explorer tree and list, editor tabs, search results, the trash, the project list | Settings ▸ Appearance ▸ **File icons** |

So a pack is **UI + Files**, **Files only**, or **UI only** — and it may ship **several of each**,
as variants: outlined and filled chrome, colour and monochrome file badges. Every set is offered
separately in Settings, under its own name. Nothing else changes about the extension: same
`jext pack`, same `jext validate`, same publish flow.

JCode ships two built-in UI sets (*Material Rounded*, *JCode Line*) and **no** built-in file set —
the **File icons** card does not appear at all until a pack providing one is installed.

---

## 1. Layout

**Prefer this one**: each index sits beside the art it describes, and a pack laid out this way needs
no manifest keys at all.

```
my-icon-pack/
  extension.yaml
  media/icon.png            # the pack's own marketplace icon (not part of a set)
  ui-icons/
    index.yaml              # ← one UI set
    run.svg  stop.svg  terminal.svg  …
  files-icons/
    index.yaml              # ← one file set
    typescript.svg  folder.svg  database.png  …
```

### Several sets of one kind

Move the index down a level. **A directory holding an `index.yaml` is one set; a directory holding
none is scanned for subdirectories that do, one set each.** So a pack grows from one variant to
several by moving a file, with nothing to declare either way:

```
my-icon-pack/
  ui-icons/
    outlined/
      index.yaml            # ← "Neon — outlined"
      run.svg  stop.svg  …
    filled/
      index.yaml            # ← "Neon — filled"
      run.svg  stop.svg  …
  files-icons/
    colour/
      index.yaml
      typescript.svg  …
    mono/
      index.yaml
      typescript.svg  …
```

Variants are offered in **name order**, so the list does not depend on the filesystem. Each set is
remembered under `<extension id>/<its id>`, so two packs may both ship an `outlined` without
colliding.

### The flat layout

A single index at the package root, pointed at a shared art directory with `base:`:

```
my-icon-pack/
  extension.yaml
  ui-icons.yaml             # base: media/icons
  files-icons.yaml          # base: media/icons
  media/icons/
    run.svg  typescript.svg  …
```

JCode looks for the directory first and falls back to the flat file:

```
ui-icons/     (its own index, else one per subdirectory)  →  ui-icons.yaml  →  ui-icons.yml
files-icons/  (its own index, else one per subdirectory)  →  files-icons.yaml  →  files-icons.yml
```

### Declaring them explicitly

A package that uses neither layout says where its indexes are. Each value names an index file **or**
a directory, and may be a **list**:

```yaml
contributes:
  iconSets:
    ui: art/chrome                          # a directory: every set inside it
    files: [art/light.yaml, art/dark.yaml]  # a list: exactly these
```

> A declared path that resolves to nothing is **not** quietly replaced by a conventional index —
> `jext validate` reports it as an error. Being wrong about where your icons are is worth knowing.

### Art formats

**SVG** and **PNG** (and `.webp` / `.jpg`, which are read the same way as PNG).

SVG is converted to a native vector on install, so it scales and tints crisply at every density.
Supported: `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `g` with
`translate` / `scale` / `rotate` / axis-aligned `matrix`, and presentation attributes both inline
and in a `style="…"` attribute. **Not** supported, and skipped rather than approximated: gradients
and patterns (a `url(#…)` paint keeps the inherited flat colour), `<use>`, `<text>`, filters, masks,
and CSS in a `<style>` element. Icon art rarely needs them; art that does will look flat.

Prefer SVG for UI icons — they are tinted with the theme, and a raster tints to a flat silhouette at
one resolution. PNG is a good fit for detailed multi-colour file badges.

An art file must live **inside** the pack; a path that climbs out of it is refused.

---

## 2. `extension.yaml`

```yaml
id: dev.example.neonicons
name: Neon Icons
version: 1.0.0
type: iconpack          # classifies it in the marketplace; also `icon-pack` / `icons` / `icon-theme`
publisher: example
description: A neon line set for the workbench, with matching file badges.
minJCodeVersion: "1.7.2"

images:
  icon: media/icon.png
```

That is the whole manifest for a conventionally laid-out pack. `type: iconpack` is not what makes
the sets load — the indexes are — but it is what files the pack under **Icon packs** in the
marketplace, and `jext validate` errors if a pack declares the type and ships no index.

An icon pack **runs no code**, so it needs no `api:`, no `entry:`, and never asks about activation.

---

## 3. `ui-icons/index.yaml`

Keys under `icons:` are JCode's semantic **slot** names, matched case-insensitively. Anything you
leave out keeps its Material glyph, so a set can restyle only its hero icons and inherit the rest.

```yaml
id: neon-ui                 # defaults to the variant's directory name; qualified by the extension id
name: Neon UI               # defaults to "<extension name> — <variant directory>"
description: A neon line set.
version: 1.0.0
author: Example

base: .                     # where the art is, relative to THIS file. Default: beside it.

defaults:                   # inherited by every entry under `icons:`
  size: 24                  # the design grid the art was drawn on, in dp
  tint: theme               # theme = follow the surrounding content colour (the norm for UI icons)
  autoMirror: false         # flip in a right-to-left locale

icons:
  Run: run.svg                                  # short form: just the file
  Stop: stop.svg
  Terminal: terminal.svg
  ArrowBack: { file: back.svg, autoMirror: true }   # long form: any `defaults` key, per icon
  Folder: { file: folder.png, tint: none }

aliases:                    # one slot borrowing another's art — no second file, no second copy
  Continue: Run
  Rerun: Refresh
```

### The slots

```
Run  Stop  Terminal
Files  Folder  OpenFolder  NewFolder  NewFile
Sdk  Lsp  Scm  Settings  Search  Extensions  Sources  Destinations  Code  Database  Vm
Add  Minus  Close  Refresh  Paste  Collapse  MoreVert  Save  Undo  Redo  Discard
Continue  Pause  Rerun  StepInto  StepOver  StepOut
Output  Logs  Problems  Radar  Debug  Tasks  Chat  Cursor
Browser  DevTools  Image
DropDown  ChevronDown  ChevronUp  ChevronRight  ArrowUp  ArrowBack  ArrowForward  MenuToggle  Help
Copy  Cut  Delete  Open  Rename  SelectAll  Clear  Definition  References  Format
Preview  Pin  Palette  CommandPalette  ScreenRotation  Fullscreen  KeepAwake
Lock  LockOpen
TextIncrease  TextDecrease  GoToLine
Trash  Restore
```

An unrecognised key is dropped with the rest of the set intact — useful when a pack targets a newer
JCode than the one it is installed on.

> `ArrowBack`, `ArrowForward`, `ChevronRight`, `Undo`, `Redo` and `Help` are direction icons. Set
> `autoMirror: true` on them so they point the right way in a right-to-left locale. (Auto-mirroring
> applies to SVG art; a raster is drawn as authored.)

---

## 4. `files-icons/index.yaml`

A file set is keyed by ids of your own choosing; `files:` and `folders:` then say which names reach
which id.

```yaml
id: neon-files              # same defaulting rules as a UI index
name: Neon File Icons
description: Colour badges for the file tree.
version: 1.0.0

base: .

defaults:
  size: 16                  # design grid, in dp
  tint: none                # multi-colour badges: draw as authored (the norm for file icons)
  file: file                # what an unmatched FILE gets
  folder: folder            # what an unmatched FOLDER gets
  folderOpen: folder-open   # …and what it gets while expanded

icons:
  file: file.svg
  folder: folder.svg
  folder-open: folder-open.svg
  folder-src: src.svg
  folder-src-open: src-open.svg
  typescript: { file: ts.svg, size: 20, scale: 0.9 }
  javascript: js.svg
  database: { file: db.png, size: 32 }      # a raster: give it its real resolution

aliases:
  ts: typescript

files:
  - icon: typescript
    extensions: [ts, mts, cts, tsx]
  - icon: json
    extensions: [json, jsonc]
    names: [package.json, tsconfig.json]
  - icon: env
    globs: [".env*"]
  - icon: test
    patterns: ['\.(test|spec)\.[jt]sx?$']
  - icon: database
    extensions: [db, sqlite, sql]

folders:
  - icon: folder-src
    openIcon: folder-src-open
    names: [src, source, lib, app]
```

### Matching, and why order does not matter

Rules are matched by **how specific the predicate is**, not by the order they are written in:

```
names:       exact file name (case-insensitive)   ← most specific, wins first
globs:       * and ? against the whole name
patterns:    a regular expression, searched in the name
extensions:  the file's extension                 ← least specific, checked last
```

Within one bucket the first declaration wins. So a rule list can be grouped however reads best —
`names: [package.json]` beats `extensions: [json]` no matter which is written first.

Extensions are tried **longest compound first**, so `index.d.ts` reaches a `d.ts` rule before the
plain `ts` one, and still reaches `ts` if you never defined `d.ts`. A leading dot is part of the
name, not the start of an extension: `.gitignore` matches `names:`/`globs:`, never `extensions:`.

A rule pointing at an icon you never defined is dropped. A name nothing matches falls back to
`defaults.file` / `defaults.folder`; with those unset the host draws its own glyph, so a sparse pack
degrades cleanly rather than showing blanks.

### `size`, `scale` and `tint`

| Key | Means |
|---|---|
| `size` | The grid the art was drawn on. For a raster this is its real resolution; for SVG it only matters when the file has no `viewBox`. It is **not** the size the icon appears at — the host decides that. |
| `scale` | A multiplier on the host's size. Use it when your art carries less padding than the built-ins and looks oversized beside them. `0.9` is a typical nudge. |
| `tint` | `none` draws the art as authored — right for multi-colour badges. `theme` recolours it with the surrounding content colour — right for a monochrome pack that should follow the light/dark theme. |

---

## 5. Validate, pack, test

```bash
jext validate my-icon-pack
```

Reports an index that was declared but not found, a `type: iconpack` with no index at all, art that
is missing or in an unreadable format, a rule pointing at an icon you never defined, and an invalid
`patterns:` regex — then lists every set it found, so you can see all your variants were picked up.

```bash
jext pack my-icon-pack -o dist/
```

Then in JCode: **Settings ▸ Developer options ▸ Sideload extension**, pick the `.jext`, and open
**Settings ▸ Appearance**. Each card previews the set before you pick it — the UI card with five
chrome slots, the file card by resolving real file names through your own rules.

Worth checking on device:

- Every variant you shipped appears as its own row, under its own name.
- Slots you left out still show Material glyphs. That is the fallback chain, not a broken pack.
- The Explorer, editor tabs and search results all change together.
- A folder in your `folders:` rules swaps to its `openIcon` when expanded.
- A `tint: theme` set follows light/dark; a `tint: none` set does not.
- **File icons ▸ None** puts everything back.

---

## 6. Publish

Exactly as any other extension — see
[CREATING-EXTENSIONS.md ▸ Publish](CREATING-EXTENSIONS.md). Set `category: Appearance` and
`subcategory: Icons` so it files sensibly in the marketplace.

---

## 7. Reference

- [CREATING-EXTENSIONS.md](CREATING-EXTENSIONS.md) — the general extension walkthrough.
- [JEXT spec](JEXT-SPEC.md) — package format and install/verify flow.
- [JEHM spec](JEHM-SPEC.md) — header fields.

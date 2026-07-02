# JEHM — JCode Extension Header Markdown (schema 1)

A `.jehm` file is the **header** of a JCode extension: machine-readable metadata
in **YAML frontmatter**, followed by a human-readable **Markdown body** (the long
description + walkthrough). Exactly one lives at the extension root, named
`extension.jehm`.

It does **not** replace the functional manifest (`extension.yaml` — language
rules, template recipes, …); the header points at it via `entry.manifest`. Both
travel inside the compiled `.jext` package.

## Layout

```markdown
---
# ── frontmatter (YAML) ──
schema: 1
uniqueName: jcode.lang.csharp
name: C# Language Pack
version: 1.0.0
type: language
shortDescription: C# coding suggestions, a formatter, and helpers.
minJCodeVersion: 1.0.0
targetJCodeVersion: 1.0.0
...
---

# C# Language Pack            ← Markdown body (long description + images)
Rich description here. ![Sample](media/sample-1.png)
```

## Fields

| Field | Req | Type | Notes |
|-------|-----|------|-------|
| `schema` | ✓ | int | Header schema version. Currently `1`. |
| `uniqueName` | ✓ | string | Globally-unique reverse-DNS id, lower-case, e.g. `jcode.lang.csharp`. The on-device install id. |
| `name` | ✓ | string | Human display name. |
| `version` | ✓ | semver | The extension's own version (`major.minor.patch`). |
| `type` | ✓ | enum | `language` \| `templates` \| `app` \| `dbmanager` \| `formatter` \| `theme` \| `icons`. |
| `shortDescription` | ✓ | string | One line for list rows. |
| `minJCodeVersion` | ✓ | semver | Lowest JCode app version that can run this. |
| `targetJCodeVersion` | ✓ | semver | JCode version this was built/tested against. |
| `publisher` | | string | |
| `category` | | string | e.g. `Languages`, `Templates`. |
| `subcategory` | | string | e.g. `C#`. |
| `requires` | | map | `{ sdks: [], lsps: [], extensions: [] }` — hard dependencies. |
| `suggests` | | map | `{ sdks: [], lsps: [], extensions: [] }` — soft recommendations. |
| `images` | | map | `{ icon, samples: [], walkthrough: [{ image, caption }] }` — paths relative to the extension root. |
| `entry` | | map | `{ manifest: extension.yaml, ui: <dir|null>, libs: [] }` — functional payload pointers. |
| `fingerprint` | | map | `{ algo: sha256, value: null }` — **reserved**; integrity is recorded in `.jext-manifest.json` today. Signed fingerprints are planned. |
| `license`, `homepage`, `keywords` | | | Optional metadata. |

`description` is the **Markdown body**, not a frontmatter field.

## Why "and more"

`images.walkthrough` and `entry.libs` are the forward-looking
hooks: extensions may ship their own UI and libraries. Unknown extra frontmatter
keys are preserved by the tools and ignored by older readers.

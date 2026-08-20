# Attribution and provenance

## Third-party glTF model

- **Title**: Blocky Characters (2.0) — model `character-a`
- **Author**: Kenney (www.kenney.nl)
- **Source URL**: https://kenney.nl/assets/blocky-characters
- **License**: Creative Commons Zero (CC0 1.0) — https://creativecommons.org/publicdomain/zero/1.0/
  (public domain dedication; usable for personal, educational, and commercial purposes with no
  attribution requirement — this file credits Kenney anyway, per their own suggestion)
- **Files shipped**: `public/models/blocky-character/character-a.glb` and
  `public/models/blocky-character/Textures/texture-a.png` (the GLB references the PNG via a
  relative URI; both are bundled at build time and served from the app's own origin, no
  third-party runtime fetch)
- **Modifications**: none to the mesh/texture data itself. Only the two files above were
  extracted from Kenney's original zip archive (which also contains 17 other character
  variants and FBX/OBJ formats, unused here) and placed under `hangman/public/`.

### Why this asset

The wish's shape-research memo pointed at Quaternius's "Ultimate Modular Men Pack" first, with
Kenney's "Modular Characters" as a fallback. Both were checked against a download:

- Quaternius's pack page only links out to a Google Drive folder with no direct, scriptable
  download URL reachable from this environment.
- Kenney's "Modular Characters" (kenney.nl/assets/modular-characters) turned out to be a 2D
  sprite/spritesheet pack (PNG spritesheets + SVG/SWF vectors), not a glTF/3D asset at all — it
  doesn't meet the "pre-made 3D model file (glTF)" requirement regardless of license.
- Kenney's "Blocky Characters" (kenney.nl/assets/blocky-characters) is CC0, ships direct-download
  GLB files, and — critically — each character's GLB is a genuinely modular node graph, not one
  fused mesh: node `root` has children `leg-left`, `leg-right`, `torso`; `torso` has children
  `arm-left`, `arm-right`, `head`. That's exactly 6 independently named/meshed body-part nodes,
  matching the spec's 6 wrong-guess stages one-to-one via node-visibility toggling.

This was verified by downloading the real zip and parsing the GLB's embedded JSON chunk (node
names, mesh indices, and children listed above), not just read off the pack's marketing page.

## Runtime dependency

- **Three.js 0.165.0**, Three.js Authors, MIT License. Used for the WebGL scene, camera,
  lighting, renderer, and `GLTFLoader`.

## Development-only dependencies

- Vite 5.4.14 — MIT License; build and local static preview.
- TypeScript 5.4.5 — Apache-2.0 License; compilation only.
- Vitest 1.6.1 — MIT License; tests only.
- Playwright Test 1.54.2 — Apache-2.0 License; browser automation only.
- `@types/three` 0.165.0 — MIT License; type declarations only.

Transitive development packages remain in `package-lock.json` and are not separately
redistributed as runtime assets.

## Repository-created content

The game-state logic, word list, difficulty-tier scoring, gallows/ground-plane scene dressing
(built from Three.js primitive geometries — never the figure itself), stage-transition
animation code, and all UI were authored for this project.

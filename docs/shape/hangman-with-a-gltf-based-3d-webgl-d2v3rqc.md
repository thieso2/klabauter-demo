# Shaping map: Hangman with a glTF-based 3D WebGL scene

## What this wish is

A single-player, browser-playable Hangman game built as a static TypeScript
app (`hangman/`, Vite-built, mirroring `mario64/`'s scaffold). The gallows
and hangman figure render as a real 3D scene via Three.js. The figure is one
real, pre-made, permissively-licensed third-party glTF/glb model, imported
with `GLTFLoader` and never assembled from code-defined primitives. Each
wrong guess reveals the next of 6 stages via an animated transition on that
same loaded model (skeletal animation, morph targets, or per-part node
visibility — an implementation choice, not a scope question).

Word selection draws from a built-in, curated word list with three
difficulty tiers (Easy/Medium/Hard), chosen pre-round, based on word length
plus an explicit rarity/frequency tag authored per word — not just a length
cutoff. The player guesses via keyboard or an on-screen keyboard, sees
guessed letters, remaining attempts, and the partially revealed word, and
can start a new round after any win or loss.

The scene also offers selectable presentation modes — Light, Dark, and
High-Contrast — that restyle materials, lighting, and UI chrome around the
one shared model. No second model, no per-mode geometry swap.

## What this wish is not

- Not multiplayer, no accounts, no backend, no persistence across sessions
  (the wish rules these out explicitly).
- Not topic/category word grouping (Animals, Movies, …) — difficulty tiers
  only.
- Not a decorative art-direction reskin in the `gothic/roman/modern` 2048
  sense. "Themes" here means functional presentation modes (Light/Dark/
  High-Contrast) layered on one shared model — not separate visual worlds,
  and not separate assets per mode.
- Not an original, self-authored, or procedurally-exported model. The figure
  must be a genuine pre-existing third-party asset under a license that
  permits redistribution/modification (CC0 or equivalent permissive),
  attributed in `hangman/ATTRIBUTION.md`. This is the opposite of
  `mario64/`'s "no external assets, procedural only" policy — the wishes
  differ on purpose and both are correct for their own repo.
- Not built from Three.js primitive geometry (`BoxGeometry`, etc.) for the
  figure. Primitives are fine for incidental scene dressing (ground plane,
  simple gallows timber) if that's cheaper than sourcing a second asset, but
  the figure itself must come from the imported glTF file.

## Decisions taken and why

These were resolved by the human across two earlier rounds on this wish
(recorded in the handoff); this map folds them into one coherent shape.

- **q1 — Model provenance.** A real pre-made third-party model under a CC0
  or equivalent permissive license (Kenney, Poly Haven, Sketchfab CC0
  filter, or similar), attributed in `hangman/ATTRIBUTION.md` with title,
  author, source URL, exact license, and any modifications — mirroring
  `mario64/ATTRIBUTION.md`'s format. Chosen because the wish's rendering
  section is explicit and non-negotiable ("imported pre-made 3D model...not
  procedurally generated primitives"), unlike `mario64`'s copyright-safety
  posture which pushed toward procedural/original content instead.
- **q2 — Project scaffold.** A new top-level `hangman/` directory, Vite +
  TypeScript, structured like `mario64/`: `package.json`/`tsconfig.json`/
  `vite.config.ts`, `src/`, unit tests (Vitest) for game-state logic (word
  selection, guess handling, win/loss), and a Playwright browser smoke test
  for one full win and one full loss round. README documents install/dev/
  test/build commands. Chosen for consistency with the one other 3D/Three.js
  project in this repo, rather than inventing a second convention.
- **q3 — Difficulty basis.** Length plus an explicit rarity/frequency tag
  authored per word in the curated list (not a length-only bucket). Easy =
  short + common words, Hard = long + rare words, Medium in between. More
  curation work up front, but the tiers are then a defensible, inspectable
  property of the data rather than an assumption baked into a length
  threshold.
- **q4–q6 — Presentation modes.** Multiple selectable presentation options
  are in scope (q4), but scoped down to functional Light/Dark/High-Contrast
  modes rather than decorative themes (q6), sharing exactly one glTF model —
  modes vary materials, lighting, and UI only, never geometry or a second
  asset (q5). This keeps the "nice" quality bar (visibly distinct, purposeful
  modes) without doubling the asset-sourcing/attribution burden the way
  three separate models would.

## Good outcome and acceptance criteria

A good outcome is a single `hangman/` app, playable start-to-finish with no
build step for the player (static production build, no backend), where the
gallows/figure are unmistakably a loaded 3D asset — not code-drawn shapes —
and each wrong guess visibly assembles the figure one stage further.

Delivery is complete when:

- `npm install`/`ci`, dev, test, and build commands work from `hangman/`;
  the production build runs from a static file server with no backend.
- A full round is playable via keyboard and via the on-screen keyboard:
  correct guesses reveal letters, wrong guesses advance the figure exactly
  one of 6 stages, the 6th wrong guess ends the round as a loss, completing
  the word ends it as a win, and a visible control starts a new round from
  either end state.
- The gallows/figure are rendered in a real Three.js WebGL scene (camera,
  lighting, at minimum one imported glTF/glb figure), loaded via
  `GLTFLoader` — not assembled from primitive geometries — with a smooth,
  animated transition between stages rather than an instant swap.
- All three difficulty tiers are selectable before a round starts and
  visibly draw from distinct length/rarity slices of the built-in word list.
- Light, Dark, and High-Contrast presentation modes are all selectable, each
  visibly changes materials/lighting/UI, and none swaps the model or scene
  geometry.
- `hangman/ATTRIBUTION.md` documents the glTF model (and any other shipped
  third-party asset) with title, author, source URL, license, and
  modifications; the license permits this use.
- No uncaught console errors during a normal complete round; guessed
  letters, remaining attempts, and the partially revealed word stay legible
  throughout.

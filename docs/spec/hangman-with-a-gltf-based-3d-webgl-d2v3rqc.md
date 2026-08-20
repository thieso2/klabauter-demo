# Spec: Hangman with a glTF-based 3D WebGL scene

Source: `docs/shape/hangman-with-a-gltf-based-3d-webgl-d2v3rqc.md`. This spec
describes behaviour and boundaries, not implementation. Location: new
top-level `hangman/` app (Vite + TypeScript + Three.js), mirroring
`mario64/`'s scaffold (`package.json`, `tsconfig.json`, `vite.config.ts`,
`src/`, Vitest unit tests, Playwright smoke test, README, ATTRIBUTION.md).

## 1. Round lifecycle

- A round starts with: a difficulty tier selected (default or last-chosen),
  a secret word drawn from that tier's slice of the built-in word list, zero
  guessed letters, 6 remaining attempts, and the hangman figure in its
  unrevealed (stage 0) pose.
- The player guesses one letter at a time, via keyboard keypress or clicking
  an on-screen letter key.
- **Correct guess** (letter is in the word): every occurrence of that letter
  is revealed in the word display. Remaining attempts is unchanged. The
  figure stage is unchanged.
- **Wrong guess** (letter is not in the word): remaining attempts decreases
  by 1. The hangman figure advances exactly one of its 6 stages, with an
  animated (non-instant) transition.
- **Repeat guess** (letter already guessed, right or wrong): no state
  changes — not counted again, no additional stage advance, no double
  penalty. The UI gives some feedback that the letter was already tried
  (e.g. the key stays visibly disabled/marked) but nothing else happens.
- **Win**: all distinct letters in the secret word have been guessed
  correctly, with remaining attempts > 0 at the moment of the last reveal.
  Round ends immediately in a win state; no further guesses are accepted.
- **Loss**: the 6th wrong guess is made (remaining attempts reaches 0).
  Round ends immediately in a loss state; the full secret word is revealed;
  no further guesses are accepted.
- **New round**: a visible control, present on both the win screen and the
  loss screen, starts a fresh round (new word draw, guesses cleared,
  attempts reset to 6, figure reset to stage 0). The difficulty tier
  selector is reachable again before/at this point — the player is not
  locked into the tier of the previous round.
- Difficulty tier and presentation mode (see §4) may be changed before a
  round starts; changing them mid-round is out of scope for this spec (an
  implementation may choose to allow it, but it is not required behaviour
  and must not corrupt in-progress round state if disallowed by simply
  being unreachable during a round).

## 2. Word source and difficulty tiers

- The word list is bundled at build time — no network fetch, no user-
  supplied list, no external dictionary API at runtime.
- Every word in the list carries, at minimum: the word itself, and enough
  authored data to place it in exactly one of Easy / Medium / Hard, based on
  **length plus an explicit rarity/frequency tag** (not length alone). Easy
  = short + common, Hard = long + rare, Medium = in between. The exact
  scoring formula is an implementation choice; the requirement is that tier
  membership is a data property inspectable in the source list, not an
  ad-hoc runtime length cutoff invented separately from the data.
- Each tier's word pool is non-trivial in size (large enough that replaying
  many rounds in one tier does not immediately feel like a fixed rotation of
  2–3 words) and contains only words expressible with the guess UI's letter
  set (A–Z, no punctuation/spaces/digits, case-insensitive).
- The tier selector is shown before a round starts (or via a reachable menu
  between rounds) and the chosen tier determines which pool the next word is
  drawn from. Selecting a tier does not itself start a round.

## 3. 3D rendering and the glTF figure

- The gallows and hangman figure render inside a real Three.js WebGL scene:
  a `Scene`, a `Camera`, at least one light, and a `WebGLRenderer` producing
  a `<canvas>` — not a 2D canvas context, not DOM/CSS shapes, not an `<img>`
  or video standing in for the scene.
- The hangman figure is loaded at runtime via `GLTFLoader` from a shipped
  `.gltf`/`.glb` file. No part of the figure is constructed from Three.js
  primitive geometries (`BoxGeometry`, `SphereGeometry`, etc.). Primitives
  are permitted only for incidental, non-figure scene dressing (ground
  plane, gallows timber) — the acceptance bar is that the figure itself is
  unmistakably the loaded asset, not code-drawn shapes standing in for it.
- The scene reflects exactly 6 wrong-guess stages plus the stage-0 (empty
  gallows, no figure parts visible) starting pose — 7 visually distinct
  states in total. Each wrong guess advances the scene from stage *N* to
  stage *N+1* with a smooth animated transition (e.g. tweened
  opacity/scale/position, a skeletal animation clip, or morph-target
  interpolation) — not an instant cut or a full scene reload.
- Stage state is derived purely from the current count of wrong guesses (an
  integer 0–6). Given the same wrong-guess count, the figure's visual state
  is reproducible — no accumulated animation glitches from repeated
  advance/reset cycles across rounds.
- On loss, stage 6 (fully assembled figure) is reached and stays visibly
  rendered until New Round is triggered. On a fresh round, the scene resets
  to stage 0.
- `hangman/ATTRIBUTION.md` names the shipped glTF model's title, author,
  source URL, exact license, and any modifications made to it, matching the
  format and rigor of `mario64/ATTRIBUTION.md`. The license must permit this
  use (redistribution + modification without payment/registration — CC0 or
  equivalent). This is a delivery gate, not just documentation: if no such
  model has been sourced and cleared, the figure requirement in this
  section is unmet regardless of what's on screen.

## 4. Presentation modes

- Light, Dark, and High-Contrast modes are all selectable (e.g. a control
  always reachable, not gated to between-rounds).
- Switching modes changes scene lighting and/or materials and UI chrome
  (colors, contrast, typography treatment) visibly. It never swaps the
  loaded model, never loads a second glTF file, and never changes scene
  geometry/mesh structure.
- Switching modes mid-round preserves all round state (guessed letters,
  remaining attempts, current figure stage, secret word) exactly — a mode
  switch is a pure presentation change.
- High-Contrast mode's acceptance bar: guessed letters, remaining attempts,
  and the partially revealed word remain legible (sufficient contrast
  against background) in every mode, not just default.

## 5. UI surface

- On-screen keyboard: 26 letter keys (A–Z), each independently showing
  untried / correct / incorrect state, and disabled (non-interactive) once
  guessed. Physical keyboard letter keypresses produce the same guess
  behaviour as clicking the corresponding on-screen key; non-letter keys
  and keys outside A–Z are ignored without error.
- Word display: shows one slot per letter of the secret word (revealing
  correctly-guessed letters, hiding others behind a placeholder such as
  `_`), updating immediately on a correct guess.
- Guessed-letters display and remaining-attempts display are both visible
  and update immediately on every guess (correct, wrong, or ignored-repeat
  as applicable per §1).
- Win/loss end state is visibly distinct from in-round play (e.g. a
  message plus the New Round control), and is reachable from either
  keyboard or on-screen-keyboard-driven play.
- No uncaught console errors/exceptions during a normal complete round
  (tier select → guesses → win or loss → new round), across all three
  presentation modes.

## 6. Delivery / build boundary

- `hangman/` is a standalone static app: `npm install`/`ci`, `npm run dev`,
  a test command, and `npm run build` all work from within `hangman/`.
- The production build (`dist/` or equivalent) runs correctly served as
  static files with no backend/server process and no network calls other
  than fetching its own bundled assets (JS/CSS/glTF/textures) from the same
  origin.
- All game assets (word list, glTF model + textures) are bundled into the
  build output; nothing is fetched from a third-party origin at runtime.

## Test seams

- **Game-state module** (word selection, guess handling, win/loss
  transition, wrong-guess counter, tier pool selection) — the core target
  for unit tests (Vitest, mirroring `mario64/src/*.test.ts`). This module
  should be importable and testable with no DOM/WebGL dependency: given a
  tier and a sequence of guessed letters, it returns/exposes the resulting
  guessed set, remaining attempts, revealed-word state, and round status
  (`in-progress` / `won` / `lost`). This is where §1 and §2's rules
  (repeat-guess no-op, win/loss thresholds, tier-pool membership) are
  directly assertable without spinning up a renderer.
- **Word list data** — the curated list itself (with per-word tier/rarity
  data) is a plain data module, testable in isolation: every word uses only
  A–Z, every word has a tier assignment, each tier's pool is non-empty and
  meets the "non-trivial size" bar from §2.
- **Stage-from-wrong-guess-count function** — a pure mapping from an
  integer 0–6 to "which stage is shown," testable without a renderer,
  covering §3's determinism requirement (same count in → same stage out).
- **DOM/UI layer** (keyboard input, on-screen keyboard, word/attempts/
  guessed-letter display, win/loss screen, new-round control, tier
  selector, mode selector) — exercised via a Playwright browser smoke test
  (mirroring `mario64/`'s Playwright setup): drive one full win and one
  full loss round through simulated key presses and clicks, asserting the
  visible word/attempts/end-state text at each step, and asserting no
  console errors were emitted.
- **Three.js scene / glTF load** — the one seam that can't be fully unit-
  tested; verify at minimum by the Playwright smoke test asserting a
  `<canvas>` is present and the page reaches each of the win/loss end
  states without a console error (which would surface a failed
  `GLTFLoader` load or a thrown error during a stage transition). Visual
  correctness of the model/animation itself is a manual check, not an
  automated one — call this out in the README/VALIDATION.md rather than
  claiming automated coverage that doesn't exist.
- **Presentation mode switch** — testable at the DOM level (Playwright):
  switching modes mid-round leaves the word/attempts/guessed-letter state
  unchanged (§4), and each mode is reachable via a visible control.

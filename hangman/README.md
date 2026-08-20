# Hangman — glTF-based 3D WebGL scene

A browser Hangman game whose gallows and hangman figure render inside a real Three.js WebGL
scene. The figure is a pre-made glTF model (Kenney's CC0 "Blocky Characters"), loaded via
`GLTFLoader` and revealed part-by-part as wrong guesses accumulate — never a procedurally-built
stand-in. Words come from a built-in, tiered word list; no network fetch, no backend.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:browser
npm run preview
```

Open the URL printed by Vite. Pick a difficulty tier (Easy/Medium/Hard) and a presentation mode
(Light/Dark/High Contrast — always reachable, even mid-round) from the header, then click "Start
round". Guess letters by typing A–Z or clicking the on-screen keyboard. Each wrong guess advances
the hangman figure one stage with an animated reveal; 6 wrong guesses ends the round in a loss,
revealing every letter and the full model. Winning or losing shows a "New round" control that
draws a fresh word from the currently-selected tier.

Browser tests need Playwright's Chromium: `export PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers &&
npx playwright install chromium`. On a minimal host with no GUI shared libraries and no root
(`playwright install --with-deps` needs `apt-get`, which needs root), Chromium can still run by
downloading those libraries' `.deb` files with `apt-get download` and unpacking them locally with
`dpkg-deb -x` — no install/root required. See `VALIDATION.md` for the exact commands and for what
was actually run in this container.

## Project layout

- `src/words.ts` — the built-in word list, with per-word rarity data and a tier-scoring function
  (length + rarity, not a raw length cutoff).
- `src/game.ts` — pure round-state logic (guess handling, win/loss, repeat-guess no-op).
- `src/stage.ts` — pure mapping from wrong-guess count to which of the 6 figure stages is shown.
- `src/scene.ts` — the Three.js scene: camera, lights, gallows dressing (code-built primitives),
  the loaded glTF figure, staged part reveal with an eased scale-in transition, and the three
  presentation modes (light/material color changes only — never a second glTF load).
- `src/main.ts` — DOM wiring: tier/mode selectors, on-screen keyboard, keyboard input, and the
  win/loss/new-round UI.
- `tests/browser/complete-round.spec.ts` — the Playwright smoke test (see `VALIDATION.md`).
- `public/models/blocky-character/` — the shipped glTF model and its texture (see
  `ATTRIBUTION.md`).

## What isn't automated

Visual correctness of the 3D model and its stage-by-stage animation — does the figure actually
look right, does the reveal read as an assembling hangman, is High Contrast mode actually legible
on screen — is a manual check. The Playwright suite asserts DOM state, a `<canvas>` is present,
and no console errors occur; it does not (and cannot, headlessly) judge what's rendered. See
`VALIDATION.md`.

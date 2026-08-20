# Plan: Hangman with a glTF-based 3D WebGL scene

Source: `docs/spec/hangman-with-a-gltf-based-3d-webgl-d2v3rqc.md`.

Three slices, strictly sequential — each extends the `hangman/` app the
previous slice created, so parallelizing them would just create merge
conflicts on shared scaffold files (`package.json`, `main.ts`, etc.) for no
real gain.

## t1 — Scaffold + word list + game-state logic

Self-contained, testable core with no DOM/WebGL dependency. Lands a working
`hangman/` project (install/test/build all green) even before any rendering
exists.

## t2 — glTF figure + 3D scene + full playable round

The load-bearing slice: sources and clears the third-party model, builds the
Three.js scene and staged reveal, and wires everything (game-state module +
scene + UI) into one genuinely playable round in a single default
presentation style.

## t3 — Presentation modes + Playwright coverage + docs

Adds Light/Dark/High-Contrast modes on top of the one shared model, browser
smoke tests, README, and VALIDATION.md.

See the report's `plan` field for the full ticket bodies used to schedule
these — this file is a summary, not the source of truth for ticket content.

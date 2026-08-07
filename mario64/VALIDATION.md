# Release validation record

Validation date: 2026-08-07 UTC. This record separates reproducible container results from device work that requires real browser/hardware access.

Execution note: earlier attempts on 2026-08-07 could not run any of these commands. Repeated
installs extracted truncated package files (`esbuild/install.js`, the Execa entry point), and no
automated pass was claimed. The cause was the host, not the project: `mmap` with `MAP_SHARED`
fails with `ENXIO` under `/home` and `/workspace` on this machine, which corrupts large package
extraction and prevents Chromium from starting. Checking the repository out on `/tmp` (tmpfs,
unaffected) makes installs and browsers work normally.

`npm run validate` was then executed in full and passed. Environment: Linux x64, Node 26.5.1,
npm 11.17.0, Playwright 1.54.2 driving its bundled Chromium build 1181 in headless mode.

| Command | Result |
| --- | --- |
| `npm test` | 23 tests across 5 files pass (movement, input, settings, encounters, run state) |
| `npm run build` | `tsc -b` clean; Vite emits 12 modules, 513.7 kB JS (133.7 kB gzip) |
| `npm run test:browser` | 2 Playwright tests pass: full start-to-finish run and lifecycle pause |
| `npm run audit` | 135,243 B total gzip transfer; no remote runtime URLs |

The browser run drives the real game: both progression gates hold against ordinary movement,
all five motes and three beacons register, the guardian is baited into each armed conductor and
struck three times, and the completion panel reports an elapsed time. The run asserts zero
console errors and zero non-local network requests.

## Automated acceptance

Run `npm run validate`. Unit coverage includes mixed input normalization and clearing, settings persistence/conflicts/fallback, deterministic movement, capped healing, spitter wind-up/projectile travel/damage, durable progression/recovery, and guardian causality. Playwright launches the application and covers both physical gates, proximity-driven objectives, natural guardian telegraph/charge/conductor exposure and movement-attack hits, crest completion, lifecycle pause with an explicit zero-movement/no-held-actions assertion, console errors, and remote network requests. The production audit inventories every emitted file, computes gzip size, rejects runtime HTTP(S) URLs in source, and enforces the 15 MiB initial-transfer ceiling.

## Manual acceptance matrix

The automated run above covers headless Chromium only. The following remains a release-device
checklist: Firefox, Safari, Edge, and every physical mobile/gamepad observation below are still
unexecuted, and no frame-rate figure has been measured on any hardware.

| Coverage | Required observation |
| --- | --- |
| Current Chrome, Firefox, Safari, Edge | 1440×900 traversal and guardian; quality tier on `#stage[data-quality]`; clean console; target near 60 fps on representative 2022 laptop |
| iOS Safari, Android Chrome | landscape 844×390 or native; safe areas, rotate pause, three simultaneous touches, background/restore; auto low tier; target near 30 fps on representative 2022 phone |
| Keyboard/mouse, standard gamepad, touch | complete independently; verify remaps persist and defaults restore |
| Mixed input | gamepad movement + mouse camera + keyboard jump; no duplicate/stuck actions |
| Lifecycle/fallbacks | blur, hidden tab, resize, rotate, controller disconnect, blocked storage/audio, and WebGL failure |
| Complete run | non-authored beacon order, five motes, three causal guardian hits, crest; accurate time/shards and no uncaught console errors |

No browser/device version or frame-rate figure is asserted without an actual run. Downstream release testing should append exact versions, hardware, resolution, selected tier, and observed FPS range here.

## Copyright-safety audit

Player-facing copy uses only Galecrest Isle’s original vocabulary. Code-defined terrain is a branching floating-island ascent assembled from procedural primitives, not traced geometry. Characters are faceted non-human forms without protected likenesses. Audio is synthesized from repository-authored oscillator instructions. No franchise name, copied dialogue, texture, recording, recognizable melody, or claim of official association appears in the built UI.

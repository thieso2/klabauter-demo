# Release validation record

Validation date: 2026-08-07 UTC. This record separates reproducible container results from device work that requires real browser/hardware access.

Container execution note: `npm test && npm run build && npm run audit` was attempted. The checked-in dependency installation was corrupt, and two clean `npm ci` attempts (including a fresh temporary npm cache) produced syntactically truncated packages: Execa/Esbuild first, then an invalid `vitest/package.json`. Consequently no automated pass is claimed for this session; rerun the commands in a healthy Node 18+ environment. `git diff --check` passed.

## Automated acceptance

Run `npm test`, `npm run build`, and `npm run audit`. The suite covers mixed input normalization and clearing, settings persistence/conflicts/fallback, deterministic movement, durable progression/recovery, and guardian causality. The production audit inventories every emitted file, computes gzip size, rejects runtime HTTP(S) URLs in source, and enforces the 15 MiB initial-transfer ceiling. `npm run preview` serves static files with no backend.

## Manual acceptance matrix

The following remains a release-device checklist; it is not falsely marked as executed in this headless container.

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

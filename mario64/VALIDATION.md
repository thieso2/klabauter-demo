# Release validation record

Validation date: 2026-08-07 UTC. This record separates reproducible container results from device work that requires real browser/hardware access.

Container execution note: on 2026-08-07, unit, build, audit, and browser commands were attempted after replacing the prior installation and using a fresh npm cache. A second clean-cache `npm ci` was performed during the returned-change fix and again extracted a syntactically truncated `esbuild/install.js`; the restored installation still has a truncated Execa entry point, so no automated pass is claimed. `git diff --check` passed after the fixes. This records an execution-environment limitation rather than fabricated passing evidence.

## Automated acceptance

Run `npm run validate`. Unit coverage includes mixed input normalization and clearing, settings persistence/conflicts/fallback, deterministic movement, capped healing, spitter wind-up/projectile travel/damage, durable progression/recovery, and guardian causality. Playwright launches the application and covers both physical gates, proximity-driven objectives, natural guardian telegraph/charge/conductor exposure and movement-attack hits, crest completion, lifecycle pause with an explicit zero-movement/no-held-actions assertion, console errors, and remote network requests. The production audit inventories every emitted file, computes gzip size, rejects runtime HTTP(S) URLs in source, and enforces the 15 MiB initial-transfer ceiling.

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

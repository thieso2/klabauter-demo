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
| `npm run build` | `tsc -b` clean; no Rollup size warning; app 46.2 kB (15.5 kB gzip) plus a separate three chunk 466.9 kB (117.9 kB gzip) |
| `npm run test:browser` | 3 Playwright tests pass: normal-route play, full completion, lifecycle pause |
| `npm run audit` | 135 kB total gzip transfer; no remote runtime URLs |

### Reproducing this run exactly

```sh
# 1. Work outside /home and /workspace. mmap MAP_SHARED fails with ENXIO there on this host,
#    which truncates extracted packages and stops Chromium launching. /tmp is tmpfs and is fine.
cp -r <checkout> /tmp/galecrest && cd /tmp/galecrest/mario64

# 2. Install exactly what package-lock.json pins.
npm ci

# 3. Put the browser on /tmp for the same reason.
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers
npx playwright install chromium

# 4. Everything: unit tests, tsc + Vite build, Playwright, release audit.
npm run validate
```

`npm ci` completes in about a second and reports no truncated files. If `npm install` ever
extracts a partial `esbuild/install.js` or a partial Execa entry point again, the checkout is on
the wrong filesystem — move it to `/tmp` rather than retrying, because retrying reproduces it.

Playwright's own downloader stalled part-way through unpacking Chromium on this host. Fetching
`chromium-linux.zip` and `chromium-headless-shell-linux.zip` for the pinned build and unpacking
them into `$PLAYWRIGHT_BROWSERS_PATH/chromium-<rev>/` and
`$PLAYWRIGHT_BROWSERS_PATH/chromium_headless_shell-<rev>/` works and is what was done here. Both
directories need an `INSTALLATION_COMPLETE` marker file.

### What the browser tests actually do

**Normal route, no teleporting at all.** One test plays the opening with real key events only —
`KeyW/A/S/D` to run and `Space` to jump — from the spawn point to all three beacons. It asserts
each beacon registers as it is reached, that waking the third moves the run to the ascent phase,
and that the barrier which stopped ordinary movement at `z = -12` is then walkable. This is the
evidence that the game is completable by playing it rather than by moving the player around.

**Full completion, teleport-assisted.** A second test covers the whole run through to the crest.
It uses the debug teleport to place the player at each objective, because scripting the upper
ascent — 8-unit jumps between floating platforms, a moving ferry, and a wall-kick section — is
not reliably automatable. Everything else in it is real: both gates are pushed against with held
keys and hold, the guardian is baited into each armed conductor and struck by a real ground-pound
three times, and the completion panel reports elapsed time. Zero console errors, zero non-local
requests.

### Measured performance

Measured once, in this container: **25.8 fps** at 1440×900 on the `high` quality tier, sampling
`requestAnimationFrame` for 5 seconds during play. This machine has **no GPU** — WebGL resolves to
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`, a pure software
rasteriser. This figure is therefore a software-rendering floor and says nothing about hardware
frame rate. It is not evidence for the 60 fps laptop target below.

## Automated acceptance

Run `npm run validate`. Unit coverage includes mixed input normalization and clearing, settings persistence/conflicts/fallback, deterministic movement, capped healing, spitter wind-up/projectile travel/damage, durable progression/recovery, and guardian causality. Playwright launches the application and covers a keyboard-only normal-route opening, both physical gates, proximity-driven objectives, natural guardian telegraph/charge/conductor exposure and movement-attack hits, crest completion, lifecycle pause with an explicit zero-movement/no-held-actions assertion, console errors, and remote network requests. The production audit inventories every emitted file, computes gzip size, rejects runtime HTTP(S) URLs in source, and enforces the 15 MiB initial-transfer ceiling.

## Manual acceptance matrix

These rows are deferred by the section 2a amendment in
`docs/spec/build-a-copyright-safe-browser-3d-svr3tgr.md`: they remain product requirements and a
release checklist, but they do not gate this wish, because the build host cannot execute them.

The automated run above covers headless Chromium only, on a GPU-less machine with no physical
input devices attached. The following remains a release-device checklist and **cannot be closed
from this container**: Firefox, Safari and Edge are not installed here; there is no phone, no
tablet and no gamepad to attach; and there is no GPU, so no meaningful frame-rate figure can be
produced for any of the targets below. These rows need a human on real hardware.

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

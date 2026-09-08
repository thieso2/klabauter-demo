# Shaping map: 2D kart racer (Mario Kart-inspired)

## What this wish is

A single-player, browser-playable top-down 2D kart racer built as a static
TypeScript app in `kart2d/` (Vite-built, mirroring `mario64/`'s scaffold: HTML5
Canvas 2D rendering rather than Three.js, since the view is a fixed top-down
camera, not a 3D scene). The player races a small cup of original tracks
against AI opponents, using drift-boosting and a small set of original
item-box power-ups, and finishes with cup standings after the final race.

All content — racer/kart designs, track names and theming, item names and
effects, cup name — is original, evoking kart-racing genre conventions
(item boxes, drifting, lap-based circuits, a multi-race cup with points)
without reproducing Mario Kart's protected characters, courses, items,
names, or music. This mirrors `mario64/`'s posture on the same underlying
inspiration in this repo: the directory name is a delivery constraint only,
not player-facing content.

Assumed creative direction (implementation-owned, so building can proceed
without another decision round):

- **Cup:** "Turbo Loop Cup", three original tracks — a desert canyon loop, a
  snowy mountain switchback, and a nighttime harbor circuit — three laps
  each, raced in sequence with no track-select detour.
- **Racers:** the player picks one of three original karts/pilots (simple,
  abstract, geometric — not licensed character designs, avoiding both
  trademark risk and the need to source or draw figurative character art);
  three AI opponents fill out a four-racer field on every track.
- **Items:** four original power-ups from roadside item boxes, uniform odds
  (no position-weighted rubber-banding): a forward speed boost, a
  short-range forward projectile that spins out whoever it hits, a
  one-hit defensive shield, and a dropped hazard that spins out a racer who
  drives over it.
- **Scoring:** standard placement points (e.g. 4/3/2/1 for 1st–4th) summed
  across the three races; a champion screen shows final standings after
  race three.
- **Controls:** keyboard only (steer/accelerate, drift-to-boost, use item).
  No gamepad, touch, or remapping support — justified below under scope.

## What this wish is not

- Not literal Mario Kart branding: no reproduced characters, likenesses,
  course names/layouts, item names/art, music, or dialogue (**q1**).
- Not a side-view/platformer racer — the camera is fixed top-down bird's-eye
  (**q2**).
- Not a single standalone race, and not a large track roster/full game — the
  target is a small, complete three-track cup with cross-race scoring
  (**q3**).
- Not local multiplayer or split-screen — one human player against AI only
  (**q4**).
- Not a pure race-only game with no items — a small original item set ships
  (**q5**).
- Not gamepad/touch input, remapping, or accessibility settings
  (sensitivity, reduced motion, assist mode) — `mario64/`'s heavier
  multi-input bar was justified by its longer continuous run and third-person
  camera; this smaller, keyboard-driven top-down racer doesn't carry the same
  requirement. A follow-up wish can add it.
- Not position-weighted item odds, battle mode, a track editor, online play,
  accounts, or persistent progress/best-times across browser sessions.
- Not licensed third-party art/audio assets — karts, tracks, and effects are
  procedurally drawn/synthesized in-repo, consistent with `mario64/`'s
  "original IP, no external assets" resolution for the same inspiration,
  and sidestepping the attribution burden `hangman/` took on for a different
  reason (its wish text required a real imported 3D model).

## Decisions taken and why

- **q1 — IP posture: original, genre-inspired.** Matches `mario64/`'s
  precedent for the same underlying inspiration in this repo: an original
  racer roster and track theme, not licensed Nintendo IP. The `kart2d/`
  directory name is a delivery-only codename, not player-facing text.
- **q2 — Camera: top-down bird's-eye.** The closest 2D analogue to kart
  racing — shows track curvature and multiple racers abreast — versus a
  side view, which suits platforming, not racing.
- **q3 — Scope: small multi-track cup with points.** A single track doesn't
  read as "Mario Kart" (the cup structure is core to the genre); a large
  roster is more than one wish should target. Three original tracks, laps,
  and a scored cup keep this bounded like `mario64/`'s single deliberately-
  scoped level.
- **q4 — Opponents: AI only, no local multiplayer.** Split-screen rendering
  and per-player input handling is substantial added architecture better
  left to a follow-up wish, mirroring `mario64/`'s exclusion of multiplayer
  entirely.
- **q5 — Items: small original set.** Item boxes are a defining, expected
  genre feature; omitting them would read as a generic racer. Kept to four
  items to bound scope.

## Good outcome and acceptance criteria

A good outcome is a single `kart2d/` app, playable start-to-finish with no
build step for the player (static production build, no backend): character
select, three races with laps/AI/items, and a final cup-standings screen.

Delivery is complete when:

- `npm install`/`ci`, dev, test, and build commands work from `kart2d/`; the
  production build runs from a static file server with no backend.
- A full cup is playable via keyboard: select a racer, complete three laps
  on each of the three original tracks against three AI opponents, collect
  and use all four item types with a visible effect, accumulate placement
  points across races, and see a champion/standings screen after race three.
- Drifting produces a distinct, visible boost from plain acceleration.
- AI opponents follow the track and contest position — not decorative
  bystanders.
- No uncaught console errors during a full cup playthrough.
- Unit tests cover race/lap state, scoring across races, and item effects;
  a Playwright browser smoke test covers one complete race and the final
  cup standings after all three.
- A repository review finds no reproduced Mario Kart names, characters,
  course layouts, item designs, or music; if any asset beyond in-repo code
  is ever added, `kart2d/ATTRIBUTION.md` documents it (expected to stay
  empty/unnecessary given the procedural-content decision above).

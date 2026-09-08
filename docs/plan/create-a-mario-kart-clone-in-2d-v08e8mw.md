# Plan: Turbo Loop Cup (2D top-down kart racer)

Four slices, each a working vertical increment on `kart2d/` (scaffolded to
mirror `mario64/`'s Vite/TypeScript/Vitest/Playwright setup, Canvas 2D
instead of Three.js).

## t1 — Scaffold, movement, one track, basic AI race (no dependencies)

Bootstrap `kart2d/` and ship one fully playable race: title screen, racer
select (3 original geometric kart/pilot designs), a single track (desert
canyon loop) with checkpoints/finish line/off-track boundary, the player's
kart plus 3 AI opponents doing simple track-following, three laps, and a
results screen with correct final placements. No items yet, no cup scoring
across races — that's t2/t3.

Build:
- Project scaffold: `package.json` (vite, vitest, playwright, typescript —
  copy `mario64/`'s dependency versions/scripts), `tsconfig.json`,
  `index.html`, `src/`, `tests/browser/`, `.gitignore`, empty
  `ATTRIBUTION.md`, stub `README.md`.
- `src/input.ts` (+ test): normalizes keydown/keyup/blur into
  `{steerAxis, accelerate, brake, driftHeld, itemPressed}`. Keys: Arrow
  keys or WASD for steer/accelerate, Left Shift = drift (hold), Space =
  item use. Window blur clears all held state.
- `src/kart.ts` (+ test): fixed-step `(state, input, trackInfo) -> nextState`
  covering position/velocity/heading, drift charge/release boost (§5 of the
  spec), off-track speed cap (not a hard stop), spin-out state machine
  (unused until t2 but the state shape belongs here). Must be deterministic
  given a fixed timestep and identical input sequence — cover with a unit
  test.
- One track (desert canyon loop): closed path, checkpoints, finish line,
  off-track boundary polygon/spline, procedurally drawn (desert color/shape
  theming only, no external assets).
- `src/race.ts` (+ test): reducer over `CHECKPOINT_PASSED` /
  `FINISH_CROSSED` / `LAP_COMPLETED` events per kart, tracking
  `(lapsCompleted, checkpointIndex)`, plus a ranking function producing a
  strict 1st–4th order from `(lapsCompleted, checkpointIndex,
  distanceAlongSegment)`. Test that crossing the finish line backwards or
  before all checkpoints is a no-op on the lap counter.
- `src/ai.ts` (+ test): pure `(trackWaypoints, checkpoints, kartState) ->
  {steerAxis, accelerate, itemUsePressed}` that follows the track's driving
  line and attempts to overtake a close rival ahead. `itemUsePressed`
  always false this slice.
- Kart-kart collision: simple push-apart, no spinout from contact, no
  passing through each other or track boundaries.
- Wire the screen flow: title → racer select → race (desert canyon, 4
  karts, 3 laps, live HUD lap counter + position) → results (final
  placements only, no points/cup total yet).
- Give the start button, racer-select options, in-race HUD (lap counter,
  position), and results-screen placements stable selectors/accessible
  names — later slices' Playwright test depends on these.

Acceptance: `npm install`, `npm run dev`, `npm test`, `npm run build` all
work from `kart2d/`. A full 3-lap race against 3 AI opponents completes
with a correct final placement order. Drift-boost is measurably faster
than plain acceleration from the same starting speed (unit test + manual
check). No uncaught console errors during the race.

## t2 — Items (depends on t1)

Add the full item system to the desert canyon race from t1.

- `src/items.ts` (+ test): pure functions applying `BOOST_USED`,
  `PROJECTILE_HIT`, `SHIELD_ABSORBED`, `HAZARD_TRIGGERED` to kart state.
  Cover: shield absorbs exactly one hit then is consumed; a hazard's
  dropper is immune for a short fixed grace window, then vulnerable
  (including to their own hazard).
- Item boxes scattered on the desert canyon track (implementation-owned
  count/placement, at least one reliably hit per lap); driving over an
  unclaimed box grants one of the 4 items at uniform random odds only if
  the kart holds none; claimed boxes respawn after a fixed cooldown.
- The 4 items, each visually distinct by shape/color (not text-reliant):
  speed boost (temporary forward speed increase, stacks with drift-boost),
  forward projectile (spins out the first kart it hits within range,
  expires harmlessly if it misses), shield (passive indefinite hold,
  absorbs the next projectile hit or hazard contact, visible active
  indicator), hazard (dropped at the kart's rear, stationary, grace window
  for the dropper, then spins out any kart that touches it).
- Extend `src/kart.ts`'s spin-out state (added in t1) so items are the only
  thing that triggers it: loses steering authority, near-zero speed for a
  fixed duration, then recovers.
- Space (item-use) consumes the held item and triggers its effect; no-op if
  holding nothing. HUD shows the currently-held item.
- Extend `src/ai.ts` so an AI kart holding an item eventually uses it
  during a race (target selection / drop timing implementation-owned, must
  not be inert).

Acceptance: on the desert canyon race, the player can collect and use all
4 items and observe each one's specified effect; an AI kart is seen using
at least one item during a race; unit tests cover the shield-one-hit and
hazard-self-immunity-window edge cases.

## t3 — Cup structure: two more tracks, scoring, champion screen (depends on t1)

Extends t1's track/movement/AI foundation with cup-level structure. Does
not require items (t2) — can proceed independently of it.

- Two more tracks reusing t1's track/checkpoint/collision representation:
  snowy mountain switchback, nighttime harbor circuit — each a closed loop
  with its own checkpoints/finish/boundary, visually distinct by theme
  (color/shape/lighting cues), drivable with the same movement model and AI
  from t1. Items not required on these tracks in this slice.
- `src/scoring.ts` (+ test): pure function taking three races' finish
  orders (arrays of racer IDs) → per-racer per-race points (4/3/2/1),
  cumulative totals, and the final tie-broken standings order (ties broken
  by better race-three placement, then race-two, then race-one). Unit-test
  the tie-break directly via this seam with synthetic tied finish orders —
  don't rely on provoking a rare in-game tie.
- Wire cup sequencing: racer select → desert canyon → results (that race's
  placements + points + running cup total) → continue → snowy mountain →
  results → continue → harbor → results → champion screen (final standings
  for all 4 racers by cup total descending, player's rank highlighted,
  "race again" restarts from racer select). Per-race results show only
  that race's numbers; only the champion screen shows the full cumulative
  table.

Acceptance: play all three races back-to-back (plain racing, items not
required to work here yet), see correct per-race results and an accurate
champion-screen total matching the sum of placements; the scoring
tie-break is exercised by a unit test.

## t4 — Full integration, browser test, audit (depends on t2, t3)

- Bring items (t2) onto the snowy mountain and harbor tracks (t3) so item
  boxes, all 4 items, and AI item use work identically on all three
  tracks.
- Reconcile any seams between t2's race-screen changes and t3's
  cup-sequencing wrapper — item-holding state resets appropriately between
  races; results/champion screens are unaffected by items.
- `tests/browser/`: a Playwright smoke test covering one complete race
  (title → racer select → race → results) and reaching the champion screen
  after all three races, using the stable selectors from t1.
- Run full validation from a clean `npm ci`: `npm test` (input, kart
  movement incl. determinism, race/lap incl. no-op backwards finish,
  items incl. shield/hazard edge cases, scoring incl. tie-break, AI
  steering), `npm run build`, the Playwright test, and a manual full-cup
  playthrough checking for zero uncaught console errors.
- `kart2d/README.md`: exact install/dev/test/build commands, and
  confirmation the production build serves statically with no backend
  (mirror `mario64/README.md`'s structure).
- Confirm `kart2d/ATTRIBUTION.md` needs no entries (no external assets
  were added). Content audit: no reproduced Mario Kart names, characters,
  course layouts, item names/art, or music anywhere in `kart2d/` — only
  the original cup/track/item names established in t1–t3.

Acceptance: a full cup playthrough (title → racer select → 3 races with
laps/AI/items → champion screen) works with no uncaught console errors;
every command in the README works from a clean `npm ci`; the content audit
passes.

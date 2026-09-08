# Specification: Turbo Loop Cup (2D top-down kart racer)

## 1. Product contract

`kart2d/` contains one self-contained, browser-playable, single-player 2D kart racing game rendered on HTML5 Canvas 2D with a fixed top-down camera. A complete playthrough is the **Turbo Loop Cup**: three original tracks, three laps each, raced in a fixed sequence with no track-select detour, against three AI opponents in a four-racer field.

There is no backend, account, or save between browser sessions. Reloading starts a fresh cup from the title/racer-select screen. A full cup takes roughly 5–10 minutes.

All content is original and evokes only broad kart-racing genre conventions (item boxes, drift boosting, lap-based circuits, a multi-race cup with points). It must not reproduce any protected character, kart design, course name/layout, item name/art, music, or dialogue from the cited inspiration. `kart2d/` is a repository path only and never appears as player-facing franchise text.

## 2. Resolved delivery decisions

| Area | Required decision |
| --- | --- |
| Cup | "Turbo Loop Cup": desert canyon loop, snowy mountain switchback, nighttime harbor circuit — raced in that fixed order, three laps each. |
| Racers | Player picks 1 of 3 original abstract/geometric kart-and-pilot designs before race 1. Three AI opponents (fixed, one per remaining design) fill the field on every track. |
| Camera | Fixed top-down bird's-eye, following the player's kart. |
| Items | Roadside item boxes grant one of four original power-ups at uniform random odds (no position-weighted rubber-banding): speed boost, forward projectile (spins out whoever it hits), one-hit shield, dropped hazard (spins out whoever drives over it). A kart holds at most one item at a time. |
| Scoring | Placement points 4/3/2/1 for 1st–4th, summed across all three races; a standings/champion screen shows the total after race three. |
| Controls | Keyboard only: steer, accelerate, drift-to-boost, use item. No gamepad, touch, or remapping. |
| Persistence | None. No settings, best times, or cup progress survive a reload. |
| Technology | Static TypeScript + Vite app, Canvas 2D rendering, no runtime backend, no external art/audio assets. |

## 3. Screen flow

1. **Title screen** — start affordance and a brief controls summary.
2. **Racer select** — the player picks one of three karts; selection is confirmed before race 1 begins.
3. **Race screen** (×3, fixed order: desert canyon loop → snowy mountain switchback → nighttime harbor circuit) — see §4–§7.
4. **Race results screen** — placements 1st–4th for that race, points earned, running cup total; a continue affordance advances to the next race, or to the champion screen after race three.
5. **Champion screen** (after race three) — final standings: all four racers ranked by total cup points with a tie-break (§8), the player's rank highlighted. Offers "race again" (restarts the cup from racer select) and no other persistent state.

No screen transition requires a full page reload. Only the champion screen displays cumulative standings; per-race results show that race's placements and points only.

## 4. Track and lap state

Each track defines a closed drivable path, a start/finish line, and an ordered sequence of checkpoints spanning the loop. A lap counts as complete only when a kart crosses every checkpoint in order and then crosses the finish line moving forward; crossing the finish line without having covered all checkpoints (e.g., reversing over it, cutting the loop) does not increment the lap counter. Each track requires three completed laps.

A kart's race progress is always expressible as an ordered tuple `(lapsCompleted, checkpointIndex, distanceAlongCurrentSegment)`. This tuple is the sole input to a ranking function that orders all four karts from 1st to 4th at any instant — used both for the live HUD position indicator and for determining final race placements.

The track surface is bounded; driving off it caps a kart's maximum speed (a slowdown, not a hard stop) rather than blocking movement outright, so an off-track kart can recover. Karts collide with each other (simple push-apart, no spinout from contact alone) and do not pass through one another or through track boundary geometry.

A race ends, for scoring purposes, the instant the player's kart completes its third lap. Final placements for that race are read from the ranking function at that instant — AI karts do not need to have literally crossed their own finish lines first.

## 5. Kart movement and drift-boost

Input maps to acceleration, braking/reverse, and steering, all continuous rather than binary-snap. Holding the drift input while steering during a sustained turn puts the kart into a drift state distinct from ordinary turning (visibly different handling and a charging boost indicator). Releasing the drift input after sufficient charge grants a temporary forward speed boost measurably faster than plain acceleration; releasing early, or never charging, grants no boost. Exact speed, turn-rate, charge-time, and boost-magnitude values are implementation-owned, but identical starting state and input sequence must produce the same outcome (deterministic given a fixed timestep).

A spun-out kart (from a projectile or hazard, §6) loses steering authority and drops to near-zero speed for a fixed duration, then recovers to normal control. This is the only source of spin-out; kart-to-kart contact and off-track driving never spin out a kart.

## 6. Items

Each track scatters item box pickups around its layout (implementation-owned count and placement, at least enough that a racer reliably encounters one within a lap). Driving over an unclaimed item box grants one of the four items at uniform random odds, and only if the kart isn't already holding an item — a kart already holding one gets no effect from touching a box. A claimed box is unavailable until a fixed respawn cooldown elapses. Pressing the item-use input consumes the held item and triggers its effect; a kart holding nothing does nothing on that input.

- **Speed boost** — immediate forward speed increase for a fixed duration, stacking with but distinct from drift-boost.
- **Projectile** — fires forward from the kart; on reaching another kart within its range, applies spin-out to that kart and is consumed. Misses (no kart in its path before range/lifetime expires) simply expire.
- **Shield** — a passive, indefinitely-held state (no timer) that absorbs the next incoming projectile hit or hazard contact instead of spinning the kart out, then is consumed. Gives a distinct visible indicator while active.
- **Hazard** — dropped at the kart's rear position when used; stationary on the track thereafter. The dropping kart is immune to its own hazard for a short fixed grace window after dropping (to avoid an instant self-hit); after that, any kart (including the original dropper) that touches it is spun out and the hazard is consumed.

## 7. AI opponents

Each AI kart follows its track's driving line using the same movement model as the player (§5) rather than being teleported or scripted along a fixed path with no simulation. AI karts steer to stay on the track, attempt to overtake when a rival is close ahead, pick up item boxes they cross, and use held items (target selection for projectiles and drop timing for hazards are implementation-owned but must not be inert — an AI holding an item eventually uses it during a race). AI karts are subject to the same off-track slowdown, collision, drift-boost opportunity, and spin-out rules as the player.

## 8. Scoring and standings

Placement points are fixed: 1st = 4, 2nd = 3, 3rd = 2, 4th = 1. After each race, every racer's points for that race are added to their running cup total. The champion screen ranks all four racers by cup total, descending. Ties in cup total are broken by better (numerically lower) placement in race three; if still tied, by better placement in race two, then race one — this is fully deterministic since every race produces a strict 1st–4th ordering with no ties possible within a single race (the ranking function in §4 is a total order).

## 9. Input contract

Keyboard only; no gamepad, touch, or remapping.

| Action | Keys |
| --- | --- |
| Steer left / right | Arrow Left/Right or A/D |
| Accelerate / brake-reverse | Arrow Up/Down or W/S |
| Drift (hold) | Left Shift |
| Use item | Space |

Held keys combine normally (e.g., accelerate + steer + drift are concurrently readable). Losing window focus clears all held input state so a kart cannot keep accelerating or turning after the tab loses focus. There is no pause menu in scope; the race screen, results screen, and champion screen are the only states.

## 10. Presentation, assets, and provenance

All visuals (karts, tracks, item boxes, effects, UI) are drawn procedurally/in-repo; no external image, model, or audio asset ships. `kart2d/ATTRIBUTION.md` exists and stays empty/unnecessary unless a future change adds a third-party asset, in which case it must record title, author, source, license, and modifications before that asset ships. Track theming (desert canyon, snowy mountain, harbor at night) and item effects are visually distinguishable from each other by shape/color, not reliant on player-facing text alone to convey state (e.g., holding an item, drift-boost charge tier, spin-out).

A copyright-safety review must find no protected franchise names, recognizable character likenesses, copied track layouts, copied item names/art, or claims that this is an official/related product.

## 11. Packaging and quality boundaries

Everything needed to install, develop, test, and build lives below `kart2d/`. Its README states exact commands for install, dev server, test, and production build, and confirms the production build serves from a static file server with no backend. A full cup playthrough (title → racer select → three races with laps/AI/items → champion screen) produces no uncaught console errors.

## 12. Acceptance scenarios

1. **Complete cup:** From the title screen, select a racer, complete three laps on each of the three tracks against three AI opponents, collect and use all four item types with a visible effect from each, and reach the champion screen with an accurate cumulative total matching the three races' placements.
2. **Lap integrity:** Attempt to cross the finish line without covering all checkpoints (drive backwards over it, or cut toward it early); the lap counter does not increment until checkpoints are covered in order.
3. **Drift-boost:** Demonstrate that a charged-and-released drift produces a measurably higher speed than plain acceleration from the same starting speed, and that an uncharged/early release does not.
4. **Item effects:** Trigger each item and observe its specified effect — boosted speed, a fired projectile spinning out a hit kart, a shield absorbing exactly one incoming hit, and a dropped hazard spinning out a kart (including, after the grace window, the one who dropped it) that touches it.
5. **AI contest:** Observe that AI karts stay on-track, change relative position over a race (not fixed order every lap), and are seen to use at least one collected item during a full cup.
6. **Scoring:** Verify race results screens show correct per-race placements/points and the champion screen's total equals the sum of the three races' points per racer, with the tie-break rule in §8 exercised (constructible via the scoring seam in §13 without needing a rare in-game tie).
7. **Build/console:** Run the documented install/dev/test/build commands from `kart2d/`, serve the production build statically, and confirm a complete cup playthrough produces no uncaught console errors.
8. **Content audit:** Review shipped names, art, and layouts against §10; confirm `kart2d/ATTRIBUTION.md` needs no entries.

## 13. Test seams

- **Pure input seam:** an importable module turns raw keydown/keyup (and focus-loss) events into a normalized held-state object (steer axis, accelerate/brake, drift held, item-use pressed-this-frame). Testable without a DOM canvas.
- **Pure kart movement seam:** a fixed-step function taking current kart state, normalized input, and track collision/off-track info, returning next position/velocity/heading/drift-charge/spin-out state. Testable headlessly with synthetic input sequences.
- **Pure race/lap seam:** a reducer taking explicit events (`CHECKPOINT_PASSED`, `FINISH_CROSSED`, `LAP_COMPLETED`) per kart and returning each kart's `(lapsCompleted, checkpointIndex)` and the derived 1st–4th ranking. Out-of-order/backwards finish-line crossings are provably no-ops on the lap counter.
- **Pure item-effect seam:** functions applying `BOOST_USED`, `PROJECTILE_HIT`, `SHIELD_ABSORBED`, `HAZARD_TRIGGERED` events to kart state, independent of rendering or AI — covers shield-consumes-on-one-hit and hazard self-immunity-window behavior directly.
- **Pure scoring seam:** a function taking three races' finish orders (arrays of racer IDs) and returning per-racer per-race points, cumulative totals, and the final tie-broken standings order — the seam for acceptance scenario 6's tie-break case.
- **AI steering seam:** a pure function taking track waypoints/checkpoints and a kart's current state, returning steer/throttle/item-use intent, testable without rendering or the other seams.
- **Browser automation seam:** stable selectors/accessible names for the start affordance, racer-select options, in-race HUD (lap counter, position, held item), race results screen, and champion standings screen, sufficient for a Playwright smoke test of one complete race and the final champion screen after all three.

Debug/test seams (if any are added for automation, e.g. deterministic RNG seeding for item odds) must be inert or excluded in the production build and must not be required for manual completion.

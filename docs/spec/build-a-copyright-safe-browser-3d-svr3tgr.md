# Specification: Galecrest Isle browser 3D platformer

## 1. Product contract

`mario64/` contains one self-contained, browser-playable 3D platforming experience. Its player-facing title is **Galecrest Isle**. A complete run is one continuous level with three ordered objectives: activate three foothill beacons, collect five ascent motes, and defeat a summit guardian before claiming the released crest.

The intended first completion takes roughly 10–15 minutes, but completion is determined by objective state rather than a time limit. There is no hub, level select, account, backend, lives system, or required progress save between browser sessions. Reloading may begin a new run; settings and remapped controls persist locally.

The experience evokes only broad genre qualities of an early open 3D platformer: a welcoming playground, branching routes, vertical escalation, momentum-based traversal, optional discoveries, and a summit climax. It must not reproduce any protected character, name, dialogue, melody, sound, artwork, map, terrain silhouette, landmark arrangement, encounter, or other distinctive expressive content from the cited inspiration. `mario64/` is a repository path only and never appears as a player-facing franchise reference.

## 2. Resolved delivery decisions

These decisions are the source of truth for implementation planning and acceptance:

| Area | Required decision |
| --- | --- |
| Fidelity | High-fidelity *movement sandbox* feel, with original physics values and content; no numerical, geometric, audiovisual, or presentational imitation. |
| World | One original wind-swept floating island with a landing shelf, branching foothills, gated vertical ascent, and summit arena. Geometry and landmark placement are designed from scratch. |
| Player | An original non-human, faceted wind-runner; no protected likeness. |
| Progression | One continuous three-objective run; prior objectives persist after defeat; checkpoints follow objectives one and two. |
| Movement | Full land-based move set in section 4. No swimming, crawling, transformations, object carrying/throwing, or aimable launchers. |
| Combat | Three small original enemy archetypes and one original three-hit guardian; movement attacks are the combat verbs. |
| Inputs | Keyboard/mouse, standard-mapping gamepad, and landscape multitouch are independently usable and concurrently active. Keyboard and gamepad bindings are remappable. |
| Technology | Static TypeScript, Vite, and Three.js application with no runtime backend. A small permissively licensed physics/support package is allowed if documented. |
| Content | Repository-made content is preferred. Any third-party content must permit redistribution and modification and have complete attribution. No production gameplay asset is fetched remotely. |
| Browsers | Stable releases current at validation time: Chrome, Firefox, Safari, and Edge on desktop, plus iOS Safari and Android Chrome. |
| Performance | Target 60 fps on a representative 2022 laptop and 30 fps on a representative 2022 phone, using adaptive quality; record observations rather than asserting a universal minimum. |
| Transfer budget | Initial compressed transfer is below 15 MB with an empty cache, excluding browser tooling. |

## 3. Run and objective state

### 3.1 Start and instruction

On a supported browser, opening the built application presents a start affordance and a brief controls overlay appropriate to available input sources. Play must not require pointer lock. Starting creates a fresh run, starts the completion timer when the player gains control, and places the player on a safe landing shelf. The controls overlay remains available from pause.

The HUD communicates current objective, progress count, health, and relevant interaction feedback. Objectives use text plus distinguishable shape/icon cues; color alone is never the only indication. The game is fully understandable with all audio muted.

### 3.2 Objective 1: wake the wind network

- Three beacons occupy three distinct foothill branches and can be reached in any order.
- Entering/using a beacon's clear activation zone activates it once. Activation produces visible in-world feedback, non-audio HUD feedback, and increments progress exactly once.
- Activated beacons remain active for the run, including after damage, a void fall, or defeat.
- Before all three are active, the ascent is visibly unavailable and cannot be bypassed on the normal completion route. Guidance identifies regions rather than drawing an exact route.
- Activating the third beacon opens the ascent, updates the objective, and establishes the post-objective-1 checkpoint. No loading screen or objective-select screen interrupts play.

### 3.3 Objective 2: power the ascent

- Five distinct required energy motes are distributed across the opened ascent's switchbacks, moving platforms, wall-kick gaps, and ordinary traversal.
- Each mote is collectible once, gives visible confirmation, and increments progress exactly once.
- Every required mote is reachable using the documented standard moves without a shortcut, enemy grind, damage boost, or precision exploit.
- Before all five motes are collected, the summit gate remains closed. The fifth mote opens it, updates the objective, and establishes the post-objective-2 checkpoint.
- Required mote progress persists after defeat. A mote already collected never respawns during that run.

Optional minor shards may reward exploration and/or restore health. They never open a mandatory route or gate. The completion summary reports the number collected without treating a shortfall as failure.

### 3.4 Objective 3: calm the summit guardian

- Entering the summit arena starts or resumes a fresh guardian attempt. The arena remains escapable only if doing so cannot corrupt encounter state; otherwise its boundary clearly retains the player until success or defeat.
- The guardian is an original crystal-and-wind construct with no dialogue. It telegraphs each damaging charge or projectile with enough visible anticipation for a first-time player to react.
- To earn one hit, the player baits a telegraphed guardian attack into an enabled arena conductor, which exposes the guardian core for a finite, visibly signaled window. The player then touches the exposed core with a valid movement attack (jump/stomp, dive, or ground pound as physically appropriate).
- Contact without a valid exposed-core attack does not award a hit. A single exposure awards at most one hit. A conductor collision by itself does not award a hit.
- Each successful hit gives unambiguous visual feedback, advances the guardian by exactly one of three phases, and restores ordinary encounter control. Later phases may increase pace or pattern complexity but retain readable telegraphs and the same causal rule.
- After the third valid hit, damaging guardian behavior stops and an original crest becomes claimable. Claiming it stops the timer and displays a completion screen containing completion time and optional-shard count.
- The guardian cannot be grabbed, carried, or thrown. There is no dialogue dependency.

## 4. Player behavior

### 4.1 Locomotion and moves

Ground movement is camera-relative and supports analog magnitude, acceleration/deceleration, facing changes, running, and a readable skid on sharp reversal at speed. Airborne movement retains useful but weaker directional control. Slopes affect motion: traversable slopes can be climbed, and sufficiently steep/downhill movement produces acceleration or sliding rather than treating all ground as flat.

The player can perform:

- walk and run;
- a single jump, a second consecutive jump, and a timing-dependent higher third jump;
- a side flip after a sharp reversal and jump;
- a backflip from the crouched/low-motion context;
- a long jump from crouch plus movement plus jump;
- a wall kick after contacting an eligible wall while airborne;
- a forward dive that becomes a ground slide when it reaches suitable ground with momentum;
- a ground pound by using crouch/action while airborne;
- automatic ledge grab on eligible edges, followed by hang and climb; and
- fall, knockback, hurt, recovery, and landing states.

Commands may be buffered briefly and jumps have a short coyote window. Exact distances, velocities, angles, and windows are implementation-owned, but identical initial state and input should produce predictable outcomes. Assist mode lengthens coyote and jump-buffer windows. The mandatory route is completable without triple jumps, side flips, advanced momentum conservation, or unintended shortcuts; advanced moves provide faster routes and optional discoveries.

Mutually exclusive states resolve coherently: a move fires once per press unless it explicitly supports hold; pause, focus loss, touch cancellation, controller disconnect, respawn, and completion clear held/transient actions. The player cannot move or take damage while paused or after completion.

### 4.2 Collision, damage, and recovery

The player collides reliably with terrain, platforms, gates, conductors, enemies, and eligible ledges without routinely tunneling through, becoming embedded, or standing on void space. Moving platforms carry a standing player without requiring constant corrective input.

The visible health meter decreases from enemy contact/projectiles, active hazards, and sufficiently severe falls. A hit causes knockback and a short visible invulnerability period; additional hits during that period do not reduce health. Health pickups cannot raise health above its maximum.

At zero health, the player returns to the latest checkpoint with usable health. A void fall does the same without a lives counter. Ordinary falls within the island should land or return the player to nearby safe ground where the route design permits. Recovery clears unsafe velocity and inputs and places the player on stable, unoccupied ground facing a useful direction.

Respawn preserves completed objectives, activated beacons, collected required motes, and optional-shard count. It resets the unfinished objective's transient hazards, projectiles, enemy encounters, and guardian attempt. Thus a defeat during objective 1 returns to the initial checkpoint while retaining beacon activations; during objective 2 it returns to the post-objective-1 checkpoint while retaining motes; during objective 3 it returns to the post-objective-2 checkpoint and resets the guardian to hit zero. Defeated small enemies remain defeated until such a respawn/current-objective reset.

Assist mode reduces incoming damage, provides longer coyote/buffer windows, and may trigger earlier safe recovery from a fall. It does not auto-complete movement, collect required items, activate beacons, remove guardian hits, or otherwise remove an objective.

## 5. Camera behavior

The default camera is a smoothed third-person orbit camera. It supports horizontal and clamped vertical orbit, adjustable distance, recentering behind the player's current direction, sensitivity adjustment, and optional inverted vertical input. Solid scenery between camera and player causes the camera to move inward or otherwise avoid obstruction; it must not settle inside opaque geometry. After the obstruction clears, distance recovers smoothly. The player remains visible during ordinary traversal and combat.

Reduced-motion mode materially reduces camera lag, shake, rapid field-of-view changes, and other nonessential movement. It does not disable user-controlled orbit or conceal gameplay information. There is no first-person or lock-on mode.

Pointer-lock denial leaves mouse-drag camera control and all non-mouse controls usable, with a clear retry/instruction affordance if capture was requested. Losing pointer lock never creates held movement or attack state.

## 6. Enemies and hazards

The foothill/ascent population includes all three original archetypes:

1. A ground charger patrols, notices a nearby player, visibly telegraphs, then rushes along a readable line.
2. A hopping spitter alternates movement with a visible wind-up and fires slow, avoidable wind pellets.
3. A rooted crystalline bloom stays anchored and periodically telegraphs a short-range hazard whose active area is visually readable.

Each archetype can damage the player through its advertised contact, projectile, or hazard behavior. Jump/stomp, ground pound, or dive defeats enemies where their form makes that interaction legible. Enemy damage and defeat give visible feedback. Defeated enemies may drop health or optional shards. Enemies do not require grinding, random drops, or defeat to satisfy a mandatory objective, and no unavoidable enemy placement makes the safe route impassable.

## 7. Input contract

### 7.1 Default mappings

| Action | Keyboard and mouse | Standard gamepad | Touch (landscape) |
| --- | --- | --- | --- |
| Move | WASD or arrows | Left stick | Left virtual stick |
| Camera orbit | Mouse drag or movement while captured | Right stick | Drag on right side |
| Jump / confirm | Space | South face button | Jump button |
| Crouch / ground pound / long-jump modifier | Left Shift | West face button | Action button |
| Dive / attack | E or primary mouse button | East face button | Dive button |
| Recenter camera | R or middle mouse button | Right-stick press | Double-tap right side |
| Zoom | Mouse wheel | Triggers | Pinch |
| Pause | Escape | Start/Menu | Pause button |

Context and motion determine chained moves. Menu confirm/cancel behavior is labeled wherever it differs from gameplay actions.

### 7.2 Concurrent sources and normalization

All connected sources remain live simultaneously; using one never disables another or requires a reload/menu switch. Movement from digital and analog sources is normalized to one vector whose magnitude never exceeds 1. For each movement axis/action, the strongest active magnitude wins; equal opposing digital directions cancel. For button-like actions, a transition from inactive to active produces one press even if another source is held, while release occurs only when no source still holds that action. This permits, for example, gamepad movement with mouse camera and keyboard jump.

The most recently active camera-pointing source may control camera deltas without changing the active movement source. Normal source changes must not create synthetic presses, duplicate actions, or stuck state. Browser blur/visibility loss, pause, touch cancellation, and gamepad disconnect clear the affected held state immediately.

Keyboard and gamepad gameplay bindings are remappable through settings and persist locally. A binding UI identifies conflicts and requires an explicit resolution; it never silently leaves a required action unbound. Restoring defaults restores the table above. Camera sensitivity, inverted Y, touch sensitivity, and touch UI scale are configurable and persistent.

Touch supports simultaneous movement, camera drag, and action presses with distinct touch identifiers. Controls respect safe-area insets, remain reachable at supported UI scales, and adapt after landscape resize/orientation changes. Portrait orientation may pause play and request landscape; it must not continue with broken or obscured controls. Gesture handling does not trigger unwanted page scrolling or browser zoom during the play surface.

## 8. Pause, settings, and exceptional states

Pause freezes gameplay simulation and the completion timer and exposes resume, controls, settings, restart-run, and exit-to-title behavior. Restart-run is explicitly confirmed because it discards current run progress; ordinary checkpoint recovery does not require confirmation. Settings include master, music, and effects volume; camera and touch sensitivity; inverted Y; touch UI scale; reduced motion; assist mode; and remapping.

Audio settings take effect immediately. Master mute produces silence. Settings survive reload in the same browser when storage is available; if storage is unavailable/corrupt, defaults are used and play remains possible.

Resize and landscape orientation changes update viewport, camera aspect, HUD, and touch bounds without resetting progress. Focus/visibility loss automatically pauses or equivalently freezes the simulation and clears inputs. Gamepad connection/disconnection is nonfatal and other sources continue working.

If WebGL cannot initialize, the application shows a readable error with basic compatibility guidance instead of a blank canvas or repeated crash. Runtime absence of audio, pointer lock, vibration, or local storage is nonfatal. A normal complete run produces no uncaught console errors.

## 9. Presentation, assets, and provenance

The shipped visual identity uses the original Galecrest vocabulary: pale rock, amber grass, wind ribbons, timber scaffolds, crystalline machinery, and simple faceted beings. Regions, interactable states, hazards, and objective items are visually distinguishable by silhouette/shape as well as color. Essential feedback has a non-audio channel.

Every shipped asset is either created for this repository or properly licensed for redistribution and modification. `mario64/ATTRIBUTION.md` records every external asset's title, author, source URL, exact license, and modifications, and also records provenance for internally generated art, meshes, textures, music, and effects. Runtime dependencies and their licenses are accounted for as applicable. No asset with unverifiable provenance ships. The production bundle makes no remote request for gameplay meshes, textures, fonts, audio, or other assets after initial application delivery.

A copyright-safety review must find no protected franchise names in player-facing text, recognizable character likenesses, copied/traced geometry or compositions, extracted art, copied dialogue, recognizable melodies/sound effects, or claims that this is an official/remade reference work.

## 10. Packaging and quality boundaries

Everything required to install, develop, test, build, and preview lives below `mario64/`. Its README gives exact commands for dependency installation, development, automated tests, production build, and serving the production build over static HTTP. The built experience needs no server-side application or network API.

Quality adapts through capped device pixel ratio and tiers for shadows/effects/detail, with reduced vegetation/detail on constrained devices. Quality changes must not remove colliders, objectives, enemy telegraphs, required route cues, or touch controls. Validation records browser/device versions, hardware, resolution, quality tier, and observed frame-rate range. The targets are approximately 60 fps on a typical 2022 laptop and 30 fps on a typical 2022 phone during representative traversal and the guardian fight.

The compressed initial production transfer, measured with an empty browser cache and excluding developer/browser tooling, is less than 15 MB.

## 11. Acceptance scenarios

The delivery is wrong if any required scenario cannot be completed without debug controls or code changes.

1. **Complete run:** Start fresh, activate beacons in a non-authored order, traverse the opened ascent, collect all five motes, open the summit gate, earn three guardian hits through conductor/core interactions, claim the crest, and see accurate elapsed time and shard count.
2. **Gating:** Attempt ascent and summit gates early; neither permits normal-route progress. Their exact prerequisite opens each once, with an objective transition and no level reload.
3. **Recovery by phase:** Die or void-fall during each objective and verify the checkpoint, retained durable progress, reset transient state, usable health, and absence of stuck input. During objective 3, verify guardian hits reset to zero.
4. **Move coverage:** On designated safe test geometry, demonstrate every move in section 4, slope behavior, moving-platform carry, ledge recovery, fall damage, hurt invulnerability, and a standard non-advanced route to every requirement.
5. **Enemy coverage:** Observe telegraph, attack, damage, and valid defeat for each small archetype; verify its projectile/hazard is avoidable and enemy defeat is not a completion gate.
6. **Input coverage:** Finish the level separately with keyboard/mouse, standard gamepad, and multitouch. Demonstrate at least gamepad movement plus mouse camera plus keyboard jump concurrently. Verify clamping, opposing-input cancellation, source switching, disconnect, blur, and touch cancellation.
7. **Settings/accessibility:** Remap keyboard and gamepad controls, reload, and observe persistence; restore defaults. Verify mute, inversion, sensitivity, touch scale, assist mode, and reduced motion each have their specified observable effect.
8. **Platform resilience:** Validate current target browsers; deny pointer lock; resize; rotate a phone portrait then back to landscape; connect/disconnect a gamepad; background/restore the page; and run without storage/audio where practical. Progress remains coherent and controls never stick.
9. **Build/performance:** Run all documented commands from `mario64/`, serve the production output statically, measure compressed transfer, record representative frame rates, and observe no uncaught errors in a complete normal run.
10. **Content audit:** Account for every shipped asset/dependency, inspect production network requests, and review names, text, silhouettes, geometry, audio, and artwork against section 9.

## 12. Test seams

These are the concrete surfaces tests should be able to control or observe. Exact source filenames may vary, but the seams and semantics are required.

- **Pure input seam:** an importable input-normalization unit accepts timestamped per-source movement vectors, camera deltas, button transitions, disconnect/cancel, and clear-all events, and returns normalized movement, action held/pressed/released state, and chosen camera delta. It can be tested without WebGL or DOM pointer events.
- **Pure run-state seam:** an importable objective/checkpoint reducer accepts explicit events (`BEACON_ACTIVATED`, `MOTE_COLLECTED`, `GUARDIAN_HIT`, `CREST_CLAIMED`, `PLAYER_DEFEATED`, `VOID_FALL`) and returns objective, counts/identities, checkpoint, encounter phase, completion state, and shard count. Duplicate collectible events are idempotent. Time is supplied by an injectable clock.
- **Player simulation seam:** movement advances through a fixed-step callable with explicit input, collision query/fixture, current state, and delta time. Tests can place the player on flat ground, slopes, ledges, eligible walls, and moving platforms and inspect position, velocity, grounded/move/hurt state without rendering.
- **Encounter seam:** enemies and guardian accept an injectable clock/random source (or fixed seed), expose state/phase, and can be stepped deterministically. Tests can trigger detection, telegraph completion, conductor collision, core exposure, valid/invalid hits, invulnerability, defeat, and reset.
- **Browser automation seam:** stable semantic selectors or accessible names exist for start, controls, objective text/counts, health, pause, settings, restart confirmation, WebGL error, and completion summary. Gameplay landmarks expose stable test identifiers in non-production test mode only (three beacons, five motes, two gates, checkpoint triggers, guardian, conductors, crest); test mode may reposition the player or issue semantic events but the required end-to-end smoke run must also exercise real gates and transitions.
- **Lifecycle seam:** input clearing and simulation pause can be driven with browser `blur`, visibility, gamepad disconnect, touch cancel, resize, and orientation events in an integration harness; current normalized inputs and paused status are observable in test mode.
- **Settings seam:** settings storage is behind an injectable storage adapter, allowing persistence, unavailable-storage, corrupt-data, defaults, remap conflict, and restore-default tests without mutating a developer's real browser profile.
- **Asset/build seam:** a build-time inventory identifies every emitted gameplay asset and its provenance entry; an automated size check consumes production build output and compressed sizes, and a network test can assert that a complete run requests no remote gameplay asset.

Debug/test seams must be excluded or inert in the ordinary production experience and must not be necessary for manual completion.

## 13. Delivery plan and evidence

Implementation should proceed in behaviorally verifiable slices: (1) static shell, input normalization, settings, fixed-step movement/collision, and camera; (2) original world blockout and all traversal moves; (3) durable objective/checkpoint state and the beacon/mote gates; (4) small enemies, damage/recovery, and guardian; (5) touch/accessibility/presentation/audio; (6) browser, performance, provenance, size, and complete-run validation.

Delivery evidence consists of passing unit/integration tests at the seams above, an automated browser smoke test for the full objective chain, recorded manual input/browser/device results, recorded performance and transfer measurements, a clean normal-run console, and the completed attribution/provenance audit. Placeholder geometry, debug controls, skipped mechanics, or an objective that only works through test injection do not satisfy this specification.

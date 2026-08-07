# Shaping map: copyright-safe browser 3D platformer

## What this wish is

Build one original, browser-playable 3D platforming level in `mario64/`. It should evoke the broad appeal of an early 3D platformer playground: a welcoming open foothill, branching routes, increasingly vertical traversal, expressive momentum-based movement, optional discoveries, and a climactic summit encounter. The player completes one continuous 10–15 minute run consisting of three sequential objectives.

The implementation is a static TypeScript application built with Vite and Three.js. It targets current Chrome, Firefox, Safari, and Edge on desktop, and current iOS Safari and Android Chrome. No server is required after the built files are deployed.

The work must be independently expressive. The level layout, terrain silhouette, characters, creatures, names, UI, text, visual motifs, audio, and encounter details must not reproduce protected material from the inspiration. Similarity is limited to genre conventions and broad structural ideas such as an open starting area, multiple traversal routes, collectibles, and a summit climax.

## Product shape

### Original setting and route

Use an original “wind-swept skyland” theme (working title: **Galecrest Isle**). The player controls an abstract, non-human wind-runner composed of simple faceted shapes. The environment is a floating island of pale rock, amber grass, wind ribbons, timber scaffolds, and crystalline machinery. This theme is an implementation assumption, not a licensed reference.

The space has four legible regions:

1. A safe landing shelf that teaches movement and camera control.
2. Branching foothill loops containing three wind beacons, enemies, optional pickups, slopes, and shortcuts.
3. A newly opened vertical ascent using switchbacks, moving platforms, wall-kick gaps, and five required energy motes.
4. A broad summit arena for the guardian encounter and completion reward.

The geometry must be designed from scratch and must not trace, measure, or reproduce the reference level's map, landmark placement, terrain silhouette, paths, or set pieces. Routes should support both a safe first-time line and faster skill-based shortcuts. Falling from ordinary high routes returns the player to safe ground where practical; true void falls use checkpoint recovery.

### Objective flow

Progress is continuous and retained between objectives:

1. **Wake the wind network:** activate three beacons placed across distinct foothill branches. Each beacon stays active. The goal presentation points toward regions rather than drawing an exact route.
2. **Power the ascent:** the activated network opens the ascent. Collect five energy motes distributed along its traversal challenges; collecting all five opens the summit gate. Optional minor shards may restore health or reward exploration but never block completion.
3. **Calm the summit guardian:** defeat an original large crystal-and-wind construct by baiting its telegraphed charge or projectile into three arena conductors, then striking its exposed core with a movement attack. The guardian has three clear phases/hits, cannot be grabbed or thrown, and uses no dialogue. Claiming the released crest ends the level and shows completion time plus collected optional shards.

Objective transitions use brief in-engine feedback and HUD text without loading or returning to an objective-select screen. Checkpoints activate after objectives one and two. Restarting after defeat preserves completed objectives but resets the current encounter and its transient entities.

### Player movement

Implement responsive camera-relative locomotion with analog speed and acceleration, turning, skid transitions, useful air control, slope acceleration/sliding, and the following full land-based move set:

- walk and run;
- single, double, and timing-dependent triple jump;
- side flip and backflip;
- crouch-to-long-jump;
- wall kick;
- forward dive that can transition into a ground slide;
- ground pound;
- ledge grab, hang, and climb;
- fall damage, knockback, and recovery states.

Swimming, crawling, temporary transformation/power-up forms, carrying or throwing objects, and aimable launchers are out of scope. Exact physics values are implementation-owned and should favor predictability and generous input buffering over numerical imitation of another game. All required objectives must be completable without advanced shortcuts; advanced moves create speed and exploration advantages.

### Camera

Use a third-person orbit camera with horizontal and vertical rotation, clamped pitch, adjustable distance, obstacle avoidance, smoothing, recentering, and an optional inverted Y axis. The camera should preserve player visibility and avoid geometry clipping. Reduced-motion mode decreases camera lag, shake, rapid FOV changes, and other nonessential motion. No first-person mode or lock-on combat camera is required.

### Enemies, damage, and recovery

Include three original small enemy archetypes:

- a ground charger that patrols, notices the player, telegraphs, and rushes;
- a hopping spitter that fires slow, avoidable wind pellets;
- a rooted crystalline bloom that periodically creates a short-range hazard.

They deal contact or projectile damage with visible anticipation, invulnerability feedback, and knockback. Jumping, ground pounding, or diving can defeat them where physically appropriate. Defeated enemies can drop health or optional shards and remain defeated until player defeat/current-objective reset. Enemy placement must not gate progress through mandatory grinding.

Use a visible health meter, fall damage, temporary post-hit invulnerability, and no lives counter. Reaching zero health or falling into the void returns the player to the latest checkpoint. Completed objective progress is never lost. Assist mode reduces damage, expands coyote time and jump buffering, and may recover the player from falls sooner; it must not remove objectives.

## Input contract

All input sources remain active concurrently. The input layer normalizes actions, combines digital and analog movement with clamping, and resolves each action from the strongest active source. A newly used pointing device may take camera control without disabling gamepad or touch movement. Switching devices must not require a menu or reload and must not cause stuck actions.

Default mappings:

| Action | Keyboard and mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD or arrow keys | Left stick | Left virtual stick |
| Camera orbit | Mouse drag/movement while captured | Right stick | Drag on right side |
| Jump / confirm | Space | South face button | Jump button |
| Crouch / ground pound / long-jump modifier | Left Shift | West face button | Action button |
| Dive / attack | E or primary mouse button | East face button | Dive button |
| Recenter camera | R or middle mouse button | Right-stick press | Double-tap right side |
| Zoom | Mouse wheel | Triggers | Pinch |
| Pause | Escape | Start/Menu | Pause button |

Context and motion determine chained moves (for example crouch plus movement plus jump produces a long jump; crouch in air produces a ground pound). Keyboard and gamepad bindings are remappable and persisted locally. Camera sensitivity, inversion, and touch sensitivity are configurable. Touch controls support safe-area insets, UI scale adjustment, multitouch (move, camera, and jump simultaneously), and landscape orientation. A brief controls overlay appears before play and remains accessible from pause.

## Visual, audio, and licensing policy

Prefer repository-made procedural low-poly meshes, generated textures, synthesized effects, and original short musical material. Permissively licensed third-party content may be used only when its license permits redistribution and modification in this project. Every external asset must be listed in `mario64/ATTRIBUTION.md` with title, author, source URL, exact license, and modifications. Keep a provenance entry for internally generated assets as well.

Do not use protected character likenesses, franchise names in player-facing content, copied dialogue, recognizable melodies or sound effects, extracted assets, traced geometry, or visual compositions intended to be mistaken for the reference. The directory name `mario64/` is a delivery constraint only and is not a player-facing title. Avoid third-party assets whose provenance cannot be verified. The production bundle must not fetch gameplay assets from remote services.

## Accessibility and settings

Provide pause, master/music/effects volume controls, camera sensitivity, Y inversion, touch UI scale, reduced motion, and assist mode. Settings persist through `localStorage`; progress persistence across browser sessions is not required. Communicate objectives through both text and distinct shape/color cues. Essential interactions cannot rely on color alone. The game must remain operable without audio.

## Technical boundaries

- Everything needed to install, develop, test, and build lives under `mario64/`.
- Use TypeScript, Vite, and Three.js. Lightweight supporting packages are acceptable when license-compatible and documented.
- Use custom deterministic-enough character/gameplay physics or a small permissively licensed physics library; do not depend on a backend.
- Provide README commands for install, development, testing, production build, and static preview.
- Provide adaptive quality controls such as capped pixel ratio, shadow/effect tiers, and reduced vegetation/detail on constrained devices.
- Handle pointer-lock denial, gamepad connect/disconnect, touch cancellation, focus loss, resizing, orientation changes, and WebGL initialization failure without a stuck control state.

## What this wish is not

- It is not a remake, reverse-engineering project, or geometrically faithful reconstruction.
- It does not include multiple levels, an objective-selection hub, swimming, carrying, launchers, lives, online features, accounts, or a backend.
- It does not require photorealism, cinematic storytelling, voiced dialogue, user-generated content, or save-game progression.
- It does not promise support for legacy browsers, low-end devices without WebGL, every gamepad model, or portrait touch play.
- It does not require exact replication of another game's physics constants, glitches, camera quirks, UI, or audiovisual style.

## Decisions and rationale

The human selected a high-fidelity movement sandbox because expressive traversal is the core of the requested feel. The land-based advanced set retains that depth while excluding systems that would add large bespoke areas or mechanics. A continuous three-objective run keeps the single level cohesive and allows clear checkpointing. Exploration beacons, a collectible-gated climb, and a summit guardian give three different verbs without copying a distinctive mission.

Three combat archetypes make enemies functional rather than decorative while allowing every attack to reuse movement mechanics. Forgiving checkpoints, assist features, and core accessibility settings fit a browser game likely to be played across uneven input devices. Full remapping and normalized mixed input make simultaneous keyboard, mouse, gamepad, and touch behavior an architectural requirement rather than a late overlay.

TypeScript, Vite, and Three.js provide a small static delivery target across current desktop and mobile browsers. Original content plus properly attributed permissive assets balances copyright safety with achievable polish. The cross-device test and performance budget below is the agreed acceptance standard.

Creative names, theme, exact terrain, art direction, guardian fiction, and encounter details were not separately chosen by the human. This map assumes the original Galecrest Isle direction described above so implementation can proceed without another decision round. These details may be renamed or refined during implementation only if the copyright-safe boundaries, objective structure, and acceptance behavior remain unchanged.

## Good outcome and acceptance criteria

A good outcome is immediately playable, visually coherent, and satisfying to traverse even after the objectives are known. A first-time player can understand each goal, finish without advanced-technique mastery, recover from failure without replaying completed work, and discover faster or more expressive routes using the full move set.

Delivery is complete when all of the following are true:

- `npm install`, the documented development command, tests, and production build work from `mario64/`; the production output runs from a static HTTP server without a backend.
- A start-to-finish automated browser smoke test covers starting play, all three beacons, the five-mote gate, the three-hit guardian, and the completion screen.
- Unit tests cover objective/checkpoint state and mixed-input normalization, including simultaneous sources, source switching, clamping, and cleared state after blur/disconnect.
- Manual checks confirm complete playability with keyboard and mouse, a standard mapping gamepad, and multitouch controls, plus at least one mixed-input combination.
- Manual browser coverage includes current Chrome, Firefox, Safari, and Edge desktop, current iOS Safari, and current Android Chrome. Device availability may use reputable hosted real-device testing; results and versions are recorded.
- There are no uncaught console errors during a normal complete run, and focus loss, resize/orientation change, gamepad disconnect, and pause do not leave movement or actions stuck.
- Settings remap and persistence work, assist mode and reduced motion have visible functional effects, and touch UI respects safe areas and scaling.
- The game targets 60 fps on a typical 2022 laptop and 30 fps on a typical 2022 phone using adaptive quality. Record tested hardware, resolution, quality tier, and observed frame-rate range rather than claiming universal guarantees.
- Initial compressed network transfer for the production experience is under 15 MB, measured with an empty cache and excluding browser tooling.
- All mandatory mechanics, enemies, damage/recovery, checkpoints, objectives, and completion behavior described in this map work; no placeholder blocks or debug controls are needed to finish.
- `ATTRIBUTION.md` accounts for every shipped asset and dependency as applicable, and a repository review finds no copied protected names, likenesses, artwork, audio, dialogue, or level geometry.

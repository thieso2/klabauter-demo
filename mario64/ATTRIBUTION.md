# Attribution and provenance

## Repository-created content

All player-facing names, text, level layout, geometry, characters, enemies, objective objects, UI styling, colors, and interaction design were authored for Galecrest Isle in this repository. Meshes are assembled at runtime from Three.js primitives; there are no exported models, textures, images, fonts, or shaders. The wind-runner, three enemy forms, Aerolith guardian, Windglass Crest, beacon network, ascent motes, floating-island route, and visual vocabulary are original and were not traced from an existing game.

Music and effects are original Web Audio oscillator sequences defined in `src/audio.ts`. They use no samples, copied recordings, MIDI, or external melody data. The short six-note ambient pattern was created for this project.

No generative service or third-party asset library was used. Production loads no remote gameplay content. The emitted inventory and source URL scan are reproducible with `npm run build && npm run audit`.

## Runtime dependency

- **Three.js 0.165.0**, Three.js Authors, MIT License. Bundled into the production JavaScript. Used for WebGL rendering and procedural geometry. No Three.js examples or external assets are shipped.

## Development-only dependencies

- Vite 5.4.14 — MIT License; build and local static preview.
- TypeScript 5.4.5 — Apache-2.0 License; compilation only.
- Vitest 1.6.1 — MIT License; tests only.
- `@types/three` 0.165.0 — MIT License; type declarations only.

Transitive development packages remain in `package-lock.json` and are not separately redistributed as runtime assets. No licensed external artwork, audio, fonts, meshes, dialogue, or other media ship with the application.

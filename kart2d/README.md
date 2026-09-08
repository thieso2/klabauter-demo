# Turbo Loop Cup

An original browser 2D top-down kart racer. Pick one of three racers and run a three-race cup —
desert canyon, snowy mountain switchback, nighttime harbor circuit — against three AI opponents,
collecting item-box pickups along the way, for the cup standings.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:browser
npm run preview
```

Open the URL printed by `npm run dev` (or `npm run preview`, which serves the production build).
`npm run build` emits static files to `dist/`: the game has no backend and no server-side state,
so `dist/` can be hosted from any static file host or opened via `npm run preview` alone.

Keyboard: Arrow keys or WASD steer/accelerate, Left Shift holds a drift for a release boost, Space
uses a held item. Losing window focus clears all held input.

`npm run test:browser` drives the app with Playwright end to end (title → racer select → a full
race → results, repeated to the champion screen). It needs Chromium and its OS libraries:
`npx playwright install --with-deps chromium` (or `npx playwright install chromium` if those
libraries are already present on the host).

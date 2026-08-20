# Release validation record

Validation date: 2026-08-20 UTC, in this container (Debian trixie, no GPU, no root).

## What ran, and what it needed

`npm test` and `npm run build` ran with no extra setup. `npm run test:browser` needed a working
Chromium — this container ships **no** browser and **no** GUI shared libraries (`libnss3`,
`libatk-1.0`, `libgtk-3`, `libfreetype6`, fonts, etc.) at all, and `lamp` has no `sudo`/root, so
`playwright install --with-deps` cannot run `apt-get install`. It's not the `mmap`/`/home`
quirk `mario64/VALIDATION.md` hit on its host — this one has nothing installed to begin with.

It's still possible without root, because `apt-get download` and `dpkg-deb -x` don't need it —
they just fetch and unpack `.deb` files anywhere writable:

```sh
# 1. Point apt at a writable list/cache dir instead of the root-owned defaults.
mkdir -p /tmp/apt-root/var/lib/apt/lists/partial /tmp/apt-root/etc/apt
cp /etc/apt/sources.list /tmp/apt-root/etc/apt/sources.list
apt-get -o Dir::State::Lists=/tmp/apt-root/var/lib/apt/lists \
  -o Dir::Etc::SourceList=/tmp/apt-root/etc/apt/sources.list \
  -o Dir::Etc::SourceParts=/dev/null update

# 2. Download (not install) Chromium's runtime libs plus a font, and unpack each .deb locally.
mkdir -p /tmp/debs /tmp/deb-root
cd /tmp/debs && apt-get -o Dir::State::Lists=/tmp/apt-root/var/lib/apt/lists \
  -o Dir::Etc::SourceList=/tmp/apt-root/etc/apt/sources.list -o Dir::Etc::SourceParts=/dev/null \
  -o Dir::Cache::Archives=/tmp/debs download \
  libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libxkbcommon0 libasound2t64 libatspi2.0-0t64 libcairo2 libpango-1.0-0 \
  libpangocairo-1.0-0 libgtk-3-0t64 libgdk-pixbuf-2.0-0 libcups2t64 libx11-6 libxext6 \
  libx11-xcb1 libxcb1 libdrm2 libglib2.0-0t64 libxrender1 libxi6 \
  fonts-dejavu-core fontconfig libfontconfig1 libexpat1 libpng16-16t64 libbrotli1 \
  libfreetype6 libuuid1
for f in /tmp/debs/*.deb; do dpkg-deb -x "$f" /tmp/deb-root; done

# 3. A minimal fontconfig pointing at the unpacked font (headless Chromium with zero fonts
#    renders every text node as blank, which looks exactly like a legibility bug but isn't one).
mkdir -p /tmp/fontconfig-home/.cache/fontconfig
cat > /tmp/fontconfig-conf/fonts.conf <<'XML'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/deb-root/usr/share/fonts</dir>
  <cachedir>/tmp/fontconfig-home/.cache/fontconfig</cachedir>
</fontconfig>
XML
/tmp/deb-root/usr/bin/fc-cache -f

# 4. Install the browser binary itself the normal way, then run with the unpacked libs/fonts.
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers
npx playwright install chromium
export LD_LIBRARY_PATH=/tmp/deb-root/usr/lib/x86_64-linux-gnu:/tmp/deb-root/usr/lib/x86_64-linux-gnu/pango-1.0
export FONTCONFIG_FILE=/tmp/fontconfig-conf/fonts.conf
npm run validate
```

With that in place, `npm run validate` (`npm test && npm run build && npm run test:browser`) ran
in full and passed:

| Command | Result |
| --- | --- |
| `npm test` | 18 tests across 3 files pass (game state, word list, stage mapping) |
| `npm run build` | `tsc -b` clean; `dist/` contains `index.html`, one JS chunk (568.8 kB / 146.6 kB gzip), one CSS chunk, and both the `.glb` and its texture under `dist/models/` |
| `npm run test:browser` | 4 Playwright tests pass (below) |

## What the browser tests actually do

`tests/browser/complete-round.spec.ts` loads the app with `?test=1`, which wires up a read-only
`window.__hangmanTest.word()` seam (mirroring `mario64`'s `__galecrestTest`) so the test can read
the secret word and script a deterministic route, instead of guessing blind:

- **Win route**: starts an Easy round, guesses every distinct letter of the actual word — half via
  real `page.keyboard.press`, half via clicking the on-screen key button — asserting
  `Remaining attempts: 6` stays unchanged after every (correct) guess, then asserts the exact
  "You won! ..." text, the fully-revealed word, and the "New round" control. Also asserts a
  `<canvas>` is present before the round starts.
- **Loss route**: starts a Hard round, computes 6 letters guaranteed absent from the word, and
  guesses those (again split between key presses and on-screen clicks), asserting
  `Remaining attempts` decrements 5→4→…→0 in order, then the exact "You lost. ..." text with the
  full word revealed.
- **Mode-switch route**: makes a couple of guesses, snapshots the word/attempts/guessed text, then
  cycles Light → High Contrast → Dark, asserting all three text snapshots are byte-identical after
  every switch and that `<html data-mode>` actually changed.
- **Cross-mode console-error route**: for each of Light/Dark/High Contrast, plays a full round
  (tier select → 6 guesses → loss → New round) and asserts zero `console.error`/`pageerror`
  events. A failed `GLTFLoader` load or a thrown error during a stage transition would show up
  here as a console/page error.

Both console-error listeners run for every test in this file, not just the dedicated one; none of
the four ever saw a console or page error in this run.

## What's a manual check, not an automated one

Per the spec's Test seams section, visual correctness of the 3D model and its animation is **not**
automated and this test suite doesn't claim to cover it — a `<canvas>` being present and no
console error firing only proves the `GLTFLoader` load and stage-transition code didn't throw, not
that the model looks right on screen. To close that gap for this round of work, three screenshots
were taken directly (not via the Playwright suite) after selecting each mode mid-round:

- All three modes show the glTF figure's torso+head correctly assembled (2 wrong guesses = stage
  2) with no primitive shapes standing in for it, and the gallows/ground dressing (built from
  primitives, as intended) recolors per mode without touching the figure's own materials.
- **High Contrast**: pure black background, white body text, yellow accent (tier/mode pill fill,
  "New round" button) with black text on it, red wrong-guess keys with white text — the word
  display, "Remaining attempts", and "Guessed" lines are all clearly legible.
- Light and Dark modes likewise show every text element legible against its background.

This was a one-time manual look at this run's screenshots, not a repeatable automated check —
future changes to `scene.ts`/`style.css` should get the same manual look before being called done,
per the spec's explicit call-out that this seam "can't be fully unit-tested."

## Static-serve / no-backend check

`npm run build` output was served with `vite preview` (a plain static file server, not part of the
app) and fetched with `curl`: `index.html`, the JS/CSS bundles, and both
`models/blocky-character/character-a.glb` and its texture all returned `200` from the same origin.
`dist/index.html` references its JS/CSS via relative `./assets/...` paths (from `vite.config.ts`'s
`base: './'`), and `scene.ts` builds its glTF URL from `import.meta.env.BASE_URL`, so the same
`dist/` folder works from any static host or subpath, not just root. A source-and-bundle grep for
`https?://` turned up exactly one hit, in the built JS: the literal string
`http://www.w3.org/1999/xhtml`, which is the standard XHTML XML-namespace constant three.js uses
for DOM/SVG element creation — a string constant, not a network request. No other remote URL
appears anywhere in `src/` or the built bundle.

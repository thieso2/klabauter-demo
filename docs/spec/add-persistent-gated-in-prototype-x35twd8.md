# Specification: persistent, gated feedback in the prototype skill

## 1. Product contract

This wish authors `.claude/skills/prototype/{SKILL.md,UI.md,LOGIC.md}` from
scratch (none exist yet, on this branch or `main`). These files are
instructions for a future Claude session generating a throwaway HTML
prototype — the wish is judged by what a session following them produces,
so this spec states that output's required behavior, validated by two
example prototypes shipped under `.claude/skills/prototype/examples/`.

Every prototype the skill produces, regardless of branch (LOGIC.md's
free-play/walkthrough demos or UI.md's `?variant=` switcher demos), is
**three co-located artifacts**, never one:

- `<name>.html` — the interactive artifact.
- `<name>-server.mjs` — a zero-dependency Node script (built-in `http`/
  `fs` only, no `package.json`, no install step) that serves the HTML at
  `/` and exposes a local JSON API, bound to `127.0.0.1` only.
- `feedback.json` — written next to the other two, initially `[]`.

Running a prototype is `node <name>-server.mjs`, then opening the URL it
prints. Double-clicking the HTML file directly is no longer a supported
path for prototypes built by this skill, because the feedback panel needs
a same-origin API.

This wish does not touch the pre-existing `gothic/`, `roman/`, `modern/`,
`mario64/` folders — the skill only shapes prototypes generated after it
exists.

## 2. Resolved decisions

| Area | Decision |
| --- | --- |
| Server language | Node.js, built-in modules only, no dependencies. |
| Server scope | Local, single-user, `127.0.0.1`-only, started/stopped by hand. Not a real backend: no auth, no concurrent-write handling beyond read-modify-write-whole-file. |
| Persistence granularity | One `feedback.json` per prototype, co-located, rewritten whole on each change. Not a shared ledger across prototypes. |
| Gate behavior | Informational only. Never disables the prototype's own state/variant controls or the feedback input itself. |
| Acknowledged entries | Stay visible, marked resolved — never hidden or deleted. |
| Offline feedback | Never dropped. If the server is unreachable, the entry is held in memory for the session and visibly marked "not saved." |
| Verification | No automated tests (disallowed). Verified by manually running the two example demos end-to-end per the acceptance walkthrough in §5. |

## 3. Server API contract

Each `<name>-server.mjs`:

- On startup, binds to `127.0.0.1` on an available port (incrementing past
  a default on collision) and prints the URL to stdout.
- `GET /` → the prototype's HTML.
- `GET /feedback.json` → current full contents of `feedback.json` (`[]` if
  the file doesn't exist yet).
- `POST /feedback` → body is a new entry (see §4 shape, minus `id`/
  `acknowledged`); server assigns `id` and `timestamp`, sets
  `acknowledged: false`, appends to `feedback.json`, returns the merged
  array.
- `POST /feedback/:id/ack` → sets that entry's `acknowledged` to `true` in
  `feedback.json`, returns the merged array.
- `POST /feedback/ack-all` → sets every entry's `acknowledged` to `true`,
  returns the merged array.
- All writes are read-whole-file, modify, write-whole-file — no partial
  writes, no external DB.

## 4. Feedback entry shape

```json
{
  "id": "string, server-assigned, unique",
  "text": "string, the feedback text, non-empty",
  "context": "string, e.g. scenario/state name (LOGIC.md) or variant id (UI.md)",
  "timestamp": "ISO 8601 string, server-assigned",
  "acknowledged": false
}
```

`context` is whatever LOGIC.md's active scenario/state or UI.md's active
`?variant=` was at the moment of submission — captured client-side and
sent as part of the POST body, not inferred by the server.

## 5. In-prototype feedback panel behavior

Present by default in every generated prototype (not opt-in, not
removable via config):

1. **Visible on load.** A text input and submit control, always rendered,
   never behind a toggle that defaults to closed.
2. **Submit.** On submit, the client reads the currently active
   scenario/state (LOGIC.md) or `?variant=` (UI.md), builds an entry, and
   POSTs it to `/feedback`.
   - On success: the panel re-renders from the server's merged response,
     so the new entry is visible immediately alongside prior ones.
   - On failure (fetch error/timeout — server not running): the entry is
     still appended to the panel's in-memory list for this session, shown
     with a visible "not saved — start the server to persist" warning.
     No exception escapes to break the page; the rest of the prototype
     keeps working.
3. **Load.** On page load, the client does `GET /feedback.json` and
   renders every returned entry (each showing its text, tied context, and
   acknowledged/unresolved status), before or alongside any new
   in-session entries.
4. **Unresolved gate.** Whenever at least one rendered entry (loaded or
   new) has `acknowledged: false`, a visible banner or badge is shown.
   The gate is purely informational: it never disables the base
   prototype's state/variant controls or the feedback input.
5. **Acknowledge.** Each entry has its own acknowledge control; a single
   "acknowledge all" control clears every entry at once. Acknowledging
   POSTs to the server (`/feedback/:id/ack` or `/feedback/ack-all}`); on
   success the entry stays visible but is marked resolved, and the gate
   banner/badge disappears once no unresolved entries remain. If the
   server is unreachable, acknowledging an in-memory-only entry updates
   it locally (best effort — it is not yet persisted, same as the entry
   itself).
6. **Persistence round-trip.** Because acknowledgement and submission both
   write through the server to `feedback.json`, restarting the server and
   reloading the page reproduces the exact same entries with the exact
   same acknowledged/unresolved status as before the restart.

## 6. Interactive-only rule (tightened, applies everywhere)

A prototype — base state/variant behavior *and* the feedback panel — is
real clicks driving real state, never a static description, screenshot,
or non-interactive mockup. Specifically for the feedback panel: it must
actually submit, persist through the server, and reload correctly on
restart — a panel that only renders a text box without a working submit/
persist/reload path does not satisfy the skill.

## 7. Example demos

`.claude/skills/prototype/examples/` ships two runnable demos proving out
both branches (LOGIC.md's state-tied context and UI.md's variant-tied
context each need their own proof — a single demo can only exercise one):

- One built the LOGIC.md way: `<name>.html`, `<name>-server.mjs`, and a
  starting empty `feedback.json` (`[]`), with at least two distinct
  scenarios/states to switch between so state-tagging is observable.
- One built the UI.md way: same three files, with at least two `?variant=`
  options to switch between so variant-tagging is observable.

Both must independently satisfy the full walkthrough in §8.

## 8. Acceptance walkthrough (manual, per example demo)

1. `node <name>-server.mjs` starts with no install step and prints a
   `http://localhost:PORT` URL.
2. Opening that URL shows a working prototype (real state changes for the
   LOGIC.md demo, real `?variant=` switching for the UI.md demo) and a
   visible feedback panel.
3. Submitting feedback shows it immediately, tagged with the
   scenario/state or variant active at submit time; a gate banner/badge
   appears.
4. Stopping and restarting the server, then reloading the page, shows the
   same feedback still present, still tagged, still flagged unresolved.
5. Acknowledging one entry (or using "acknowledge all") clears the gate;
   after another restart+reload, acknowledged entries stay acknowledged
   and do not re-trigger the gate.
6. Killing the server, then typing and submitting new feedback, still
   shows it in the panel with a visible "not saved" warning — no thrown
   error, no frozen page, no lost keystrokes.

## 9. Non-goals / boundaries

- Not a retrofit of `gothic/`, `roman/`, `modern/`, `mario64/`.
- Not a real backend: no auth, no multi-user concurrency handling, no
  network exposure beyond `127.0.0.1`.
- Not a database: `feedback.json` is a flat file, rewritten whole.
- Not a shared/cross-prototype ledger: each prototype's server and
  `feedback.json` are independent; deleting a prototype's folder deletes
  its feedback.
- Not blocking: the gate and the "not saved" warning are signals only.
- Not covered by automated tests — verification is the manual walkthrough
  in §8, run against both example demos.

## 10. Test seams

Concrete places a human (or a script standing in for one) can grab this
behavior, since no automated test suite backs it:

- **Skill files themselves** — `.claude/skills/prototype/SKILL.md`,
  `UI.md`, `LOGIC.md` should each contain, as literal boilerplate (not
  prose-only description): the feedback panel markup/CSS/JS, and the
  `-server.mjs` script. A reviewer can grep these files for the required
  endpoints (`/feedback`, `/feedback.json`, `/feedback/:id/ack`,
  `/feedback/ack-all`) and the "not saved" fallback path to confirm the
  boilerplate is actually present, not just described.
- **Example demo file tree** — `.claude/skills/prototype/examples/*/`
  should show, per demo: `<name>.html`, `<name>-server.mjs`,
  `feedback.json` (starts as `[]`), and no `package.json`/`node_modules`.
- **HTTP layer, independent of the UI** — with a demo server running,
  `curl`/`fetch` against `GET /feedback.json`, `POST /feedback`, `POST
  /feedback/:id/ack`, `POST /feedback/ack-all` directly; response bodies
  and the resulting `feedback.json` on disk are the seam for entry shape,
  ack persistence, and merge behavior, independent of any DOM.
- **`feedback.json` on disk** — before/after each API call above, its
  contents are the seam for "did this actually persist," not just "did
  the panel say it did."
- **DOM elements in the served HTML** — the feedback input, submit
  control, per-entry acknowledge control, "acknowledge all" control, and
  the unresolved-gate banner/badge should be reachable by stable
  selectors (e.g. consistent `id`/`data-*` attributes) so a human
  driving the browser — or a future scripted check — can locate and
  exercise them without reading the implementation first.
- **Server stdout** — the printed URL and port-increment-on-collision
  behavior are observable directly from the process output.
- **Offline path** — killing the server process, then interacting with
  the already-loaded page, is the seam for the "not saved" warning and
  for confirming no uncaught JS error reaches the console.

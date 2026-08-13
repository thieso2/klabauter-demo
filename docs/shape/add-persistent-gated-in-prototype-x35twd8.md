# Shaping map: persistent, gated feedback in the prototype skill

## What this wish is

This repo has no `.claude/skills/prototype/` today — not on this branch, not on
`main`, not as a global skill (**q1**). So this wish authors
`SKILL.md`, `UI.md`, and `LOGIC.md` from scratch: a skill for generating two
kinds of throwaway, clickable HTML prototypes, both of which must now ship a
default, always-on, persisted, gated feedback mechanism.

Both branches produce a prototype as **two co-located files, not one**
(**q6**, **q8**):

- `<name>.html` — the interactive artifact itself (LOGIC.md: free-play
  buttons + guided walkthroughs; UI.md: variant switcher via `?variant=`).
- `<name>-server.mjs` — a tiny, zero-dependency Node script (built-in
  `http`/`fs` only, **q7**) that does two jobs: serves the HTML at `/`, and
  exposes a small local JSON API for the feedback panel to read and append
  to `feedback.json`, written next to the two files.

Running a prototype is now `node <name>-server.mjs`, then open the URL it
prints — not a plain double-click of the HTML file (**q6**, deliberate change
from the skill's prior "just open the file" habit; see rationale below). The
server binds to `127.0.0.1` only.

Every generated prototype includes, by default, not opt-in:

- A visible feedback panel: text input + submit, always present.
- Each submitted entry is tagged with the scenario/state active in LOGIC.md
  prototypes, or the active `?variant=` in UI.md prototypes.
- On submit, the entry (text + tied context + id + timestamp) is POSTed to
  the local server, which appends it to `feedback.json` and returns the
  merged list. If the server isn't reachable, the entry still appears in the
  panel for that session, held in memory, with a visible "not saved — start
  the server to persist" warning (**q9**) — feedback is never silently
  dropped, but persistence is honest about its own state.
- On load, the panel fetches `feedback.json` via the server and renders
  prior entries alongside anything submitted this session.
- A visible banner/badge whenever any loaded or new entry is unacknowledged
  (a soft gate — informational, never blocks interaction with the
  prototype itself). Each entry gets an acknowledge control, plus an
  "acknowledge all." Acknowledged entries stay visible, marked resolved
  (**q3**), rather than disappearing — the panel is a full hand-off record,
  not just an inbox.
- Acknowledgement is itself persisted through the same server/file, so
  resolved entries stay resolved on the next `node <name>-server.mjs`.

`SKILL.md`/`UI.md`/`LOGIC.md` embed the feedback panel markup/CSS/JS and the
server script as concrete, copy-pasteable boilerplate (**q5**) — not prose
the generating session has to reinvent each time — since the server/API/ack
merge logic is exactly the kind of fiddly code that drifts if
re-implemented from a description on every generation.

Item 1 of the wish (tighten the interactive-only rule) is folded into
authoring these files well the first time: `SKILL.md` states plainly that a
prototype is real clicks driving real state/variant changes, never a
static description, screenshot, or non-interactive mockup, and that this
now includes the feedback panel — it must actually submit, persist, and
reload, not just render.

To validate the mechanism before it's ever exercised for real — no
automated tests are allowed as a backstop (**q4**) — this wish also ships
two minimal demo prototypes under
`.claude/skills/prototype/examples/`: one built the LOGIC.md way, one the
UI.md way, each with its own `-server.mjs` and starting empty
`feedback.json`. **Assumption beyond q4's literal wording:** q4's answer
said "one small demo"; I built one per branch instead of one total, because
a single demo can only prove out state-tied *or* variant-tied context, not
both, and item 7 of the wish explicitly requires both branches to get the
feature. If a single demo was actually intended, dropping the second one is
a cheap trim for whoever picks this up next.

## What this wish is not

- Not a retrofit. `gothic/`, `roman/`, `modern/`, and `mario64/` predate
  this skill and were built by an unrelated earlier wish; this wish does
  not touch them. The skill only shapes prototypes generated *after* it
  exists.
- Not a real backend. The Node script is a local, single-user,
  `127.0.0.1`-only file-append helper started and stopped by hand — no
  auth, no concurrent-write handling beyond a simple read-modify-write, no
  network exposure. It is a deliberate, human-approved exception
  (**q2**) to the wish's own "no real backend/server" line, chosen because
  it works identically in every browser, unlike a File System Access
  API-only approach which is Chromium-only.
- Not a database. `feedback.json` is one flat file, rewritten whole on
  each change.
- Not a shared/multi-prototype ledger. Every prototype gets its own server
  and its own `feedback.json`, co-located with it (**q8**) — deleting a
  prototype's folder removes its feedback with it, and no two prototypes'
  servers or ports need to coordinate.
- Not blocking. The unresolved-feedback gate and the "server unreachable"
  warning are both visible signals only; neither disables the prototype's
  own interactive controls.
- Not covered by automated tests (disallowed by the wish); validated
  instead by the two example demos being manually opened, played, and
  fed back into.

## Decisions and rationale

**q1 — Author the full skill now.** Nothing existed to amend; the wish
text is detailed enough to serve as the baseline spec for both branches.

**q2 — Small local server instead of a browser file-access grant.** Trades
"no server at all" for "no real server" — a few dozen lines, no
dependencies, no install step, works the same in every browser. Chosen
over the File System Access API specifically because that API only exists
in Chromium browsers and would silently degrade elsewhere.

**q3 — Acknowledged entries stay visible, marked resolved.** The panel is a
hand-off record between sessions; hiding resolved entries would make past
feedback feel lost even though it's still in the file.

**q4 — Ship demo prototype(s).** With no automated tests, actually running
the flow is the only real verification available. Built as two (see
assumption above), one per branch.

**q5 — Boilerplate embedded, not described.** The server/API/merge logic is
easy to get subtly wrong from a prose description; a tested, copy-pasteable
snippet in the skill files keeps every future generation consistent.

**q6 — Server also serves the HTML.** Changes the skill's run contract from
"double-click the file" to "run one Node command, open the URL it prints."
Accepted as the cost of q2: once the feedback panel needs a same-origin API
to talk to, serving the HTML from that same tiny server is simpler and more
robust than keeping the HTML on `file://` and reasoning about CORS from a
`null` origin to `localhost`.

**q7 — Node.js.** This environment already requires Node to run Claude Code
itself, and the one sibling project in this repo with a real toolchain
(`mario64/`) is already Node/npm-based — the safer "already installed"
assumption over Python.

**q8 — Per-prototype server and file.** Matches the wish's own wording
("written next to the prototype file") and keeps every prototype fully
independent and disposable, consistent with how the rest of the skill
treats each generated artifact.

**q9 — Feedback always accepted, unsaved state visibly flagged.** Matches
the "soft gate" philosophy the wish already applies to unresolved
feedback: signal, never block. Forgetting to start the server shouldn't
cost the driver their in-the-moment note.

**Implementation assumptions made this turn (not asked, low-stakes, left
for build/spec to firm up):** default server port is arbitrary and should
increment on collision; the JSON API is `GET /` (HTML), `GET /feedback.json`
(current state), `POST /feedback` (append entry), `POST
/feedback/:id/ack` and `POST /feedback/ack-all`; example demos live under
`.claude/skills/prototype/examples/` since they exist to validate the skill
itself rather than as a product deliverable at the repo root.

## Good outcome and acceptance criteria

A good outcome is `.claude/skills/prototype/{SKILL.md,UI.md,LOGIC.md}`
existing, each describing and providing boilerplate for: the interactive-only
rule, the default feedback panel, state/variant-tagged entries, the
server-backed persistence to `feedback.json`, load-on-reopen, and the soft
unresolved-feedback gate with per-entry and all-at-once acknowledgement —
adapted to each branch's own shape. Plus two example prototypes under
`.claude/skills/prototype/examples/` that a reviewer can actually run:

- `node <name>-server.mjs` starts with zero install step (no
  `package.json`, no npm install) and prints a `http://localhost:PORT` URL.
- Opening that URL shows a working prototype (real state changes for
  LOGIC.md, real `?variant=` switching for UI.md) plus a visible feedback
  panel.
- Submitting feedback shows it immediately, tagged with the current
  scenario/state or variant, and a gate banner/badge appears.
- Stopping and restarting the server, then reloading the page, shows the
  same feedback still there, still tagged, still flagged as unresolved.
- Acknowledging an entry (or all) clears the gate; after another
  restart+reload, that entry stays acknowledged and does not re-trigger the
  gate.
- Killing the server and typing new feedback still shows it in the panel
  with a visible "not saved" warning, and does not throw or freeze the
  page.

# Plan: persistent, gated feedback in the prototype skill

Source: `docs/spec/add-persistent-gated-in-prototype-x35twd8.md` (authoritative
for all shapes/contracts below — tickets summarize, spec is the reference).

Nothing under `.claude/skills/prototype/` exists yet on this branch or
`main`. Five slices: one foundation, two parallel skill-file authors, two
parallel example builds that each depend on their own skill file.

## Dependency shape

```
t1 (SKILL.md, canonical server.mjs + API contract)
 ├── t2 (LOGIC.md)  ── t4 (LOGIC example demo)
 └── t3 (UI.md)      ── t5 (UI example demo)
```

t2/t3 do not depend on each other. t4/t5 do not depend on each other. t4
only needs t2; t5 only needs t3.

## t1 — SKILL.md: skill contract, interactive-only rule, server + API boilerplate

No dependencies.

Author `.claude/skills/prototype/SKILL.md` from scratch. It's the entry
point a future Claude session reads before generating either kind of
prototype (LOGIC.md free-play/walkthrough, or UI.md `?variant=` switcher —
those two files are separate tickets). SKILL.md must state, and where code
is involved provide literal copy-pasteable boilerplate (not prose-only —
see spec §10 test seam), the parts shared by both branches:

- **File layout contract**: every generated prototype is three co-located
  files — `<name>.html`, `<name>-server.mjs`, `feedback.json` (starts as
  `[]`). Running a prototype is `node <name>-server.mjs`, then open the
  printed URL. Double-clicking the HTML file is explicitly no longer
  supported, because the feedback panel needs a same-origin API.
- **Interactive-only rule, tightened** (spec §6): a prototype — base
  behavior AND the feedback panel — is real clicks driving real state,
  never a static description/screenshot/mockup. A feedback panel that only
  renders a text box without a working submit/persist/reload path does not
  satisfy the skill.
- **Canonical `-server.mjs` boilerplate**: zero-dependency Node script,
  built-in `http`/`fs` only, no `package.json`, no install step. Binds to
  `127.0.0.1`, increments past a default port on collision, prints the URL
  to stdout on startup. Serves:
  - `GET /` → the prototype's HTML
  - `GET /feedback.json` → current contents of `feedback.json` (`[]` if
    missing)
  - `POST /feedback` → body is a new entry minus `id`/`acknowledged`;
    server assigns `id` + ISO 8601 `timestamp`, sets `acknowledged: false`,
    appends, writes the whole file, returns the merged array
  - `POST /feedback/:id/ack` → sets that entry's `acknowledged: true`,
    writes, returns merged array
  - `POST /feedback/ack-all` → sets every entry's `acknowledged: true`,
    writes, returns merged array
  - All writes are read-whole-file → modify → write-whole-file. No partial
    writes, no external DB, no auth, no concurrency handling beyond that.
  This exact script (or a script identical in behavior) is what LOGIC.md
  and UI.md will each also embed — the server does not differ by branch,
  only the client-side context tagging does.
- **Feedback entry shape** (spec §4): `{id, text, context, timestamp,
  acknowledged}` — `context` is captured client-side (active scenario/state
  or active `?variant=`) and sent in the POST body, never inferred
  server-side.
- **Feedback panel contract** (spec §5), described generically here (LOGIC.md/
  UI.md each adapt the context-tagging part): always-visible input + submit,
  never behind a closed-by-default toggle; on load `GET /feedback.json` and
  render all entries; on submit success re-render from the server's merged
  response; on submit failure (fetch error — server not running) keep the
  entry in an in-memory list for the session with a visible "not saved —
  start the server to persist" warning, no thrown exception, rest of the
  page keeps working; unresolved-gate banner/badge shown whenever any
  rendered entry has `acknowledged: false`, purely informational, never
  disables base controls or the input itself; per-entry acknowledge control
  plus one "acknowledge all" control, POSTing to the ack endpoints,
  acknowledged entries stay visible marked resolved (never hidden/deleted).
- Stable selectors (consistent `id`/`data-*`) on the feedback input, submit
  control, per-entry ack control, ack-all control, and gate banner/badge, so
  they're reachable without reading implementation (spec §10).
- Point to `UI.md` and `LOGIC.md` as the two branches, each producing the
  three-file output above with this shared machinery, adapted to their own
  state/variant shape.

Do not touch `gothic/`, `roman/`, `modern/`, `mario64/` — out of scope.

## t2 — LOGIC.md: free-play/walkthrough branch with state-tied feedback

Depends on: t1.

Author `.claude/skills/prototype/LOGIC.md` — instructions + literal
boilerplate for the free-play-buttons + guided-walkthrough style of
prototype, adapted per spec:

- Preserve/restate whatever LOGIC.md's existing free-play + walkthrough
  demo behavior is meant to be (real buttons driving real state changes,
  guided walkthrough steps) — tightened per the interactive-only rule from
  t1: no static mockups.
- Embed the same `-server.mjs` boilerplate from t1 (server logic is
  branch-agnostic).
- Embed the feedback panel HTML/CSS/JS, adapted so the client captures the
  **currently active scenario/state name** as `context` at submit time and
  sends it in the POST body.
- Cover load (`GET /feedback.json` on page load, render before/alongside
  new entries), the unresolved gate, per-entry + all acknowledge controls,
  and the offline "not saved" fallback — same behavioral contract as t1,
  just concretely wired to LOGIC.md's state model.
- Literal, copy-pasteable code blocks — not prose descriptions (spec §10:
  a reviewer must be able to grep this file for `/feedback`,
  `/feedback.json`, `/feedback/:id/ack`, `/feedback/ack-all`, and the "not
  saved" fallback text and find them present).

## t3 — UI.md: variant-switcher branch with variant-tied feedback

Depends on: t1.

Author `.claude/skills/prototype/UI.md` — instructions + literal
boilerplate for the `?variant=`-driven radically-different-UI-options
switcher, adapted per spec:

- Preserve/restate whatever UI.md's existing variant-switching behavior is
  meant to be (real `?variant=` switching, each variant a genuinely
  different interactive UI, not a static description) — tightened per the
  interactive-only rule from t1.
- Embed the same `-server.mjs` boilerplate from t1 (server logic is
  branch-agnostic).
- Embed the feedback panel HTML/CSS/JS, adapted so the client captures the
  **currently active `?variant=` value** as `context` at submit time and
  sends it in the POST body.
- Cover load, the unresolved gate, per-entry + all acknowledge controls,
  and the offline "not saved" fallback — same behavioral contract as t1,
  wired to UI.md's variant model.
- Literal, copy-pasteable code blocks, grep-able for the same endpoints and
  fallback text as t2 (spec §10).

## t4 — LOGIC.md example demo, built and manually verified

Depends on: t2.

Under `.claude/skills/prototype/examples/` (pick a short descriptive name,
e.g. `examples/logic-demo/`), build a minimal but real prototype following
LOGIC.md exactly as authored in t2:

- `<name>.html`, `<name>-server.mjs`, `feedback.json` (starts as `[]`).
- At least two distinct scenarios/states to switch between, so
  state-tagging is observable in submitted feedback.
- No `package.json`, no `node_modules`, no install step.

Then run the full manual acceptance walkthrough (spec §8) against it and
fix anything that doesn't hold:

1. `node <name>-server.mjs` starts with no install step, prints a
   `http://localhost:PORT` URL.
2. Opening the URL shows real state changes plus a visible feedback panel.
3. Submitting feedback shows it immediately, tagged with the active
   scenario/state; a gate banner/badge appears.
4. Stop and restart the server, reload the page: same feedback still
   present, still tagged, still flagged unresolved.
5. Acknowledge one entry (or "acknowledge all"): gate clears; after
   another restart+reload, stays acknowledged, gate does not reappear.
6. Kill the server, submit new feedback: still shows in the panel with a
   visible "not saved" warning, no thrown error, no frozen page.

Also spot-check the HTTP layer directly (curl/fetch against
`GET /feedback.json`, `POST /feedback`, `POST /feedback/:id/ack`,
`POST /feedback/ack-all`) and confirm `feedback.json` on disk matches
what the API returns at each step (spec §10 test seams).

## t5 — UI.md example demo, built and manually verified

Depends on: t3.

Under `.claude/skills/prototype/examples/` (e.g. `examples/ui-demo/`),
build a minimal but real prototype following UI.md exactly as authored in
t3:

- `<name>.html`, `<name>-server.mjs`, `feedback.json` (starts as `[]`).
- At least two `?variant=` options to switch between, so variant-tagging
  is observable in submitted feedback.
- No `package.json`, no `node_modules`, no install step.

Then run the same full manual acceptance walkthrough as t4 (spec §8),
substituting `?variant=` switching for scenario/state switching in steps 2
and 3, plus the same HTTP-layer and on-disk `feedback.json` spot-checks.

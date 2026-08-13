---
name: prototype
description: Generate a throwaway, clickable HTML prototype with a built-in, persisted, gated feedback panel. Use for quick interactive demos (LOGIC.md free-play/walkthrough branch, or UI.md variant-switcher branch) — never for production code.
---

# Prototype skill

This skill generates disposable, interactive HTML prototypes. It has two
branches for the interactive artifact itself — **[LOGIC.md](LOGIC.md)**
(free-play buttons + guided walkthroughs over some state machine) and
**[UI.md](UI.md)** (a `?variant=` switcher between radically different UI
options) — but both branches share everything in this file: the file
layout, the interactive-only rule, the local server, and the feedback
panel. Read this file first, then read LOGIC.md or UI.md for the branch
that matches what's being prototyped.

## 1. File layout contract

Every prototype this skill produces is **three co-located files**, never
one:

- `<name>.html` — the interactive artifact.
- `<name>-server.mjs` — a zero-dependency Node script (§3) that serves the
  HTML and the feedback API.
- `feedback.json` — starts as `[]`, written next to the other two.

Running a prototype is:

```
node <name>-server.mjs
```

then opening the URL it prints. **Double-clicking `<name>.html` directly
is not a supported way to run a prototype built by this skill** — the
feedback panel calls a same-origin API that only exists when the server is
running. Opening the raw file over `file://` gives a prototype with a
broken feedback panel, which fails the interactive-only rule below.

## 2. Interactive-only rule (applies everywhere, tightened)

A prototype is real clicks driving real state or variant changes. It is
never a static description, a screenshot, or a non-interactive mockup —
this applies to the base LOGIC.md/UI.md behavior *and* to the feedback
panel equally.

The feedback panel specifically must actually submit, persist through the
server, and reload correctly after a restart. A panel that only renders a
text box, with no working submit/persist/reload path, does **not** satisfy
this skill — it's exactly the kind of static mockup the rule forbids.

## 3. Canonical server: `<name>-server.mjs`

Every prototype embeds this exact script (or one identical in behavior),
with `<name>.html` replaced by the prototype's actual filename. It is
branch-agnostic — LOGIC.md and UI.md both use it unmodified; only the
client-side context tagging in the HTML differs between branches.

Zero dependencies: built-in `http`/`fs`/`path`/`url` only. No
`package.json`, no install step. Binds to `127.0.0.1` only, increments
past a default port on collision, prints the URL it's serving on to
stdout.

```js
// <name>-server.mjs
// Zero-dependency local server for this prototype. No install step.
// Usage: node <name>-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.join(__dirname, '<name>.html'); // <-- rename to match this prototype
const FEEDBACK_FILE = path.join(__dirname, 'feedback.json');
const DEFAULT_PORT = 4173;

function readFeedback() {
  try {
    return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeFeedback(entries) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2));
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(HTML_FILE));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/feedback.json') {
    sendJson(res, 200, readFeedback());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/feedback') {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid JSON body' });
      return;
    }
    const entries = readFeedback();
    entries.push({
      id: makeId(),
      text: body.text,
      context: body.context,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
    writeFeedback(entries);
    sendJson(res, 200, entries);
    return;
  }

  const ackMatch = url.pathname.match(/^\/feedback\/([^/]+)\/ack$/);
  if (req.method === 'POST' && ackMatch) {
    const entries = readFeedback();
    const target = entries.find((e) => e.id === ackMatch[1]);
    if (target) target.acknowledged = true;
    writeFeedback(entries);
    sendJson(res, 200, entries);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/feedback/ack-all') {
    const entries = readFeedback();
    entries.forEach((e) => (e.acknowledged = true));
    writeFeedback(entries);
    sendJson(res, 200, entries);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

let port = DEFAULT_PORT;
function tryListen() {
  server.listen(port, '127.0.0.1');
}
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    port += 1;
    tryListen();
  } else {
    throw err;
  }
});
server.on('listening', () => {
  console.log(`Prototype running at http://127.0.0.1:${port}`);
});
tryListen();
```

All writes are read-whole-file → modify → write-whole-file. No partial
writes, no external database, no auth, no concurrency handling beyond
that — this is a local, single-user, hand-started/stopped helper, not a
real backend.

### API contract

- `GET /` → the prototype's HTML.
- `GET /feedback.json` → current contents of `feedback.json` (`[]` if the
  file doesn't exist yet).
- `POST /feedback` → body is a new entry minus `id`/`acknowledged`; server
  assigns `id` and an ISO 8601 `timestamp`, sets `acknowledged: false`,
  appends it, writes the whole file, and returns the merged array.
- `POST /feedback/:id/ack` → sets that entry's `acknowledged` to `true`,
  writes, returns the merged array.
- `POST /feedback/ack-all` → sets every entry's `acknowledged` to `true`,
  writes, returns the merged array.

## 4. Feedback entry shape

```json
{
  "id": "string, server-assigned, unique",
  "text": "string, the feedback text, non-empty",
  "context": "string — active scenario/state name (LOGIC.md) or active ?variant= value (UI.md)",
  "timestamp": "ISO 8601 string, server-assigned",
  "acknowledged": false
}
```

`context` is captured **client-side**, at the moment of submission, and
sent as part of the `POST /feedback` body. The server never infers it.

## 5. Feedback panel contract

Included by default in every prototype — not opt-in, not behind a
config flag:

1. **Always visible.** The input and submit control render immediately;
   never behind a toggle that defaults to closed.
2. **Load.** On page load, `GET /feedback.json` and render every entry
   returned (text, tied context, acknowledged/unresolved status) before or
   alongside any newly submitted entries.
3. **Submit.** Reads the active scenario/state (LOGIC.md) or `?variant=`
   (UI.md) via a small branch-specific `getActiveContext()`, builds an
   entry, and `POST`s it to `/feedback`.
   - Success: re-render from the server's merged response.
   - Failure (fetch error — server not running): keep the entry in an
     in-memory, session-only list, rendered with a visible **"not saved —
     start the server to persist"** warning. No exception escapes; the
     rest of the page keeps working.
4. **Unresolved gate.** Whenever at least one rendered entry (loaded or
   new) has `acknowledged: false`, a visible banner/badge is shown. Purely
   informational — it never disables the base prototype's controls or the
   feedback input itself.
5. **Acknowledge.** Each entry has its own acknowledge control; one
   "acknowledge all" control clears every entry at once. Both `POST` to
   the ack endpoints; acknowledged entries **stay visible, marked
   resolved** — never hidden or deleted. If the server is unreachable,
   acknowledging an in-memory-only entry updates it locally (best effort).

## 6. Canonical feedback panel boilerplate (HTML/CSS/JS)

Embed this markup and script in `<name>.html`. The only branch-specific
part is `getActiveContext()`, marked below — LOGIC.md returns the active
scenario/state name, UI.md returns the active `?variant=` value.

```html
<section id="feedback-panel" data-feedback-panel>
  <div id="feedback-gate" data-feedback-gate hidden>
    <span data-feedback-gate-count id="feedback-gate-count">0</span>
    unresolved feedback item(s)
    <button type="button" id="feedback-ack-all" data-feedback-ack-all>Acknowledge all</button>
  </div>

  <form id="feedback-form" data-feedback-form>
    <label for="feedback-input">Feedback</label>
    <input
      type="text"
      id="feedback-input"
      data-feedback-input
      placeholder="What do you think? (tied to the current state/variant)"
      required
    />
    <button type="submit" id="feedback-submit" data-feedback-submit>Submit feedback</button>
  </form>

  <div id="feedback-offline-warning" data-feedback-offline-warning hidden>
    Not saved — start the server (<code>node &lt;name&gt;-server.mjs</code>) to persist.
  </div>

  <ul id="feedback-list" data-feedback-list></ul>
</section>

<style>
  #feedback-panel { border-top: 2px solid #333; margin-top: 2rem; padding: 1rem; font: 14px system-ui, sans-serif; }
  #feedback-gate { background: #fff3cd; border: 1px solid #d4a72c; padding: 0.5rem; margin-bottom: 0.75rem; }
  #feedback-offline-warning { background: #f8d7da; border: 1px solid #d33; padding: 0.5rem; margin: 0.5rem 0; }
  #feedback-list { list-style: none; padding: 0; }
  #feedback-list li { border: 1px solid #ccc; padding: 0.5rem; margin-bottom: 0.5rem; }
  #feedback-list li.resolved { opacity: 0.6; }
  #feedback-list [data-feedback-context] { font-weight: bold; margin-left: 0.5rem; }
  #feedback-list [data-feedback-unsaved] { color: #a33; }
</style>

<script>
(function () {
  // --- branch-specific: LOGIC.md/UI.md replace this body ---
  function getActiveContext() {
    return 'default';
  }
  // -----------------------------------------------------------

  const state = { entries: [], localOnly: [] };

  const form = document.getElementById('feedback-form');
  const input = document.getElementById('feedback-input');
  const list = document.getElementById('feedback-list');
  const gate = document.getElementById('feedback-gate');
  const gateCount = document.getElementById('feedback-gate-count');
  const ackAllBtn = document.getElementById('feedback-ack-all');
  const offlineWarning = document.getElementById('feedback-offline-warning');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    const all = [...state.entries, ...state.localOnly];
    list.innerHTML = '';
    all.forEach((entry) => {
      const li = document.createElement('li');
      li.dataset.feedbackEntry = entry.id;
      li.className = entry.acknowledged ? 'resolved' : 'unresolved';
      li.innerHTML = `
        <span data-feedback-text>${escapeHtml(entry.text)}</span>
        <span data-feedback-context>[${escapeHtml(entry.context)}]</span>
        <span data-feedback-status>${entry.acknowledged ? 'resolved' : 'unresolved'}</span>
        ${entry._unsaved ? '<em data-feedback-unsaved>(not saved — start the server to persist)</em>' : ''}
        ${entry.acknowledged ? '' : `<button type="button" data-feedback-ack="${entry.id}">Acknowledge</button>`}
      `;
      list.appendChild(li);
    });

    const unresolvedCount = all.filter((e) => !e.acknowledged).length;
    gate.hidden = unresolvedCount === 0;
    gateCount.textContent = String(unresolvedCount);

    list.querySelectorAll('[data-feedback-ack]').forEach((btn) => {
      btn.addEventListener('click', () => acknowledge(btn.getAttribute('data-feedback-ack')));
    });
  }

  async function load() {
    try {
      const res = await fetch('/feedback.json');
      state.entries = await res.json();
    } catch {
      state.entries = [];
    }
    render();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const context = getActiveContext();
    try {
      const res = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context }),
      });
      if (!res.ok) throw new Error('save failed');
      state.entries = await res.json();
      offlineWarning.hidden = true;
    } catch {
      state.localOnly.push({
        id: `local-${Date.now()}`,
        text,
        context,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        _unsaved: true,
      });
      offlineWarning.hidden = false;
    }
    input.value = '';
    render();
  });

  async function acknowledge(id) {
    const local = state.localOnly.find((e) => e.id === id);
    if (local) {
      local.acknowledged = true;
      render();
      return;
    }
    try {
      const res = await fetch(`/feedback/${encodeURIComponent(id)}/ack`, { method: 'POST' });
      if (res.ok) state.entries = await res.json();
    } catch {
      // best effort — server unreachable, leave state as-is
    }
    render();
  }

  ackAllBtn.addEventListener('click', async () => {
    state.localOnly.forEach((e) => (e.acknowledged = true));
    try {
      const res = await fetch('/feedback/ack-all', { method: 'POST' });
      if (res.ok) state.entries = await res.json();
    } catch {
      // best effort
    }
    render();
  });

  load();
})();
</script>
```

## 7. Stable selectors

So the panel is reachable without reading the implementation:

| Element | Selector |
| --- | --- |
| Feedback text input | `#feedback-input` / `[data-feedback-input]` |
| Submit control | `#feedback-submit` / `[data-feedback-submit]` |
| Feedback form | `#feedback-form` / `[data-feedback-form]` |
| Entry list | `#feedback-list` / `[data-feedback-list]` |
| Per-entry acknowledge control | `[data-feedback-ack="<id>"]` |
| Acknowledge-all control | `#feedback-ack-all` / `[data-feedback-ack-all]` |
| Unresolved gate banner | `#feedback-gate` / `[data-feedback-gate]` (hidden when no unresolved entries) |
| Offline "not saved" warning | `#feedback-offline-warning` / `[data-feedback-offline-warning]` |

## 8. The two branches

This file covers everything shared. Pick the branch that matches the
prototype being built, and follow it for the interactive-artifact half of
the three-file output — it embeds this same server and feedback panel,
adapted only in how `getActiveContext()` is implemented:

- **[LOGIC.md](LOGIC.md)** — free-play buttons + guided walkthroughs over
  a state machine. `getActiveContext()` returns the active scenario/state
  name.
- **[UI.md](UI.md)** — a `?variant=` switcher between distinct UI options.
  `getActiveContext()` returns the active `?variant=` value.

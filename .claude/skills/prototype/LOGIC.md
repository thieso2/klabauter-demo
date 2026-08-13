# LOGIC.md — free-play + walkthrough branch

Read [SKILL.md](SKILL.md) first — it owns the file layout, the
interactive-only rule, the canonical `-server.mjs`, the feedback entry
shape, and the feedback panel contract. This file adapts that shared
machinery to the **free-play buttons + guided walkthrough** shape: a
prototype built around an explicit, named state machine that the user can
either poke at directly (free play) or step through in a scripted order
(walkthrough).

## 1. What this branch produces

A single named `currentState` (or `currentScenario` — pick one term and
use it consistently) drives everything on screen:

- **Free play**: one button per state, each calling `setState(name)`
  directly. Clicking a button changes `currentState` and re-renders the
  view for that state, immediately, with no confirmation step.
- **Guided walkthrough**: a fixed, ordered list of steps, each naming a
  target state and a short caption ("now the cart is empty", "now
  checkout has failed"). "Start walkthrough" resets to step 0 and applies
  its state; "Next step" advances and applies the next state; the
  walkthrough can be left at any point to go back to free play.

Both paths call the same `setState()` — there is no separate rendering
path for "walkthrough mode" vs "free-play mode". This is what keeps the
walkthrough honest: it is driving the same real state changes free play
does, just in a fixed order.

## 2. Interactive-only rule, restated for this branch

Every state in the state machine must have a real, reachable button (free
play) and be reachable via the walkthrough. A state that only exists in a
comment or a design note, with no button wired to `setState()`, does not
count as part of the prototype. Likewise the walkthrough must actually
call `setState()` on each step — a walkthrough that only changes captions
without changing the underlying state fails the interactive-only rule
from SKILL.md §2.

## 3. State model contract

Define states as data, not as scattered conditionals, so both free-play
buttons and the walkthrough can drive them uniformly:

```js
// Adapt this object to the scenario being prototyped. Each key is a state
// name (also what getActiveContext() reports as feedback `context`).
const STATES = {
  cart: {
    label: 'Cart',
    render: () => `<h2>Cart</h2><p>2 items, $42.00</p>`,
  },
  checkout: {
    label: 'Checkout',
    render: () => `<h2>Checkout</h2><p>Enter payment details.</p>`,
  },
  'checkout-failed': {
    label: 'Checkout failed',
    render: () => `<h2>Checkout failed</h2><p>Card declined. Try again.</p>`,
  },
  shipped: {
    label: 'Shipped',
    render: () => `<h2>Shipped</h2><p>Tracking #12345.</p>`,
  },
};

const WALKTHROUGH = [
  { state: 'cart', caption: 'Start: two items in the cart.' },
  { state: 'checkout', caption: 'User proceeds to checkout.' },
  { state: 'checkout-failed', caption: 'Payment is declined.' },
  { state: 'checkout', caption: 'User retries with a different card.' },
  { state: 'shipped', caption: 'Payment succeeds; order ships.' },
];

let currentState = 'cart';
let walkthroughStep = null; // null = free play; otherwise index into WALKTHROUGH

function setState(name) {
  currentState = name;
  walkthroughStep = null; // any direct setState() call exits walkthrough mode
  render();
}

function startWalkthrough() {
  walkthroughStep = 0;
  currentState = WALKTHROUGH[0].state;
  render();
}

function nextWalkthroughStep() {
  if (walkthroughStep === null || walkthroughStep >= WALKTHROUGH.length - 1) return;
  walkthroughStep += 1;
  currentState = WALKTHROUGH[walkthroughStep].state;
  render();
}

function render() {
  document.getElementById('state-view').innerHTML = STATES[currentState].render();
  document.querySelectorAll('[data-state-button]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-state-button') === currentState);
  });
  const wt = document.getElementById('walkthrough-caption');
  wt.textContent = walkthroughStep === null ? '' : WALKTHROUGH[walkthroughStep].caption;
  document.getElementById('walkthrough-next').disabled =
    walkthroughStep === null || walkthroughStep >= WALKTHROUGH.length - 1;
}
```

`getActiveContext()` for this branch (§5) is just `() => currentState` —
the state name is already the right granularity for tying feedback to
"what was on screen when this was submitted."

## 4. Canonical server: `<name>-server.mjs`

Identical to SKILL.md §3 — embed it unmodified, only renaming
`<name>.html` inside it to match this prototype's actual filename.

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

### API contract (unchanged from SKILL.md §3)

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

## 5. Feedback panel, wired to the state model

Same panel as SKILL.md §6, with `getActiveContext()` filled in to report
`currentState`:

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
      placeholder="What do you think of this state? (tied to the current state)"
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
  // --- branch-specific for LOGIC.md: report the active state name ---
  function getActiveContext() {
    return currentState; // set by the state model in section 3 — must be in scope
  }
  // -----------------------------------------------------------------

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

  function renderFeedback() {
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

  async function loadFeedback() {
    try {
      const res = await fetch('/feedback.json');
      state.entries = await res.json();
    } catch {
      state.entries = [];
    }
    renderFeedback();
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
    renderFeedback();
  });

  async function acknowledge(id) {
    const local = state.localOnly.find((e) => e.id === id);
    if (local) {
      local.acknowledged = true;
      renderFeedback();
      return;
    }
    try {
      const res = await fetch(`/feedback/${encodeURIComponent(id)}/ack`, { method: 'POST' });
      if (res.ok) state.entries = await res.json();
    } catch {
      // best effort — server unreachable, leave state as-is
    }
    renderFeedback();
  }

  ackAllBtn.addEventListener('click', async () => {
    state.localOnly.forEach((e) => (e.acknowledged = true));
    try {
      const res = await fetch('/feedback/ack-all', { method: 'POST' });
      if (res.ok) state.entries = await res.json();
    } catch {
      // best effort
    }
    renderFeedback();
  });

  loadFeedback();
})();
</script>
```

Note `renderFeedback()`/`loadFeedback()` are named distinctly from the
state model's own `render()` in §3 so the two scripts can sit on the same
page without clashing.

## 6. Full worked `<name>.html` skeleton

This is the shape a generated `<name>.html` should follow: free-play
buttons, walkthrough controls, the state view, and the feedback panel all
on one page, in the order a person would actually use them.

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Prototype</title>
  <style>
    body { font: 16px system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    #controls button { margin: 0.25rem; }
    #controls button.active { outline: 2px solid #06c; font-weight: bold; }
    #walkthrough-caption { font-style: italic; min-height: 1.2em; }
    #state-view { border: 1px solid #ccc; padding: 1rem; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>Order status prototype</h1>

  <section id="controls">
    <h3>Free play</h3>
    <div id="state-buttons"></div>

    <h3>Guided walkthrough</h3>
    <button type="button" id="walkthrough-start">Start walkthrough</button>
    <button type="button" id="walkthrough-next" disabled>Next step</button>
    <p id="walkthrough-caption"></p>
  </section>

  <section id="state-view"></section>

  <!-- feedback panel from section 5 goes here -->

  <script>
    // --- state model from section 3 goes here ---

    document.getElementById('state-buttons').innerHTML = Object.entries(STATES)
      .map(([name, def]) => `<button type="button" data-state-button="${name}">${def.label}</button>`)
      .join('');
    document.querySelectorAll('[data-state-button]').forEach((btn) => {
      btn.addEventListener('click', () => setState(btn.getAttribute('data-state-button')));
    });
    document.getElementById('walkthrough-start').addEventListener('click', startWalkthrough);
    document.getElementById('walkthrough-next').addEventListener('click', nextWalkthroughStep);

    render();
  </script>

  <!-- feedback panel script from section 5 goes here -->
</body>
</html>
```

## 7. Stable selectors

Feedback selectors are identical to SKILL.md §7. This branch adds:

| Element | Selector |
| --- | --- |
| Free-play state button | `[data-state-button="<state-name>"]` |
| Start walkthrough | `#walkthrough-start` |
| Next walkthrough step | `#walkthrough-next` |
| Walkthrough caption | `#walkthrough-caption` |
| State view (current render target) | `#state-view` |

# UI.md — variant-switcher branch

Read [SKILL.md](SKILL.md) first — it owns the file layout, the
interactive-only rule, the canonical `-server.mjs`, the feedback entry
shape, and the feedback panel contract. This file adapts that shared
machinery to the **`?variant=` switcher** shape: several radically
different UI treatments of the same underlying task or screen, switched
live via a `?variant=` query parameter and an in-page control — never a
static side-by-side description of what each option "would" look like.

## 1. What this branch produces

A single `currentVariant` drives which UI is mounted into the page:

- Each variant is a **genuinely different, fully interactive UI** for the
  same underlying task (e.g. a card grid vs. a data table vs. a wizard) —
  not the same layout with a palette swap. Each variant has its own real
  controls (buttons, inputs, toggles) that do something within that
  variant, not just a label reading "Variant B".
- **Switching** happens two ways, both driving the same `setVariant()`: a
  visible variant-picker control on the page, and the `?variant=` URL
  query parameter itself (so a direct link or a page reload lands on the
  right variant). Picking a variant updates the URL via
  `history.pushState` (no full reload) and re-renders; `popstate` (back/
  forward) also re-renders.
- There is no separate rendering path for "the variant switcher" vs. "the
  variant itself" — clicking the picker calls the exact same
  `setVariant()` that reading the URL on load calls.

## 2. Interactive-only rule, restated for this branch

Every variant must be reachable via a real control that calls
`setVariant()`, and once mounted must have its own working interactive
elements — a variant that only renders inert markup with no clickable
behavior does not count, even if it looks visually distinct. A "variant
switcher" that just swaps CSS classes on identical markup is not a
radically different UI option and fails this rule; each variant's
`render()` should mount meaningfully different DOM/interaction, not the
same DOM re-skinned.

## 3. Variant model contract

Define variants as data, keyed by the exact string used in `?variant=`,
so the picker, the URL, and `getActiveContext()` all agree on the same
names:

```js
// Adapt this object to the screen being prototyped. Each key is a variant
// id (also what getActiveContext() reports as feedback `context`, and
// what appears in the URL as ?variant=<key>).
const VARIANTS = {
  cards: {
    label: 'Card grid',
    render: (root) => {
      root.innerHTML = `
        <div class="cards">
          <div class="card" data-plan="basic"><h3>Basic</h3><p>$9/mo</p><button type="button" data-select-plan="basic">Choose</button></div>
          <div class="card" data-plan="pro"><h3>Pro</h3><p>$29/mo</p><button type="button" data-select-plan="pro">Choose</button></div>
          <div class="card" data-plan="team"><h3>Team</h3><p>$99/mo</p><button type="button" data-select-plan="team">Choose</button></div>
        </div>
        <p id="cards-selection">No plan selected.</p>
      `;
      root.querySelectorAll('[data-select-plan]').forEach((btn) => {
        btn.addEventListener('click', () => {
          root.querySelector('#cards-selection').textContent = `Selected: ${btn.getAttribute('data-select-plan')}`;
        });
      });
    },
  },
  table: {
    label: 'Comparison table',
    render: (root) => {
      root.innerHTML = `
        <table>
          <thead><tr><th data-sort="name">Plan</th><th data-sort="price">Price</th><th>Seats</th></tr></thead>
          <tbody id="table-body">
            <tr><td>Basic</td><td data-price="9">$9/mo</td><td>1</td></tr>
            <tr><td>Pro</td><td data-price="29">$29/mo</td><td>5</td></tr>
            <tr><td>Team</td><td data-price="99">$99/mo</td><td>20</td></tr>
          </tbody>
        </table>
      `;
      root.querySelector('[data-sort="price"]').addEventListener('click', () => {
        const body = root.querySelector('#table-body');
        const rows = [...body.querySelectorAll('tr')].sort(
          (a, b) => Number(a.querySelector('[data-price]').dataset.price) - Number(b.querySelector('[data-price]').dataset.price)
        );
        rows.forEach((row) => body.appendChild(row));
      });
    },
  },
  wizard: {
    label: 'Step wizard',
    render: (root) => {
      let step = 0;
      const steps = ['Pick a plan', 'Enter team size', 'Confirm'];
      const renderStep = () => {
        root.innerHTML = `
          <p>Step ${step + 1} of ${steps.length}: ${steps[step]}</p>
          <button type="button" data-wizard-back ${step === 0 ? 'disabled' : ''}>Back</button>
          <button type="button" data-wizard-next ${step === steps.length - 1 ? 'disabled' : ''}>Next</button>
        `;
        root.querySelector('[data-wizard-back]').addEventListener('click', () => { step = Math.max(0, step - 1); renderStep(); });
        root.querySelector('[data-wizard-next]').addEventListener('click', () => { step = Math.min(steps.length - 1, step + 1); renderStep(); });
      };
      renderStep();
    },
  },
};

const DEFAULT_VARIANT = 'cards';

function getVariantFromURL() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('variant');
  return requested && VARIANTS[requested] ? requested : DEFAULT_VARIANT;
}

let currentVariant = getVariantFromURL();

function setVariant(name) {
  if (!VARIANTS[name]) return;
  currentVariant = name;
  const url = new URL(location.href);
  url.searchParams.set('variant', name);
  history.pushState({}, '', url);
  renderVariant();
}

function renderVariant() {
  VARIANTS[currentVariant].render(document.getElementById('variant-view'));
  document.querySelectorAll('[data-variant-button]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-variant-button') === currentVariant);
  });
}

window.addEventListener('popstate', () => {
  currentVariant = getVariantFromURL();
  renderVariant();
});
```

`getActiveContext()` for this branch (§5) is just `() => currentVariant` —
the variant id is already the right granularity for tying feedback to
"which UI option was on screen when this was submitted."

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

## 5. Feedback panel, wired to the variant model

Same panel as SKILL.md §6, with `getActiveContext()` filled in to report
`currentVariant`:

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
      placeholder="What do you think of this variant? (tied to the current variant)"
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
  // --- branch-specific for UI.md: report the active ?variant= value ---
  function getActiveContext() {
    return currentVariant; // set by the variant model in section 3 — must be in scope
  }
  // ----------------------------------------------------------------------

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
variant model's own `renderVariant()` in §3 so the two scripts can sit on
the same page without clashing.

## 6. Full worked `<name>.html` skeleton

This is the shape a generated `<name>.html` should follow: the variant
picker, the mounted variant, and the feedback panel all on one page, in
the order a person would actually use them.

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Prototype</title>
  <style>
    body { font: 16px system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    #variant-picker button { margin: 0.25rem; }
    #variant-picker button.active { outline: 2px solid #06c; font-weight: bold; }
    #variant-view { border: 1px solid #ccc; padding: 1rem; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>Pricing page prototype</h1>

  <section id="variant-picker"></section>

  <section id="variant-view"></section>

  <!-- feedback panel from section 5 goes here -->

  <script>
    // --- variant model from section 3 goes here ---

    document.getElementById('variant-picker').innerHTML = Object.entries(VARIANTS)
      .map(([name, def]) => `<button type="button" data-variant-button="${name}">${def.label}</button>`)
      .join('');
    document.querySelectorAll('[data-variant-button]').forEach((btn) => {
      btn.addEventListener('click', () => setVariant(btn.getAttribute('data-variant-button')));
    });

    renderVariant();
  </script>

  <!-- feedback panel script from section 5 goes here -->
</body>
</html>
```

## 7. Stable selectors

Feedback selectors are identical to SKILL.md §7. This branch adds:

| Element | Selector |
| --- | --- |
| Variant picker button | `[data-variant-button="<variant-id>"]` |
| Variant view (current mount target) | `#variant-view` |

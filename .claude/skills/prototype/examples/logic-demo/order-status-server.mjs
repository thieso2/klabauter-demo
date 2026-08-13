// order-status-server.mjs
// Zero-dependency local server for this prototype. No install step.
// Usage: node order-status-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.join(__dirname, 'order-status.html');
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

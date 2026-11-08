// Runs gallery cards on a small pool of Web Workers. Each card hands its
// canvas to one worker (as an OffscreenCanvas), which builds and draws it, so
// the page's main thread only sends messages. One shared clock drives every
// animated card, and a worker is only sent the next frame once it has
// finished the last, so a slow design drops frames instead of piling up work.
// Each card keeps its own place in its loop, so it can pause and resume.
//
// Where OffscreenCanvas isn't supported, the same renderer runs on the main
// thread, one message per task, so the page still stays responsive.

const OFFSCREEN =
  typeof Worker !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  'transferControlToOffscreen' in HTMLCanvasElement.prototype;

const cards = new Map();
let pool = null;
let nextId = 1;
let raf = 0;

function receive(worker, msg) {
  if (msg.type === 'done') {
    worker.busy = false;
    return;
  }
  const card = cards.get(msg.id);
  // Only the newest build of a card counts; an older one still in flight is dropped.
  if (msg.type === 'ready' && card && msg.gen === card.gen) card.onReady(msg);
}

function makeWorker() {
  const worker = new Worker(new URL('../workers/card-worker.js', import.meta.url), { type: 'module' });
  const w = { busy: false, count: 0, send: (msg, transfer = []) => worker.postMessage(msg, transfer) };
  worker.onmessage = (event) => receive(w, event.data);
  return w;
}

function makeLocal() {
  const w = { busy: false, count: 0 };
  const renderer = import('./card-renderer.js').then((m) => m.createRenderer((msg) => receive(w, msg)));
  // Each message runs in its own task, in order, so the page can paint between them.
  w.send = (msg) => renderer.then((r) => setTimeout(() => r.handle(msg), 0));
  return w;
}

function workers() {
  if (!pool) {
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    pool = OFFSCREEN ? Array.from({ length: Math.max(1, Math.min(4, cores - 1)) }, makeWorker) : [makeLocal()];
  }
  return pool;
}

function tick(now) {
  raf = 0;
  const due = new Map();
  for (const [id, card] of cards) {
    if (!card.active) continue;
    if (!due.has(card.worker)) due.set(card.worker, []);
    due.get(card.worker).push(id);
  }
  for (const [worker, ids] of due) {
    if (worker.busy) continue;
    worker.busy = true;
    worker.send({ type: 'frame', now, ids });
  }
  if (due.size) raf = requestAnimationFrame(tick);
}

// Hands a canvas to the least busy worker. Returns the card's id.
export function connect(canvas, onReady) {
  const worker = workers().reduce((a, b) => (b.count < a.count ? b : a));
  const id = nextId++;
  worker.count++;
  cards.set(id, { worker, onReady, gen: 0, active: false });
  if (OFFSCREEN) {
    const offscreen = canvas.transferControlToOffscreen();
    worker.send({ type: 'add', id, canvas: offscreen }, [offscreen]);
  } else {
    worker.send({ type: 'add', id, canvas });
  }
  return id;
}

// Builds the card's drawing for these settings; onReady gets its text.
export function build(id, settings) {
  const card = cards.get(id);
  if (!card) return;
  card.gen++;
  card.worker.send({ type: 'init', id, gen: card.gen, now: performance.now(), ...settings });
  // A playing card restarts its new drawing from the beginning.
  if (card.active) card.worker.send({ type: 'play', id, now: performance.now() });
}

export function resize(id, width, height) {
  cards.get(id)?.worker.send({ type: 'size', id, width, height });
}

// Plays or pauses a card's animation. A paused card keeps its place.
export function animate(id, on) {
  const card = cards.get(id);
  if (!card || card.active === on) return;
  card.active = on;
  card.worker.send({ type: on ? 'play' : 'pause', id, now: performance.now() });
  if (on && !raf) raf = requestAnimationFrame(tick);
}

export function disconnect(id) {
  const card = cards.get(id);
  if (!card) return;
  card.worker.send({ type: 'remove', id });
  card.worker.count--;
  cards.delete(id);
}

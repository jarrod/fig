// Draws gallery cards to canvas. It runs inside a Web Worker on an
// OffscreenCanvas each card hands over (see card-pool.js), or on the main
// thread with an ordinary canvas where OffscreenCanvas isn't available.
//
// Every face is drawn from the same path data as the downloadable SVG
// (Path2D takes SVG path strings), filled and stroked the same way, so the
// canvas shows exactly what the exported file contains.
import { DESIGN, DESIGNS } from '../designs/index.js';
import { HEIGHT, TAU, WIDTH, build, describeDesign, fitDesign, loopMs, pathData } from './render.js';

// The card's colours and line widths, in the drawing's own 320 × 270 units.
const LINE = '#55595d';
const BACKGROUND = '#0e1011';
const FACE_WIDTH = 0.7;
const OPEN_WIDTH = 0.5;

export function createRenderer(post) {
  const cards = new Map();

  function draw(card, faces) {
    const { ctx, canvas, box } = card;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!box || !faces.length) return;
    const k = canvas.width / WIDTH;
    ctx.setTransform(k, 0, 0, (canvas.height / HEIGHT), 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = LINE;
    ctx.fillStyle = BACKGROUND;
    // Faces are painted in order: a closed face is filled with the
    // background to hide what is behind it, then outlined.
    for (const f of faces) {
      const path = new Path2D(pathData(f, box));
      if (f.open) {
        ctx.lineWidth = OPEN_WIDTH;
      } else {
        ctx.fill(path);
        ctx.lineWidth = FACE_WIDTH;
      }
      ctx.stroke(path);
    }
  }

  // Each card keeps its own place in its loop: it starts from the still
  // drawing, pauses where it is, and carries on from there next time.
  const timeOf = (card, now) => {
    const ms = card.playing ? now - card.start : card.paused;
    return ((ms % card.loop) / card.loop) * TAU;
  };

  const handlers = {
    add({ id, canvas }) {
      cards.set(id, { canvas, ctx: canvas.getContext('2d'), box: null, faces: [], playing: false, paused: 0, start: 0 });
    },

    size({ id, width, height }) {
      const card = cards.get(id);
      if (!card || (card.canvas.width === width && card.canvas.height === height)) return;
      card.canvas.width = width;
      card.canvas.height = height;
      draw(card, card.faces);
    },

    // Build the still drawing, its text and its fit. The heavy part.
    init({ id, gen, form, seed, detail, frame, speed, animate, now }) {
      const card = cards.get(id);
      if (!card) return;
      const design = DESIGN[form] ?? DESIGNS[0];
      const { faces, facts } = build(design, seed, detail, 0, frame);
      Object.assign(card, {
        design,
        seed,
        detail,
        frame,
        animate,
        loop: loopMs(design, speed),
        box: faces.length ? fitDesign(design, seed, detail, animate, frame) : null,
        // A new drawing starts its loop from the beginning.
        paused: 0,
        start: now,
      });
      card.faces = faces;
      draw(card, card.faces);
      post({ type: 'ready', id, gen, name: design.name(facts), body: describeDesign(design, facts, faces.length) });
    },

    play({ id, now }) {
      const card = cards.get(id);
      if (!card || card.playing) return;
      card.playing = true;
      card.start = now - card.paused;
    },

    pause({ id, now }) {
      const card = cards.get(id);
      if (!card?.playing) return;
      card.playing = false;
      card.paused = now - card.start;
    },

    // One tick of the shared clock: redraw every playing card listed.
    frame({ now, ids }) {
      for (const id of ids) {
        const card = cards.get(id);
        if (!card?.playing || !card.animate || !card.box) continue;
        card.faces = build(card.design, card.seed, card.detail, timeOf(card, now), card.frame).faces;
        draw(card, card.faces);
      }
      post({ type: 'done' });
    },

    remove({ id }) {
      cards.delete(id);
    },
  };

  return { handle: (msg) => handlers[msg.type]?.(msg) };
}

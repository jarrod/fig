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

  const timeOf = (card, now) => ((now % card.loop) / card.loop) * TAU;

  const handlers = {
    add({ id, canvas }) {
      cards.set(id, { canvas, ctx: canvas.getContext('2d'), box: null, faces: [] });
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
      });
      // An animated card picks up where the shared clock is, so it doesn't
      // jump from the still drawing on its first frame.
      card.faces = animate && card.box ? build(design, seed, detail, timeOf(card, now), frame).faces : faces;
      draw(card, card.faces);
      post({ type: 'ready', id, gen, name: design.name(facts), body: describeDesign(design, facts, faces.length) });
    },

    // One tick of the shared clock: redraw every listed card at that time.
    frame({ now, ids }) {
      for (const id of ids) {
        const card = cards.get(id);
        if (!card?.animate || !card.box) continue;
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

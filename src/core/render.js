// Turns a design's faces into SVG: for the live cards, and as standalone files
// for export. No design-specific code lives here.
import { rng } from './geometry.js';
import { HEIGHT, WIDTH, makeFrame } from './frame.js';

export { HEIGHT, WIDTH };
// A loop lasts the design's own loopSeconds (10 by default) divided by speed.
export const loopMs = (design, speed = 1) => ((design.loopSeconds ?? 10) * 1000) / (speed || 1);
export const TAU = Math.PI * 2;
const PAD = 28;
const CORNER = 2.2;
const FIT_SAMPLES = 48;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Field designs (design.framed) also get a frame: the shape of ground they
// sample and how it is shown. Other designs ignore the frame setting.
export const frameFor = (design, frameId) => (design.framed ? makeFrame(frameId) : null);

export function build(design, seed, detail, time = 0, frameId) {
  const faces = [];
  const frame = frameFor(design, frameId);
  // The seed is passed too, for designs that cache a slow simulation per seed.
  const facts = design.draw(faces, rng(seed), detail, time, seed, frame);
  return { faces, facts, frame };
}

// The card text always describes the still drawing (time 0).
export function describeDesign(design, facts, faceCount) {
  return faceCount ? design.describe(facts) : 'This seed and detail produced no shapes.';
}

export function facePath(points, rounded, open) {
  const n = (v) => v.toFixed(1);
  if (!rounded) return `M${points.map((q) => `${n(q[0])} ${n(q[1])}`).join('L')}${open ? '' : 'Z'}`;
  let d = '';
  points.forEach((c, i) => {
    const cut = (u) => {
      const dx = u[0] - c[0];
      const dy = u[1] - c[1];
      const len = Math.hypot(dx, dy) || 1;
      const m = Math.min(CORNER, len / 2.4) / len;
      return [c[0] + dx * m, c[1] + dy * m];
    };
    const a = cut(points[(i + points.length - 1) % points.length]);
    const b = cut(points[(i + 1) % points.length]);
    d += `${i ? 'L' : 'M'}${n(a[0])} ${n(a[1])}Q${n(c[0])} ${n(c[1])} ${n(b[0])} ${n(b[1])}`;
  });
  return `${d}Z`;
}

// Scale and offset that fit every given frame in the frame, so a looping
// drawing keeps one size instead of zooming as its outline changes. A shaped
// frame fits its own outline instead, and Fill runs to the edges.
export function fit(frames, frame) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  if (frame?.bounds) [minX, minY, maxX, maxY] = frame.bounds;
  else for (const faces of frames) {
    for (const f of faces) {
      for (const [x, y] of f.p) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (minX === Infinity) return null;
  const pad = frame?.bleed ? 0 : PAD;
  const k = Math.min((WIDTH - pad * 2) / (maxX - minX || 1), (HEIGHT - pad * 2) / (maxY - minY || 1));
  return { k, ox: (WIDTH - (maxX - minX) * k) / 2 - minX * k, oy: (HEIGHT - (maxY - minY) * k) / 2 - minY * k };
}

// The fit for a still drawing, or for every point in the loop when animated.
export function fitDesign(design, seed, detail, loop, frameId) {
  const frame = frameFor(design, frameId);
  if (frame?.bounds) return fit([], frame);
  const frames = loop
    ? Array.from({ length: FIT_SAMPLES }, (_, i) => build(design, seed, detail, (i / FIT_SAMPLES) * TAU, frameId).faces)
    : [build(design, seed, detail, 0, frameId).faces];
  return fit(frames);
}

export const pathData = (f, { k, ox, oy }) =>
  facePath(
    f.p.map((q) => [q[0] * k + ox, q[1] * k + oy]),
    f.r,
    f.open,
  );

// Paths for the live cards, styled by the card's stylesheet. Open lines have
// no fill, so they hide nothing behind them.
export function drawPaths(faces, box, stagger, staggerMs = 450) {
  const lastGroup = Math.max(1, faces.at(-1)?.g ?? 1);
  return faces
    .map((f) => {
      const style = stagger ? ` style="animation-delay:${Math.round((f.g / lastGroup) * staggerMs)}ms"` : '';
      return `<path${f.open ? ' class="line"' : ''}${style} d="${pathData(f, box)}"/>`;
    })
    .join('');
}

// For animation frames: reuse the existing path elements and only change the
// ones whose outline moved, instead of parsing a whole new drawing each frame.
export function updatePaths(svg, faces, box) {
  const paths = svg.querySelectorAll(':scope > path');
  let i = 0;
  for (; i < faces.length; i++) {
    const path = paths[i] ?? svg.appendChild(document.createElementNS(SVG_NS, 'path'));
    const d = pathData(faces[i], box);
    if (path.getAttribute('d') !== d) path.setAttribute('d', d);
    if (path.classList.contains('line') !== Boolean(faces[i].open)) path.classList.toggle('line');
  }
  for (; i < paths.length; i++) paths[i].remove();
}

// ---- Export ---------------------------------------------------------------

export const DEFAULT_STYLE = { line: '#55595d', background: '#0e1011', transparent: false, width: 0.7 };

// Faces are always filled with the background colour, even when the file's
// background is transparent, because the fill is what hides the lines behind.
function svgOpen(style, label) {
  const width = Number(style.width) || DEFAULT_STYLE.width;
  return [
    `<svg xmlns="${SVG_NS}" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${label}">`,
    style.transparent ? '' : `<rect width="${WIDTH}" height="${HEIGHT}" fill="${style.background}"/>`,
    `<g fill="${style.background}" stroke="${style.line}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round">`,
  ].join('');
}

const lineAttrs = (f, style) => (f.open ? ` fill="none" stroke-width="${((Number(style.width) || 0.7) * 0.72).toFixed(2)}"` : '');

export function exportSvg(design, seed, detail, style = DEFAULT_STYLE, frameId) {
  const { faces, facts, frame } = build(design, seed, detail, 0, frameId);
  const box = fit([faces], frame);
  const label = `${design.name(facts)}, seed ${seed}`;
  const paths = box ? faces.map((f) => `<path${lineAttrs(f, style)} d="${pathData(f, box)}"/>`).join('\n') : '';
  return `${svgOpen(style, label)}\n${paths}\n</g></svg>\n`;
}

// An animated SVG that loops on its own with SMIL, no script needed. When every
// frame has the same faces with the same shape of path, each path morphs
// smoothly between frames. Otherwise (cubes appearing and disappearing, say)
// whole frames are swapped in turn, which is larger and steps rather than glides.
export function exportAnimatedSvg(design, seed, detail, style = DEFAULT_STYLE, { frames = 30, swapFrames = 24, speed = 1, frame: frameId } = {}) {
  const { facts } = build(design, seed, detail, 0, frameId);
  const box = fitDesign(design, seed, detail, true, frameId);
  const label = `${design.name(facts)}, seed ${seed}, animated`;
  const dur = `${+(loopMs(design, speed) / 1000).toFixed(2)}s`;
  const shapeOf = (d) => d.replace(/-?[\d.]+/g, '#');
  const sample = (count) =>
    Array.from({ length: count }, (_, i) => build(design, seed, detail, (i / count) * TAU, frameId).faces.map((f) => ({ f, d: pathData(f, box) })));

  const morphFrames = sample(frames);
  const first = morphFrames[0];
  // A design that re-sorts its faces by depth each frame (design.resorts)
  // can't morph: a face that changes place in the order would fly across.
  const canMorph =
    box &&
    !design.resorts &&
    morphFrames.every((frame) => frame.length === first.length && frame.every((p, i) => p.f.open === first[i].f.open && shapeOf(p.d) === shapeOf(first[i].d)));

  if (canMorph) {
    const paths = first.map((p, i) => {
      const ds = morphFrames.map((frame) => frame[i].d);
      // Paths that never move need no animation.
      if (ds.every((d) => d === p.d)) return `<path${lineAttrs(p.f, style)} d="${p.d}"/>`;
      const values = [...ds, p.d].join(';');
      return `<path${lineAttrs(p.f, style)} d="${p.d}"><animate attributeName="d" dur="${dur}" repeatCount="indefinite" values="${values}"/></path>`;
    });
    return { svg: `${svgOpen(style, label)}\n${paths.join('\n')}\n</g></svg>\n`, mode: 'morph' };
  }

  const swaps = box ? sample(swapFrames) : [];
  const groups = swaps.map((frame, i) => {
    const start = (i / swapFrames).toFixed(4);
    const end = ((i + 1) / swapFrames).toFixed(4);
    const show =
      i === 0
        ? `values="visible;hidden" keyTimes="0;${end}"`
        : i === swapFrames - 1
          ? `values="hidden;visible" keyTimes="0;${start}"`
          : `values="hidden;visible;hidden" keyTimes="0;${start};${end}"`;
    const paths = frame.map((p) => `<path${lineAttrs(p.f, style)} d="${p.d}"/>`).join('');
    return `<g visibility="${i === 0 ? 'visible' : 'hidden'}"><animate attributeName="visibility" calcMode="discrete" dur="${dur}" repeatCount="indefinite" ${show}/>${paths}</g>`;
  });
  return { svg: `${svgOpen(style, label)}\n${groups.join('\n')}\n</g></svg>\n`, mode: 'frames' };
}

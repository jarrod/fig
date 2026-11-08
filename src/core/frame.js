// Frames for field designs: designs that sample a patch of ground (a noise
// field, a wave sum, a chemical grid) rather than drawing one free object.
// Diamond is the original isometric view of a square of ground. The others look
// straight down at a ground patch the shape of the frame, and clip every line
// to it, so the field fills the shape instead of being cut from the diamond.
import { project } from './geometry.js';

// The card's drawing area, in the same units as the SVG viewBox.
export const WIDTH = 320;
export const HEIGHT = 270;

const SIDE = 12; // The ground square the field designs were written for.
const HEX = 6.5; // Hexagon corner radius.

function hexagon() {
  const cx = HEX;
  const cy = (HEX * Math.sqrt(3)) / 2;
  return Array.from({ length: 6 }, (_, i) => [cx + HEX * Math.cos((i * Math.PI) / 3), cy + HEX * Math.sin((i * Math.PI) / 3)]);
}
const rectangle = (w, h) => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
];

const SHAPES = {
  diamond: { label: 'Diamond', w: SIDE, h: SIDE, iso: true, where: 'on a square 12 units across' },
  fill: {
    label: 'Fill',
    w: (SIDE * WIDTH) / HEIGHT,
    h: SIDE,
    bleed: true,
    polygon: rectangle((SIDE * WIDTH) / HEIGHT, SIDE),
    where: 'across a rectangle 14 by 12 units, edge to edge',
  },
  square: { label: 'Square', w: SIDE, h: SIDE, polygon: rectangle(SIDE, SIDE), where: 'on a square 12 units across, seen from above' },
  circle: { label: 'Circle', w: SIDE, h: SIDE, circle: [SIDE / 2, SIDE / 2, SIDE / 2], where: 'in a circle 12 units across' },
  hexagon: { label: 'Hexagon', w: 2 * HEX, h: HEX * Math.sqrt(3), polygon: hexagon(), where: 'in a hexagon 13 units across' },
};

export const FRAME_IDS = Object.keys(SHAPES);
export const DEFAULT_FRAME = 'diamond';
export const frameLabel = (id) => (SHAPES[id] ?? SHAPES[DEFAULT_FRAME]).label;
export const isFrame = (id) => Object.hasOwn(SHAPES, id ?? '');

// A convex polygon as half-planes n·p <= c, each facing out from the centre.
function halfPlanes(poly) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    let nx = q[1] - p[1];
    let ny = p[0] - q[0];
    let c = nx * p[0] + ny * p[1];
    if (nx * cx + ny * cy > c) [nx, ny, c] = [-nx, -ny, -c];
    return [nx, ny, c];
  });
}

// The part of segment a→b inside the shape, as [t0, t1] along it, or null.
function segmentClipper(shape) {
  if (shape.circle) {
    const [cx, cy, r] = shape.circle;
    return (a, b) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const fx = a[0] - cx;
      const fy = a[1] - cy;
      const A = dx * dx + dy * dy;
      const B = 2 * (fx * dx + fy * dy);
      const C = fx * fx + fy * fy - r * r;
      if (A < 1e-12) return C <= 0 ? [0, 1] : null;
      const disc = B * B - 4 * A * C;
      if (disc <= 0) return null;
      const s = Math.sqrt(disc);
      const t0 = Math.max(0, (-B - s) / (2 * A));
      const t1 = Math.min(1, (-B + s) / (2 * A));
      return t0 < t1 ? [t0, t1] : null;
    };
  }
  const planes = halfPlanes(shape.polygon);
  return (a, b) => {
    let t0 = 0;
    let t1 = 1;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    for (const [nx, ny, c] of planes) {
      const num = c - (nx * a[0] + ny * a[1]);
      const den = nx * dx + ny * dy;
      if (Math.abs(den) < 1e-12) {
        if (num < 0) return null;
      } else if (den > 0) t1 = Math.min(t1, num / den);
      else t0 = Math.max(t0, num / den);
      if (t0 > t1) return null;
    }
    return [t0, t1];
  };
}

// Cuts a polyline into the runs that lie inside the shape.
export function clipPolyline(points, clip) {
  const runs = [];
  let run = null;
  const at = (a, b, t) => (t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const part = clip(a, b);
    if (!part) {
      if (run) runs.push(run);
      run = null;
      continue;
    }
    const [t0, t1] = part;
    if (!run || t0 > 0) {
      if (run) runs.push(run);
      run = [at(a, b, t0)];
    }
    run.push(at(a, b, t1));
    if (t1 < 1) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs.filter((r) => r.length > 1);
}

// What a field design draws with: the ground patch to sample (0..w by 0..h),
// how to turn a ground point into a drawing point, and how to add a line.
export function makeFrame(id = DEFAULT_FRAME) {
  const shape = SHAPES[id] ?? SHAPES[DEFAULT_FRAME];
  const { w, h, iso, bleed = false, where } = shape;
  const clip = iso ? null : segmentClipper(shape);
  return {
    id: SHAPES[id] ? id : DEFAULT_FRAME,
    w,
    h,
    iso: Boolean(iso),
    bleed,
    where,
    // Ground area against the original 12 × 12 square, for keeping line density.
    scale: (w * h) / (SIDE * SIDE),
    // The frame's own outline sets the fit, so the shape is the same every seed.
    bounds: iso ? null : [0, 0, w, h],
    to: iso ? project : (x, y) => [x, y],
    push(out, face) {
      if (!clip) {
        out.push(face);
        return;
      }
      for (const p of clipPolyline(face.p, clip)) out.push({ ...face, p });
    },
  };
}

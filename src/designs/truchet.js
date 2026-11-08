import { makeFrame } from '../core/frame.js';
import { pct, plural } from '../core/text.js';

const TAU = Math.PI * 2;
const WORDS = ['', 'one', 'two', 'three'];

// Whether a disc fits wholly inside the frame's shape, tested by asking the
// frame to clip a ring just outside it.
function discInside(frame, x, y, r) {
  if (frame.iso) return x - r >= -1e-9 && x + r <= frame.w + 1e-9 && y - r >= -1e-9 && y + r <= frame.h + 1e-9;
  const ring = Array.from({ length: 25 }, (_, i) => [x + r * 1.02 * Math.cos((i * TAU) / 24), y + r * 1.02 * Math.sin((i * TAU) / 24)]);
  const probe = [];
  frame.push(probe, { p: ring });
  return probe.length === 1 && probe[0].p.length === ring.length;
}

// Follows the arcs from tile to tile at rest and measures the paths they
// make: how many, how many close into loops, and how many arcs the longest
// joins. Radii are given as fractions of a tile side.
function measure(cols, rows, flips, radii, live) {
  const lanes = radii.length;
  const parent = Int32Array.from({ length: cols * rows * 2 * lanes }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  // Arc ends waiting for a partner, keyed by the point they touch.
  const ends = new Map();
  const touch = (x, y, arc) => {
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
    if (ends.has(key)) {
      const a = find(ends.get(key));
      const b = find(arc);
      if (a !== b) parent[a] = b;
      ends.delete(key);
    } else ends.set(key, arc);
  };
  const size = new Map();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const t = j * cols + i;
      if (!live[t]) continue;
      for (let side = 0; side < 2; side++) {
        const [kx, ky] = corner(flips[t], side);
        radii.forEach((r, l) => {
          const arc = (t * 2 + side) * lanes + l;
          // One end on the tile's top or bottom side, one on its left or right.
          touch(i + kx + (kx ? -r : r), j + ky, arc);
          touch(i + kx, j + ky + (ky ? -r : r), arc);
        });
      }
    }
  }
  // A path with an end left over runs off the patch; the rest are loops.
  const open = new Set([...ends.values()].map(find));
  for (let t = 0; t < cols * rows; t++) {
    if (!live[t]) continue;
    for (let k = 0; k < 2 * lanes; k++) {
      const root = find(t * 2 * lanes + k);
      size.set(root, (size.get(root) ?? 0) + 1);
    }
  }
  let longest = 0;
  for (const n of size.values()) longest = Math.max(longest, n);
  return { paths: size.size, loops: [...size.keys()].filter((r) => !open.has(r)).length, longest };
}

// The corner, in tile units, that each of a tile's two arcs turns about.
// Opposite corners, chosen by the tile's turn.
const corner = (flip, side) => (flip ? (side ? [1, 0] : [0, 1]) : side ? [1, 1] : [0, 0]);

export default {
  id: 'truchet',
  kind: 'line',
  // Seconds per loop; two calm waves cross the grid each loop.
  loopSeconds: 24,
  // Tiles a patch of ground, so it can be shown in any frame shape.
  framed: true,

  describe: ({ cols, rows, lanes, first, paths, loops, longest }) =>
    `A ${cols} by ${rows} grid of Smith tiles, each holding two ${lanes > 1 ? `bundles of ${WORDS[lanes]} quarter circles` : 'quarter circles'}, with ${pct(first)}% turned the first way. At rest the arcs join into ${plural(paths, 'path')}, ${loops} of them closed loops, and the longest joins ${longest} arcs.`,

  name: () => 'Truchet tiles',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    // Tiles per 12 units of ground, set by detail and the seed.
    const per = Math.max(4, Math.round((4.5 + detail * 1.3) * (0.7 + R() * 0.6)));
    const bias = 0.2 + R() * 0.6;
    const lanes = 1 + Math.floor(R() * 3);
    const spread = 0.24 + R() * 0.2;
    const wave = R() < 0.5 ? 'radial' : 'linear';
    const heading = R() * TAU;
    const focus = [R() * w, R() * h];
    const jitter = R() * 0.25;
    const s = 12 / per;
    const cols = Math.ceil(w / s - 1e-9);
    const rows = Math.ceil(h / s - 1e-9);
    // The grid is centred on the patch; tiles past its edge are cut by the frame.
    const x0 = (w - cols * s) / 2;
    const y0 = (h - rows * s) / 2;
    const n = cols * rows;
    // Segments per quarter circle, more on bigger tiles.
    const steps = Math.max(4, Math.min(10, Math.round(s * 5)));
    const flips = new Uint8Array(n);
    const lag = new Float32Array(n);
    for (let t = 0; t < n; t++) {
      flips[t] = R() < bias ? 0 : 1;
      lag[t] = R() * jitter;
    }

    // Lane radii as fractions of a side, spread evenly around a half, so each
    // lane meets a lane in the next tile whichever way that tile turns.
    const radii = Array.from({ length: lanes }, (_, l) => 0.5 + (l - (lanes - 1) / 2) * (spread / Math.max(1, lanes - 1)));
    // How far an arc reaches from the tile centre, which sets the room a turn needs.
    const reach = s * Math.max(...radii.map((r) => Math.hypot(0.5, r - 0.5)));

    // Where each tile sits in the wave, 0..1.
    const corners = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ];
    const along = (x, y) =>
      wave === 'radial' ? Math.hypot(x - focus[0], y - focus[1]) : (x - w / 2) * Math.cos(heading) + (y - h / 2) * Math.sin(heading);
    const spanLo = wave === 'radial' ? 0 : Math.min(...corners.map(([x, y]) => along(x, y)));
    const spanHi = Math.max(...corners.map(([x, y]) => along(x, y)));

    // Each tile makes two half turns a loop, one per wave, so it is back
    // where it started at 2π. Each half turn eases in and out.
    const T = ((time % TAU) + TAU) % TAU;
    const edge = 0.08;
    const length = 0.75;
    const sweep = Math.PI - 2 * edge - length - 0.25; // 0.25 leaves room for the lag.
    const turnOf = (start) => {
      let a = 0;
      for (const k of [0, Math.PI]) {
        const u = Math.min(1, Math.max(0, (T - start - k) / length));
        a += (Math.PI * (1 - Math.cos(Math.PI * u))) / 2;
      }
      return a;
    };

    const live = new Uint8Array(n);
    let first = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const t = j * cols + i;
        const cx = x0 + (i + 0.5) * s;
        const cy = y0 + (j + 0.5) * s;
        // Tiles wholly outside the frame are skipped; ones the frame cuts
        // stay still, so the frame's cut is the same at every moment.
        const [ax, ay, bx, by] = [x0 + i * s, y0 + j * s, x0 + (i + 1) * s, y0 + (j + 1) * s];
        const probe = [];
        frame.push(probe, { p: [[ax, ay], [bx, ay], [bx, by], [ax, by], [ax, ay], [bx, by]] });
        frame.push(probe, { p: [[bx, ay], [ax, by]] });
        if (!probe.length) continue;
        live[t] = 1;
        if (!flips[t]) first++;
        const pos = (along(cx, cy) - spanLo) / Math.max(1e-6, spanHi - spanLo);
        const moves = discInside(frame, cx, cy, reach);
        const angle = moves ? turnOf(edge + pos * sweep + lag[t]) : 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const g = Math.min(9, Math.floor(pos * 10));
        for (let side = 0; side < 2; side++) {
          // The two arcs turn about opposite corners.
          const [kx, ky] = corner(flips[t], side);
          // The quarter that faces into the tile.
          const a0 = kx ? (ky ? Math.PI : Math.PI / 2) : ky ? -Math.PI / 2 : 0;
          for (const f of radii) {
            const r = f * s;
            const p = [];
            for (let q = 0; q <= steps; q++) {
              const a = a0 + ((Math.PI / 2) * q) / steps;
              // Relative to the tile centre, then turned with the tile.
              const dx = (kx - 0.5) * s + r * Math.cos(a);
              const dy = (ky - 0.5) * s + r * Math.sin(a);
              p.push(frame.to(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos, 0));
            }
            frame.push(out, { g, r: false, open: true, p });
          }
        }
      }
    }
    const tilesShown = live.reduce((a, b) => a + b, 0);
    const { paths, loops, longest } = measure(cols, rows, flips, radii, live);
    return { cols, rows, lanes, first: first / Math.max(1, tilesShown), paths, loops, longest };
  },
};

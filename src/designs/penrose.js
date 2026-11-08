import { clipPolyline, makeFrame } from '../core/frame.js';
import { plural } from '../core/text.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const DECOR = ['plain', 'arcs', 'arcs', 'hatch-thick', 'hatch-thin'];
const cache = new Map();

// Robinson triangles [colour, ax, ay, bx, by, cx, cy]. Colour 0 is half a thin
// rhomb (36° at A), colour 1 half a thick rhomb (108° at A). B–C is the
// diagonal shared with the triangle's twin, so only A–B and A–C are rhomb
// edges. Twins share B and C with the same labels.
function deflate(tris, reach) {
  const next = [];
  const keep = (t) => {
    // Drop triangles wholly outside the disc that the turning patch sweeps.
    const cx = (t[1] + t[3] + t[5]) / 3;
    const cy = (t[2] + t[4] + t[6]) / 3;
    const r = Math.max(Math.hypot(t[1] - cx, t[2] - cy), Math.hypot(t[3] - cx, t[4] - cy), Math.hypot(t[5] - cx, t[6] - cy));
    if (Math.hypot(cx, cy) - r < reach) next.push(t);
  };
  for (const [c, ax, ay, bx, by, cx, cy] of tris) {
    if (c === 0) {
      const px = ax + (bx - ax) / PHI;
      const py = ay + (by - ay) / PHI;
      keep([0, cx, cy, px, py, bx, by]);
      keep([1, px, py, cx, cy, ax, ay]);
    } else {
      const qx = bx + (ax - bx) / PHI;
      const qy = by + (ay - by) / PHI;
      const rx = bx + (cx - bx) / PHI;
      const ry = by + (cy - by) / PHI;
      keep([1, rx, ry, cx, cy, ax, ay]);
      keep([1, qx, qy, rx, ry, bx, by]);
      keep([0, rx, ry, qx, qy, ax, ay]);
    }
  }
  return next;
}

const keyOf = (x, y) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;

// Splits a graph (edges as [a, b] node ids) into as few walks as it can
// greedily, starting at odd nodes. `pick` chooses among the free edges.
function walks(nodeCount, edges, pick = (v, options) => options[0]) {
  const adj = Array.from({ length: nodeCount }, () => []);
  edges.forEach(([a, b], e) => {
    adj[a].push([b, e]);
    adj[b].push([a, e]);
  });
  const used = new Uint8Array(edges.length);
  const free = (v) => adj[v].filter(([, e]) => !used[e]);
  const out = [];
  const walk = (start) => {
    const nodes = [start];
    const via = [];
    let v = start;
    let prev = -1;
    for (;;) {
      const options = free(v);
      if (!options.length) break;
      const [next, e] = pick(v, options, prev);
      used[e] = 1;
      via.push(e);
      prev = v;
      v = next;
      nodes.push(v);
    }
    if (via.length) out.push({ nodes, via });
  };
  for (let v = 0; v < nodeCount; v++) if (adj[v].length % 2) while (free(v).length) walk(v);
  for (let v = 0; v < nodeCount; v++) while (free(v).length) walk(v);
  return out;
}

// Rhomb edges, each drawn once, joined through shared corners into chains
// that carry straight on where they can.
function edgeChains(tris) {
  const id = new Map();
  const pts = [];
  const node = (x, y) => {
    const k = keyOf(x, y);
    if (!id.has(k)) {
      id.set(k, pts.length);
      pts.push([x, y]);
    }
    return id.get(k);
  };
  const seen = new Set();
  const edges = [];
  for (const t of tris) {
    const a = node(t[1], t[2]);
    for (const b of [node(t[3], t[4]), node(t[5], t[6])]) {
      const k = a < b ? `${a}/${b}` : `${b}/${a}`;
      if (!seen.has(k)) {
        seen.add(k);
        edges.push([a, b]);
      }
    }
  }
  const straightest = (v, options, prev) => {
    if (prev < 0) return options[0];
    const dx = pts[v][0] - pts[prev][0];
    const dy = pts[v][1] - pts[prev][1];
    let best = options[0];
    let bestDot = -Infinity;
    for (const o of options) {
      const ex = pts[o[0]][0] - pts[v][0];
      const ey = pts[o[0]][1] - pts[v][1];
      const dot = (dx * ex + dy * ey) / Math.hypot(ex, ey);
      if (dot > bestDot) [bestDot, best] = [dot, o];
    }
    return best;
  };
  return walks(pts.length, edges, straightest).map(({ nodes }) => nodes.map((i) => pts[i]));
}

// The matching-rule arcs. Each half-rhomb has an arc about B (1/φ² of the
// edge on thin tiles, 1/φ on thick ones) and one about C (the same radius on
// both), and these meet tile to tile in unbroken curves. Returns curves as
// lists of [triangle, corner, forward].
function arcCurves(tris, which) {
  const id = new Map();
  const node = (k) => {
    if (!id.has(k)) id.set(k, id.size);
    return id.get(k);
  };
  const arcs = [];
  const edges = [];
  tris.forEach((t, i) => {
    for (const corner of which) {
      // The arc runs from the corner's edge to A, across to the diagonal.
      const [vx, vy, ox, oy] = corner === 'B' ? [t[3], t[4], t[5], t[6]] : [t[5], t[6], t[3], t[4]];
      // Thin and thick B arcs meet on a shared edge from opposite ends, so
      // the end on that edge is keyed by the edge itself plus its length.
      const toA = [keyOf(vx, vy), keyOf(t[1], t[2])].sort().join('>');
      const rA = corner === 'C' ? `C${keyOf(vx, vy)}` : t[0] ? keyOf(t[1], t[2]) : keyOf(vx, vy);
      const diag = [keyOf(vx, vy), keyOf(ox, oy)].sort().join('>') + corner;
      arcs.push([i, corner]);
      edges.push([node(`${toA}@${rA}`), node(diag)]);
    }
  });
  return walks(id.size, edges).map(({ nodes, via }) =>
    via.map((e, j) => {
      const [i, corner] = arcs[e];
      // Forward when the walk enters at the arc's end on the edge to A.
      return [i, corner, nodes[j] === edges[e][0]];
    }),
  );
}

// The part of a ground segment inside 0..w × 0..h, as [t0, t1], or null. The
// diamond frame does not clip, and in the others this drops most of the
// wheel's spare tiles before the frame's own clip.
const rectClip = (w, h) => (a, b) => {
  let t0 = 0;
  let t1 = 1;
  for (const i of [0, 1]) {
    const hi = i ? h : w;
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-12) {
      if (a[i] < 0 || a[i] > hi) return null;
      continue;
    }
    let u0 = -a[i] / d;
    let u1 = (hi - a[i]) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0);
    t1 = Math.min(t1, u1);
    if (t0 >= t1) return null;
  }
  return [t0, t1];
};

function inside(frame, x, y) {
  if (frame.iso) return x >= 0 && x <= frame.w && y >= 0 && y <= frame.h;
  const probe = [];
  frame.push(probe, { p: [[x, y], [x + 1e-6, y]] });
  return probe.length > 0;
}

// A small seeded shuffle, so lines of every length are mixed through the
// drawing order.
function shuffle(list, seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  for (let i = list.length - 1; i > 0; i--) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    const j = s % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function tiling(seed, detail, frame, edge, spin, decor) {
  const key = `${seed}/${detail}/${frame.id}/${edge}/${spin}/${decor}`;
  let entry = cache.get(key);
  if (entry) return entry;
  const { w, h } = frame;
  const reach = Math.hypot(w / 2, h / 2) + edge;
  // Enough deflations that the wheel's inner radius clears the patch corners.
  const steps = Math.ceil(Math.log(reach / (Math.cos(Math.PI / 10) * edge)) / Math.log(PHI));
  const R0 = edge * PHI ** steps;
  let tris = [];
  for (let i = 0; i < 10; i++) {
    let b = [R0 * Math.cos(((2 * i - 1) * Math.PI) / 10), R0 * Math.sin(((2 * i - 1) * Math.PI) / 10)];
    let c = [R0 * Math.cos(((2 * i + 1) * Math.PI) / 10), R0 * Math.sin(((2 * i + 1) * Math.PI) / 10)];
    if (i % 2) [b, c] = [c, b];
    tris.push([0, 0, 0, ...b, ...c]);
  }
  for (let s = 0; s < steps; s++) tris = deflate(tris, reach);

  const items = edgeChains(tris).map((p) => ({ edge: p, from: p[0] }));
  if (decor.startsWith('arcs')) {
    const which = decor === 'arcs-b' ? ['B'] : decor === 'arcs-c' ? ['C'] : ['B', 'C'];
    for (const arc of arcCurves(tris, which)) items.push({ arc, from: tris[arc[0][0]].slice(1, 3) });
  } else if (decor !== 'plain') {
    const family = decor === 'hatch-thick' ? 1 : 0;
    const twins = new Map();
    for (const t of tris) {
      if (t[0] !== family) continue;
      const k = keyOf(t[3], t[4]) + keyOf(t[5], t[6]);
      if (twins.has(k)) items.push({ hatch: [twins.get(k), t], from: t.slice(1, 3) });
      else twins.set(k, t);
    }
  }

  // Measured on the still drawing: rhombs whose middle is in the patch. The
  // middle of the shared diagonal is the middle of the rhomb, and each rhomb
  // has two halves.
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);
  const seen = (x, y) => inside(frame, w / 2 + x * cos - y * sin, h / 2 + x * sin + y * cos);
  let thick = 0;
  let thin = 0;
  // Corners where five thick rhombs meet in a star: ten thick halves have a
  // B or C corner there.
  const corners = new Map();
  for (const t of tris) {
    if (seen((t[3] + t[5]) / 2, (t[4] + t[6]) / 2)) t[0] ? thick++ : thin++;
    if (t[0]) for (const j of [3, 5]) corners.set(keyOf(t[j], t[j + 1]), [(corners.get(keyOf(t[j], t[j + 1]))?.[0] ?? 0) + 1, t[j], t[j + 1]]);
  }
  let stars = 0;
  for (const [n, x, y] of corners.values()) if (n === 10 && seen(x, y)) stars++;
  for (const item of items) item.at = Math.atan2(item.from[1], item.from[0]);
  entry = { tris, items: shuffle(items, seed), thick: Math.round(thick / 2), thin: Math.round(thin / 2), stars, steps };
  if (cache.size >= 24) cache.delete(cache.keys().next().value);
  cache.set(key, entry);
  return entry;
}

export default {
  id: 'penrose',
  kind: 'line',
  // A fifth of a turn per loop, so it turns slowly.
  loopSeconds: 40,
  // Tiles a patch of ground, so it can be shown in any frame shape.
  framed: true,

  describe: ({ thick, thin, steps, decor, curves, longest, stars, where }) => {
    const star = stars === 1 ? 'one corner' : `${stars} corners`;
    const extra = decor.startsWith('arcs')
      ? `Arcs on the tiles join into ${plural(curves, 'curve')}, the longest ${longest.toFixed(1)} units.`
      : decor === 'plain'
        ? `Five thick rhombs meet in a star at ${star}.`
        : `The ${decor === 'hatch-thick' ? 'thick' : 'thin'} rhombs are hatched, and five thick rhombs meet in a star at ${star}.`;
    return `Ten Robinson triangles deflated ${steps} times leave ${thick} thick and ${thin} thin rhombs ${where}, a ratio of ${(thick / Math.max(1, thin)).toFixed(3)} against the golden ratio's 1.618. ${extra}`;
  },

  name: () => 'Penrose tiling',

  draw(out, R, detail, time = 0, seed, frame = makeFrame()) {
    const { w, h } = frame;
    const spin = (Math.floor(R() * 72) * Math.PI) / 180;
    const turn = R() < 0.5 ? 1 : -1;
    let decor = DECOR[Math.floor(R() * DECOR.length)];
    const arcSet = ['arcs', 'arcs-b', 'arcs-c'][Math.floor(R() * 3)];
    if (decor === 'arcs') decor = arcSet;
    const scale = 0.88 + R() * 0.26;
    const cArc = 0.26 + R() * 0.16;
    const breathe = 0.04 + R() * 0.05;
    const ripple = 0.25 + R() * 0.5;
    const lanes = 2 + Math.floor(R() * 2);
    // Rhomb edge length, falling with detail, the same per unit of ground in any frame.
    const edge = +(2.2 * 0.865 ** (detail - 1) * scale).toFixed(4);
    const { tris, items, thick, thin, stars, steps } = tiling(seed, detail, frame, edge, spin, decor);

    // A fifth of a turn per loop maps the tiling onto itself, so the loop is seamless.
    const t = ((time % TAU) + TAU) % TAU;
    const angle = spin + (turn * t) / 5;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const place = (x, y) => [w / 2 + x * cos - y * sin, h / 2 + x * sin + y * cos];
    const clip = rectClip(w, h);
    let g = 0;
    // Adds a line, clipped to the patch, and returns its length in the patch.
    const span = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
    const draw = (p) => {
      let length = 0;
      for (const run of clipPolyline(p, clip)) {
        const from = out.length;
        frame.push(out, { g: g % 10, r: false, open: true, p: run.map(([x, y]) => frame.to(x, y, 0)) });
        // The diamond is drawn in projection; its ground is the clipped run.
        length += frame.iso ? span(run) : out.slice(from).reduce((s, f) => s + span(f.p), 0);
      }
      g++;
      return length;
    };

    // Arc radii breathe, edge by edge, in rings spreading out from the centre.
    // Where two arcs meet on an edge they move together, so curves stay whole.
    const swell = (ax, ay, bx, by) => breathe * Math.sin(time - ripple * Math.hypot(ax + bx, ay + by) * 0.5);
    const arcPoints = (tr, corner, forward) => {
      const [c, ax, ay, bx, by, cx, cy] = tr;
      const [vx, vy, ox, oy] = corner === 'B' ? [bx, by, cx, cy] : [cx, cy, bx, by];
      const sign = corner === 'C' ? 1 : c ? -1 : 1;
      const base = corner === 'C' ? cArc : c ? 1 / PHI : 1 / PHI ** 2;
      const r0 = edge * (base + sign * swell(vx, vy, ax, ay));
      const r1 = edge * (base + sign * swell(vx, vy, ox, oy));
      const a0 = Math.atan2(ay - vy, ax - vx);
      let da = Math.atan2(oy - vy, ox - vx) - a0;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const n = 4;
      const p = [];
      for (let k = 0; k <= n; k++) {
        const u = forward ? k / n : 1 - k / n;
        const r = r0 + (r1 - r0) * u;
        p.push(place(vx + r * Math.cos(a0 + da * u), vy + r * Math.sin(a0 + da * u)));
      }
      return p;
    };

    let curves = 0;
    let longest = 0;
    // Lines are drawn sector by sector, by where they are now. The turn hands
    // each line on to its neighbour a fifth of a turn round, so no line keeps
    // its place in the order for the whole loop, and an animated export swaps
    // frames rather than morphing each line back to where it started.
    const sectors = [[], [], [], [], []];
    for (const item of items) {
      const a = (((item.at + angle) % TAU) + TAU) % TAU;
      sectors[Math.min(4, Math.floor((a * 5) / TAU))].push(item);
    }
    for (const item of sectors.flat()) {
      if (item.edge) draw(item.edge.map(([x, y]) => place(x, y)));
      else if (item.arc) {
        const p = [];
        for (const [i, corner, forward] of item.arc) {
          const part = arcPoints(tris[i], corner, forward);
          p.push(...(p.length ? part.slice(1) : part));
        }
        const length = draw(p);
        if (length > 0) curves++;
        longest = Math.max(longest, length);
      } else {
        // Chevrons: in each half, lines parallel to A–B run from A–C to the
        // diagonal, where they meet the twin's.
        const [[, ax, ay, bx, by, cx, cy], [, dx, dy]] = item.hatch;
        for (let k = 1; k <= lanes; k++) {
          const u = k / (lanes + 1);
          draw([place(ax + (cx - ax) * u, ay + (cy - ay) * u), place(bx + (cx - bx) * u, by + (cy - by) * u), place(dx + (cx - dx) * u, dy + (cy - dy) * u)]);
        }
      }
    }
    return { thick, thin, stars, steps, decor, curves, longest, where: frame.where };
  },
};

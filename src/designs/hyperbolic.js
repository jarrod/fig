// A regular {p,q} tiling of the Poincaré disc: p-sided tiles, q meeting at
// every corner, possible when (p - 2)(q - 2) > 4. The tiles are grown from a
// central polygon by its turns and the half-turns about its edge midpoints,
// and every edge is an arc of a circle that meets the rim at right angles.
//
// The motion is a hyperbolic translation along a mirror line through the
// centre, by exactly the shortest step that maps the tiling onto itself. The
// edges are sorted into orbits of that step, so each one is drawn as
// "representative moved by k + s steps", where s runs from 0 to 1 over the
// loop. At s = 1 every edge sits where its neighbour in the orbit started,
// so the picture at the end of the loop is the picture at the start.
const TAU = Math.PI * 2;
// The disc's radius on the card, in pixels, for judging what is too small.
const DISC_PX = 107;

const TILINGS = [
  [7, 3], [5, 4], [4, 5], [3, 7], [6, 4], [8, 3], [4, 6], [3, 8],
];
const DECOR = ['plain', 'plain', 'spokes', 'inset', 'mirrors'];
const DECOR_CUT = 2.5;

// Möbius maps of the disc, z -> (a z + b) / (conj(b) z + conj(a)), kept as
// [ar, ai, br, bi].
const mul = ([a, b, c, d], [e, f, g, h]) => [
  // a1 a2 + b1 conj(b2)
  a * e - b * f + (c * g + d * h),
  a * f + b * e + (d * g - c * h),
  // a1 b2 + b1 conj(a2)
  a * g - b * h + (c * e + d * f),
  a * h + b * g + (d * e - c * f),
];
const apply = ([ar, ai, br, bi], [x, y]) => {
  const nx = ar * x - ai * y + br;
  const ny = ar * y + ai * x + bi;
  const dx = br * x + bi * y + ar;
  const dy = br * y - bi * x - ai;
  const m = dx * dx + dy * dy;
  return [(nx * dx + ny * dy) / m, (ny * dx - nx * dy) / m];
};
const rotation = (t) => [Math.cos(t / 2), Math.sin(t / 2), 0, 0];
const translation = ([x, y]) => {
  const k = 1 / Math.sqrt(1 - x * x - y * y);
  return [k, 0, x * k, y * k];
};
const inverse = ([ar, ai, br, bi]) => [ar, -ai, -br, -bi];
const halfTurn = (m) => mul(mul(translation(m), rotation(Math.PI)), inverse(translation(m)));

// Translation along the real diameter by hyperbolic distance d.
const slide = (d) => {
  const a = Math.tanh(d / 2);
  return ([x, y]) => {
    // (z + a) / (1 + a z)
    const nx = x + a;
    const dx = 1 + a * x;
    const dy = a * y;
    const m = dx * dx + dy * dy;
    return [(nx * dx + y * dy) / m, (y * dx - nx * dy) / m];
  };
};

// Position along the real diameter of a point's foot on it.
const along = ([x, y]) => {
  // w = (1 + z) / (1 - z); u = log |w|
  const n = (1 + x) * (1 + x) + y * y;
  const d = (1 - x) * (1 - x) + y * y;
  return 0.5 * Math.log(n / d);
};

// Points on the geodesic from a to b in the disc.
function geodesic(a, b, n) {
  // Move a to the centre, where the geodesic is straight, then back.
  const [ax, ay] = a;
  const to = [1 / Math.sqrt(1 - ax * ax - ay * ay), 0, -ax / Math.sqrt(1 - ax * ax - ay * ay), -ay / Math.sqrt(1 - ax * ax - ay * ay)];
  const back = inverse(to);
  const [bx, by] = apply(to, b);
  const pts = [a];
  for (let i = 1; i < n; i++) pts.push(apply(back, [(bx * i) / n, (by * i) / n]));
  pts.push(b);
  return pts;
}

// A point keyed to a grid, with its neighbours checked, so the same point
// reached two ways is recognised.
function pointSet() {
  const map = new Map();
  const key = (i, j) => i * 4194304 + j;
  const cell = (v) => Math.round(v * 2e6);
  return {
    has([x, y]) {
      const i = cell(x);
      const j = cell(y);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const list = map.get(key(i + di, j + dj));
        if (list && list.some(([u, v]) => Math.abs(u - x) < 1e-8 && Math.abs(v - y) < 1e-8)) return true;
      }
      return false;
    },
    add(p) {
      const k = key(cell(p[0]), cell(p[1]));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    },
  };
}

const cache = new Map();

function build(p, q, edgeOnAxis, decor, cutPx, dir) {
  const key = `${p},${q},${edgeOnAxis},${decor},${cutPx},${dir}`;
  if (cache.has(key)) return cache.get(key);

  // Distances from a tile's centre to an edge midpoint and to a corner.
  const inr = Math.acosh(Math.cos(Math.PI / q) / Math.sin(Math.PI / p));
  const circ = Math.acosh(1 / (Math.tan(Math.PI / p) * Math.tan(Math.PI / q)));
  const rm = Math.tanh(inr / 2);
  const rv = Math.tanh(circ / 2);
  // Either an edge midpoint or a corner lies on the line of motion.
  const t0 = edgeOnAxis ? 0 : Math.PI / p;
  const mids = [];
  const verts = [];
  for (let j = 0; j < p; j++) {
    const am = t0 + (TAU * j) / p;
    const av = am + Math.PI / p;
    mids.push([rm * Math.cos(am), rm * Math.sin(am)]);
    verts.push([rv * Math.cos(av), rv * Math.sin(av)]);
  }
  const turn = rotation(TAU / p);
  const turns = [[1, 0, 0, 0]];
  for (let j = 1; j < p; j++) turns.push(mul(turns[j - 1], turn));
  const flip = halfTurn(mids[0]);

  // Edges below cutPx pixels are dropped. An edge of hyperbolic length L at
  // distance d from the centre spans about L (1 - tanh²(d/2)) / 2 of the
  // radius, which sets how far out the tiles need to be grown. Every orbit
  // of the step has a member within one step of the centre's foot, so the
  // tiles reach one step further than that.
  const edgeLen = 2 * Math.acosh(Math.cos(Math.PI / p) / Math.sin(Math.PI / q));
  const cut = cutPx / DISC_PX;
  let dCut = 0;
  while (edgeLen * (1 - Math.tanh(dCut / 2) ** 2) > cut * 0.7) dCut += 0.05;

  // Find the step: the shortest map in the group that slides along the
  // real diameter. Every map sends the central tile to some tile, so it is
  // that tile's map followed by one of the central turns.
  const tiles = [[1, 0, 0, 0]];
  const seen = pointSet();
  seen.add([0, 0]);
  let step = Infinity;
  const consider = (g) => {
    for (const r of turns) {
      let [ar, ai, br, bi] = mul(g, r);
      if (Math.abs(ai) < 1e-9 && Math.abs(bi) < 1e-9 && Math.abs(br) > 1e-6) step = Math.min(step, 2 * Math.atanh(Math.abs(br / ar)));
    }
  };
  // Grow outward, ring by ring, until the tiles are past what is drawn.
  let reach = Infinity;
  for (let i = 0; i < tiles.length; i++) {
    const g = tiles[i];
    for (const r of turns) {
      let h = mul(mul(g, r), flip);
      const c = apply(h, [0, 0]);
      const d = 2 * Math.atanh(Math.hypot(c[0], c[1]));
      if (d > reach || d > 12 || seen.has(c)) continue;
      // Renormalise, to keep |a|² - |b|² = 1 as the products pile up.
      const det = Math.sqrt(h[0] * h[0] + h[1] * h[1] - h[2] * h[2] - h[3] * h[3]);
      h = h.map((v) => v / det);
      seen.add(c);
      tiles.push(h);
      if (d < 6) {
        consider(h);
        if (step < Infinity) reach = dCut + step + circ + 0.3;
      }
    }
  }

  // Segments to draw: the edges, and any decoration, each kept once.
  const segs = [];
  const segSeen = pointSet();
  const addSeg = (a, b, mid, kind) => {
    if (segSeen.has(mid)) return;
    segSeen.add(mid);
    segs.push({ a, b, u: along(mid), kind });
  };
  const inset = verts.map(([x, y]) => {
    const r = Math.tanh(0.62 * Math.atanh(rv));
    return [(x * r) / rv, (y * r) / rv];
  });
  const insetMid = (j) => {
    // Midpoint of the inset edge, by symmetry on the ray through mids[j+1]...
    const g = geodesic(inset[j], inset[(j + 1) % p], 2);
    return g[1];
  };
  const insetMids = inset.map((_, j) => insetMid(j));
  const spokeMid = (v) => geodesic([0, 0], v, 2)[1];
  const vMids = verts.map(spokeMid);
  const mMids = mids.map(spokeMid);
  for (const g of tiles) {
    const V = verts.map((v) => apply(g, v));
    for (let j = 0; j < p; j++) addSeg(V[j], V[(j + 1) % p], apply(g, mids[(j + 1) % p]), 0);
    if (decor === 'plain') continue;
    const c = apply(g, [0, 0]);
    if (decor === 'spokes' || decor === 'mirrors') for (let j = 0; j < p; j++) addSeg(c, V[j], apply(g, vMids[j]), 1);
    if (decor === 'mirrors') for (let j = 0; j < p; j++) addSeg(c, apply(g, mids[j]), apply(g, mMids[j]), 1);
    if (decor === 'inset') {
      const I = inset.map((v) => apply(g, v));
      for (let j = 0; j < p; j++) addSeg(I[j], I[(j + 1) % p], apply(g, insetMids[j]), 1);
    }
  }

  // Keep one member of each orbit: the one whose foot lies in a window one
  // step long, set off the centre so no segment sits on its edge. Then find
  // the steps k for which it is drawn at some point in the loop.
  const u0 = -0.413 * step;
  const size = (s, k) => {
    const f = slide(k * step);
    const a = f(s.a);
    const b = f(s.b);
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  };
  const slots = [];
  const kMax = Math.ceil((dCut + 2) / step) + 1;
  for (const s of segs) {
    if (s.u < u0 || s.u >= u0 + step) continue;
    for (let k = -kMax; k <= kMax; k++) {
      // Over the loop this slot runs from k to k + dir.
      let big = 0;
      // Decoration stops sooner than the edges, to keep the rim clear.
      const least = s.kind ? cut * DECOR_CUT : cut;
      for (let i = 0; i <= 8 && !big; i++) big = size(s, k + (dir * i) / 8) >= least;
      if (big) slots.push({ a: s.a, b: s.b, k, kind: s.kind });
    }
  }
  const result = { slots, step, tilesGrown: tiles.length };
  cache.set(key, result);
  return result;
}

export default {
  id: 'hyperbolic',
  kind: 'line',
  loopSeconds: 32,

  name: ({ p, q }) => `Hyperbolic tiling {${p},${q}}`,

  describe({ p, q, edges, extra, decor, step, through, toward }) {
    const deco =
      decor === 'spokes'
        ? ` Spokes from each centre to its ${p} corners add ${extra} lines.`
        : decor === 'mirrors'
          ? ` Its mirror lines split each tile into ${2 * p} triangles with angles of 90°, ${+(180 / p).toFixed(1)}° and ${+(180 / q).toFixed(1)}°.`
          : decor === 'inset'
            ? ` A smaller copy of each tile sits inside it, adding ${extra} lines.`
            : '';
    return `Tiles with ${p} sides, ${q} at every corner, fill the Poincaré disc, and ${edges} of their edges are drawn before they get too small to see. They stream toward the ${toward} rim, sliding ${step.toFixed(2)} units along a line through ${through} each loop, the shortest move that maps the tiling onto itself.${deco}`;
  },

  draw(out, R, detail, time = 0) {
    const [p, q] = TILINGS[Math.floor(R() * TILINGS.length)];
    let decor = DECOR[Math.floor(R() * DECOR.length)];
    // Triangles are too small for a copy inside, and the mirror lines of a
    // tiling with many tiles at a corner crowd it.
    if (decor === 'inset' && p < 5) decor = 'spokes';
    if (decor === 'mirrors' && p * q > 24) decor = 'plain';
    if (decor === 'spokes' && p === 3) decor = 'plain';
    const edgeOnAxis = R() < 0.5;
    const dir = R() < 0.5 ? 1 : -1;
    const tilt = R() * TAU;
    const cutPx = +(1.3 * 2.1 ** ((10 - detail) / 5)).toFixed(3);
    const { slots, step } = build(p, q, edgeOnAxis, decor, cutPx, dir);
    const cut = cutPx / DISC_PX;

    // The share of the loop, and where it puts each orbit.
    const s = (((time / TAU) % 1) + 1) % 1;
    const c = Math.cos(tilt);
    const sn = Math.sin(tilt);
    const turn = ([x, y]) => [x * c - y * sn, x * sn + y * c];
    const maps = new Map();
    let edges = 0;
    let extra = 0;
    for (const slot of slots) {
      const k = slot.k + dir * s;
      if (!maps.has(k)) maps.set(k, slide(k * step));
      const f = maps.get(k);
      const a = f(slot.a);
      const b = f(slot.b);
      const len = Math.hypot(a[0] - b[0], a[1] - b[1]);
      // Every slot is drawn at every time, so the faces keep their order
      // through the loop. One too small to see slides onto the rim and
      // hides under the boundary circle, instead of piling up into a grey
      // band on the side the tiles flow into.
      const least = slot.kind ? cut * DECOR_CUT : cut;
      if (len < least) {
        const w = Math.max(0, (2 * len) / least - 1);
        const fold = ([x, y]) => {
          const r = Math.hypot(x, y);
          const m = w + (1 - w) / r;
          return turn([x * m, y * m]);
        };
        out.push({ g: slot.kind, r: false, open: true, p: [fold(a), fold(b)] });
        continue;
      }
      const n = Math.max(1, Math.min(16, Math.ceil((len * DISC_PX) / 9)));
      out.push({ g: slot.kind, r: false, open: true, p: (n === 1 ? [a, b] : geodesic(a, b, n)).map(turn) });
      if (slot.kind) extra++;
      else edges++;
    }
    const rim = [];
    for (let i = 0; i <= 180; i++) rim.push([Math.cos((i / 180) * TAU), Math.sin((i / 180) * TAU)]);
    out.push({ g: 2, r: false, open: true, p: rim });
    // Which way the tiles stream on the card, from the slide's direction.
    const heading = Math.atan2(sn * dir, c * dir);
    const toward = ['right', 'lower right', 'bottom', 'lower left', 'left', 'upper left', 'top', 'upper right'][((Math.round(heading / (Math.PI / 4)) % 8) + 8) % 8];
    return { p, q, edges, extra, decor, step, toward, through: edgeOnAxis ? 'the middle of an edge' : 'a corner' };
  },
};

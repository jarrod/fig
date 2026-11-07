// Shared geometry for the designs. No DOM. Each design pushes faces into `out`,
// back to front, because the renderer hides lines by painting each face over the last.
// A face is { g, r, p, open }: group index (for stagger), whether to round
// corners, points already projected to 2D, and whether it is an open line with
// no fill (which hides nothing, so its order does not matter).
// Each design returns facts measured from what it drew, which its describe()
// turns into the card text. Measuring must not call R(), or the drawings would change.
// `time` (radians) moves the seeded values for the looping animation. Time 0 is
// the still drawing, and every motion repeats exactly every 2π.

export const COS30 = Math.cos(Math.PI / 6);

export const project = (x, y, z) => [(x - y) * COS30, (x + y) * 0.5 - z];

// Mulberry32: the same seed always gives the same drawing.
export const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Faces is a mask of which visible faces to draw: 1 top, 2 the y side, 4 the
// x side. Leaving out faces that touch a neighbour avoids drawing hidden ones.
export function box(out, x, y, z, w, d, h, g, faces = 7) {
  const X = x + w;
  const Y = y + d;
  const T = z + h;
  if (faces & 1) out.push({ g, r: true, p: [project(x, y, T), project(X, y, T), project(X, Y, T), project(x, Y, T)] });
  if (faces & 2) out.push({ g, r: true, p: [project(x, Y, T), project(X, Y, T), project(X, Y, z), project(x, Y, z)] });
  if (faces & 4) out.push({ g, r: true, p: [project(X, y, T), project(X, Y, T), project(X, Y, z), project(X, y, z)] });
}

export const peakIndex = (values) => values.reduce((best, v, i) => (v > values[best] ? i : best), 0);

export const countCrests = (values) =>
  values.filter((v, i) => (i === 0 || v > values[i - 1]) && (i === values.length - 1 || v > values[i + 1])).length;

// Splits total into count parts that change steadily from first to last. Slope
// (-1 to 1) sets the direction and strength. Each part gets a minimum, unless
// count is so high that the minimums would use up most of the total.
export function shareOut(total, count, minimum, slope) {
  const base = Math.min(minimum, (total / count) * 0.6);
  const weights = Array.from({ length: count }, (_, i) => 1 + slope * (count > 1 ? (2 * i) / (count - 1) - 1 : 0));
  const sum = weights.reduce((a, v) => a + v, 0);
  return weights.map((v) => base + ((total - base * count) * v) / sum);
}

// Seeded 2D gradient (Perlin) noise. Returns roughly -1 to 1. Uses 255 calls to R.
export function makeNoise(R) {
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const hash = (i, j) => perm[(perm[i & 255] + j) & 255];
  const grad = (h, x, y) => Math.cos((h & 7) * (Math.PI / 4)) * x + Math.sin((h & 7) * (Math.PI / 4)) * y;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const fx = x - X;
    const fy = y - Y;
    const u = fade(fx);
    const v = fade(fy);
    const top = grad(hash(X, Y), fx, fy) * (1 - u) + grad(hash(X + 1, Y), fx - 1, fy) * u;
    const bottom = grad(hash(X, Y + 1), fx, fy - 1) * (1 - u) + grad(hash(X + 1, Y + 1), fx - 1, fy - 1) * u;
    return (top * (1 - v) + bottom * v) * 1.4;
  };
}

// The point at distance d along a Hilbert curve that fills an n×n grid.
export function hilbertPoint(n, d) {
  let x = 0;
  let y = 0;
  let t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t / 2);
    const ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      [x, y] = [y, x];
    }
    x += s * rx;
    y += s * ry;
    t = Math.floor(t / 4);
  }
  return [x, y];
}

// Draws touching unit cubes back to front. `on` is an n×n×n grid indexed by
// cell(n, x, y, z). Faces against a neighbour are left out.
export const cell = (n, x, y, z) => (x * n + y) * n + z;

export function cubes(out, on, n) {
  let g = 0;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        if (!on[cell(n, x, y, z)]) continue;
        const faces =
          (z + 1 < n && on[cell(n, x, y, z + 1)] ? 0 : 1) |
          (y + 1 < n && on[cell(n, x, y + 1, z)] ? 0 : 2) |
          (x + 1 < n && on[cell(n, x + 1, y, z)] ? 0 : 4);
        if (faces) box(out, x, y, z, 1, 1, 1, g, faces);
        g++;
      }
    }
  }
}

export const area = (poly) => poly.reduce((a, [x, y], i) => {
  const [X, Y] = poly[(i + 1) % poly.length];
  return a + x * Y - X * y;
}, 0) / 2;

// The span of x + y (depth) where the line x − y = u crosses a convex polygon.
export function chord(poly, u) {
  let lo = Infinity;
  let hi = -Infinity;
  poly.forEach(([ax, ay], i) => {
    const [bx, by] = poly[(i + 1) % poly.length];
    const ua = ax - ay;
    const ub = bx - by;
    if (ua === ub || (ua - u) * (ub - u) > 0) return;
    const t = (u - ua) / (ub - ua);
    const v = ax + ay + t * (bx + by - ax - ay);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  });
  return (lo + hi) / 2;
}

// Back-to-front order for solids standing on the ground with separate convex
// footprints. Where two footprints overlap on screen, the one further along
// x + y is in front. For separate convex shapes this never forms a loop.
export function orderFootprints(polys) {
  const n = polys.length;
  const span = polys.map((poly) => {
    const u = poly.map(([x, y]) => x - y);
    return [Math.min(...u), Math.max(...u)];
  });
  const after = Array.from({ length: n }, () => []);
  const before = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const lo = Math.max(span[i][0], span[j][0]);
      const hi = Math.min(span[i][1], span[j][1]);
      if (hi - lo < 1e-6) continue;
      const mid = (lo + hi) / 2;
      const [back, front] = chord(polys[i], mid) < chord(polys[j], mid) ? [i, j] : [j, i];
      after[back].push(front);
      before[front]++;
    }
  }
  const order = [];
  const ready = [...Array(n).keys()].filter((i) => !before[i]);
  while (ready.length) {
    const i = ready.pop();
    order.push(i);
    for (const j of after[i]) if (!--before[j]) ready.push(j);
  }
  return order;
}

// A straight-sided column on a convex footprint: the sides facing the viewer,
// then the top.
export function prism(out, poly, z0, z1, g) {
  const ring = area(poly) < 0 ? [...poly].reverse() : poly;
  ring.forEach(([ax, ay], i) => {
    const [bx, by] = ring[(i + 1) % ring.length];
    if (by - ay - (bx - ax) <= 0) return; // Outward normal points away from the viewer.
    out.push({ g, r: true, p: [project(ax, ay, z1), project(bx, by, z1), project(bx, by, z0), project(ax, ay, z0)] });
  });
  out.push({ g, r: true, p: ring.map(([x, y]) => project(x, y, z1)) });
}

// A round column: one band for the side facing the viewer, then the top.
export function cylinder(out, cx, cy, r, z0, z1, g) {
  const at = (a, z) => project(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
  const side = [];
  for (let k = 0; k <= 24; k++) side.push(at(-Math.PI / 4 + (k / 24) * Math.PI, z0));
  for (let k = 24; k >= 0; k--) side.push(at(-Math.PI / 4 + (k / 24) * Math.PI, z1));
  out.push({ g, r: false, p: side });
  out.push({ g, r: false, p: Array.from({ length: 48 }, (_, k) => at((k / 48) * Math.PI * 2, z1)) });
}

// Keeps the side of the line through m facing away from direction (dx, dy).
export function clipHalf(poly, mx, my, dx, dy) {
  const side = ([x, y]) => (x - mx) * dx + (y - my) * dy;
  const out = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  });
  return out;
}

// Fits 3D points into a 12-wide box centred on the ground, keeping proportions.
export function normalise(points) {
  const lo = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
  const scale = 12 / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  return points.map((p) => [(p[0] - (lo[0] + hi[0]) / 2) * scale + 6, (p[1] - (lo[1] + hi[1]) / 2) * scale + 6, (p[2] - lo[2]) * scale]);
}

export const turnAbout = ([x, y, z], a) => [6 + (x - 6) * Math.cos(a) - (y - 6) * Math.sin(a), 6 + (x - 6) * Math.sin(a) + (y - 6) * Math.cos(a), z];

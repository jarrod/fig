import { pct } from '../core/text.js';

const TAU = Math.PI * 2;
const RING = 24;

// Whether segments ab and cd cross.
const crosses = (a, b, c, d) => {
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

// Self-crossings of a closed polyline.
function countCrossings(curve) {
  let n = 0;
  for (let i = 0; i < curve.length - 1; i++) {
    for (let j = i + 2; j < curve.length - 1; j++) {
      if (i === 0 && j === curve.length - 2) continue;
      if (crosses(curve[i], curve[i + 1], curve[j], curve[j + 1])) n++;
    }
  }
  return n;
}

// The crossing count describes the still curve, which is the same at every
// time, so it is counted once per set of circles and kept.
const crossingCache = new Map();

const sumAt = (terms, s, time, scale) => {
  let x = 0;
  let y = 0;
  for (const t of terms) {
    const a = t.k * s + t.phi + t.rate * time;
    const c = t.c * (t.base ? scale : 1);
    x += c * Math.cos(a);
    y += c * Math.sin(a);
  }
  return [x, y];
};

export default {
  id: 'epicycles',
  kind: 'line',
  // Seconds per loop at normal speed: the pen goes once round the curve.
  loopSeconds: 30,

  describe({ circles, lo, hi, share, fold, rem, crossings, copies }) {
    const count = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
    const cross = crossings ? `crosses itself ${count(crossings)}` : 'never crosses itself';
    return `${circles} circles turning at frequencies from ${lo} to ${hi}, each one ${rem > 0 ? 'more' : 'less'} than a multiple of ${fold}, trace a ${fold}-fold curve that ${cross}. It is drawn ${count(copies)}, each copy a little smaller and turned, and the largest circle is ${pct(share)}% of their total radius.`;
  },

  name: () => 'Fourier epicycles',

  draw(out, R, detail, time = 0) {
    // Every frequency leaves the same remainder, 1 or -1, modulo the fold,
    // which gives the curve that many-fold turning symmetry.
    const fold = 3 + Math.floor(R() * 7);
    const rem = R() < 0.5 ? 1 : -1;
    const pool = [];
    for (let k = -60; k <= 60; k++) if (k && k !== rem && (((k - rem) % fold) + fold) % fold === 0) pool.push(k);
    pool.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    const reach = Math.min(pool.length, 3 + Math.floor(detail / 3));
    const circles = Math.min(reach + 1, 2 + Math.floor(detail * 0.3) + Math.floor(R() * 2));
    const falloff = 0.8 + R() * 0.8;
    // The base circle turns once per trip and gives the outline. A second,
    // large circle at one of the lowest frequencies gives the points or
    // loops. The rest are small, drawn mostly from low frequencies, and kept
    // under 0.2 / |k|, so they shape the curve without making it wiggle.
    const terms = [{ k: rem, c: 1, phi: R() * TAU, rate: 0, base: true }];
    const used = new Set();
    while (terms.length < circles) {
      const first = terms.length === 1;
      // The second circle skips |k| = 2, which only squashes the outline.
      const low = Math.abs(pool[0]) < 3 ? 1 : 0;
      const rank = first ? low + Math.floor(R() * 2) : Math.floor(R() ** 1.5 * reach);
      const k = pool[rank];
      const c = first ? Math.min(0.35, (0.5 + R() * 0.8) / Math.abs(k)) : Math.min((0.1 + R() * 0.3) * (rank + 1) ** -falloff, 0.2 / Math.abs(k));
      const phi = R() * TAU;
      const spin = R();
      if (used.has(rank)) continue;
      used.add(rank);
      terms.push({ k, c, phi, rate: first ? 0 : spin < 0.35 ? 1 : spin < 0.7 ? -1 : 0, second: first });
    }
    terms.sort((a, b) => b.c - a.c);
    // Nested copies: each has a smaller base circle and its second circle
    // turned on a little, so the copies weave like a guilloché band.
    const copies = 3 + Math.floor(R() * 2);
    const shrink = 0.06 + R() * 0.05;
    const twist = (R() < 0.5 ? -1 : 1) * (0.1 + R() * 0.25);
    // The second circle's phase also turns once per loop, so the whole
    // rosette slowly changes shape and returns.
    const second = terms.find((t) => t.second);
    if (second) second.rate = R() < 0.5 ? 1 : -1;

    const count = 300 + detail * 90;
    for (let j = 0; j < copies; j++) {
      const phi0 = second ? second.phi : 0;
      if (second) second.phi = phi0 + j * twist;
      const curve = [];
      for (let i = 0; i <= count; i++) curve.push(sumAt(terms, (i / count) * TAU, time, 1 - j * shrink));
      if (second) second.phi = phi0;
      out.push({ g: j, r: false, open: true, p: curve });
    }

    // The mechanism at the pen of the outer copy, which goes once round per
    // loop: the arms from the end of the base arm to the pen, and the small
    // circles near the pen. The large circles add nothing the curve doesn't show.
    const s = time;
    let cx = 0;
    let cy = 0;
    const arms = [];
    terms.forEach((t, j) => {
      const a = t.k * s + t.phi + t.rate * time;
      if (!t.base && t.c < 0.15) {
        const ring = [];
        for (let i = 0; i <= RING; i++) {
          const b = (i / RING) * TAU;
          ring.push([cx + t.c * Math.cos(b), cy + t.c * Math.sin(b)]);
        }
        out.push({ g: copies + j, r: false, open: true, p: ring });
      }
      cx += t.c * Math.cos(a);
      cy += t.c * Math.sin(a);
      if (t.base) arms.length = 0;
      arms.push([cx, cy]);
    });
    if (arms.length < 2) arms.unshift([0, 0]);
    out.push({ g: copies + terms.length, r: false, open: true, p: arms });

    // Crossings of the outer copy at time 0, counted on up to 400 points.
    const key = `${detail}|${terms.map((t) => `${t.k},${t.c},${t.phi}`).join(';')}`;
    let crossings = crossingCache.get(key);
    if (crossings === undefined) {
      const n = Math.min(400, count);
      const still = [];
      for (let i = 0; i <= n; i++) still.push(sumAt(terms, (i / n) * TAU, 0, 1));
      crossings = countCrossings(still);
      if (crossingCache.size > 50) crossingCache.clear();
      crossingCache.set(key, crossings);
    }
    const ks = terms.map((t) => t.k);
    const total = terms.reduce((sum, t) => sum + t.c, 0);
    return { circles: terms.length, lo: Math.min(...ks), hi: Math.max(...ks), share: terms[0].c / total, fold, rem, crossings, copies };
  },
};

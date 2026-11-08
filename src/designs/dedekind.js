// The Dedekind tessellation: the upper half-plane cut into the triangles
// that PSL(2,Z), the modular group, makes from its fundamental domain. Its
// lines are the Farey arcs, joining neighbouring fractions a/b and c/d with
// |ad - bc| = 1, and the altitudes of the Farey triangles, which join the
// mediant (a+c)/(b+d) of each Farey pair to (a-c)/(b-d). Ford circles, the
// horocycles touching the real line at p/q with diameter 1/q², can sit on top.
//
// It is shown in the Poincaré disc through a Cayley transform centred on a
// seeded point, and it flows by z -> z + s, a parabolic motion about the cusp
// at infinity. At s = 1 the picture is mapped onto itself, so every line is
// kept as a representative in [0, 1] moved by k + s, and the loop closes
// with each line where its neighbour in the orbit started.
const TAU = Math.PI * 2;
const DISC_PX = 107;
const SQ3 = Math.sqrt(3);

// Centres of the disc, as points of the upper half-plane, with how to name them.
const CENTRES = [
  { c: [0, 1], name: 'the point i, where two triangles of each kind meet' },
  { c: [0.5, SQ3 / 2], name: 'the point e^(iπ/3), where three triangles of each kind meet' },
  { c: [0.5, 1.6], name: 'a point above the arc from 0 to 1, near the cusp at infinity' },
  { c: [0, 1.9], name: 'a point high above 0, near the cusp at infinity' },
];

const cache = new Map();

// Farey neighbours a/b < c/d in [0, 1] with denominators up to n, from the
// Stern–Brocot tree.
function fareyPairs(n) {
  const pairs = [];
  const walk = (a, b, c, d) => {
    pairs.push([a, b, c, d]);
    if (b + d > n) return;
    walk(a, b, a + c, b + d);
    walk(a + c, b + d, c, d);
  };
  walk(0, 1, 1, 1);
  return pairs;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

// Where the boundary point n/d (d = 0 for infinity), moved by t, lands on
// the unit circle, as an angle, for a disc centred on (cx, cy).
const angleOf = (n, d, t, cx, cy) => {
  const m = n + t * d;
  return -2 * Math.atan2(cy * d, m - cx * d);
};

// The horocycle at n/d (diameter 1/d² in the half-plane, or height 1 when
// d = 0), moved by t: the boundary angle it touches and its signed
// hyperbolic distance from the centre.
const horocycle = (n, d, t, cx, cy) => {
  const m = n + t * d;
  const re = cx * d - m;
  const im = cy * d;
  return { a: angleOf(n, d, t, cx, cy), dist: Math.log((re * re + im * im) / cy) };
};

// How visible a piece is: its length, but no more than a few times its
// middle's gap from the rim, so that the long pieces packed close along the
// rim count as small and are left out.
const seen = (A, M, B, gap) => Math.min(Math.hypot(A[0] - B[0], A[1] - B[1]), gap * (1 - Math.hypot(M[0], M[1])));

const fordSize = (dist) => 1 - Math.tanh(dist / 2);

// The part of each line outside the horoballs at its two ends, as a piece of
// semicircle (centre m, radius rho, angles th1 > th2) or of vertical line (at
// x, from y1 to y2), before any shift. Null when the horoballs overlap.
function trim([n1, d1, n2, d2], kappa) {
  if (d1 === 0 || d2 === 0) {
    const [n, d] = d1 === 0 ? [n2, d2] : [n1, d1];
    const y1 = kappa / (d * d);
    const y2 = 1 / kappa;
    return y1 < y2 ? { x: n / d, y1, y2 } : null;
  }
  let x1 = n1 / d1;
  let x2 = n2 / d2;
  let D1 = kappa / (d1 * d1);
  let D2 = kappa / (d2 * d2);
  if (x1 > x2) [x1, x2, D1, D2] = [x2, x1, D2, D1];
  const m = (x1 + x2) / 2;
  const rho = (x2 - x1) / 2;
  // A horocycle of diameter D at one end cuts the semicircle at chord
  // length u from that end, which is a central angle of 2 asin(u / 2 rho).
  const angle = (D) => 2 * Math.asin(D / Math.sqrt(4 * rho * rho + D * D));
  const th1 = Math.PI - angle(D1);
  const th2 = angle(D2);
  return th1 > th2 ? { m, rho, th1, th2 } : null;
}

function build(ci, kappa, cutPx, gap, dir) {
  const key = `${ci},${kappa},${cutPx},${gap},${dir}`;
  if (cache.has(key)) return cache.get(key);
  const [cx, cy] = CENTRES[ci].c;
  const cut = cutPx / DISC_PX;
  const fordCut = cut * 0.9;
  const shrink = Math.log(1 / kappa);

  // Lines are kept as pairs of boundary points [n1, d1, n2, d2], d = 0 for
  // infinity. First the vertical line from 0 up to infinity, and its
  // altitude, the unit semicircle from -1 to 1.
  const lines = [
    { e: [0, 1, 1, 0], kind: 0 },
    { e: [-1, 1, 1, 1], kind: 1 },
  ];
  const order = Math.ceil(5 / cut);
  for (const [a, b, c, d] of fareyPairs(order)) {
    lines.push({ e: [a, b, c, d], kind: 0 });
    // The altitude: the mediant joined to (a - c)/(b - d), in lowest terms.
    let n2 = a - c;
    let d2 = b - d;
    if (d2 < 0) [n2, d2] = [-n2, -d2];
    const g = gcd(n2, d2) || 1;
    lines.push({ e: [a + c, b + d, n2 / g, d2 / g], kind: 1 });
  }
  const circles = [{ n: 1, d: 0 }];
  for (let q = 1; q <= order; q++) for (let p = 0; p < q; p++) if (gcd(p, q) === 1) circles.push({ n: p, d: q });

  // For each representative, the shifts k at which it is seen somewhere
  // in the loop, when it runs from k to k + dir. The shifts that matter are
  // near the centre's real part, and the sizes fall away on either side.
  const k0 = Math.round(cx);
  const slots = [];
  const scan = (size, least, make) => {
    const shown = (k) => {
      for (let i = 0; i <= 6; i++) if (size(k + (dir * i) / 6) >= least) return true;
      return false;
    };
    for (const sgn of [1, -1]) {
      let miss = 0;
      for (let k = sgn > 0 ? k0 : k0 - 1; Math.abs(k - k0) < 400 && miss < 4; k += sgn) {
        if (shown(k)) {
          slots.push(make(k));
          miss = 0;
        } else miss++;
      }
    }
  };
  // Disc points without the seeded turn, which does not change sizes.
  const disc = (x, y) => {
    const ax = x - cx;
    const ay = y - cy;
    const by = y + cy;
    const m = ax * ax + by * by;
    return [(ax * ax + ay * by) / m, (ay * ax - ax * by) / m];
  };
  for (const L of lines) {
    const P = trim(L.e, kappa);
    if (!P) continue;
    // The two ends and the hyperbolic middle of the piece.
    const pts = P.rho
      ? [P.th1, 2 * Math.atan(Math.sqrt(Math.tan(P.th1 / 2) * Math.tan(P.th2 / 2))), P.th2].map((th) => [P.m + P.rho * Math.cos(th), P.rho * Math.sin(th)])
      : [P.y1, Math.sqrt(P.y1 * P.y2), P.y2].map((y) => [P.x, y]);
    const size = (t) => seen(...pts.map(([x, y]) => disc(x + t, y)), gap);
    const line = { ...L, piece: P };
    scan(size, cut * (L.kind ? 1.4 : 1), (k) => ({ line, k }));
  }
  for (const C of circles) {
    if (C.d === 0) {
      // Moved onto itself by the flow: drawn once.
      if (fordSize(horocycle(1, 0, 0, cx, cy).dist + shrink) >= fordCut) slots.push({ circle: C, k: 0, kappa });
      continue;
    }
    scan((t) => fordSize(horocycle(C.n, C.d, t, cx, cy).dist + shrink), fordCut, (k) => ({ circle: C, k, kappa }));
  }
  const result = { slots, cut, fordCut };
  cache.set(key, result);
  return result;
}

export default {
  id: 'dedekind',
  kind: 'line',
  loopSeconds: 30,

  name: () => 'Dedekind tessellation',

  describe({ farey, altitudes, fords, deepest, centre, toward, kappa, cusp }) {
    return `The modular group's triangles in the disc, seen from ${centre}: ${farey} Farey arcs join neighbouring fractions down to denominator ${deepest}, and ${altitudes} altitudes split each arch into six. The lines stop at horocycles ${kappa.toFixed(2)} times the size of the Ford circles, ${fords} of them large enough to draw, and the lines stream ${toward} round the cusp at infinity, on the ${cusp} of the rim.`;
  },

  draw(out, R, detail, time = 0) {
    const ci = Math.floor(R() * CENTRES.length);
    const kappa = 0.3 + 0.3 * R();
    const dir = R() < 0.5 ? 1 : -1;
    const tilt = R() * TAU;
    const cutPx = +(5.5 * 1.8 ** ((5 - detail) / 4.5)).toFixed(3);
    // Higher detail lets lines run closer to the rim.
    const gap = 1.5 + 0.35 * detail;
    const { slots, cut, fordCut } = build(ci, +kappa.toFixed(4), cutPx, gap, dir);
    const [cx, cy] = CENTRES[ci].c;
    const s = (((time / TAU) % 1) + 1) % 1;
    const c = Math.cos(tilt);
    const sn = Math.sin(tilt);
    const turn = ([x, y]) => [x * c - y * sn, x * sn + y * c];
    const toDisc = (x, y) => {
      // (z - c) / (z - conj c), then the seeded turn.
      const ax = x - cx;
      const ay = y - cy;
      const by = y + cy;
      const m = ax * ax + by * by;
      return turn([(ax * ax + ay * by) / m, (ay * ax - ax * by) / m]);
    };
    // A piece too small to see slides onto the rim and hides under it,
    // keeping the faces in the same order at every time.
    const fold = (pts, size, least) => {
      const w = Math.max(0, (2 * size) / least - 1);
      return pts.map(([x, y]) => {
        const k = w + (1 - w) / Math.hypot(x, y);
        return [x * k, y * k];
      });
    };

    let farey = 0;
    let altitudes = 0;
    let fords = 0;
    let deepest = 1;
    for (const slot of slots) {
      const t = slot.k + dir * s;
      if (slot.line) {
        const { piece: P, kind, e } = slot.line;
        const least = cut * (kind ? 1.4 : 1);
        const at = P.rho
          ? (L) => {
              const th = 2 * Math.atan(Math.exp(L));
              return toDisc(P.m + t + P.rho * Math.cos(th), P.rho * Math.sin(th));
            }
          : (L) => toDisc(P.x + t, Math.exp(L));
        // Even steps of hyperbolic length along the piece.
        const L1 = P.rho ? Math.log(Math.tan(P.th1 / 2)) : Math.log(P.y1);
        const L2 = P.rho ? Math.log(Math.tan(P.th2 / 2)) : Math.log(P.y2);
        const A = at(L1);
        const B = at(L2);
        const size = seen(A, at((L1 + L2) / 2), B, gap);
        if (size < least) {
          out.push({ g: kind, r: false, open: true, p: fold([A, B], size, least) });
          continue;
        }
        const n = Math.max(1, Math.min(24, Math.ceil((size * DISC_PX) / 8)));
        const pts = [A];
        for (let i = 1; i < n; i++) pts.push(at(L1 + ((L2 - L1) * i) / n));
        pts.push(B);
        out.push({ g: kind, r: false, open: true, p: pts });
        if (kind) altitudes++;
        else {
          farey++;
          deepest = Math.max(deepest, e[1], e[3]);
        }
        continue;
      }
      const { n: cn, d: cd } = slot.circle;
      const h = cd === 0 ? horocycle(1, 0, 0, cx, cy) : horocycle(cn, cd, t, cx, cy);
      const size = fordSize(h.dist + Math.log(1 / slot.kappa));
      // Below the cut a circle shrinks onto the point where it touches.
      const w = size < fordCut ? Math.max(0, (2 * size) / fordCut - 1) : 1;
      const r = (size / 2) * w;
      const ctr = [(1 - r) * Math.cos(h.a), (1 - r) * Math.sin(h.a)];
      const n = Math.max(6, Math.min(48, Math.ceil((size * w * DISC_PX * Math.PI) / 8)));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const u = h.a + Math.PI + (TAU * i) / n;
        pts.push(turn([ctr[0] + r * Math.cos(u), ctr[1] + r * Math.sin(u)]));
      }
      out.push({ g: 2, r: false, open: true, p: pts });
      if (w === 1) fords++;
    }
    const rim = [];
    for (let i = 0; i <= 180; i++) rim.push([Math.cos((i / 180) * TAU), Math.sin((i / 180) * TAU)]);
    out.push({ g: 3, r: false, open: true, p: rim });

    // z + s runs along the real line, which the transform sends round the
    // rim anticlockwise in these coordinates, so clockwise on the card,
    // where y points down. Infinity lands at angle 0, then is turned.
    const toward = dir > 0 ? 'clockwise' : 'anticlockwise';
    const cusp = ['right', 'lower right', 'bottom', 'lower left', 'left', 'upper left', 'top', 'upper right'][((Math.round(tilt / (Math.PI / 4)) % 8) + 8) % 8];
    return { farey, altitudes, fords, deepest, centre: CENTRES[ci].name, toward, kappa, cusp };
  },
};

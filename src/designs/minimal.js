// Minimal surfaces from the Weierstrass–Enneper representation. Each surface is
// the real part of a holomorphic curve Φ(ζ) in C³, drawn as a wireframe of its
// two families of parameter lines, with every mesh quad filled and painted back
// to front so the far side is hidden.
//
// The motion is the associate family: the surface at angle θ is Re(e^{iθ} Φ),
// which bends the surface without stretching it, keeping every length and
// angle on it. θ runs with time, so the catenoid winds into the helicoid and
// back, Scherk's doubly periodic surface turns into his tower of saddles, and
// Enneper's surfaces turn while their mesh slides over them (each of their
// associate surfaces is the same shape turned). The family repeats every 2π.
//
// The quads are sorted by depth every frame, so which quad is drawn in which
// place in the list changes as the surface bends.
const TAU = Math.PI * 2;

// Small complex helpers on [re, im] pairs.
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const log = (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])];
const pow = (a, n) => {
  const r = Math.hypot(a[0], a[1]) ** n;
  const t = Math.atan2(a[1], a[0]) * n;
  return [r * Math.cos(t), r * Math.sin(t)];
};
const scale = (a, k) => [a[0] * k, a[1] * k];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const I = (a) => [-a[1], a[0]];
// artanh z = ½ log((1 + z) / (1 − z)), continuous on the unit disc.
const artanh = (z) => scale(log(div([1 + z[0], z[1]], [1 - z[0], -z[1]])), 0.5);

const SURFACES = [
  {
    // ζ = e^w on the punctured plane gives the catenoid; its conjugate is the helicoid.
    key: 'catenoid',
    name: 'Catenoid to helicoid',
    wrap: false,
    phi(u, v) {
      const ch = Math.cosh(u);
      const sh = Math.sinh(u);
      return [
        [ch * Math.cos(v), sh * Math.sin(v)],
        [ch * Math.sin(v), -sh * Math.cos(v)],
        [u, v],
      ];
    },
  },
  {
    // f = 4 / (1 − ζ⁴), g = ζ on the unit disc, reached through ζ = tanh(w / 2)
    // from a strip, so the mesh runs along the surface's two directions of
    // repeat instead of radiating from the centre.
    key: 'scherk',
    name: 'Scherk surface',
    wrap: false,
    phi(a, b) {
      // tanh((a + ib) / 2) = (sinh a + i sin b) / (cosh a + cos b)
      const d = Math.cosh(a) + Math.cos(b);
      const z = [Math.sinh(a) / d, Math.sin(b) / d];
      // arctan z = artanh(iz) / i
      const at = artanh(I(z));
      return [scale([at[1], -at[0]], 2), [-b, a], scale(artanh(mul(z, z)), 2)];
    },
  },
  {
    // f = 1, g = ζⁿ: Enneper's surface for n = 1, and its higher orders.
    key: 'enneper',
    name: 'Enneper surface',
    wrap: true,
    phi(r, t, n) {
      const z = [r * Math.cos(t), r * Math.sin(t)];
      const high = scale(pow(z, 2 * n + 1), 1 / (2 * n + 1));
      return [scale(sub(z, high), 0.5), scale(I(add(z, high)), 0.5), scale(pow(z, n + 1), 1 / (n + 1))];
    },
  },
];

const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

export default {
  id: 'minimal',
  kind: 'solid',
  // Quads are sorted by depth every frame, and the order changes as the
  // surface bends, so animated exports swap whole frames instead of morphing.
  resorts: true,
  loopSeconds: 32,

  describe({ key, along, around, waist, order, reach, elev, tall, span }) {
    const mesh = `${along} by ${around} quads`;
    const seen = `seen from ${elev}° above`;
    if (key === 'catenoid')
      return `A catenoid of ${mesh}, its waist ${waist}% as wide as its rims, ${seen}. It bends without stretching into a helicoid of the same mesh and back.`;
    if (key === 'scherk')
      return `One cell of Scherk's doubly periodic surface, ${span} units across and ${tall} times as tall as it is wide, in ${mesh} ${seen}. It bends without stretching into his tower of saddles and back.`;
    return `An Enneper surface with ${words[order + 1]}-fold symmetry out to radius ${(reach / 100).toFixed(2)}, ${mesh}, ${seen}. Every surface in its associate family is the same shape turned, so it turns as its mesh slides over it.`;
  },

  name: ({ key, order }) => (key === 'enneper' && order > 1 ? 'Higher-order Enneper surface' : SURFACES.find((s) => s.key === key).name),

  draw(out, R, detail, time = 0) {
    const pick = R();
    const s = pick < 0.45 ? 0 : pick < 0.75 ? 1 : 2;
    const surf = SURFACES[s];
    const order = 1 + Math.floor(R() * 3);
    const elev = [0.45, 0.35, 0.6][s] + R() * 0.45;
    const azim = R() * TAU;
    const size = R();
    const along = s === 1 ? 10 + detail * 3 : 10 + detail * 2 + (surf.wrap ? 0 : 4);
    const around = s === 1 ? 10 + detail * 3 : 20 + detail * 4;

    // Parameter ranges.
    let us;
    let vs = (j) => (j / around) * TAU;
    if (s === 0) {
      const U = 1.25 + size * 0.5;
      us = (i) => -U + (2 * U * i) / along;
    } else if (s === 1) {
      // A square cell: b is the surface's y directly, and a reaches x = gd(A).
      const A = 2 + size;
      const B = 2 * Math.atan(Math.tanh(A / 2));
      us = (i) => -A + (2 * A * i) / along;
      vs = (j) => -B + (2 * B * j) / around;
    } else {
      const rmax = [1.05 + size * 0.25, 0.92 + size * 0.1, 0.9 + size * 0.07][order - 1];
      us = (i) => (rmax * i) / along;
    }
    const cols = surf.wrap ? around : around + 1;
    const ct = Math.cos(time);
    const st = Math.sin(time);
    const ce = Math.cos(elev);
    const se = Math.sin(elev);
    const ca = Math.cos(azim);
    const sa = Math.sin(azim);

    // Vertices of the surface at this θ, turned to the view: [x, y, depth].
    const verts = [];
    for (let i = 0; i <= along; i++) {
      const u = us(i);
      for (let j = 0; j < cols; j++) {
        const v = vs(j);
        const ph = surf.phi(u, v, order);
        const X = ct * ph[0][0] - st * ph[0][1];
        const Y = ct * ph[1][0] - st * ph[1][1];
        const Z = ct * ph[2][0] - st * ph[2][1];
        const a = ca * X - sa * Y;
        const b = sa * X + ca * Y;
        // Depth grows toward the viewer, who looks down from above.
        verts.push([a, -(ce * Z) + se * b, se * Z + ce * b]);
      }
    }

    // Quads, far ones first.
    const quads = [];
    for (let i = 0; i < along; i++) {
      for (let j = 0; j < around; j++) {
        const j1 = surf.wrap ? (j + 1) % around : j + 1;
        const q = [verts[i * cols + j], verts[i * cols + j1], verts[(i + 1) * cols + j1], verts[(i + 1) * cols + j]];
        quads.push({ g: i, q, d: q[0][2] + q[1][2] + q[2][2] + q[3][2] });
      }
    }
    quads.sort((m, n) => m.d - n.d);

    // The same box round every frame, so the loop never reads as a zoom.
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y] of verts) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    const k = 100 / Math.max((x1 - x0) / 320, (y1 - y0) / 270);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    for (const { g, q } of quads) out.push({ g, r: false, p: q.map(([x, y]) => [(x - cx) * k, (y - cy) * k]) });

    // Measured from the still surface.
    const at = (u, v) => surf.phi(u, v, order).map((c) => c[0]);
    const rim = Math.hypot(...at(us(0), 0).slice(0, 2));
    const waist = Math.hypot(...at(us(along / 2), 0).slice(0, 2));
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i <= along; i++) {
      for (let j = 0; j < cols; j++) {
        at(us(i), vs(j)).forEach((c, n) => ((lo[n] = Math.min(lo[n], c)), (hi[n] = Math.max(hi[n], c))));
      }
    }
    return {
      key: surf.key,
      order,
      along,
      around,
      waist: Math.round((waist / rim) * 100),
      reach: Math.round(us(along) * 100),
      tall: ((hi[2] - lo[2]) / Math.max(hi[0] - lo[0], hi[1] - lo[1])).toFixed(2),
      span: (hi[0] - lo[0]).toFixed(1),
      elev: Math.round((elev * 180) / Math.PI),
    };
  },
};

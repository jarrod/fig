// The Hopf fibration splits the 3-sphere into circles, one over each point of
// the 2-sphere. Base points are taken around one or two seeded circles on the
// 2-sphere, tipped away from the pole; the fibres over one circle fill a torus,
// and every pair of fibres links once. Each fibre is a great circle of S³, and
// stereographic projection from (0, 0, 0, 1) turns it into a round circle in
// space.
//
// The motion is a rotation of S³ itself before projecting. Turning z2's phase
// swings the base circles round the pole, so the rings roll over their tori and
// the tipped tori reshape, while a swing in the (x1, x4) plane leans them
// through each other. Both return exactly at 2π. The base circles stay clear of
// the point whose fibre would pass through the projection pole, so no ring runs
// off to infinity.
//
// Depth is shown by breaking each ring into dashes: the near half is whole and
// the far half thins to short dashes. No lines are hidden, so ring counts are
// capped to keep the rings apart.
const TAU = Math.PI * 2;
const DASHES = 28;
const STEPS = 4;

const deg = (r) => Math.round((r * 180) / Math.PI);
const words = ['no', 'one', 'two', 'three', 'four', 'five'];
const fmt = (n) => n.toLocaleString('en-US');

export default {
  id: 'hopf',
  kind: 'line',
  loopSeconds: 36,

  describe({ bands, perBand, radii, tip, rings, wave, swing }) {
    const circles =
      bands === 1
        ? `one circle ${radii[0]}° across on the 2-sphere`
        : `two circles ${radii[0]}° and ${radii[1]}° across on the 2-sphere, ${perBand} on each`;
    const tipped = tip ? `, tipped ${tip}° off the pole` : ', centred on the pole';
    const shape = wave ? ` and waving ${words[wave]} times round` : '';
    return `${rings} fibres of the 3-sphere over ${circles}${tipped}${shape}. Every pair of rings links once, ${fmt((rings * (rings - 1)) / 2)} links in all, while the sphere tilts ${swing}° in a fourth direction and back.`;
  },

  name: () => 'Hopf fibration',

  draw(out, R, detail, time = 0) {
    const bands = R() < 0.55 ? 1 : 2;
    // The swing in the (x1, x4) plane, and the polar angle the base points must
    // stay under so their fibres keep clear of the projection pole.
    const swing = 0.22 + R() * 0.18;
    const top = Math.min(Math.PI - 2 * swing - 0.5, 1.65);
    const gap = 0.3 + R() * 0.12;
    const tip = R() < 0.15 ? 0 : 0.15 + R() * 0.45;
    const room = top - tip - (bands - 1) * gap;
    const rho = Math.min(room, 0.45 + R() * 0.6) - 0.02;
    const waveK = R() < 0.35 ? 2 + Math.floor(R() * 2) : 0;
    const waveA = waveK ? 0.06 + R() * 0.06 : 0;
    const wavePh = R() * TAU;
    const spin = R() < 0.5 ? 1 : -1;
    const elev = 0.7 + R() * 0.45;
    const azim = R() * TAU;
    const persp = R() < 0.5 ? 0 : 0.12 + R() * 0.12;
    const perBand = Math.round([16, 11][bands - 1] * (0.6 + detail * 0.08));
    const steps = STEPS + Math.floor(detail / 4);

    const a = swing * Math.sin(time);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ce = Math.cos(elev);
    const se = Math.sin(elev);
    const cz = Math.cos(azim);
    const sz = Math.sin(azim);
    const ct = Math.cos(tip);
    const st = Math.sin(tip);

    // A point of S³ on the fibre with half-angle factors c, s0 and phase phi,
    // at fibre angle s, rotated, projected to space and turned to the view:
    // [screen x, screen y, depth].
    const point = (c, s0, phi, s) => {
      const x1 = c * Math.cos(s);
      const x2 = c * Math.sin(s);
      const x3 = s0 * Math.cos(s + phi);
      const x4 = s0 * Math.sin(s + phi);
      const y1 = ca * x1 - sa * x4;
      const y4 = sa * x1 + ca * x4;
      const k = 1 / (1 - y4);
      const X = y1 * k;
      const Y = x2 * k;
      const Z = x3 * k;
      const u = cz * X - sz * Y;
      const v = sz * X + cz * Y;
      return [u, ce * Z - se * v, se * Z + ce * v];
    };

    const fibres = [];
    for (let b = 0; b < bands; b++) {
      for (let j = 0; j < perBand; j++) {
        const psi = ((j + b * 0.5) / perBand) * TAU;
        const r = rho + b * gap + waveA * Math.sin(waveK * psi + wavePh);
        // The base point: around the pole at angular radius r, tipped by `tip`.
        const px = Math.sin(r) * Math.cos(psi);
        const py = Math.sin(r) * Math.sin(psi);
        const pz = Math.cos(r);
        const nx = px * ct + pz * st;
        const nz = -px * st + pz * ct;
        const eta = Math.acos(Math.max(-1, Math.min(1, nz)));
        const phi = Math.atan2(py, nx) + spin * time;
        const c = Math.cos(eta / 2);
        const s0 = Math.sin(eta / 2);
        // Dash centres first, for their depth.
        const mids = [];
        for (let d = 0; d < DASHES; d++) mids.push(point(c, s0, phi, ((d + 0.5) / DASHES) * TAU));
        fibres.push({ b, c, s0, phi, mids });
      }
    }
    let zlo = Infinity;
    let zhi = -Infinity;
    for (const f of fibres) for (const m of f.mids) (zlo = Math.min(zlo, m[2])), (zhi = Math.max(zhi, m[2]));

    const faces = [];
    for (const f of fibres) {
      for (let d = 0; d < DASHES; d++) {
        const near = (f.mids[d][2] - zlo) / (zhi - zlo || 1);
        const len = near > 0.5 ? 1 : 0.35 + 1.3 * near;
        const s1 = ((d + 0.5 - len / 2) / DASHES) * TAU;
        const p = [];
        for (let i = 0; i <= steps; i++) p.push(point(f.c, f.s0, f.phi, s1 + (len / DASHES) * TAU * (i / steps)));
        faces.push({ g: f.b, p });
      }
    }

    // Gentle perspective, then the same spread of points every frame.
    // The outline is held to the card's shape: the box round each frame is
    // centred and scaled to the same size, so the loop never reads as a zoom.
    const mid = (zlo + zhi) / 2;
    const flat = faces.map((f) =>
      f.p.map(([x, y, z]) => {
        const w = 1 / (1 - (persp * (z - mid)) / (zhi - zlo || 1));
        return [x * w, y * w];
      }),
    );
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of flat) for (const [x, y] of p) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    const k = 100 / Math.max((x1 - x0) / 320, (y1 - y0) / 270);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    faces.forEach((f, i) => out.push({ g: f.g, r: false, open: true, p: flat[i].map(([x, y]) => [(x - cx) * k, (y - cy) * k]) }));

    return {
      bands,
      perBand,
      rings: bands * perBand,
      radii: Array.from({ length: bands }, (_, b) => 2 * deg(rho + b * gap)),
      tip: deg(tip),
      wave: waveK,
      swing: deg(swing),
    };
  },
};

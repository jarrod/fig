// Classic Lindenmayer systems. F, A and B move the pen forward and draw; + and -
// turn by the angle; [ and ] save and restore the pen, for branching. < and >
// turn by the fixed corner of a closed island, so it still closes when the
// angle inside the rule is changed.
//
// Every symbol remembers the rewrite that made it (its generation), and each
// generation turns by its own angle. A wave moves through the generations as
// time passes, so the largest bends open while the finest close and back: the
// curve passes through its own relatives (the Koch snowflake through the
// Cesàro curve and the anti-snowflake, the dragon through other paper folds).
// Each generation's angle stays between the system's angle minus `down` and
// plus `up`, and is the classic angle at rest and halfway round the loop.
const SYSTEMS = [
  { name: 'Dragon curve', noun: 'dragon curve', axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, angle: 90, wobble: 1.5, down: [14, 24], up: [14, 24] },
  { name: 'Lévy C curve', noun: 'Lévy C curve', axiom: 'F', rules: { F: '+F--F+' }, angle: 45, wobble: 1.5, down: [12, 18], up: [12, 18] },
  { name: 'Gosper curve', noun: 'Gosper curve', axiom: 'A', rules: { A: 'A-B--B+A++AA+B-', B: '+A-AA--A-B++B+A' }, angle: 60, wobble: 1.2, down: [8, 12], up: [8, 12] },
  // The snowflake's spikes swing out toward the Cesàro curve's near
  // space-filling 85°, and down toward flat; on some seeds past flat, so
  // they fold inward into the anti-snowflake.
  { name: 'Koch snowflake', noun: 'Koch snowflake', axiom: 'F>F>F', corner: 120, rules: { F: 'F+F--F+F' }, angle: 60, wobble: 3, down: [35, 45], up: [20, 24], flip: [80, 95] },
  { name: 'Sierpiński arrowhead', noun: 'Sierpiński arrowhead', axiom: 'A', rules: { A: 'B-A-B', B: 'A+B+A' }, angle: 60, wobble: 2, down: [10, 16], up: [10, 16] },
  { name: 'Peano curve', noun: 'Peano curve', axiom: 'F', rules: { F: 'F+F-F-F-F+F+F+F-F' }, angle: 90, wobble: 1.5, down: [10, 16], up: [10, 16] },
  { name: 'Quadratic Koch island', noun: 'quadratic Koch island', axiom: 'F<F<F<F', corner: 90, rules: { F: 'F+F-F-FF+F+F-F' }, angle: 90, wobble: 2, down: [16, 26], up: [16, 26] },
  // Bracketed plants from The Algorithmic Beauty of Plants, grown upward.
  // Their wave runs from the trunk out to the twigs, like wind.
  { name: 'Fractal plant', axiom: 'X', rules: { X: 'F+[[X]-X]-F[-X]+X', F: 'FF' }, angle: 25, wobble: 5, down: [7, 12], up: [7, 12], plant: true },
  { name: 'Fractal plant', axiom: 'X', rules: { X: 'F[+X]F[-X]+X', F: 'FF' }, angle: 20, wobble: 5, down: [7, 12], up: [7, 12], plant: true },
  { name: 'Fractal plant', axiom: 'X', rules: { X: 'F-[[X]+X]+F[+FX]-X', F: 'FF' }, angle: 22.5, wobble: 5, down: [7, 12], up: [7, 12], plant: true },
  { name: 'Fractal plant', axiom: 'F', rules: { F: 'F[+F]F[-F][F]' }, angle: 20, wobble: 5, down: [7, 12], up: [7, 12], plant: true },
];
const DRAWS = new Set(['F', 'A', 'B']);

// Rewriting is the same at every time, so each system's strings are kept,
// with the generation of every symbol alongside.
const cache = new Map();
function rewrite(s, depth) {
  const sys = SYSTEMS[s];
  const key = `${s}:${depth}`;
  if (cache.has(key)) return cache.get(key);
  let str = sys.axiom;
  let gen = new Uint8Array(str.length);
  if (depth) {
    const prev = rewrite(s, depth - 1);
    const chars = [];
    const gens = [];
    for (let i = 0; i < prev.str.length; i++) {
      const rule = sys.rules[prev.str[i]];
      if (rule === undefined) {
        chars.push(prev.str[i]);
        gens.push(prev.gen[i]);
      } else {
        for (const c of rule) {
          chars.push(c);
          gens.push(depth);
        }
      }
    }
    str = chars.join('');
    gen = Uint8Array.from(gens);
  }
  let segments = 0;
  for (const c of str) if (DRAWS.has(c)) segments++;
  const entry = { str, gen, segments };
  cache.set(key, entry);
  return entry;
}

const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const fmt = (n) => n.toLocaleString('en-US');
const deg = (a) => `${+a.toFixed(1)}°`;

export default {
  id: 'lsystem',
  kind: 'line',
  // Seconds per loop at normal speed. The wave passes through the classic
  // shape twice per loop, so each half is 20 seconds.
  loopSeconds: 40,

  describe({ noun, depth, segments, low, high, inward, aspect, plant, branches, outward }) {
    const shape = aspect > 1.15 ? `${aspect.toFixed(1)} times as wide as it is tall` : aspect < 1 / 1.15 ? `${(1 / aspect).toFixed(1)} times as tall as it is wide` : 'about as wide as it is tall';
    if (plant) {
      return `A plant rule rewritten ${times(depth)} into ${fmt(segments)} segments over ${fmt(branches)} branches. Each generation of forks swings between ${deg(low)} and ${deg(high)}, in a wave running ${outward ? 'from the trunk out to the twigs' : 'from the twigs in to the trunk'}, and it stands ${shape}.`;
    }
    const order = outward ? 'from the largest bends down to the finest' : 'from the finest bends up to the largest';
    const fold = inward ? ', folding its spikes inward past flat and out again' : '';
    return `The ${noun} rule rewritten ${times(depth)} into ${fmt(segments)} segments. Each generation turns by its own angle, between ${deg(low)} and ${deg(high)}, in a wave ${order}${fold}. At rest it spans ${shape}.`;
  },

  name: ({ name }) => name,

  draw(out, R, detail, time = 0) {
    const pick = R();
    // Plants share a quarter of the seeds between their four variants.
    const s = pick < 0.75 ? Math.floor((pick / 0.75) * 7) : 7 + Math.floor(((pick - 0.75) / 0.25) * 4);
    const sys = SYSTEMS[s];
    const drop = R() < 0.3 ? 1 : 0;
    const angle = sys.angle + (R() * 2 - 1) * sys.wobble;
    const start = sys.plant ? -90 + (R() * 2 - 1) * 8 : R() * 360;
    const reach = R();
    const up = sys.up[0] + reach * (sys.up[1] - sys.up[0]);
    // Some snowflakes reach down past flat, so their spikes fold inward.
    const inwardSeed = R() < 0.4 && sys.flip;
    const down = inwardSeed ? sys.flip[0] + reach * (sys.flip[1] - sys.flip[0]) : sys.down[0] + reach * (sys.down[1] - sys.down[0]);
    // How far the wave lags from one generation to the next, and which way it runs.
    const lag = (0.6 + R() * 0.9) * (R() < 0.5 ? -1 : 1);

    // The deepest rewrite under the segment budget, sometimes one less.
    const cap = Math.round(250 * 1.45 ** (detail - 1));
    let depth = 1;
    while (depth < 12 && rewrite(s, depth + 1).segments <= cap) depth++;
    if (drop && depth > 1 && rewrite(s, depth - 1).segments * 5 >= cap) depth--;
    const { str, gen, segments } = rewrite(s, depth);

    // Each generation's turn follows sin(t)·cos(t − g·lag): zero at rest and
    // halfway round, and a wave that reaches each generation a little later.
    // Scaled to −1..1, it maps smoothly onto angle − down .. angle + up.
    const corner = ((sys.corner ?? 0) * Math.PI) / 180;
    const a1 = (up + down) / 2;
    const a2 = (up - down) / 2;
    const turnOf = (g, t) => {
      const c = g * lag;
      const f = (2 * Math.sin(t) * Math.cos(t - c)) / (1 + Math.abs(Math.sin(c)));
      return angle + a1 * f + a2 * f * f;
    };
    const turns = Float64Array.from({ length: depth + 1 }, (_, g) => (turnOf(g, time) * Math.PI) / 180);
    let x = 0;
    let y = 0;
    let a = (start * Math.PI) / 180;
    let line = [[0, 0]];
    const stack = [];
    let branches = 0;
    const flush = () => {
      if (line.length > 1) out.push({ g: out.length, r: false, open: true, p: line });
    };
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const turn = turns[gen[i]];
      if (DRAWS.has(c)) {
        x += Math.cos(a);
        y += Math.sin(a);
        line.push([x, y]);
      } else if (c === '+') a += turn;
      else if (c === '-') a -= turn;
      else if (c === '<') a += corner;
      else if (c === '>') a -= corner;
      else if (c === '[') {
        stack.push([x, y, a]);
        branches++;
      } else if (c === ']') {
        flush();
        [x, y, a] = stack.pop();
        line = [[x, y]];
      }
    }
    flush();

    // Hold the size steady: a fixed step length makes the drawing grow and
    // shrink as the angles change, which reads as zooming rather than
    // morphing. Every frame is scaled to the same spread of points around its
    // centre (around the root, for plants, so they stay planted).
    let cx = 0;
    let cy = 0;
    let n = 0;
    if (!sys.plant) {
      for (const f of out) for (const [px, py] of f.p) (cx += px), (cy += py), n++;
      cx /= n;
      cy /= n;
    }
    let spread = 0;
    n = 0;
    for (const f of out) for (const [px, py] of f.p) (spread += (px - cx) ** 2 + (py - cy) ** 2), n++;
    const k = 100 / Math.sqrt(spread / n || 1);
    for (const f of out) for (const q of f.p) (q[0] = (q[0] - cx) * k), (q[1] = (q[1] - cy) * k);

    // Measured at the still drawing.
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const f of out) {
      for (const [px, py] of f.p) {
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px);
        y1 = Math.max(y1, py);
      }
    }
    const aspect = (x1 - x0) / Math.max(1e-9, y1 - y0);
    // The range each generation's angle covers over the loop.
    const low = angle - down;
    const high = angle + up;
    return { name: sys.name, noun: sys.noun, depth, segments, low, high, inward: low < 0, aspect, plant: !!sys.plant, branches, outward: lag > 0 };
  },
};

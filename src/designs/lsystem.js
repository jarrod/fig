// Classic Lindenmayer systems. F, A and B move the pen forward and draw; + and -
// turn by the angle; [ and ] save and restore the pen, for branching. < and >
// turn by the fixed corner of a closed island, so it still closes when the
// angle inside the rule is changed.
const SYSTEMS = [
  { name: 'Dragon curve', noun: 'dragon curve', axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, angle: 90, wobble: 1.5, bend: [2, 4] },
  { name: 'Lévy C curve', noun: 'Lévy C curve', axiom: 'F', rules: { F: '+F--F+' }, angle: 45, wobble: 1.5, bend: [1.5, 3] },
  { name: 'Gosper curve', noun: 'Gosper curve', axiom: 'A', rules: { A: 'A-B--B+A++AA+B-', B: '+A-AA--A-B++B+A' }, angle: 60, wobble: 1.2, bend: [1.5, 3] },
  { name: 'Koch snowflake', noun: 'Koch snowflake', axiom: 'F>F>F', corner: 120, rules: { F: 'F+F--F+F' }, angle: 60, wobble: 6, bend: [3, 6] },
  { name: 'Sierpiński arrowhead', noun: 'Sierpiński arrowhead', axiom: 'A', rules: { A: 'B-A-B', B: 'A+B+A' }, angle: 60, wobble: 2, bend: [2, 4] },
  { name: 'Hilbert curve', noun: 'Hilbert curve', axiom: 'X', rules: { X: '+YF-XFX-FY+', Y: '-XF+YFY+FX-' }, angle: 90, wobble: 1.5, bend: [1.5, 3] },
  { name: 'Quadratic Koch island', noun: 'quadratic Koch island', axiom: 'F<F<F<F', corner: 90, rules: { F: 'F+F-F-FF+F+F-F' }, angle: 90, wobble: 2, bend: [1.5, 3] },
  // Bracketed plants from The Algorithmic Beauty of Plants, grown upward.
  { name: 'Fractal plant', axiom: 'X', rules: { X: 'F+[[X]-X]-F[-X]+X', F: 'FF' }, angle: 25, wobble: 5, bend: [3, 6], plant: true },
  { name: 'Fractal plant', axiom: 'X', rules: { X: 'F[+X]F[-X]+X', F: 'FF' }, angle: 20, wobble: 5, bend: [3, 6], plant: true },
  { name: 'Fractal plant', axiom: 'X', rules: { X: 'F-[[X]+X]+F[+FX]-X', F: 'FF' }, angle: 22.5, wobble: 5, bend: [3, 6], plant: true },
  { name: 'Fractal plant', axiom: 'F', rules: { F: 'F[+F]F[-F][F]' }, angle: 20, wobble: 5, bend: [3, 6], plant: true },
];
const DRAWS = new Set(['F', 'A', 'B']);

// Rewriting is the same at every time, so each system's strings are kept.
const cache = new Map();
function rewrite(s, depth) {
  const sys = SYSTEMS[s];
  const key = `${s}:${depth}`;
  if (cache.has(key)) return cache.get(key);
  let str = depth ? rewrite(s, depth - 1).str : sys.axiom;
  if (depth) str = [...str].map((c) => sys.rules[c] ?? c).join('');
  let segments = 0;
  for (const c of str) if (DRAWS.has(c)) segments++;
  const entry = { str, segments };
  cache.set(key, entry);
  return entry;
}

const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const fmt = (n) => n.toLocaleString('en-US');
const deg = (a) => `${+a.toFixed(1)}°`;

export default {
  id: 'lsystem',
  kind: 'line',
  // Seconds per loop at normal speed: one slow curl and uncurl.
  loopSeconds: 24,

  describe({ noun, depth, segments, angle, bend, branches, aspect, plant }) {
    const shape = aspect > 1.15 ? `${aspect.toFixed(1)} times as wide as it is tall` : aspect < 1 / 1.15 ? `${(1 / aspect).toFixed(1)} times as tall as it is wide` : 'about as wide as it is tall';
    if (plant) {
      return `A plant rule rewritten ${times(depth)} into ${fmt(segments)} segments over ${fmt(branches)} branches, forking at ${deg(angle)}. It stands ${shape}, and its forks bend by up to ${deg(bend)} and back.`;
    }
    return `The ${noun} rule rewritten ${times(depth)} into ${fmt(segments)} segments, with turns of ${deg(angle)}. It spans ${shape}, and every turn bends by up to ${deg(bend)} and back.`;
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
    const bend = sys.bend[0] + R() * (sys.bend[1] - sys.bend[0]);
    const lean = R() < 0.5 ? -1 : 1;

    // The deepest rewrite under the segment budget, sometimes one less.
    const cap = Math.round(250 * 1.45 ** (detail - 1));
    let depth = 1;
    while (depth < 12 && rewrite(s, depth + 1).segments <= cap) depth++;
    if (drop && depth > 1 && rewrite(s, depth - 1).segments * 5 >= cap) depth--;
    const { str, segments } = rewrite(s, depth);

    // The turn angle swings by `bend` with sin(time), so the curve curls and
    // uncurls and is back where it began after one loop.
    const corner = ((sys.corner ?? 0) * Math.PI) / 180;
    const turn = ((angle + lean * bend * Math.sin(time)) * Math.PI) / 180;
    let x = 0;
    let y = 0;
    let a = (start * Math.PI) / 180;
    let line = [[0, 0]];
    const stack = [];
    let branches = 0;
    const flush = () => {
      if (line.length > 1) out.push({ g: out.length, r: false, open: true, p: line });
    };
    for (const c of str) {
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
    return { name: sys.name, noun: sys.noun, depth, segments, angle, bend, branches, aspect, plant: !!sys.plant };
  },
};

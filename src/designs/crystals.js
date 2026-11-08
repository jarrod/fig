import { box } from '../core/geometry.js';
import { plural } from '../core/text.js';

export default {
  id: 'crystals',
  kind: 'solid',

  describe: ({ rule, seeds, steps, cells, tallest }) =>
    `${
      [
        'A cell switches on when exactly one of its 4 neighbours is on, and stays on. Taller columns grew earlier.',
        'A cell switches on when exactly one of its 8 neighbours is on, and stays on. Taller columns grew earlier.',
        'A cell is on when an odd number of its 4 neighbours were on, so the start keeps copying itself. Taller columns were on for longer.',
      ][rule]
    } From ${plural(seeds, 'seeded cell')}, ${plural(steps, 'step')} leave ${plural(cells, 'column')}, the tallest ${plural(tallest, 'step')} high.`,

  name: ({ rule }) => ['Ulam–Warburton automaton', 'Ulam–Warburton, 8 neighbours', 'Fredkin replicator'][rule],

  draw(out, R, detail, time = 0) {
    const steps = 4 + Math.ceil(detail / 2);
    const n = steps * 2 + 3;
    const rule = Math.floor(R() * 3);
    // The start is a 5×5 pattern with 8-way symmetry, built from 6 groups of
    // cells that mirror into each other. At least one group is always on.
    const start = 1 + Math.floor(R() * 63);
    const groups = [[[0, 0]], [[1, 0]], [[1, 1]], [[2, 0]], [[2, 2]], [[2, 1], [1, 2]]];
    const at = (x, y) => y * n + x;
    let cur = new Uint8Array(n * n);
    const c = steps + 1;
    groups.forEach((group, bit) => {
      if (!(start & (1 << bit))) return;
      for (const [a, b] of group) {
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          cur[at(c + a * sx, c + b * sy)] = 1;
          cur[at(c + b * sx, c + a * sy)] = 1;
        }
      }
    });
    const born = new Int32Array(n * n).fill(-1);
    const onFor = new Int32Array(n * n);
    // The loop replays the growth: fewer steps are run partway through it.
    const shown = Math.round(steps * (0.55 + 0.45 * Math.cos(time)));
    const near4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const near8 = [...near4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let gen = 0; gen < shown; gen++) {
      for (let i = 0; i < n * n; i++) {
        if (!cur[i]) continue;
        if (born[i] < 0) born[i] = gen;
        onFor[i]++;
      }
      const next = new Uint8Array(n * n);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const count = (dirs) => dirs.filter(([dx, dy]) => cur[at(x + dx, y + dy)] && x + dx >= 0 && x + dx < n).length;
          const i = at(x, y);
          if (rule === 0) next[i] = cur[i] || count(near4) === 1 ? 1 : 0;
          else if (rule === 1) next[i] = cur[i] || count(near8) === 1 ? 1 : 0;
          else next[i] = count(near4) % 2;
        }
      }
      cur = next;
    }
    const unit = 6 / steps;
    let cells = 0;
    let tallest = 0;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const i = at(x, y);
        const h = rule === 2 ? onFor[i] : born[i] < 0 ? 0 : shown - born[i];
        if (h <= 0) continue;
        cells++;
        tallest = Math.max(tallest, h);
        box(out, x * 1.08, y * 1.08, 0, 1, 1, h * unit, x + y);
      }
    }
    // The seeded start, counted in cells.
    let seeds = 0;
    groups.forEach((group, bit) => {
      if (start & (1 << bit)) seeds += new Set(group.flatMap(([a, b]) => [[1, 1], [-1, 1], [1, -1], [-1, -1]].flatMap(([sx, sy]) => [`${a * sx},${b * sy}`, `${b * sx},${a * sy}`]))).size;
    });
    return { rule, seeds, steps: shown, cells, tallest };
  },
};

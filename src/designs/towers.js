import { box, peakIndex } from '../core/geometry.js';
import { plural } from '../core/text.js';

export default {
  id: 'towers',
  kind: 'solid',

  describe: ({ rows, summits, range }) =>
    `${rows}×${rows} towers with ${plural(summits, 'summit')}. The tallest is ${range.toFixed(1)}× the shortest.`,

  name: () => 'Summed sine waves',

  draw(out, R, detail, time = 0) {
    const n = 3 + detail;
    const a = R() * 6;
    const b = R() * 6;
    const f = 0.5 + R() * 0.8;
    const g = 0.5 + R() * 0.8;
    const grid = [];
    for (let i = 0; i < n; i++) {
      grid.push([]);
      for (let j = 0; j < n; j++) {
        // The three waves roll across the grid.
        const u =
          ((Math.sin(i * f + a + time) + Math.cos(j * g + b + time) + Math.sin((i + j) * 0.5 + a * b + 2 * time)) / 3) *
            0.5 +
          0.5;
        const h = 0.25 + u * u * 6;
        grid[i].push(h);
        box(out, i * 1.14, j * 1.14, 0, 1, 1, h, i + j);
      }
    }
    const all = grid.flat();
    const best = peakIndex(all);
    const isSummit = (i, j) => {
      for (let a = i - 1; a <= i + 1; a++) {
        for (let b = j - 1; b <= j + 1; b++) {
          if ((a !== i || b !== j) && grid[a]?.[b] >= grid[i][j]) return false;
        }
      }
      return true;
    };
    return {
      rows: grid.length,
      summits: grid.flatMap((row, i) => row.filter((_, j) => isSummit(i, j))).length,
      range: all[best] / Math.min(...all),
    };
  },
};

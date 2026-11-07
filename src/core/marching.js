// Marching squares: contour lines of a scalar grid at one level. No DOM.
// The field is a Float32Array of w × h samples, row by row (index y * w + x).
// Returns polylines in grid coordinates ([x, y], 0..w−1 by 0..h−1). Segments are
// joined into continuous lines; a closed loop ends with a copy of its first point.

// Every crossing sits on a grid edge, and each edge is shared by at most two
// cells, so joining segments end to end only needs a lookup by edge number.
// Edge numbers: horizontal edge from (x, y) to (x+1, y) is y * w + x, vertical
// edge from (x, y) to (x, y+1) is w * h + y * w + x.

export function contourLines(field, w, h, level) {
  const H = 0;
  const V = w * h;
  const segA = [];
  const segB = [];
  const point = new Map();

  // Where the contour crosses an edge, by linear interpolation along it.
  const cross = (id, x0, y0, x1, y1) => {
    if (point.has(id)) return id;
    const a = field[y0 * w + x0];
    const b = field[y1 * w + x1];
    const t = a === b ? 0.5 : (level - a) / (b - a);
    point.set(id, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    return id;
  };

  const seg = (a, b) => {
    segA.push(a);
    segB.push(b);
  };
  // The four edges of the current cell: top, right, bottom, left.
  let x = 0;
  let y = 0;
  const top = () => cross(H + y * w + x, x, y, x + 1, y);
  const right = () => cross(V + y * w + x + 1, x + 1, y, x + 1, y + 1);
  const bottom = () => cross(H + (y + 1) * w + x, x, y + 1, x + 1, y + 1);
  const left = () => cross(V + y * w + x, x, y, x, y + 1);

  for (y = 0; y < h - 1; y++) {
    for (x = 0; x < w - 1; x++) {
      const v0 = field[y * w + x];
      const v1 = field[y * w + x + 1];
      const v2 = field[(y + 1) * w + x + 1];
      const v3 = field[(y + 1) * w + x];
      // Corners at or above the level count as inside.
      const c = (v0 >= level ? 1 : 0) | (v1 >= level ? 2 : 0) | (v2 >= level ? 4 : 0) | (v3 >= level ? 8 : 0);
      if (c === 0 || c === 15) continue;
      switch (c) {
        case 1: case 14: seg(left(), top()); break;
        case 2: case 13: seg(top(), right()); break;
        case 3: case 12: seg(left(), right()); break;
        case 4: case 11: seg(right(), bottom()); break;
        case 6: case 9: seg(top(), bottom()); break;
        case 7: case 8: seg(left(), bottom()); break;
        case 5: case 10: {
          // Saddle: the average of the corners decides whether the two inside
          // corners join through the middle of the cell or stay apart. Either
          // way the lines cut off corners 1 and 3, or corners 0 and 2.
          const joined = (v0 + v1 + v2 + v3) / 4 >= level;
          if ((c === 5) === joined) {
            seg(left(), bottom());
            seg(top(), right());
          } else {
            seg(left(), top());
            seg(right(), bottom());
          }
          break;
        }
      }
    }
  }

  // Each edge point belongs to one or two segments.
  const links = new Map();
  const link = (id, s) => {
    const l = links.get(id);
    if (l) l.push(s);
    else links.set(id, [s]);
  };
  for (let s = 0; s < segA.length; s++) {
    link(segA[s], s);
    link(segB[s], s);
  }

  const used = new Uint8Array(segA.length);
  const lines = [];
  // Walk from an end: through each point to the other segment that shares it.
  const walk = (s, from) => {
    const ids = [from];
    let at = from;
    while (s !== -1 && !used[s]) {
      used[s] = 1;
      at = segA[s] === at ? segB[s] : segA[s];
      ids.push(at);
      const l = links.get(at);
      s = l.length === 2 ? (l[0] === s ? l[1] : l[0]) : -1;
    }
    lines.push(ids.map((id) => point.get(id)));
  };
  // Open lines first (they start at a point with one segment, on the border),
  // then whatever is left forms closed loops.
  for (const [id, l] of links) if (l.length === 1 && !used[l[0]]) walk(l[0], id);
  for (let s = 0; s < segA.length; s++) if (!used[s]) walk(s, segA[s]);
  return lines;
}

// True when a line from contourLines is a closed loop.
export const isClosed = (line) => line.length > 2 && line[0] === line[line.length - 1];

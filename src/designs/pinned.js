// One card per type, for a design that draws several types and picks one
// with a random draw (Lorenz, Aizawa or Thomas, say). The pinned design
// rescales that one draw into the range that picks its type, so a new seed
// only varies the drawing within the type, and anything else the draw
// decides inside that range still varies too.
//
// `call` is which draw picks the type, counting from 0, and `from`..`to` the
// range of values that picks it.
export function pinned(design, { id, call = 0, from, to }) {
  return {
    ...design,
    id,
    draw(out, R, detail, time = 0, seed, frame) {
      let n = 0;
      const pick = () => {
        const v = R();
        return n++ === call ? from + v * (to - from) : v;
      };
      // Designs that cache slow work per seed get a key of their own per
      // type, so two types never share a cached result for the same seed.
      return design.draw(out, pick, detail, time, seed === undefined ? undefined : `${id}:${seed}`, frame);
    },
  };
}

// Splits a design into one card per type: [id, from, to] for each.
export const split = (design, call, types) => types.map(([id, from, to]) => pinned(design, { id, call, from, to }));

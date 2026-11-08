// Every design in gallery order: solids first, then line drawings.
// Each module exports { id, kind, name, describe, draw }, and optionally
// loopSeconds and framed. To add a design, import it here and add it to the list.
import plates from './plates.js';
import towers from './towers.js';
import terraces from './terraces.js';
import sheets from './sheets.js';
import lathe from './lathe.js';
import voxels from './voxels.js';
import ridges from './ridges.js';
import vessels from './vessels.js';
import blocks from './blocks.js';
import crystals from './crystals.js';
import paths from './paths.js';
import fractals from './fractals.js';
import contours from './contours.js';
import columns from './columns.js';
import pillars from './pillars.js';
import attractors from './attractors.js';
import flows from './flows.js';
import harmonographs from './harmonographs.js';
import spirographs from './spirographs.js';
import knots from './knots.js';
import torusknots from './torusknots.js';
import cliffords from './cliffords.js';
import ribbons from './ribbons.js';
import pendulums from './pendulums.js';
import growth from './growth.js';
import branches from './branches.js';
import waves from './waves.js';
import turing from './turing.js';
import hatching from './hatching.js';
import chladni from './chladni.js';
import marble from './marble.js';
import phyllotaxis from './phyllotaxis.js';
import maurer from './maurer.js';
import { curves } from './lsystem.js';
import { split } from './pinned.js';
import koch from './koch.js';
import epicycles from './epicycles.js';
import penrose from './penrose.js';
import truchet from './truchet.js';
import minimal from './minimal.js';
import hyperbolic from './hyperbolic.js';
import dedekind from './dedekind.js';
import apollonian from './apollonian.js';
import conformal from './conformal.js';
import julia from './julia.js';
import hopf from './hopf.js';
import caustics from './caustics.js';
import billiards from './billiards.js';
import fieldlines from './fieldlines.js';
import standardmap from './standardmap.js';

// Designs that draw several types are split into one card per type, so a
// new seed only varies the drawing within its type (see pinned.js).
export const DESIGNS = [
  ...split(plates, 1, [['plates', 0, 1 / 3], ['damped', 1 / 3, 2 / 3], ['powerlaw', 2 / 3, 1]]),
  towers,
  terraces,
  sheets,
  lathe,
  voxels,
  ridges,
  vessels,
  blocks,
  ...split(crystals, 0, [['crystals', 0, 1 / 3], ['ulam8', 1 / 3, 2 / 3], ['fredkin', 2 / 3, 1]]),
  paths,
  ...split(fractals, 0, [['fractals', 0, 1 / 3], ['vicsek', 1 / 3, 2 / 3], ['cantor', 2 / 3, 1]]),
  contours,
  columns,
  pillars,
  ...split(minimal, 0, [['minimal', 0, 0.45], ['scherk', 0.45, 0.75], ['enneper', 0.75, 1]]),
  ...split(attractors, 0, [['attractors', 0, 1 / 3], ['aizawa', 1 / 3, 2 / 3], ['thomas', 2 / 3, 1]]),
  flows,
  harmonographs,
  spirographs,
  knots,
  torusknots,
  ...split(cliffords, 0, [['cliffords', 0, 0.5], ['dejong', 0.5, 1]]),
  ...split(ribbons, 0, [['ribbons', 0, 0.5], ['thomasribbon', 0.5, 1]]),
  pendulums,
  growth,
  branches,
  waves,
  turing,
  hatching,
  chladni,
  marble,
  phyllotaxis,
  maurer,
  ...curves,
  koch,
  epicycles,
  penrose,
  truchet,
  hyperbolic,
  dedekind,
  apollonian,
  ...split(conformal, 0, [
    ['conformal', 0, 1 / 6],
    ['expmap', 1 / 6, 2 / 6],
    ['rationalmap', 2 / 6, 3 / 6],
    ['powermap', 3 / 6, 4 / 6],
    ['sinemap', 4 / 6, 5 / 6],
    ['mobius', 5 / 6, 1],
  ]),
  julia,
  hopf,
  caustics,
  ...split(billiards, 0, [['billiards', 0, 0.72], ['cardioid', 0.72, 1]]),
  ...split(fieldlines, 0, [['fieldlines', 0.3, 1], ['vortex', 0, 0.3]]),
  standardmap,
];

export const DESIGN = Object.fromEntries(DESIGNS.map((d) => [d.id, d]));

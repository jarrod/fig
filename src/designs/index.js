// Every design in gallery order: solids first, then line drawings.
// Each module exports { id, kind, name, describe, draw } and optionally loopSeconds.
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

export const DESIGNS = [
  plates,
  towers,
  terraces,
  sheets,
  lathe,
  voxels,
  ridges,
  vessels,
  blocks,
  crystals,
  paths,
  fractals,
  contours,
  columns,
  pillars,
  attractors,
  flows,
  harmonographs,
  spirographs,
  knots,
  torusknots,
  cliffords,
  ribbons,
  pendulums,
  growth,
  branches,
  waves,
  turing,
  hatching,
];

export const DESIGN = Object.fromEntries(DESIGNS.map((d) => [d.id, d]));

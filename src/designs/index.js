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
import lsystem from './lsystem.js';
import epicycles from './epicycles.js';
import penrose from './penrose.js';
import truchet from './truchet.js';

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
  chladni,
  marble,
  phyllotaxis,
  maurer,
  lsystem,
  epicycles,
  penrose,
  truchet,
];

export const DESIGN = Object.fromEntries(DESIGNS.map((d) => [d.id, d]));

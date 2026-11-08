// The Koch snowflake on its own card. It is the Koch rule from the L-system
// design, where each generation of spikes turns by its own angle and a wave
// passes through them, so the snowflake morphs through the Cesàro curve and,
// on some seeds, folds inward into the anti-snowflake.
export { koch as default } from './lsystem.js';

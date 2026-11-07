// Small helpers for writing card descriptions.

export const pct = (v) => Math.round(v * 100);
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const trend = (ratio, up, down) => (ratio > 1.15 ? `${up} upward` : ratio < 1 / 1.15 ? `${down} upward` : 'kept even');

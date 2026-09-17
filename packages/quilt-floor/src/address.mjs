// The golden address space — one projection for floor tiles, field points,
// and any cell that wants a position. Phyllotaxis: index i maps to radius
// √i, angle i · (golden angle). This IS the cut-and-project story of
// ai-writings/51-the-penrose-floor.md in its 2D working form: an irrational
// rotation (137.5077…° = 360°/φ²) that never repeats, so every address is
// unique and the neighborhood of a cell encodes its relations.

import { PHI } from './golden.mjs';

export const GOLDEN_ANGLE = (2 * Math.PI) / (PHI * PHI); // ≈ 2.399963 rad ≈ 137.5077°

export function addressOf(i, scale = 1) {
  const r = scale * Math.sqrt(i);
  const a = i * GOLDEN_ANGLE;
  return { x: r * Math.cos(a), y: r * Math.sin(a), angle: a, radius: r };
}

// Distance between successive addresses — the spacing a walk can rely on.
export function spacing(i) {
  const p = addressOf(i), q = addressOf(i + 1);
  return Math.hypot(q.x - p.x, q.y - p.y);
}

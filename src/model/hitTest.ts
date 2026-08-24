import { TOKEN_HIT_RADIUS } from './fieldGeometry';
import { distanceToSegmentSq, type Point } from './path';
import type { Stroke, Token } from './types';

/**
 * The token under `p`. Hit areas are generous enough to overlap on small
 * screens, so the nearest token wins; ties go to the topmost, which is the one
 * the coach can actually see (later tokens render on top).
 */
export function tokenAt(
  tokens: readonly Token[],
  p: Point,
  radius = TOKEN_HIT_RADIUS,
): Token | null {
  let best: Token | null = null;
  let bestDistSq = radius * radius;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const distSq = dx * dx + dy * dy;
    // Strict once something is held, so an exact tie keeps the topmost token.
    if (best === null ? distSq <= bestDistSq : distSq < bestDistSq) {
      best = t;
      bestDistSq = distSq;
    }
  }
  return best;
}

export const STROKE_HIT_TOLERANCE = 22;

export function strokeAt(
  strokes: readonly Stroke[],
  p: Point,
  tolerance = STROKE_HIT_TOLERANCE,
): Stroke | null {
  const limit = tolerance * tolerance;
  for (let i = strokes.length - 1; i >= 0; i--) {
    const points = strokes[i].points;
    if (points.length === 1) {
      const dx = points[0].x - p.x;
      const dy = points[0].y - p.y;
      if (dx * dx + dy * dy <= limit) return strokes[i];
      continue;
    }
    for (let j = 0; j < points.length - 1; j++) {
      if (distanceToSegmentSq(p, points[j], points[j + 1]) <= limit) return strokes[i];
    }
  }
  return null;
}

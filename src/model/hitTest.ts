import { BASES, TOKEN_HIT_RADIUS } from './fieldGeometry';
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

/**
 * Where a route leg should actually land. A throw goes *to the shortstop* or
 * *to second base*, not to a coordinate, so a tap near either snaps to it.
 */
export function snapToTarget(
  tokens: readonly Token[],
  p: Point,
  radius = TOKEN_HIT_RADIUS,
): Point {
  const token = tokenAt(tokens, p, radius);
  if (token) return { x: token.x, y: token.y };

  let best: Point | null = null;
  let bestDistSq = radius * radius;
  for (const base of [BASES.home, BASES.first, BASES.second, BASES.third]) {
    const distSq = (base.x - p.x) ** 2 + (base.y - p.y) ** 2;
    if (distSq <= bestDistSq) {
      best = base;
      bestDistSq = distSq;
    }
  }
  return best ?? p;
}

/** Is `p` on the ball's route? Used to erase it. */
export function routeAt(
  path: readonly Point[],
  p: Point,
  tolerance = STROKE_HIT_TOLERANCE,
): boolean {
  const limit = tolerance * tolerance;
  for (let i = 0; i < path.length - 1; i++) {
    if (distanceToSegmentSq(p, path[i], path[i + 1]) <= limit) return true;
  }
  return false;
}

/**
 * The bag a dropped token should settle onto, if it landed near one. Bases only:
 * a fielder dragged past a teammate should stay where he was put.
 */
export function snapToBase(p: Point, radius = 24): Point {
  let best: Point | null = null;
  let bestDistSq = radius * radius;
  for (const base of [BASES.home, BASES.first, BASES.second, BASES.third]) {
    const distSq = (base.x - p.x) ** 2 + (base.y - p.y) ** 2;
    if (distSq <= bestDistSq) {
      best = base;
      bestDistSq = distSq;
    }
  }
  return best ?? p;
}

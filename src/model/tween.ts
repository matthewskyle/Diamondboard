import type { Point } from './path';
import type { PositionMap } from './types';

export const DEFAULT_DURATION_MS = 1800;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Interpolate one arrangement toward another. Deliberately knows nothing about
 * where the two arrangements came from — Phase 2 can pick a bracketing pair out
 * of an N-keyframe list and call this unchanged.
 *
 * A token missing from either map stays put: it was added after capture.
 */
export function interpolatePositions(
  from: PositionMap,
  to: PositionMap,
  t: number,
  ease: (t: number) => number = easeInOutCubic,
): PositionMap {
  const eased = ease(clamp01(t));
  const out: PositionMap = {};
  for (const id of Object.keys(from)) {
    const a = from[id];
    const b = to[id];
    out[id] = b ? lerpPoint(a, b, eased) : a;
  }
  return out;
}

/**
 * A point a fraction of the way along a polyline, measured by distance rather
 * than by leg, so the travel speed is constant across legs of different length.
 */
export function pointAlongPath(points: readonly Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const legs: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    legs.push(d);
    total += d;
  }
  if (total === 0) return points[0];

  let travelled = clamp01(t) * total;
  for (let i = 0; i < legs.length; i++) {
    if (travelled <= legs[i] || i === legs.length - 1) {
      const along = legs[i] === 0 ? 1 : Math.min(travelled / legs[i], 1);
      return lerpPoint(points[i], points[i + 1], along);
    }
    travelled -= legs[i];
  }
  return points[points.length - 1];
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

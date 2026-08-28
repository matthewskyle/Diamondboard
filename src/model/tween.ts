import type { Point } from './path';
import type { PositionMap } from './types';

/** Slow, default, and the board's original pace. */
export const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Interpolate one arrangement toward another. Deliberately knows nothing about
 * where the two arrangements came from — `steps.ts` picks the pair bracketing
 * the current beat and calls this unchanged.
 *
 * A token missing from either map stays put: it was added after the step.
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

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/* --- Following a polyline ------------------------------------------------
 *
 * Parked with the play library (see DECISIONS.md). This drove the ball's route
 * and the base paths a runner covers — a man scoring from second goes by way of
 * third, not across the mound. A play drawn by hand is straight lines between
 * beats, so nothing live calls this today; it is kept whole, with its tests,
 * because the library it served is.
 */

/**
 * How long the ball is held at each stop, as a share of the whole playback, so
 * a throw arriving reads as someone catching it rather than the ball glancing
 * off. Capped in total, or a long relay would be more waiting than movement.
 */
export const DWELL_SHARE_PER_STOP = 0.12;
export const MAX_DWELL_SHARE = 0.45;

export function dwellShareFor(stops: number): number {
  if (stops <= 0) return 0;
  return Math.min(stops * DWELL_SHARE_PER_STOP, MAX_DWELL_SHARE);
}

/**
 * A point a fraction of the way along a polyline, measured by distance rather
 * than by leg, so travel speed is constant across legs of different length.
 *
 * `dwellShare` holds the ball at each intermediate stop for a slice of the
 * timeline — the beat where a fielder actually catches it. The share is split
 * evenly between stops; the rest of the time is travel.
 */
export function pointAlongPath(
  points: readonly Point[],
  t: number,
  dwellShare = 0,
): Point {
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

  const stops = points.length - 2; // every point but the origin and the last
  const dwell = stops > 0 ? clamp01(dwellShare) : 0;
  const perStop = stops > 0 ? dwell / stops : 0;
  const travelShare = 1 - dwell;

  let remaining = clamp01(t);
  for (let i = 0; i < legs.length; i++) {
    const legTime = travelShare * (legs[i] / total);
    if (remaining <= legTime || i === legs.length - 1) {
      const along = legTime === 0 ? 1 : Math.min(remaining / legTime, 1);
      return lerpPoint(points[i], points[i + 1], along);
    }
    remaining -= legTime;

    // Held at this stop until its dwell elapses.
    if (remaining <= perStop) return points[i + 1];
    remaining -= perStop;
  }
  return points[points.length - 1];
}

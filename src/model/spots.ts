import { BASE_PATH_FT, FOUL_ANGLE, MOUND_DISTANCE_FT, pointAt } from './fieldGeometry';
import type { Point } from './path';
import type { BaseName, Spot } from './playTypes';

/**
 * Spot arithmetic, done in real feet.
 *
 * A cut man stands "forty-five feet from the plate, in a line between the left
 * fielder and the catcher"; a backup stands "thirty feet behind the bag, in
 * line with the throw". Those are real distances on a real field, so they are
 * worked out on a plan view in feet and only then handed to the field's
 * projection — which keeps the answers right if the drawing is ever retuned.
 */

/** A plan view in feet: +y toward centre field, +x toward the right-field line. */
export interface Feet {
  x: number;
  y: number;
}

const DEG = Math.PI / 180;

export function feetAt(distance: number, angleDeg: number): Feet {
  const a = angleDeg * DEG;
  return { x: distance * Math.sin(a), y: distance * Math.cos(a) };
}

export const BASE_FEET: Record<BaseName, Feet> = {
  home: { x: 0, y: 0 },
  first: feetAt(BASE_PATH_FT, FOUL_ANGLE),
  second: feetAt(BASE_PATH_FT * Math.SQRT2, 0),
  third: feetAt(BASE_PATH_FT, -FOUL_ANGLE),
  mound: feetAt(MOUND_DISTANCE_FT, 0),
};

/** The four bags a runner touches, in the order he touches them. */
export const BASE_CIRCUIT = ['home', 'first', 'second', 'third'] as const;

/** Where a spot is, in feet. Null for `{ fielder }` — that depends on the play. */
export function feetOf(spot: Spot): Feet | null {
  if ('base' in spot) return BASE_FEET[spot.base];
  if ('at' in spot) return feetAt(spot.at[0], spot.at[1]);
  return null;
}

export function spotOfFeet(f: Feet): Spot {
  const distance = Math.hypot(f.x, f.y);
  const angle = distance === 0 ? 0 : Math.atan2(f.x, f.y) / DEG;
  return { at: [round(distance), round(angle)] };
}

/** Where a spot lands on the board. `{ fielder }` needs the play's arrangement. */
export function pointOfFeet(f: Feet): Point {
  return pointAt(...spotFeetPair(f));
}

function spotFeetPair(f: Feet): [number, number] {
  const distance = Math.hypot(f.x, f.y);
  return [distance, distance === 0 ? 0 : Math.atan2(f.x, f.y) / DEG];
}

export function feetBetween(a: Feet, b: Feet): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function unit(from: Feet, to: Feet): Feet {
  const d = feetBetween(from, to);
  if (d === 0) return { x: 0, y: 1 };
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

/** A point `feet` short of `to`, on the line back toward `from`. */
export function shortOf(from: Feet, to: Feet, feet: number): Feet {
  const u = unit(to, from);
  return { x: to.x + u.x * feet, y: to.y + u.y * feet };
}

/** A point `feet` past `to`, on the line from `from` through `to`. */
export function beyond(from: Feet, to: Feet, feet: number): Feet {
  const u = unit(from, to);
  return { x: to.x + u.x * feet, y: to.y + u.y * feet };
}

/**
 * `from` toward `to`, but no further than a fielder can actually run while the
 * play happens. A right fielder breaking in to back up first base does not get
 * to stand behind the bag on a routine ground ball — he gets as far as he gets.
 */
export function towardCapped(from: Feet, to: Feet, maxFeet: number): Feet {
  const d = feetBetween(from, to);
  if (d <= maxFeet) return to;
  const u = unit(from, to);
  return { x: from.x + u.x * maxFeet, y: from.y + u.y * maxFeet };
}

/** Which bag a spot belongs to — the one a runner standing there last touched. */
export function nearestBase(f: Feet): (typeof BASE_CIRCUIT)[number] {
  let best: (typeof BASE_CIRCUIT)[number] = 'home';
  let bestDistance = Infinity;
  for (const base of BASE_CIRCUIT) {
    const d = feetBetween(f, BASE_FEET[base]);
    if (d < bestDistance) {
      bestDistance = d;
      best = base;
    }
  }
  return best;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

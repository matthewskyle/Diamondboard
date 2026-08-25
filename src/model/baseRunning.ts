import { BASES, BASE_PATH_FT, MOUND, pointAt } from './fieldGeometry';
import type { Point } from './path';
import { BASE_CIRCUIT, BASE_FEET, feetOf, nearestBase, pointOfFeet } from './spots';
import type { BaseName, Spot } from './playTypes';

/**
 * How a runner actually gets where he is going.
 *
 * Everything else on the board can tween in a straight line, because a fielder
 * running to a spot does run in a straight line. A runner cannot. He is on the
 * base paths, so a man scoring from second goes by way of third rather than
 * across the mound, and he does not corner a bag like a train changing tracks
 * either: he bows out into the outside of the path a stride before it, brushes
 * the inside corner, and pushes off toward the next one. That bow is the whole
 * difference between a diagram of base running and a diagram of geometry, and
 * it is why a route is a curve of sampled points rather than three straight
 * legs with a kink at each bag.
 */

/** How far off the bag a runner stands before the pitch. */
export const LEAD_FT = 12;

/** How far back along each leg the turn runs, and how far outside the bag it bows. */
const TURN_UNITS = 46;
const SWING_UNITS = 15;
/** Points sampled per side of a turn. Enough to read as a curve, few enough to stay cheap. */
const SAMPLES = 4;

const CENTRE_OF_DIAMOND = pointAt((BASE_PATH_FT * Math.SQRT2) / 2, 0);

const BASE_POINT: Record<BaseName, Point> = {
  home: BASES.home,
  first: BASES.first,
  second: BASES.second,
  third: BASES.third,
  mound: MOUND,
};

/** Where on the circuit a spot sits: home 0, first 1, second 2, third 3. */
function circuitIndex(spot: Spot): number | null {
  const feet = feetOf(spot);
  if (!feet) return null;
  return (BASE_CIRCUIT as readonly BaseName[]).indexOf(nearestBase(feet));
}

/**
 * The bags a runner has to touch on the way, not counting the one he starts on
 * or the one he finishes at. Scoring counts home as the far end of the circuit,
 * so a man on second passes third; a man diving back passes nothing.
 */
export function basesBetween(from: Spot, to: Spot): BaseName[] {
  const start = circuitIndex(from);
  const finish = circuitIndex(to);
  if (start === null || finish === null) return [];

  // Home is both the start and the end of the circuit: a runner already on the
  // bases who reaches it has gone all the way round, not back to the box.
  const end = finish === 0 && start > 0 ? 4 : finish;
  const bases: BaseName[] = [];
  for (let i = start + 1; i < end; i++) bases.push(BASE_CIRCUIT[i % 4]);
  return bases;
}

/** A runner's lead: off the bag, down the line toward the next base. */
export function leadOff(base: BaseName, feet = LEAD_FT): Point {
  const index = (BASE_CIRCUIT as readonly BaseName[]).indexOf(base);
  if (index < 0) return BASE_POINT[base];
  const here = BASE_FEET[base];
  const next = BASE_FEET[BASE_CIRCUIT[(index + 1) % 4]];
  const d = Math.hypot(next.x - here.x, next.y - here.y);
  const t = feet / d;
  return pointOfFeet({ x: here.x + (next.x - here.x) * t, y: here.y + (next.y - here.y) * t });
}

/**
 * The route a runner runs: his start, every bag he has to touch, and where he
 * finishes — with the turns bowed out the way a runner bows them.
 */
export function runnerRoute(from: Point, to: Point, through: readonly BaseName[]): Point[] {
  const bags = through.map((base) => BASE_POINT[base]);
  if (bags.length === 0) return [from, to];

  const stops = [from, ...bags, to];
  const route: Point[] = [from];
  for (let i = 0; i < bags.length; i++) {
    const bag = bags[i];
    const previous = stops[i];
    const next = stops[i + 2];
    const turn = Math.min(TURN_UNITS, distance(previous, bag) * 0.4, distance(bag, next) * 0.4);
    const swing = Math.min(SWING_UNITS, turn * 0.4);
    route.push(...bow(previous, bag, turn, swing, 'in'));
    // The bag itself, because a runner who does not touch it is not safe.
    route.push(bag);
    route.push(...bow(bag, next, turn, swing, 'out'));
  }
  route.push(to);
  return route;
}

/**
 * The bowed part of one leg: samples that leave the straight line by `swing` at
 * the middle of the turn and rejoin it at the bag. On the way in the turn is the
 * last `turn` units of the leg, on the way out the first.
 */
function bow(
  from: Point,
  to: Point,
  turn: number,
  swing: number,
  half: 'in' | 'out',
): Point[] {
  if (turn <= 0 || swing <= 0) return [];
  const along = direction(from, to);
  const span = distance(from, to);
  if (span === 0) return [];
  // The bag is the end of an inbound leg and the start of an outbound one, and
  // the bow is measured from it either way.
  const corner = half === 'in' ? to : from;
  const out = outward(along, corner);

  const points: Point[] = [];
  for (let i = 1; i <= SAMPLES; i++) {
    // Distance from the bag, walking outward for the inbound half and inward
    // for the outbound one, so both halves are sampled toward the bag.
    const d = half === 'in' ? turn * (1 - (i - 1) / SAMPLES) : (turn * i) / SAMPLES;
    const base = half === 'in' ? -d : d;
    const off = swing * Math.sin((Math.PI * d) / turn);
    points.push({
      x: corner.x + along.x * base + out.x * off,
      y: corner.y + along.y * base + out.y * off,
    });
  }
  return points;
}

/** Perpendicular to the run, on the side away from the middle of the diamond. */
function outward(along: Point, at: Point): Point {
  const perpendicular = { x: -along.y, y: along.x };
  const away = { x: at.x - CENTRE_OF_DIAMOND.x, y: at.y - CENTRE_OF_DIAMOND.y };
  const facing = perpendicular.x * away.x + perpendicular.y * away.y;
  return facing >= 0 ? perpendicular : { x: -perpendicular.x, y: -perpendicular.y };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function direction(from: Point, to: Point): Point {
  const d = distance(from, to);
  if (d === 0) return { x: 0, y: 0 };
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

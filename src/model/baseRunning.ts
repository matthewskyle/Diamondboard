import { BASE_PATH_FT } from './fieldGeometry';
import type { Point } from './path';
import {
  BASE_CIRCUIT,
  BASE_FEET,
  feetBetween,
  nearestBase,
  pointOfFeet,
  type Feet,
} from './spots';
import type { BaseName } from './playTypes';

/**
 * How a runner actually gets where he is going.
 *
 * Everything else on the board can tween in a straight line, because a fielder
 * running to a spot does run in a straight line. A runner cannot. He is on the
 * base paths, so a man scoring from second goes by way of third rather than
 * across the mound, and he does not corner a bag like a train changing tracks
 * either: he bows out into the outside of the path a stride before it, brushes
 * the inside corner, and pushes off toward the next one. That bow is the whole
 * difference between a diagram of base running and a diagram of geometry.
 *
 * All of it is worked out in feet and handed to the field's projection at the
 * end. It has to be. The board is drawn foreshortened, so a right angle at
 * first base is not a right angle on screen and a perpendicular measured on
 * screen is not perpendicular to anything — a bow built in view units comes out
 * a different shape at first than at third, which is exactly the tell that a
 * runner is following a curve somebody drew rather than a path he ran.
 */

/** How far off the bag a runner stands before the pitch. */
export const LEAD_FT = 12;

/**
 * How far out from the bag the turn begins, and how much of a leg it may eat so
 * that a short leg is not all corner. Thirty-odd feet is where a runner starts
 * his arc — about two thirds of the way down a ninety foot path.
 */
const TURN_FT = 32;
const TURN_SHARE = 0.4;

/**
 * How far the turn carries the runner outside the straight path, as a share of
 * its length.
 *
 * Not a free choice. The curve has two jobs: leave the base path without a kink
 * a stride or two out, and reach the bag at forty-five degrees to it — halfway
 * through a ninety degree turn is what "already heading for the next one"
 * means, and it is also what makes the two halves meet smoothly on the bag.
 * Those two conditions fix the bulge at four twenty-sevenths of the run-up,
 * which on a thirty-two foot turn is about five feet outside the line. That is
 * what a turn at first base looks like from the stands.
 */
const SWING_SHARE = 4 / 27;
export const SWING_FT = TURN_FT * SWING_SHARE;

/**
 * The most a runner's heading may change from one stride of the drawn route to
 * the next.
 *
 * The route is a polyline, so every vertex is a corner; this is how sharp a
 * corner is allowed to be. It is the reason the strides are placed by how hard
 * the curve is bending rather than at even distances: nearly all of the turning
 * happens within a few feet of the bag, so even spacing spends its points out
 * where the path is already straight and leaves the bag itself a corner — which
 * is the thing the bow exists to get rid of.
 */
const MAX_TURN_DEG = 7;

/** How finely the curve is walked before the strides are picked off it. */
const WALK_STEPS = 120;

const CENTRE_OF_DIAMOND: Feet = { x: 0, y: (BASE_PATH_FT * Math.SQRT2) / 2 };

/** Where on the circuit a spot sits: home 0, first 1, second 2, third 3. */
function circuitIndex(feet: Feet): number {
  return (BASE_CIRCUIT as readonly BaseName[]).indexOf(nearestBase(feet));
}

/**
 * The bags a runner has to touch on the way, not counting the one he starts on
 * or the one he finishes at. Scoring counts home as the far end of the circuit,
 * so a man on second passes third; a man diving back passes nothing.
 */
export function basesBetween(from: Feet, to: Feet): BaseName[] {
  const start = circuitIndex(from);
  // Home is both the start and the end of the circuit: a runner already on the
  // bases who reaches it has gone all the way round, not back to the box.
  const finish = circuitIndex(to);
  const end = finish === 0 && start > 0 ? 4 : finish;
  const bases: BaseName[] = [];
  for (let i = start + 1; i < end; i++) bases.push(BASE_CIRCUIT[i % 4]);
  return bases;
}

/** A runner's lead: off the bag, down the line toward the next base. */
export function leadOff(base: BaseName, feet = LEAD_FT): Feet {
  const index = (BASE_CIRCUIT as readonly BaseName[]).indexOf(base);
  if (index < 0) return BASE_FEET[base];
  const here = BASE_FEET[base];
  const next = BASE_FEET[BASE_CIRCUIT[(index + 1) % 4]];
  const t = feet / feetBetween(here, next);
  return { x: here.x + (next.x - here.x) * t, y: here.y + (next.y - here.y) * t };
}

/**
 * The route a runner runs, in feet: his start, every bag he has to touch, and
 * where he finishes — with the turns bowed out the way a runner bows them.
 */
export function runnerRouteFeet(from: Feet, to: Feet, through: readonly BaseName[]): Feet[] {
  const bags = through.map((base) => BASE_FEET[base]);
  if (bags.length === 0) return [from, to];

  const stops = [from, ...bags, to];
  const route: Feet[] = [from];
  for (let i = 0; i < bags.length; i++) {
    const bag = bags[i];
    const previous = stops[i];
    const next = stops[i + 2];
    const turn = Math.min(
      TURN_FT,
      feetBetween(previous, bag) * TURN_SHARE,
      feetBetween(bag, next) * TURN_SHARE,
    );
    route.push(...bow(previous, bag, turn, 'in'));
    // The bag itself, because a runner who does not touch it is not safe.
    route.push(bag);
    route.push(...bow(bag, next, turn, 'out'));
  }
  route.push(to);
  return route;
}

/** The same route, projected onto the board. */
export function runnerRoute(from: Feet, to: Feet, through: readonly BaseName[]): Point[] {
  return runnerRouteFeet(from, to, through).map(pointOfFeet);
}

/**
 * Half a turn: the last `turn` feet of the leg coming in, or the first `turn`
 * feet of the leg going out, bowed away from the diamond. The bag itself is not
 * included — whoever asked for the half already has it.
 */
function bow(from: Feet, to: Feet, turn: number, half: 'in' | 'out'): Feet[] {
  if (turn <= 0 || feetBetween(from, to) === 0) return [];
  const along = direction(from, to);
  // The bag is the end of an inbound leg and the start of an outbound one, and
  // the bow is measured from it either way.
  const corner = half === 'in' ? to : from;
  const out = outward(along, corner);
  const sign = half === 'in' ? -1 : 1;

  const strides = stridesAlong(turn).map((d) => {
    const off = offTheLine(d, turn);
    return {
      x: corner.x + along.x * sign * d + out.x * off,
      y: corner.y + along.y * sign * d + out.y * off,
    };
  });
  // Coming in, the far end of the turn is where the runner gets to it first.
  return half === 'in' ? strides.reverse() : strides;
}

/**
 * Where along the turn the drawn strides fall, near end first: every point at
 * which the runner has turned another `MAX_TURN_DEG`, plus the far end where
 * the curve rejoins the straight path.
 *
 * It totals up the turning rather than comparing the lean at the two ends of a
 * stride, because the lean does not run one way. The runner swings out, levels
 * off, and comes back, so a stride can begin and end at much the same angle
 * having swung ten degrees in between — and a stride placed on that reading is
 * a stride that visibly cuts the corner it was supposed to round.
 */
function stridesAlong(turn: number): number[] {
  const limit = (MAX_TURN_DEG * Math.PI) / 180;
  const out: number[] = [];
  let previous = leanAt(0, turn);
  let turned = 0;
  for (let i = 1; i <= WALK_STEPS; i++) {
    const d = (turn * i) / WALK_STEPS;
    const lean = leanAt(d, turn);
    turned += Math.abs(lean - previous);
    previous = lean;
    if (i === WALK_STEPS || turned >= limit) {
      out.push(d);
      turned = 0;
    }
  }
  return out;
}

/**
 * How far outside the straight path the runner is, `d` feet from the bag. Zero
 * at both ends, and one-to-one at the bag — a foot out for every foot along,
 * which is the forty-five degrees that carries him into the next leg.
 */
function offTheLine(d: number, turn: number): number {
  const remaining = 1 - d / turn;
  return d * remaining * remaining;
}

/**
 * Which way the curve is leaning `d` feet from the bag, as an angle off the
 * straight path: the slope of `offTheLine`, differentiated rather than measured
 * so that placing the strides costs nothing.
 */
function leanAt(d: number, turn: number): number {
  const x = d / turn;
  return Math.atan((1 - x) * (1 - 3 * x));
}

/** Perpendicular to the run, on the side away from the middle of the diamond. */
function outward(along: Feet, at: Feet): Feet {
  const perpendicular = { x: -along.y, y: along.x };
  const away = { x: at.x - CENTRE_OF_DIAMOND.x, y: at.y - CENTRE_OF_DIAMOND.y };
  const facing = perpendicular.x * away.x + perpendicular.y * away.y;
  return facing >= 0 ? perpendicular : { x: -perpendicular.x, y: -perpendicular.y };
}

function direction(from: Feet, to: Feet): Feet {
  const d = feetBetween(from, to);
  if (d === 0) return { x: 0, y: 0 };
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

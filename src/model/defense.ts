import { FIELDER_SPOTS } from './fieldGeometry';
import type { BaseName, PlayDef, Spot } from './playTypes';
import {
  BASE_FEET,
  beyond,
  feetAt,
  feetBetween,
  feetOf,
  shortOf,
  spotOfFeet,
  towardCapped,
  type Feet,
} from './spots';

/**
 * Who does what, worked out from the play rather than written into it.
 *
 * A play says the things only a coach can say: what the batter did, where the
 * ball went, who charges. Everything after that is doctrine, and doctrine does
 * not change from play to play — the cut man on a throw home from left is the
 * third baseman, the shortstop takes the bag he left, the right fielder gets
 * behind every throw to first, the pitcher is behind whichever base the throw
 * is going to. Deriving it means all 150 plays agree with each other, and that
 * fixing a responsibility fixes it everywhere at once.
 *
 * Sources for the standard alignment. They agree with each other, and this file
 * follows them:
 *  - QCBaseball, *Cutoffs — runner on second*: "On a single to left field the
 *    third baseman will be the cutoff to home. The shortstop will cover third
 *    base. The pitcher will backup home." On a single to centre or right, the
 *    first baseman has the cut and the third baseman stays at third.
 *  - Pro Baseball Insider, *Third base positioning for relays*: "The only time
 *    you will need to be a cut off man is when there is a play at home plate and
 *    a ball is hit to the left fielder", and — the rule that decides a double
 *    cut — "The 3rd baseman is the lead cut-off man of a double cut: never. You
 *    are covering third base."
 *  - CoachUp, *Hitting the cutoff man*: the shortstop lines up throws from left
 *    to second and third and from centre to third; the second baseman lines up
 *    throws from right to second and third.
 *
 * Two consequences worth naming, because they are what a coach notices when a
 * diagram is wrong. A cut man stands 45 feet off the bag he is protecting, not
 * out where a shortstop plays; and the man who leaves a bag to cut a throw has
 * somebody behind him on it.
 */

/** The cut man stands 40–50 feet off the bag: close enough to redirect, far enough to decide. */
export const CUT_FROM_BASE_FT = 45;
/**
 * A relay man goes out to meet a throw nobody can make in one. Far enough out
 * to shorten it, never so far that his own throw is the new problem.
 */
export const RELAY_MIN_FROM_BASE_FT = 120;
export const RELAY_MAX_FROM_BASE_FT = 200;
/**
 * A ball fielded beyond this is off the wall or in the corner: too far for one
 * throw, so the middle man goes out to meet it instead of lining it up in front
 * of the bag. Set between the depth an outfielder plays and the fence.
 */
export const RELAY_DEPTH_FT = 310;
/** How far out a fielder has to be before he is relaying rather than cutting. */
export const RELAY_NOT_CUT_FT = 80;
/** Backing something up means getting behind it, in line with the throw. */
export const BACKUP_BEHIND_FT = 30;
export const BACKUP_BEHIND_FIELDER_FT = 34;
/** How far a fielder can actually run while the play happens. */
export const OUTFIELD_RUN_FT = 95;
export const CATCHER_RUN_FT = 55;
export const PITCHER_RUN_FT = 120;
/** Close enough to a bag to count as covering it. */
export const AT_BASE_FT = 9;
/** Inside this, a fielder the play moved forward is charging the ball. */
const CHARGE_INSIDE_FT = 90;

export const OUTFIELD = ['LF', 'CF', 'RF'] as const;

const DEFAULT_FEET: Record<string, Feet> = Object.fromEntries(
  FIELDER_SPOTS.map((spot) => [spot.label, feetAt(spot.feet, spot.angle)]),
);

/**
 * How the ball reached a fielder — a throw is caught differently from a liner,
 * and a fielder who already has it is not catching anything at all.
 */
export type Arrival = 'batted' | 'pitch' | 'loose' | 'throw' | 'held';

export type JobKind =
  /** Goes to the ball. */
  | 'field'
  /** Goes out to meet a long throw and turns it around. */
  | 'relay'
  /** Lines up between the throw and the bag, and may take it. */
  | 'cut'
  /** Stands on the bag and takes the throw. */
  | 'receive'
  /** Stands on the bag; the throw may never come. */
  | 'cover'
  /** Owns the plate and calls the cut. */
  | 'call'
  /** Gets behind the bag, or behind the fielder, in case it gets by. */
  | 'backup'
  /** Comes in on the plate for a ball nobody has time to wait on. */
  | 'charge'
  /** Shades off his normal spot because this play wants him somewhere else. */
  | 'shift'
  | 'idle';

export interface Job {
  kind: JobKind;
  /** The bag this job is about. */
  base?: BaseName;
  /** Where the ball goes next, for a fielder who has it. */
  next?: Spot;
  arrival?: Arrival;
  /** For a backup: the fielder being backed up, when it is not a base. */
  behind?: string;
  /** True when the play threw to this fielder by name rather than to a bag. */
  named?: boolean;
}

export interface Defense {
  /** Where every fielder who moves ends up. */
  spots: Record<string, Spot>;
  jobs: Record<string, Job>;
}

/** A stop on the ball's route that is a bag somebody threw to. */
export interface Throw {
  base: BaseName;
  thrower: string | null;
  /** True for the bag the throw was lined up for but never reached. */
  intended?: boolean;
}

// --- Doctrine -------------------------------------------------------------

/** Which side of second base a ball is on. Straight up the middle counts as centre. */
export function sideOf(feet: Feet): 'left' | 'centre' | 'right' {
  const angle = Math.atan2(feet.x, feet.y) * (180 / Math.PI);
  if (angle < -6) return 'left';
  if (angle > 6) return 'right';
  return 'centre';
}

/**
 * The cut man on a throw from the outfield to a base, in preference order.
 *
 * To the plate it is the corner nearest the ball: the third baseman on a ball
 * the left fielder handles, the first baseman on anything to centre or right.
 * Behind a relay man it is always the first baseman — a third baseman is never
 * the front half of a double cut, because on a ball that deep he is standing on
 * third waiting for the runner behind the one that is scoring.
 *
 * To second or third it is the middle infielder on the ball's side, who is
 * already moving that way and can keep the runner in front of him. That leaves
 * each bag to the man who is not looking away from it.
 *
 * Nobody cuts a throw to first base — it is short, and the bag has an owner.
 */
export function cutManFor(
  base: BaseName,
  fielder: string,
  feet: Feet,
  behindRelay = false,
): string[] {
  if (base === 'first' || base === 'mound') return [];
  if (base === 'home') {
    if (behindRelay) return ['1B'];
    return fielder === 'LF' ? ['3B', '1B'] : ['1B', '3B'];
  }
  return sideOf(feet) === 'right' ? ['2B', 'SS'] : ['SS', '2B'];
}

/** The middle infielder who goes out as the relay man on a ball to the wall. */
export function relayManFor(ball: Spot): string {
  const feet = feetOf(ball);
  return feet && sideOf(feet) === 'right' ? '2B' : 'SS';
}

/**
 * Who covers a bag a throw is coming to, in preference order.
 *
 * On a ball to the outfield the infield splits the bags between the four of
 * them and the pitcher and catcher stay out of it — they have a throw to get
 * behind and a plate to own. On an infield ground ball the pitcher is part of
 * the coverage: every ball to the right side, he breaks for first.
 */
function coverFor(base: BaseName, ball: Feet, thrower: string | null, outfield: boolean): string[] {
  switch (base) {
    case 'home':
      return outfield ? ['C'] : ['C', 'P', '1B'];
    case 'first':
      if (outfield) return ['1B', '2B'];
      // Every ground ball to the right side, the pitcher breaks for first.
      return thrower && ['1B', '2B', 'P'].includes(thrower)
        ? ['1B', 'P', '2B']
        : ['1B', '2B', 'P'];
    case 'second':
      // The middle infielder away from the ball takes the bag.
      return sideOf(ball) === 'left' ? ['2B', 'SS', '1B'] : ['SS', '2B', '1B'];
    case 'third':
      // Not the pitcher: on any throw to third he is behind the bag, not on it.
      return ['3B', 'SS'];
    case 'mound':
      return ['P'];
  }
}

/** The bag a fielder leaves uncovered when he goes out to cut or relay. */
const HOME_BASE_OF: Record<string, BaseName> = {
  '1B': 'first',
  '2B': 'second',
  SS: 'second',
  '3B': 'third',
  C: 'home',
};

/**
 * Who takes a bag whose owner went out to cut the throw, in preference order.
 * Never the pitcher, except at the plate: he has a backup to get to.
 */
const RELIEF_FOR: Record<string, string[]> = {
  '1B': ['2B'],
  '2B': ['SS'],
  SS: ['2B'],
  '3B': ['SS', '2B'],
  C: ['P'],
};

/**
 * Who else gets behind a bag a throw is going to, after the pitcher — the
 * outfielder in front of it. The right fielder trails every throw to first,
 * the centre fielder every throw to second, the left fielder every throw to
 * third. With nobody else on, the catcher trails the batter up the line.
 */
function backupFor(base: BaseName, runnersOn: boolean): string[] {
  switch (base) {
    case 'home':
      return [];
    case 'third':
      return ['LF'];
    case 'second':
      return ['CF'];
    case 'first':
      return runnersOn ? ['RF'] : ['RF', 'C'];
    case 'mound':
      return [];
  }
}

/**
 * Is the lone man between the outfielder and the bag going out to meet the
 * throw, or lining it up in front of the bag?
 *
 * A throw to the plate always has a cut man 45 feet off it, however far out the
 * ball is — that is the spot the catcher's call depends on, and a double cut
 * adds a relay behind him rather than moving him. A ball somebody caught is
 * never relayed either: he has it, and he throws it. What gets relayed is a ball
 * on the ground that got past everybody, where one throw will not reach.
 */
function isRelayBall(play: PlayDef, ball: Feet, target: BaseName): boolean {
  if (target === 'home') return false;
  if (play.category === 'Fly balls') return false;
  return distanceFromHome(ball) > RELAY_DEPTH_FT;
}

/** Which outfielder covers the ground a batted ball landed on. */
function outfieldZone(ball: Feet): string {
  const side = sideOf(ball);
  return side === 'left' ? 'LF' : side === 'right' ? 'RF' : 'CF';
}

/** The outfielder who backs up a catch, and the order to try. */
function outfieldSupport(fielder: string, ball: Feet): string[] {
  if (fielder === 'CF') return sideOf(ball) === 'right' ? ['RF', 'LF'] : ['LF', 'RF'];
  return ['CF', fielder === 'LF' ? 'RF' : 'LF'];
}

/**
 * How far a relay man sets up from the bag he is throwing at: about half the
 * distance, so the two throws are the same length, and inside the range a
 * middle infielder can actually cover the ball on.
 */
function relayDistance(gap: number): number {
  return Math.min(Math.max(gap * 0.5, RELAY_MIN_FROM_BASE_FT), RELAY_MAX_FROM_BASE_FT);
}

/**
 * Where a relay man sets up: out toward the ball on the line to the bag, so the
 * outfielder has someone to throw to and the bag has someone throwing at it.
 */
export function relaySpot(ball: Feet, base: BaseName): Spot {
  const gap = feetBetween(ball, BASE_FEET[base]);
  return spotOfFeet(shortOf(ball, BASE_FEET[base], relayDistance(gap)));
}

/**
 * Where the cut man stands: on the line from the ball to the bag, 45 feet off
 * it. Not in the hole at short and not on top of the bag — the two ways a
 * diagram of a cutoff stops being a diagram of a cutoff.
 */
export function cutSpot(ball: Feet, base: BaseName): Spot {
  return spotOfFeet(shortOf(ball, BASE_FEET[base], CUT_FROM_BASE_FT));
}

/** Where a backup stands: behind the bag, in line with the throw coming to it. */
export function backupSpot(ball: Feet, base: BaseName, feetBehind = BACKUP_BEHIND_FT): Spot {
  return spotOfFeet(beyond(ball, BASE_FEET[base], feetBehind));
}

export function isOutfield(label: string): boolean {
  return (OUTFIELD as readonly string[]).includes(label);
}

/**
 * Is this stop the pitch itself — the ball crossing the plate — rather than a
 * throw somebody made? Nobody covers the plate for a pitch and nobody backs it
 * up; the catcher simply catches it and the play starts from there.
 */
function isPitch(route: readonly Spot[], index: number): boolean {
  const stop = route[index];
  const previous = route[index - 1];
  return (
    index > 0 &&
    'base' in stop &&
    stop.base === 'home' &&
    previous !== undefined &&
    'base' in previous &&
    previous.base === 'mound'
  );
}

/**
 * Every bag the ball is thrown to, and who threw it. The pitch is not a throw,
 * and a bag the play only aimed at counts: a cut man who fires behind the
 * runner still had the plate lined up, and the plate still needed covering.
 */
export function throwTargets(play: PlayDef): Throw[] {
  const route = play.ball;
  const out: Throw[] = [];
  for (let i = 1; i < route.length; i++) {
    const stop = route[i];
    if (!('base' in stop) || isPitch(route, i)) continue;
    out.push({ base: stop.base, thrower: lastHandlerBefore(route, i) });
  }
  if (play.aim && !out.some((t) => t.base === play.aim)) {
    out.unshift({ base: play.aim, thrower: firstFielderOf(route), intended: true });
  }
  return out;
}

// --- Assignment -----------------------------------------------------------

const cache = new WeakMap<PlayDef, Defense>();

/** Everything the defence does on a play: where each fielder goes, and why. */
export function assignDefense(play: PlayDef): Defense {
  const hit = cache.get(play);
  if (hit) return hit;
  const defense = assign(play);
  cache.set(play, defense);
  return defense;
}

function assign(play: PlayDef): Defense {
  const authored: Record<string, Spot> = { ...(play.moves ?? {}) };
  const spots: Record<string, Spot> = { ...authored };
  const jobs: Record<string, Job> = {};
  const busy = new Set<string>();

  function fielderFeet(label: string): Feet {
    const spot = spots[label];
    return spot ? stopFeet(spot) : (DEFAULT_FEET[label] ?? { x: 0, y: 0 });
  }

  function stopFeet(stop: Spot): Feet {
    if ('fielder' in stop) return fielderFeet(stop.fielder);
    return feetOf(stop) ?? { x: 0, y: 0 };
  }

  /** Is a fielder standing on this bag? */
  function coversBase(label: string, base: BaseName): boolean {
    return spots[label] !== undefined && feetBetween(fielderFeet(label), BASE_FEET[base]) <= AT_BASE_FT;
  }

  function covered(base: BaseName): string | undefined {
    return Object.keys(spots).find((label) => coversBase(label, base));
  }

  /**
   * The first man on the list who is free to take a doctrine job. A play that
   * has already sent him to a bag is a play that means it, so he stays; a play
   * that has only shaded him somewhere loses the argument, because a cut man 45
   * feet off the bag and a cut man out where a shortstop plays are not the same
   * job, and the second one is how a diagram ends up with the wrong man in it.
   */
  function claim(order: readonly string[]): string | null {
    for (const label of order) {
      if (busy.has(label)) continue;
      if (spots[label] && baseOf(spots[label])) continue;
      return label;
    }
    return null;
  }

  /** The first free man on the list, leaving anybody the play placed alone. */
  function claimFree(order: readonly string[]): string | null {
    return order.find((label) => !busy.has(label) && !spots[label]) ?? null;
  }

  function take(label: string, spot: Spot, job: Job): void {
    spots[label] = spot;
    jobs[label] = job;
    busy.add(label);
  }

  const route = play.ball;
  const runners = play.runners ?? [];
  const runnersOn = runners.length > 0;
  const batted = 'base' in route[0] && route[0].base === 'home' && play.batterTo !== undefined;
  const touches = route.flatMap((stop, i) => ('fielder' in stop ? [i] : []));
  const fielderOfBall = touches.length > 0 ? labelOf(route[touches[0]]) : null;

  // Where the ball was put in play. Settled before anything else, because every
  // cut man, relay man and backup on the play is placed on a line drawn from it.
  // A play that does not say where its fielder went to get it says so by the
  // stop before him: a batted-ball spot, or the plate.
  if (fielderOfBall && !spots[fielderOfBall]) {
    const previous = route[touches[0] - 1];
    if (previous && !('fielder' in previous)) spots[fielderOfBall] = previous;
  }
  const ballFeet = touches.length > 0 ? stopFeet(route[touches[0]]) : stopFeet(route[0]);
  const fromOutfield = fielderOfBall !== null && isOutfield(fielderOfBall);
  const throws = throwTargets(play);

  // 1. A ball that starts on a base already belongs to somebody: the catcher
  //    behind the plate, the pitcher picking a runner off, whoever is standing
  //    on the bag in a rundown. He is the one who throws it.
  const origin = originThrower(route, batted);
  if (origin) {
    const label = covered(origin) ?? OWNER_OF[origin];
    if (label && !busy.has(label)) {
      take(label, spots[label] ?? { base: origin }, {
        kind: 'field',
        next: route[1],
        arrival: 'held',
      });
    }
  }

  // 2. Whoever touches the ball. The first one goes and gets it; anyone after
  //    him is a relay or cut man on the way to a bag, or the man taking the
  //    throw at the end of it.
  for (const i of touches) {
    const label = labelOf(route[i])!;
    const next: Spot | undefined = route[i + 1];
    const previous = route[i - 1];

    if (i === touches[0]) {
      jobs[label] = { kind: 'field', next, arrival: arrivalOf(previous, batted) };
      busy.add(label);
      continue;
    }

    // The end of the line: whoever the ball was thrown to. He is taking it at a
    // bag unless the play says the throw was lined up somewhere else, in which
    // case he is the cut man and the throw stopped with him.
    if (!next) {
      const onBase = baseOf(spots[label]);
      if (!onBase && play.aim) {
        take(label, cutSpot(ballFeet, play.aim), { kind: 'cut', base: play.aim });
      } else {
        take(label, spots[label] ?? { base: onBase ?? 'mound' }, {
          kind: 'receive',
          base: onBase,
          arrival: 'throw',
          named: true,
        });
      }
      continue;
    }

    // A middle man on the way to a bag. Where he stands is what he is doing:
    // 45 feet off the bag is a cut, out in the grass is a relay.
    const target = play.aim ?? nextBaseAfter(route, i) ?? 'home';
    const cutting = isLastIntermediate(route, i) && !isRelayBall(play, ballFeet, target);
    const spot = spots[label] && baseOf(spots[label])
      ? spots[label]
      : cutting
        ? cutSpot(ballFeet, target)
        : relaySpot(ballFeet, target);
    const off = feetBetween(stopFeet(spot), BASE_FEET[target]);
    take(label, spot, {
      kind: off > RELAY_NOT_CUT_FT ? 'relay' : 'cut',
      base: target,
      next,
    });
  }

  // 2b. The catcher takes the pitch, so the next throw is his.
  for (let i = 1; i < route.length - 1; i++) {
    if (!isPitch(route, i) || busy.has('C')) continue;
    take('C', spots['C'] ?? { base: 'home' }, {
      kind: 'field',
      next: route[i + 1],
      arrival: 'pitch',
    });
  }

  // 3. The cut man. Every throw in from the outfield has one, whether or not it
  //    ends up being cut: he lines it up and the bag lines him up.
  for (const { base, thrower } of throws) {
    if (!thrower || !isOutfield(thrower)) continue;
    if (Object.values(jobs).some((job) => job.kind === 'cut' && job.base === base)) continue;
    const behindRelay = Object.values(jobs).some((job) => job.kind === 'relay');
    const label = claim(cutManFor(base, thrower, ballFeet, behindRelay));
    if (!label) continue;
    take(label, cutSpot(ballFeet, base), { kind: 'cut', base });
  }

  // 4. Bags the ball is actually thrown to. Somebody has to be standing on them.
  for (const { base, thrower, intended } of throws) {
    if (intended) continue;
    const already = covered(base);
    if (already) {
      if (already !== thrower && !busy.has(already)) {
        take(already, spots[already], { kind: 'receive', base, arrival: 'throw' });
      }
      continue;
    }
    const label = claimFree(coverFor(base, ballFeet, thrower, fromOutfield));
    if (!label) continue;
    take(label, { base }, { kind: 'receive', base, arrival: 'throw' });
  }

  // 5. Any ball to the outfield: the infielders who are not lining up a throw
  //    stand on a bag. Third first, because the lead runner matters most, and
  //    first last, because the batter is the runner furthest from it.
  if (fromOutfield && (play.batterTo || runnersOn)) {
    for (const base of ['third', 'second', 'first'] as const) {
      if (covered(base)) continue;
      const label = claimFree(coverFor(base, ballFeet, fielderOfBall, true));
      if (label) take(label, { base }, { kind: 'cover', base });
    }
  }

  // 5b. Somebody is on first base whenever there is a batter running to it.
  //     The throw may never come, and it does not matter: an uncovered bag with
  //     a runner heading for it is not a defence.
  if (play.batterTo && !covered('first')) {
    const label = claimFree(coverFor('first', ballFeet, fielderOfBall, fromOutfield));
    if (label) take(label, { base: 'first' }, { kind: 'cover', base: 'first' });
  }

  // 6. Bags left empty by the men who went out to cut or relay.
  for (const [label, job] of Object.entries(jobs)) {
    if (job.kind !== 'cut' && job.kind !== 'relay') continue;
    const vacated = HOME_BASE_OF[label];
    if (!vacated || vacated === job.base || covered(vacated)) continue;
    const relief = claimFree(RELIEF_FOR[label] ?? []);
    if (relief) take(relief, { base: vacated }, { kind: 'cover', base: vacated });
  }

  // 7. The pitcher. He is behind whichever bag the throw is going to — the last
  //    one, because that is where the play ends — and behind the plate on
  //    anything that leaves the infield. He never watches. A play that has
  //    already put him on a bag has him covering it, and keeps him there.
  if (!busy.has('P') && !baseOf(spots['P'])) {
    const last = throws[throws.length - 1];
    const target =
      play.aim ?? (last && last.base !== 'mound' ? last.base : fromOutfield ? 'home' : null);
    if (target) {
      const from = throwOriginFor(target);
      take(
        'P',
        spotOfFeet(
          towardCapped(
            DEFAULT_FEET['P'],
            beyond(from, BASE_FEET[target], BACKUP_BEHIND_FT),
            PITCHER_RUN_FT,
          ),
        ),
        { kind: 'backup', base: target },
      );
    }
  }

  // 8. The catcher. The plate is his on anything that could bring a runner to
  //    it, and it is his voice that decides whether a throw gets cut. With
  //    nobody on he has no plate to guard, so he trails the batter up the line.
  if (!busy.has('C') && !spots['C'] && touches.length > 0) {
    const calling = Object.values(jobs).some((job) => job.kind === 'cut' || job.kind === 'relay');
    if (!runnersOn && play.batterTo) {
      take(
        'C',
        spotOfFeet(towardCapped(DEFAULT_FEET['C'], BASE_FEET.first, CATCHER_RUN_FT)),
        { kind: 'backup', base: 'first' },
      );
    } else if (runnersOn) {
      take('C', { base: 'home' }, { kind: calling ? 'call' : 'cover', base: 'home' });
    }
  }

  // 9. Backing up the throws, outfielder by outfielder.
  for (const { base } of throws) {
    const label = claimFree(backupFor(base, runnersOn));
    if (!label) continue;
    const behind = isOutfield(label) ? BACKUP_BEHIND_FT * 2 : BACKUP_BEHIND_FT;
    take(
      label,
      spotOfFeet(
        towardCapped(
          DEFAULT_FEET[label],
          beyond(throwOriginFor(base), BASE_FEET[base], behind),
          runLimitFor(label),
        ),
      ),
      { kind: 'backup', base },
    );
  }

  // 10. And behind the man going to the ball, because the ball gets through.
  if (fielderOfBall) {
    const order = fromOutfield
      ? outfieldSupport(fielderOfBall, ballFeet)
      : [outfieldZone(ballFeet)];
    const label = claimFree(order);
    if (label) {
      const target = beyond(BASE_FEET.home, ballFeet, BACKUP_BEHIND_FIELDER_FT);
      take(
        label,
        spotOfFeet(towardCapped(DEFAULT_FEET[label], target, runLimitFor(label))),
        { kind: 'backup', behind: fielderOfBall },
      );
    }
  }

  // 11. Anyone the play moved without saying why. A bag is coverage; a spot in
  //     front of his own is a charge; anything else is a shade.
  for (const { label } of FIELDER_SPOTS) {
    if (jobs[label]) continue;
    const spot = spots[label];
    if (!spot) {
      jobs[label] = { kind: 'idle' };
      continue;
    }
    const base = baseOf(spot);
    if (base) {
      jobs[label] = { kind: 'cover', base };
      continue;
    }
    // Charging is coming in on the plate, not shading over: a second baseman
    // twenty feet in is still playing second base.
    const here = stopFeet(spot);
    const charging =
      distanceFromHome(here) < CHARGE_INSIDE_FT &&
      distanceFromHome(here) < distanceFromHome(DEFAULT_FEET[label]) - 25;
    jobs[label] = { kind: charging ? 'charge' : 'shift' };
  }

  return { spots, jobs };

  /** Where a throw to this bag comes from, so a backup knows which side to be on. */
  function throwOriginFor(base: BaseName): Feet {
    for (let i = route.length - 1; i > 0; i--) {
      const stop = route[i];
      if ('base' in stop && stop.base === base && !isPitch(route, i)) return stopFeet(route[i - 1]);
    }
    return ballFeet;
  }
}

function distanceFromHome(f: Feet): number {
  return Math.hypot(f.x, f.y);
}

function runLimitFor(label: string): number {
  if (isOutfield(label)) return OUTFIELD_RUN_FT;
  if (label === 'C') return CATCHER_RUN_FT;
  if (label === 'P') return PITCHER_RUN_FT;
  return Infinity;
}

function labelOf(stop: Spot): string | null {
  return 'fielder' in stop ? stop.fielder : null;
}

function firstFielderOf(route: readonly Spot[]): string | null {
  const stop = route.find((s) => 'fielder' in s);
  return stop ? labelOf(stop) : null;
}

function baseOf(spot: Spot | undefined): BaseName | undefined {
  if (!spot) return undefined;
  if ('base' in spot) return spot.base;
  const feet = feetOf(spot);
  if (!feet) return undefined;
  for (const [base, at] of Object.entries(BASE_FEET) as [BaseName, Feet][]) {
    if (feetBetween(feet, at) <= AT_BASE_FT) return base;
  }
  return undefined;
}

function arrivalOf(previous: Spot | undefined, batted: boolean): Arrival {
  if (!previous) return 'held';
  if ('base' in previous) {
    if (previous.base === 'home') return batted ? 'batted' : 'throw';
    if (previous.base === 'mound') return 'pitch';
    return 'throw';
  }
  if ('at' in previous) return 'loose';
  return 'throw';
}

/** Who owns a bag when the play says nothing else. */
const OWNER_OF: Record<BaseName, string> = {
  home: 'C',
  first: '1B',
  second: '2B',
  third: '3B',
  mound: 'P',
};

/**
 * The bag a throw comes *from*, when the ball starts on one and nobody hit it:
 * the catcher back-picking, a rundown throw, a pitcher picking a runner off. A
 * pitch is not a throw — the ball leaving the mound for the plate is the play
 * starting, not somebody making a decision with it.
 */
function originThrower(route: readonly Spot[], batted: boolean): BaseName | null {
  const first = route[0];
  const next = route[1];
  if (batted || !next || !('base' in first)) return null;
  if (first.base === 'mound') {
    return 'base' in next && next.base !== 'home' ? 'mound' : null;
  }
  return first.base;
}

/** The bag the ball is headed for from here, past any more middle men. */
function nextBaseAfter(route: readonly Spot[], index: number): BaseName | null {
  for (let i = index + 1; i < route.length; i++) {
    const stop = route[i];
    if ('base' in stop) return stop.base;
  }
  return null;
}

/** Is this the last fielder the ball passes through before it reaches a bag? */
function isLastIntermediate(route: readonly Spot[], index: number): boolean {
  for (let i = index + 1; i < route.length; i++) {
    if ('fielder' in route[i]) return false;
    if ('base' in route[i]) return true;
  }
  return true;
}

/** The last fielder to have the ball before a given stop. */
function lastHandlerBefore(route: readonly Spot[], index: number): string | null {
  for (let i = index - 1; i >= 0; i--) {
    const label = labelOf(route[i]);
    if (label) return label;
    // A pitch is caught by the catcher, and whatever happens next is his throw.
    if (isPitch(route, i)) return 'C';
  }
  return null;
}

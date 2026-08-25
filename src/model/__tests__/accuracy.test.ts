import { describe, expect, it } from 'vitest';
import { BATTERS_BOX, compilePlay, PLAYS } from '../plays';
import { assignDefense, AT_BASE_FT, caughtInTheAir, isOutfield, throwTargets } from '../defense';
import { basesBetween, LEAD_FT, leadOff, runnerRouteFeet, SWING_FT } from '../baseRunning';
import { BASE_FEET, feetAt, feetBetween, feetOf, type Feet } from '../spots';
import { BASES, FIELDER_SPOTS, TOKEN_RADIUS } from '../fieldGeometry';
import type { BaseName, PlayDef, Spot } from '../playTypes';
import { POSITIONS, roleFor, UNEXPLAINED } from '../roles';

/**
 * Baseball, as rules a play either follows or breaks.
 *
 * The library is big enough that reading it is not checking it. Everything a
 * coach would object to on the field — a throw to a bag nobody is standing on,
 * two fielders in the same place, a cut man who is not between the ball and the
 * base, a runner cutting the corner of a bag he has to touch — is written down
 * here once and asserted against all 150 plays. Each check collects every
 * offender rather than stopping at the first, because fixing a library one
 * failure per run is not fixing a library.
 */

const DEFAULT_FEET: Record<string, Feet> = Object.fromEntries(
  FIELDER_SPOTS.map((spot) => [spot.label, feetAt(spot.feet, spot.angle)]),
);

function feetOfSpot(play: PlayDef, spot: Spot): Feet {
  if ('fielder' in spot) {
    const at = assignDefense(play).spots[spot.fielder];
    return at ? feetOfSpot(play, at) : DEFAULT_FEET[spot.fielder];
  }
  return feetOf(spot)!;
}

/** Where every fielder ends up, in feet. */
function fielderFeet(play: PlayDef): Record<string, Feet> {
  const { spots } = assignDefense(play);
  const out: Record<string, Feet> = {};
  for (const { label } of FIELDER_SPOTS) {
    out[label] = spots[label] ? feetOfSpot(play, spots[label]) : DEFAULT_FEET[label];
  }
  return out;
}

/** Indexes of the fielders the ball passes through on the way to a bag. */
function relayIndexes(play: PlayDef): number[] {
  const touches = play.ball.flatMap((stop, i) => ('fielder' in stop ? [i] : []));
  return touches.slice(1).filter((i) => i < play.ball.length - 1);
}

describe('every throw has somebody on the other end', () => {
  it('never throws to an empty bag', () => {
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const ends = fielderFeet(play);
      for (const { base, thrower, intended } of throwTargets(play)) {
        if (intended) continue; // a throw that never arrived needed no receiver
        const on = POSITIONS.filter(
          (label) => feetBetween(ends[label], BASE_FEET[base]) <= AT_BASE_FT,
        );
        if (!on.some((label) => label !== thrower)) {
          wrong.push(`${play.id}: throw to ${base} has ${on.join(', ') || 'nobody'} on the bag`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('throws to a bag some runner is contesting', () => {
    // Three ways a bag is worth throwing to: a runner is going there, a runner
    // could try for it from the bag behind, or a runner stopped at the bag
    // behind — in which case the throw is the reason he stopped.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const runners = [
        ...(play.batterTo ? [{ from: { base: 'home' } as Spot, to: play.batterTo }] : []),
        ...(play.runners ?? []),
      ];
      for (const { base } of throwTargets(play)) {
        if (base === 'mound') continue;
        const contested = runners.some((runner) => {
          const to = runner.to;
          if (to && 'base' in to && to.base === base) return true;
          if (to && 'base' in to && nextBase(to.base) === base) return true;
          return 'base' in runner.from && nextBase(runner.from.base) === base;
        });
        if (!contested) wrong.push(`${play.id}: throw to ${base} with nobody running there`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('nobody stands anywhere silly', () => {
  it('never puts two fielders in the same place', () => {
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const ends = fielderFeet(play);
      for (let i = 0; i < POSITIONS.length; i++) {
        for (let j = i + 1; j < POSITIONS.length; j++) {
          const gap = feetBetween(ends[POSITIONS[i]], ends[POSITIONS[j]]);
          if (gap <= 8) wrong.push(`${play.id}: ${POSITIONS[i]} and ${POSITIONS[j]} ${gap.toFixed(1)} ft apart`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('keeps the cut man between the ball and the bag', () => {
    const wrong: string[] = [];
    for (const play of PLAYS) {
      for (const i of relayIndexes(play)) {
        const stop = play.ball[i] as { fielder: string };
        const before = feetOfSpot(play, play.ball[i - 1]);
        // He lines up for the bag the throw was aimed at, which is not always
        // the bag it ended up at: cutting it and firing behind the runner is a
        // decision made after he is already standing in the right place.
        const after = play.aim ? BASE_FEET[play.aim] : feetOfSpot(play, play.ball[i + 1]);
        const span = feetBetween(before, after);
        if (span < 60) continue; // a flip, not a throw through anybody
        const off = offTheLine(before, after, feetOfSpot(play, stop));
        if (off / span > 0.12) {
          wrong.push(`${play.id}: ${stop.fielder} is ${off.toFixed(0)} ft off the throwing line`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('puts the cut man on a throw home where a cut man stands', () => {
    // Forty to fifty feet off the plate: close enough to redirect the throw,
    // far enough to have time to decide.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const { jobs, spots } = assignDefense(play);
      for (const label of POSITIONS) {
        if (jobs[label].kind !== 'cut' || jobs[label].base !== 'home') continue;
        const off = feetBetween(feetOfSpot(play, spots[label]), BASE_FEET.home);
        if (off < 35 || off > 60) wrong.push(`${play.id}: ${label} cutting ${off.toFixed(0)} ft off the plate`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('the doctrine is the same on every play', () => {
  it('cuts a throw home with the corner nearest the ball', () => {
    // The third baseman on anything the left fielder throws home, hit or caught,
    // and the first baseman on anything from centre or right. The exception is a
    // double cut: behind a relay man the third baseman is never the front half,
    // because on a ball hit that deep he is waiting at third on the trail runner.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const { jobs } = assignDefense(play);
      const fielder = firstFielder(play);
      if (!fielder || !isOutfield(fielder)) continue;
      const cut = POSITIONS.find((l) => jobs[l].kind === 'cut' && jobs[l].base === 'home');
      if (!cut) continue;
      const relayed = POSITIONS.some((l) => jobs[l].kind === 'relay');
      const expected = fielder === 'LF' && !relayed ? '3B' : '1B';
      if (cut !== expected) wrong.push(`${play.id}: ${cut} cutting a throw home from ${fielder}`);
    }
    expect(wrong).toEqual([]);
  });

  it('leaves somebody on third whenever the third baseman goes out to cut', () => {
    // The third baseman taking a throw home from left is only correct because
    // the shortstop is behind him on the bag. If that half of the exchange ever
    // goes missing, the exception has to go with it.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const { jobs } = assignDefense(play);
      if (jobs['3B'].kind !== 'cut' && jobs['3B'].kind !== 'relay') continue;
      const ends = fielderFeet(play);
      const on = POSITIONS.filter(
        (l) => l !== '3B' && feetBetween(ends[l], BASE_FEET.third) <= AT_BASE_FT,
      );
      if (on.length === 0) wrong.push(`${play.id}: third baseman cut, nobody on third`);
    }
    expect(wrong).toEqual([]);
  });

  it('leaves third base covered on every ball an outfielder catches', () => {
    // A caught ball means a runner tagging up, and a runner tagging up means a
    // throw behind him. Somebody is on the bag for it either way.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      if (!caughtInTheAir(play)) continue;
      const fielder = firstFielder(play);
      if (!fielder || !isOutfield(fielder)) continue;
      const ends = fielderFeet(play);
      const on = POSITIONS.filter((l) => feetBetween(ends[l], BASE_FEET.third) <= AT_BASE_FT);
      if (on.length === 0) wrong.push(`${play.id}: nobody on third`);
    }
    expect(wrong).toEqual([]);
  });

  it('works a relay with both middle infielders', () => {
    // A double cut is two men. The other middle infielder trails the relay, or
    // he is standing on the bag the throw is coming to — but he is never
    // watching, because a relay that gets past one man with nobody behind him
    // is a ball loose in the infield while the runners keep going.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const { jobs } = assignDefense(play);
      for (const relay of POSITIONS) {
        if (jobs[relay].kind !== 'relay') continue;
        for (const label of ['2B', 'SS'] as const) {
          if (label === relay) continue;
          if (jobs[label].kind === 'idle') {
            wrong.push(`${play.id}: ${label} watching ${relay} relay it`);
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('lines up throws to second and third with the middle infielder on the ball side', () => {
    // The shortstop on anything to left, the second baseman on anything to
    // right. Straight up the middle either of them is on the line, so the only
    // rule that matters there is that the one who does not line it up is the
    // one standing on the bag — which the coverage checks already insist on.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const { jobs } = assignDefense(play);
      const fielder = firstFielder(play);
      if (!fielder || fielder === 'CF' || !isOutfield(fielder)) continue;
      for (const label of POSITIONS) {
        const job = jobs[label];
        if (job.kind !== 'cut' && job.kind !== 'relay') continue;
        if (job.base !== 'second' && job.base !== 'third') continue;
        const expected = fielder === 'RF' ? '2B' : 'SS';
        if (label !== expected) {
          wrong.push(`${play.id}: ${label} lining up a throw to ${job.base} from ${fielder}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('always has third base covered when a throw comes to it', () => {
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const ends = fielderFeet(play);
      for (const { base, intended } of throwTargets(play)) {
        if (base !== 'third' || intended) continue;
        const on = POSITIONS.filter((l) => feetBetween(ends[l], BASE_FEET.third) <= AT_BASE_FT);
        if (!on.includes('3B') && !on.includes('SS')) {
          wrong.push(`${play.id}: ${on.join(', ') || 'nobody'} covering third`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('covers the bag a cut man left whenever a runner is coming to it', () => {
    // A ball in the corner leaves first base empty and it costs nothing: the
    // batter is standing on second by then. A bag somebody is running at is
    // different, and so is a bag the play throws to.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const { jobs, spots } = assignDefense(play);
      const wanted = new Set<BaseName>(throwTargets(play).map((t) => t.base));
      for (const runner of [
        ...(play.batterTo ? [{ to: play.batterTo }] : []),
        ...(play.runners ?? []),
      ]) {
        if (runner.to && 'base' in runner.to) wanted.add(runner.to.base);
      }
      for (const label of POSITIONS) {
        const job = jobs[label];
        // A relay man is not held to this. He goes out on a ball off the wall,
        // where his bag is a bag nobody is being thrown out at, and the man who
        // would have stood on it is behind him instead.
        if (job.kind !== 'cut') continue;
        const own = { '1B': 'first', '2B': 'second', SS: 'second', '3B': 'third' }[label] as
          | BaseName
          | undefined;
        if (!own || !wanted.has(own)) continue;
        const covered = POSITIONS.some(
          (l) =>
            l !== label &&
            spots[l] &&
            feetBetween(feetOfSpot(play, spots[l]), BASE_FEET[own]) <= AT_BASE_FT,
        );
        if (!covered) wrong.push(`${play.id}: ${label} left ${own} with nobody on it`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('the runners run like runners', () => {
  it('stays on the base paths the whole way', () => {
    // Measured in feet, against the straight line from bag to bag, because that
    // is where the path was built and it is the only place the numbers mean
    // anything: the board is drawn foreshortened, so a bow that is five feet
    // wide at first is a different shape on screen than the same bow at third.
    // The allowance is the turn itself, plus the lead a runner takes off the bag.
    const allowed = SWING_FT + LEAD_FT + 1;
    const wrong: string[] = [];
    for (const play of PLAYS) {
      for (const { name, route, legs } of runnerRoutesInFeet(play)) {
        const stray = Math.max(...route.map((p) => toBasePaths(p, legs)));
        if (stray > allowed) {
          wrong.push(`${play.id}: ${name} runs ${stray.toFixed(0)} ft off the base paths`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('rounds the bags instead of cornering them', () => {
    // Every vertex of a drawn route is a corner, so the test of whether a runner
    // is rounding a bag or turning on a dime is how sharp the sharpest one is.
    // A stride either side of the bag is where cornering shows up.
    const wrong: string[] = [];
    for (const play of PLAYS) {
      for (const { name, route, legs, bags } of runnerRoutesInFeet(play)) {
        if (bags.length === 0) continue; // a straight leg has nothing to round
        const worst = Math.max(...corners(route));
        if (worst > 12) {
          wrong.push(`${play.id}: ${name} turns ${worst.toFixed(0)} degrees in one stride`);
        }
        // And the turn has to actually be a turn, not a line with a name on it.
        const bowed = Math.max(...route.map((p) => toBasePaths(p, legs)));
        if (bowed < 2) wrong.push(`${play.id}: ${name} corners the bag flat`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('touches every bag on the way instead of cutting the corner', () => {
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const { tokens, runnerRoutes, start, end } = compilePlay(play);
      for (const token of tokens) {
        if (token.type !== 'runner') continue;
        const route = runnerRoutes[token.id];
        expect(route, `${play.id}: runner with no route`).toBeDefined();
        expect(route[0], play.id).toEqual(start[token.id]);
        expect(route[route.length - 1], play.id).toEqual(end[token.id]);

        for (const [name, bag] of [
          ['first', BASES.first],
          ['second', BASES.second],
          ['third', BASES.third],
        ] as const) {
          if (!passesBy(route, bag, 110)) continue;
          if (!touches(route, bag, TOKEN_RADIUS * 2)) {
            wrong.push(`${play.id}: a runner goes past ${name} without touching it`);
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('never runs a runner across the mound', () => {
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const { tokens, runnerRoutes } = compilePlay(play);
      for (const token of tokens) {
        if (token.type !== 'runner') continue;
        const route = runnerRoutes[token.id];
        const mound = { x: BASES.second.x, y: (BASES.second.y + BASES.home.y) / 2 };
        // Only a runner who is actually going somewhere: a rundown between the
        // bags legitimately stands in the middle of the diamond.
        const travelled = route.some((p) => Math.hypot(p.x - mound.x, p.y - mound.y) < 60);
        if (travelled && distanceOf(route) > 200) {
          wrong.push(`${play.id}: a runner runs over the mound`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('every fielder can say what he is doing', () => {
  it('never leaves a move unexplained', () => {
    const wrong: string[] = [];
    for (const play of PLAYS) {
      for (const label of POSITIONS) {
        if (roleFor(play, label).text === UNEXPLAINED) wrong.push(`${play.id} / ${label}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('has the whole team working on a ball hit to the outfield', () => {
    const wrong: string[] = [];
    for (const play of PLAYS) {
      const fielder = firstFielder(play);
      if (!fielder || !isOutfield(fielder)) continue;
      const { jobs } = assignDefense(play);
      const idle = POSITIONS.filter((label) => jobs[label].kind === 'idle');
      if (idle.length > 2) wrong.push(`${play.id}: ${idle.join(', ')} standing around`);
    }
    expect(wrong).toEqual([]);
  });
});

function firstFielder(play: PlayDef): string | null {
  const stop = play.ball.find((s) => 'fielder' in s);
  return stop && 'fielder' in stop ? stop.fielder : null;
}

function nextBase(base: BaseName): BaseName | null {
  return { home: 'first', first: 'second', second: 'third', third: 'home', mound: null }[
    base
  ] as BaseName | null;
}

/** Perpendicular distance from the line through a and b. */
function offTheLine(a: Feet, b: Feet, p: Feet): number {
  const span = feetBetween(a, b);
  if (span === 0) return feetBetween(a, p);
  return Math.abs((b.x - a.x) * (a.y - p.y) - (b.y - a.y) * (a.x - p.x)) / span;
}

/**
 * Every runner on a play, with his route and the straight base-path route he is
 * supposed to be following, both in feet. Rebuilt from the play rather than read
 * off the compiled board, because the board is projected and the projection is
 * what makes distances on it unusable for this.
 */
function runnerRoutesInFeet(
  play: PlayDef,
): { name: string; route: Feet[]; legs: Feet[]; bags: BaseName[] }[] {
  const out: { name: string; route: Feet[]; legs: Feet[]; bags: BaseName[] }[] = [];
  const runners = [
    ...(play.batterTo ? [{ from: BATTERS_BOX, to: play.batterTo, batter: true }] : []),
    ...(play.runners ?? []).map((runner) => ({ ...runner, batter: false })),
  ];
  for (const runner of runners) {
    const diveBack =
      runner.to && 'base' in runner.from && 'base' in runner.to && runner.from.base === runner.to.base;
    const bag =
      diveBack || !('base' in runner.from) || runner.from.base === 'home' ? null : runner.from.base;
    const start = bag ? leadOff(bag) : feetOf(runner.from)!;
    const from = diveBack && 'base' in runner.from ? leadOff(runner.from.base) : start;
    const to = runner.to ? feetOf(runner.to)! : from;
    const bags = runner.to && !diveBack ? basesBetween(from, to) : [];
    out.push({
      name: runner.batter ? 'the batter' : runnerName(runner.from, runner.to),
      route: runnerRouteFeet(from, to, bags),
      legs: [from, ...bags.map((b) => BASE_FEET[b]), to],
      bags,
    });
  }
  return out;
}

function runnerName(from: Spot, to: Spot | undefined): string {
  const where = (spot: Spot | undefined) =>
    spot === undefined ? 'nowhere' : 'base' in spot ? spot.base : 'between bags';
  return `${where(from)} to ${where(to)}`;
}

/** Distance from a point to the nearest of the straight legs, in feet. */
function toBasePaths(p: Feet, legs: Feet[]): number {
  let best = Infinity;
  for (let i = 0; i < legs.length - 1; i++) {
    best = Math.min(best, toSegment(legs[i], legs[i + 1], p));
  }
  return best;
}

function toSegment(a: Feet, b: Feet, p: Feet): number {
  const span = feetBetween(a, b);
  if (span === 0) return feetBetween(a, p);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (span * span)),
  );
  return feetBetween(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

/** How far the route turns at each of its vertices, in degrees. */
function corners(route: Feet[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < route.length - 1; i++) {
    const a = { x: route[i].x - route[i - 1].x, y: route[i].y - route[i - 1].y };
    const b = { x: route[i + 1].x - route[i].x, y: route[i + 1].y - route[i].y };
    const la = Math.hypot(a.x, a.y);
    const lb = Math.hypot(b.x, b.y);
    if (la < 0.01 || lb < 0.01) continue;
    const cos = (a.x * b.x + a.y * b.y) / (la * lb);
    out.push((Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI);
  }
  return out;
}

type Pt = { x: number; y: number };

function distanceOf(route: readonly Pt[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += Math.hypot(route[i + 1].x - route[i].x, route[i + 1].y - route[i].y);
  }
  return total;
}

/** Does the route come within `within` of a point at one of its vertices? */
function touches(route: readonly Pt[], target: Pt, within: number): boolean {
  return route.some((p) => Math.hypot(p.x - target.x, p.y - target.y) < within);
}

/** Does the route go by a point — near it, and not just at an end? */
function passesBy(route: readonly Pt[], target: Pt, within: number): boolean {
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    if (span === 0) continue;
    const t = ((target.x - a.x) * (b.x - a.x) + (target.y - a.y) * (b.y - a.y)) / (span * span);
    if (t <= 0.05 || t >= 0.95) continue;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (Math.hypot(target.x - x, target.y - y) < within) return true;
  }
  return false;
}

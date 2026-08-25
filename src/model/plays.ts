import { BASES, MOUND, defaultFielderPosition, FIELDER_SPOTS, pointAt } from './fieldGeometry';
import type { Point } from './path';
import { basesBetween, leadOff, runnerRoute } from './baseRunning';
import { assignDefense } from './defense';
import { capturePositions, defaultTokens, nextId } from './diagramState';
import { MORE_PLAYS } from './morePlays';
import type { BaseName, PlayDef, Spot } from './playTypes';
import { feetOf } from './spots';
import type { PositionMap, Token } from './types';

/**
 * A library of situations a 10-11U team works on. Each play is written the way
 * a coach would describe it — what the batter did, who goes to the ball, and
 * where the ball goes — and compiled into the same arrangement-plus-route the
 * board already animates. Cut men, base coverage and backups are not written
 * here: they are the same on every play, so defense.ts works them out.
 *
 * Positions are given in real feet and bearings (0 is straight to centre
 * field, negative toward third), so a play reads as baseball rather than as
 * coordinates, and stays correct if the field's drawing ever changes.
 */

export type { BaseName, PlayDef, Spot } from './playTypes';

/** Beside the plate on the first base side, clear of the ball, ready to run. */
export const BATTERS_BOX: Spot = { at: [13, 45] };

const BASE_POINTS: Record<string, Point> = {
  home: BASES.home,
  first: BASES.first,
  second: BASES.second,
  third: BASES.third,
  mound: MOUND,
};

function resolve(spot: Spot, ends: Record<string, Point>): Point {
  if ('base' in spot) return BASE_POINTS[spot.base];
  if ('at' in spot) return pointAt(spot.at[0], spot.at[1]);
  return ends[spot.fielder] ?? { x: 500, y: 500 };
}

export interface CompiledPlay {
  tokens: Token[];
  ballRoute: Point[];
  /** Runner token id -> the base paths he runs, rather than a straight line. */
  runnerRoutes: Record<string, Point[]>;
  start: PositionMap;
  end: PositionMap;
}

/** Turn a play into the arrangements and routes the board animates. */
export function compilePlay(def: PlayDef): CompiledPlay {
  const tokens = defaultTokens();

  // Where each fielder finishes — resolved first, so the ball can be thrown to
  // a fielder's finishing spot rather than to where they started.
  const fielderEnds: Record<string, Point> = {};
  for (const spot of FIELDER_SPOTS) fielderEnds[spot.label] = defaultFielderPosition(spot);
  for (const [label, target] of Object.entries(assignDefense(def).spots)) {
    fielderEnds[label] = resolve(target, fielderEnds);
  }

  const runnerEnds: Record<string, Point> = {};
  const runnerRoutes: Record<string, Point[]> = {};
  const runners = [
    // The batter leads off the list, because that is the order he exists in.
    // He stands in the box rather than on the plate: a batted ball starts at
    // home too, and a batter hidden under the ball is a batter nobody can see.
    ...(def.batterTo ? [{ from: BATTERS_BOX, to: def.batterTo }] : []),
    ...(def.runners ?? []),
  ];
  for (const runner of runners) {
    // A runner sent back to the base he is standing on was never standing on
    // it: he had a lead, and the play is him getting back. A runner who is
    // going somewhere had one too — nobody breaks from a standstill on the bag.
    const diveBack = sameBase(runner.from, runner.to);
    const bag = startOf(runner, diveBack);
    const from = bag ? leadOff(bag) : feetOf(runner.from)!;
    const to = runner.to ? feetOf(runner.to)! : from;
    // The route decides where he starts and finishes, rather than the other way
    // round, so the two can never disagree about where the bag is.
    const route = runnerRoute(from, to, runner.to && !diveBack ? basesBetween(from, to) : []);
    const start = route[0];
    const token: Token = { id: nextId('runner'), type: 'runner', x: start.x, y: start.y };
    tokens.push(token);
    runnerEnds[token.id] = route[route.length - 1];
    runnerRoutes[token.id] = route;
  }

  const ballRoute = def.ball.map((spot) => resolve(spot, fielderEnds));
  const ballStart = ballRoute[0];
  const ball: Token = { id: nextId('ball'), type: 'ball', x: ballStart.x, y: ballStart.y };
  tokens.push(ball);

  const start = capturePositions(tokens);

  const end: PositionMap = { ...start };
  for (const token of tokens) {
    if (token.type === 'fielder' && token.label && fielderEnds[token.label]) {
      end[token.id] = fielderEnds[token.label];
    }
    if (token.type === 'runner') end[token.id] = runnerEnds[token.id];
  }
  end[ball.id] = ballRoute[ballRoute.length - 1];

  return { tokens, ballRoute, runnerRoutes, start, end };
}

/** The bag a runner both starts and finishes on, if it is the same one. */
function sameBase(from: Spot, to: Spot | undefined): BaseName | null {
  if (!to || !('base' in from) || !('base' in to)) return null;
  return from.base === to.base ? from.base : null;
}

/**
 * The bag a runner takes his lead off, if he has one to take. A man standing on
 * a base with the pitch coming is standing off it; the batter is in the box and
 * a runner already caught between bags is wherever the play left him.
 */
function startOf(runner: { from: Spot; to?: Spot }, diveBack: BaseName | null): BaseName | null {
  if (diveBack) return diveBack;
  if (!('base' in runner.from) || runner.from.base === 'home') return null;
  return runner.from.base;
}

// Where balls are commonly put in play, so the plays below read consistently.
const HIT = {
  holeAtShort: { at: [150, -26] } as Spot,
  upTheMiddle: { at: [150, 6] } as Spot,
  toSecond: { at: [148, 22] } as Spot,
  toThird: { at: [112, -38] } as Spot,
  toFirst: { at: [112, 40] } as Spot,
  comebacker: { at: [72, 0] } as Spot,
  buntThirdSide: { at: [38, -22] } as Spot,
  buntFirstSide: { at: [36, 20] } as Spot,
  singleLeft: { at: [252, -30] } as Spot,
  singleRight: { at: [252, 30] } as Spot,
  singleCenter: { at: [262, 2] } as Spot,
  gapLeftCenter: { at: [330, -20] } as Spot,
  flyRight: { at: [258, 28] } as Spot,
  flyCenter: { at: [286, 0] } as Spot,
  popUpThirdSide: { at: [124, -32] } as Spot,
  ballInDirt: { at: [30, 168] } as Spot,
  popUpBehindPlate: { at: [22, 200] } as Spot,
  slowRollerThird: { at: [56, -35] } as Spot,
  gapRightCenter: { at: [330, 18] } as Spot,
  offTheWallRight: { at: [348, 30] } as Spot,
  downTheRightLine: { at: [250, 41] } as Spot,
  chargingLeft: { at: [236, -28] } as Spot,
  passedBall: { at: [30, 150] } as Spot,
  behindThePlate: { at: [32, 193] } as Spot,
};

export const PLAYS: readonly PlayDef[] = [
  // --- Routine outs ------------------------------------------------------
  {
    id: '6-3',
    name: '6-3 — short to first',
    situation: 'Nobody on. Ground ball in the hole at short.',
    category: 'Routine outs',
    teaches: 'Field it, set your feet, then throw. First baseman gets to the bag early.',
    batterTo: { base: 'first' },
    moves: { SS: HIT.holeAtShort, '1B': { base: 'first' }, '2B': { base: 'second' } },
    ball: [{ base: 'home' }, { fielder: 'SS' }, { base: 'first' }],
  },
  {
    id: '4-3',
    name: '4-3 — second to first',
    situation: 'Nobody on. Ground ball to the second baseman.',
    category: 'Routine outs',
    teaches: 'The second baseman works around the ball so the throw carries toward first.',
    batterTo: { base: 'first' },
    moves: { '2B': HIT.toSecond, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '2B' }, { base: 'first' }],
  },
  {
    id: '5-3',
    name: '5-3 — third to first',
    situation: 'Nobody on. Ground ball to third.',
    category: 'Routine outs',
    teaches: 'The longest throw on the infield: charge it and get something behind it.',
    batterTo: { base: 'first' },
    moves: { '3B': HIT.toThird, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '3B' }, { base: 'first' }],
  },
  {
    id: '1-3',
    name: '1-3 — comebacker',
    situation: 'Nobody on. Ball hit straight back at the pitcher.',
    category: 'Routine outs',
    teaches: 'Field it, turn to the glove side, and throw chest-high to first.',
    batterTo: { base: 'first' },
    moves: { P: HIT.comebacker, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'first' }],
  },
  {
    id: '3-1',
    name: '3-1 — pitcher covers first',
    situation: 'Nobody on. Ground ball pulls the first baseman off the bag.',
    category: 'Routine outs',
    teaches: 'Every ground ball to the right side, the pitcher breaks for first. No exceptions.',
    batterTo: { base: 'first' },
    moves: { '1B': HIT.toFirst, P: { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '1B' }, { fielder: 'P' }],
  },

  // --- Double plays and force outs ---------------------------------------
  {
    id: '6-4-3',
    name: '6-4-3 double play',
    situation: 'Runner on first, less than two out. Ground ball to short.',
    category: 'Double plays',
    teaches: 'Get one for sure — knowing when not to turn two matters as much. The feed leads the second baseman across the bag.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { SS: HIT.holeAtShort, '2B': { base: 'second' }, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'SS' }, { base: 'second' }, { base: 'first' }],
  },
  {
    id: '4-6-3',
    name: '4-6-3 double play',
    situation: 'Runner on first. Ground ball to the second baseman.',
    category: 'Double plays',
    teaches: 'Shortstop covers when the ball is to the right side. Underhand the short feed.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { '2B': HIT.toSecond, SS: { base: 'second' }, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '2B' }, { base: 'second' }, { base: 'first' }],
  },
  {
    id: '5-4-3',
    name: '5-4-3 — around the horn',
    situation: 'Runner on first. Ground ball to third.',
    category: 'Double plays',
    teaches: 'Third baseman throws to the bag, not to the fielder. Second baseman gets there first.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { '3B': HIT.toThird, '2B': { base: 'second' }, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '3B' }, { base: 'second' }, { base: 'first' }],
  },
  {
    id: 'force-home',
    name: 'Bases loaded — force at home',
    situation: 'Bases loaded, infield in. Ground ball to short.',
    category: 'Double plays',
    teaches: 'With the infield in, the shortest out is at the plate. Catcher shows a target.',
    roles: {
      '2B': 'Play in with the rest of the infield — there is a force at every base.',
    },
    batterTo: { base: 'first' },
    runners: [
      { from: { base: 'third' }, to: { base: 'home' } },
      { from: { base: 'second' }, to: { base: 'third' } },
      { from: { base: 'first' }, to: { base: 'second' } },
    ],
    moves: { SS: { at: [120, -20] }, '2B': { at: [120, 16] } },
    ball: [{ base: 'home' }, { fielder: 'SS' }, { base: 'home' }],
  },

  // --- Bunts -------------------------------------------------------------
  {
    id: 'bunt-first',
    name: 'Sacrifice bunt — out at first',
    situation: 'Runner on first. Bunt down the third base line.',
    category: 'Bunt defense',
    teaches: 'Corners charge, second baseman covers first. Somebody has to take the bag.',
    roles: {
      '1B': 'Charge the plate. The second baseman has first base behind you.',
      '3B': 'Charge the line and take anything you can get to.',
    },
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: {
      P: HIT.buntThirdSide,
      '3B': { at: [55, -30] },
      '1B': { at: [60, 32] },
      '2B': { base: 'first' },
      SS: { base: 'second' },
    },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'first' }],
  },
  {
    id: 'bunt-second',
    name: 'Bunt — force at second',
    situation: 'Runner on first, bunt fielded quickly out front.',
    category: 'Bunt defense',
    teaches: 'Only if the pitcher is there fast. Listen for the catcher to make the call.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { P: HIT.buntFirstSide, SS: { base: 'second' }, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'second' }],
  },
  {
    id: 'squeeze',
    name: 'Squeeze — bunt with a runner on third',
    situation: 'Runner on third breaking with the pitch. Bunt in front of the plate.',
    category: 'Bunt defense',
    teaches: 'Pitcher fields and turns to the plate. Catcher clears the line and covers.',
    roles: {
      '1B': 'Charge — the runner left on the pitch.',
      '3B': 'Charge the line; the pitcher takes anything in the middle.',
    },
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { P: { at: [30, -8] }, '3B': { at: [50, -32] }, '1B': { at: [55, 34] } },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'home' }],
  },

  // --- Cutoffs and relays -------------------------------------------------
  {
    id: 'cut-home-left',
    name: 'Single to left — cut to home',
    situation: 'Runner on second. Base hit to left field, runner sent home.',
    category: 'Cutoffs and relays',
    teaches: 'Third baseman is the cut on throws home from left. Throw through him, chest high.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'second' }, to: { base: 'home' } }],
    moves: { LF: HIT.singleLeft },
    ball: [{ base: 'home' }, { fielder: 'LF' }, { fielder: '3B' }, { base: 'home' }],
  },
  {
    id: 'cut-third-right',
    name: 'Single to right — throw to third',
    situation: 'Runner on first. Base hit to right; he takes second and looks at third.',
    category: 'Cutoffs and relays',
    teaches: 'Ball to the right side, the second baseman lines up third. The throw is what makes him stop at second.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { RF: HIT.singleRight },
    ball: [{ base: 'home' }, { fielder: 'RF' }, { fielder: '2B' }, { base: 'third' }],
  },
  {
    id: 'relay-gap',
    name: 'Ball in the gap — relay',
    situation: 'Ball splits left and centre. Batter is running hard.',
    category: 'Cutoffs and relays',
    teaches: 'Shortstop sprints out as the relay man, so the throw in is one he can turn on.',
    batterTo: { base: 'second' },
    moves: { LF: HIT.gapLeftCenter },
    ball: [{ base: 'home' }, { fielder: 'LF' }, { fielder: 'SS' }, { base: 'second' }],
  },
  {
    id: 'hit-center-second',
    name: 'Base hit to centre — throw to second',
    situation: 'Base hit up the middle. Batter thinks about stretching it.',
    category: 'Cutoffs and relays',
    teaches: 'Shortstop covers on a ball hit to centre; the second baseman lines the throw up in front of him.',
    batterTo: { base: 'first' },
    moves: { CF: HIT.singleCenter },
    ball: [{ base: 'home' }, { fielder: 'CF' }, { base: 'second' }],
  },

  // --- Fly balls ----------------------------------------------------------
  {
    id: 'tag-from-third',
    name: 'Tag up from third',
    situation: 'Runner on third, one out. Fly ball to right field.',
    category: 'Fly balls',
    teaches: 'Catch it moving toward the plate. First baseman lines up the cut.',
    batterTo: { at: [45, 45] },
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { RF: HIT.flyRight },
    ball: [{ base: 'home' }, { fielder: 'RF' }, { fielder: '1B' }, { base: 'home' }],
  },
  {
    id: 'sac-fly-center',
    name: 'Sacrifice fly to centre',
    situation: 'Runner on third, fewer than two out. Fly ball to centre.',
    category: 'Fly balls',
    teaches: 'Centre fielder gets behind it so he can catch it going forward.',
    batterTo: { at: [45, 45] },
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { CF: HIT.flyCenter },
    ball: [{ base: 'home' }, { fielder: 'CF' }, { fielder: '1B' }, { base: 'home' }],
  },
  {
    id: 'pop-up-priority',
    name: 'Pop-up priority — double off first',
    situation: 'Runner on first. Pop fly between the shortstop and the third baseman.',
    category: 'Fly balls',
    teaches: 'Shortstop calls it, catches it, and throws to first before the runner can get back.',
    roles: {
      '3B': 'Give way — the shortstop is coming on and has the better angle.',
      SS: 'Call it loud, catch it, and throw to first to double off the runner.',
      '1B': 'Get to the bag and be ready for the throw behind the runner.',
    },
    batterTo: { at: [45, 45] },
    runners: [{ from: { base: 'first' }, to: { base: 'first' } }],
    moves: { SS: HIT.popUpThirdSide, '3B': { at: [95, -40] }, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'SS' }, { base: 'first' }],
  },

  // --- Runners moving -----------------------------------------------------
  {
    id: 'steal-second',
    name: 'Steal of second',
    situation: 'Runner on first goes with the pitch.',
    category: 'Runners moving',
    teaches: 'Shortstop covers, catcher throws through the bag. Everyone else holds.',
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { SS: { base: 'second' } },
    ball: [{ base: 'mound' }, { base: 'home' }, { base: 'second' }],
  },
  {
    id: 'steal-third',
    name: 'Steal of third',
    situation: 'Runner on second breaks for third.',
    category: 'Runners moving',
    teaches: 'Third baseman gets to the bag, shortstop backs up the throw.',
    roles: {
      'SS': 'Back up the throw to third.',
    },
    runners: [{ from: { base: 'second' }, to: { base: 'third' } }],
    moves: { '3B': { base: 'third' }, SS: { at: [140, -34] } },
    ball: [{ base: 'mound' }, { base: 'home' }, { base: 'third' }],
  },
  {
    id: 'first-and-third',
    name: 'First and third double steal',
    situation: 'Runners on the corners. The runner at first takes off.',
    category: 'Runners moving',
    teaches: 'Check the runner at third before you throw. The trail runner is bait.',
    roles: {
      C: 'Check the runner at third first. Only throw through if he stays put.',
    },
    runners: [
      { from: { base: 'first' }, to: { base: 'second' } },
      // Correct defense: the run stays at third while second is given up.
      { from: { base: 'third' } },
    ],
    moves: { SS: { base: 'second' }, '3B': { base: 'third' } },
    ball: [{ base: 'mound' }, { base: 'home' }, { base: 'mound' }],
  },
  {
    id: 'rundown',
    name: 'Rundown between first and second',
    situation: 'Runner caught off the bag.',
    category: 'Runners moving',
    teaches: 'Run him hard back toward the base he came from, and throw once.',
    roles: {
      '2B': 'Trail the play so somebody is behind the tag.',
    },
    runners: [{ from: { at: [106, 24] }, to: { base: 'first' } }],
    moves: { '1B': { base: 'first' }, SS: { base: 'second' }, '2B': { at: [150, 26] } },
    ball: [{ base: 'second' }, { base: 'first' }],
  },

  // --- Pitcher and catcher ------------------------------------------------
  {
    id: 'ball-in-dirt',
    name: 'Ball in the dirt, runner on third',
    situation: 'Pitch gets past the catcher with a runner ninety feet away.',
    category: 'Pitcher and catcher',
    teaches: 'Catcher goes and gets it, pitcher covers the plate. Both move on contact with the dirt.',
    roles: {
      'C': 'Get to the ball fast — the pitcher has the plate.',
    },
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { P: { base: 'home' }, C: HIT.ballInDirt },
    ball: [{ base: 'mound' }, HIT.ballInDirt, { base: 'home' }],
  },
  {
    id: 'pitcher-backs-up',
    name: 'Pitcher backs up third',
    situation: 'Runner on first, base hit to left field; the runner takes second and looks for third.',
    category: 'Pitcher and catcher',
    teaches: 'The pitcher has a job on every ball in play: get behind the base the throw is going to.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { LF: HIT.singleLeft },
    ball: [{ base: 'home' }, { fielder: 'LF' }, { base: 'third' }],
  },

  // ---------------------------------------------------------------------
  // Second twenty-five: the situations that come up once a team can already
  // make the routine play.
  // ---------------------------------------------------------------------

  {
    id: '2-3',
    name: '2-3 — dropped third strike',
    situation: 'Strike three gets past the catcher with first base open.',
    category: 'Routine outs',
    teaches: 'It is not an out until he is thrown out. Catcher blocks, finds it, throws.',
    roles: {
      'C': 'Block it, find it, and throw to first.',
    },
    batterTo: { base: 'first' },
    moves: { C: { at: [18, 172] }, '1B': { base: 'first' } },
    ball: [{ base: 'mound' }, { at: [18, 172] }, { base: 'first' }],
  },
  {
    id: 'slow-roller',
    name: 'Slow roller to third',
    situation: 'Ball dies halfway up the third base line.',
    category: 'Routine outs',
    teaches: 'Charge it, take it bare-handed on the run, and throw from where you are.',
    batterTo: { base: 'first' },
    moves: { '3B': HIT.slowRollerThird, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '3B' }, { base: 'first' }],
  },
  {
    id: 'infield-back',
    name: 'Infield back — take the out at first',
    situation: 'Runner on third, infield playing back. Ground ball to short.',
    category: 'Routine outs',
    teaches: 'The run scores and that is fine. Playing back means you already chose the out.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { SS: { at: [168, -22] }, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'SS' }, { base: 'first' }],
  },
  {
    id: 'pop-up-catcher',
    name: 'Pop-up to the catcher — throw to first',
    situation: 'Runner on first. Ball popped straight up behind the plate.',
    category: 'Routine outs',
    teaches: 'Mask off, find it, catch it, then look the runner back to first before anything else.',
    roles: {
      C: 'Catch it, then throw to first if the runner has strayed off the bag.',
    },
    batterTo: { at: [45, 45] },
    runners: [{ from: { base: 'first' }, to: { base: 'first' } }],
    moves: { C: HIT.popUpBehindPlate, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'C' }, { base: 'first' }],
  },

  {
    id: '1-6-3',
    name: '1-6-3 double play',
    situation: 'Runner on first. Ball hit back through the box.',
    category: 'Double plays',
    teaches: 'Pitcher turns and leads the shortstop to the bag. Do not rush the feed.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { P: HIT.comebacker, SS: { base: 'second' }, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'second' }, { base: 'first' }],
  },
  {
    id: '3-6-1',
    name: '3-6-1 double play',
    situation: 'Runner on first. Ground ball to the first baseman off the bag.',
    category: 'Double plays',
    teaches: 'First baseman goes to second with it, then the pitcher covers for the return.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { '1B': HIT.toFirst, SS: { base: 'second' }, P: { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '1B' }, { base: 'second' }, { fielder: 'P' }],
  },
  {
    id: '1-2-3',
    name: '1-2-3 — home then first',
    situation: 'Bases loaded, comebacker to the pitcher.',
    category: 'Double plays',
    teaches: 'Look the runner in, throw home, and let the catcher finish it at first.',
    batterTo: { base: 'first' },
    runners: [
      { from: { base: 'third' }, to: { base: 'home' } },
      { from: { base: 'second' }, to: { base: 'third' } },
      { from: { base: 'first' }, to: { base: 'second' } },
    ],
    moves: { P: HIT.comebacker, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'home' }, { base: 'first' }],
  },

  {
    id: 'bunt-first-line',
    name: 'Bunt down the first base line',
    situation: 'Runner on first. Bunt rolls toward the first baseman.',
    category: 'Bunt defense',
    teaches: 'First baseman fields it, so the second baseman has to be standing on the bag.',
    roles: {
      'P': 'Break toward the line, but give way if the first baseman calls you off.',
    },
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { '1B': HIT.buntFirstSide, '2B': { base: 'first' }, P: { at: [45, 14] } },
    ball: [{ base: 'home' }, { fielder: '1B' }, { base: 'first' }],
  },
  {
    id: 'bunt-force-third',
    name: 'Runners on first and second — force at third',
    situation: 'Bunt with two on and nobody out.',
    category: 'Bunt defense',
    teaches: 'Third baseman charges, so the shortstop must beat the runner to the bag.',
    roles: {
      'P': 'Cover the middle — the third baseman is charging the line.',
    },
    batterTo: { base: 'first' },
    runners: [
      { from: { base: 'second' }, to: { base: 'third' } },
      { from: { base: 'first' }, to: { base: 'second' } },
    ],
    moves: {
      '3B': HIT.buntThirdSide,
      SS: { base: 'third' },
      '2B': { base: 'first' },
      P: { at: [42, -6] },
    },
    ball: [{ base: 'home' }, { fielder: '3B' }, { base: 'third' }],
  },
  {
    id: 'safety-squeeze',
    name: 'Safety squeeze',
    situation: 'Runner on third waits to see the bunt go down before he breaks.',
    category: 'Bunt defense',
    teaches: 'No play at the plate — take the out at first and keep the inning moving.',
    roles: {
      '3B': 'Charge, but check the runner at third before you throw.',
    },
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { P: { at: [34, -10] }, '1B': { base: 'first' }, '3B': { at: [52, -30] } },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'first' }],
  },

  {
    id: 'cut-home-center',
    name: 'Single to centre — cut to home',
    situation: 'Runner on second scores on a base hit up the middle.',
    category: 'Cutoffs and relays',
    teaches: 'First baseman is the cut on throws home from centre and right.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'second' }, to: { base: 'home' } }],
    moves: { CF: HIT.singleCenter, '1B': { at: [120, 8] }, '2B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'CF' }, { fielder: '1B' }, { base: 'home' }],
  },
  {
    id: 'relay-right-center',
    name: 'Right-centre gap — relay to third',
    situation: 'Ball splits right and centre with a runner on first; he takes second and is sent to third.',
    category: 'Cutoffs and relays',
    teaches: 'Ball to the right side, the second baseman is the relay and the shortstop covers.',
    batterTo: { base: 'second' },
    // Gap double: the lead runner can legitimately make third after touching second.
    runners: [{ from: { base: 'first' }, to: { base: 'third' } }],
    moves: { RF: HIT.gapRightCenter },
    ball: [{ base: 'home' }, { fielder: 'RF' }, { fielder: '2B' }, { base: 'third' }],
  },
  {
    id: 'cut-behind-runner',
    name: 'Cut it and get the batter',
    situation: 'The throw home has no chance, but the batter is rounding first too far.',
    category: 'Cutoffs and relays',
    teaches: 'The cut man decides. If the run scores anyway, take the out behind it.',
    batterTo: { base: 'second' },
    runners: [
      { from: { base: 'second' }, to: { base: 'home' } },
    ],
    moves: { LF: HIT.singleLeft },
    // Lined up for the plate; the cut man is the one who chose second instead.
    aim: 'home',
    ball: [{ base: 'home' }, { fielder: 'LF' }, { fielder: '3B' }, { base: 'second' }],
  },
  {
    id: 'off-the-wall',
    name: 'Off the wall — play the carom',
    situation: 'Ball gets by the right fielder and rattles around the fence.',
    category: 'Cutoffs and relays',
    teaches: 'Get to where it is going, not where it hit. Relay man goes out to meet the throw.',
    batterTo: { base: 'third' },
    moves: { RF: HIT.offTheWallRight },
    ball: [{ base: 'home' }, { fielder: 'RF' }, { fielder: '2B' }, { base: 'third' }],
  },

  {
    id: 'tag-from-second',
    name: 'Tag up from second',
    situation: 'Runner on second, one out. Deep fly ball to centre.',
    category: 'Fly balls',
    teaches: 'Deep enough and he goes. Shortstop lines up the throw to third.',
    batterTo: { at: [45, 45] },
    runners: [{ from: { base: 'second' }, to: { base: 'third' } }],
    moves: { CF: { at: [322, -6] } },
    ball: [{ base: 'home' }, { fielder: 'CF' }, { fielder: 'SS' }, { base: 'third' }],
  },
  {
    id: 'fly-down-the-line',
    name: 'Fly ball down the right field line',
    situation: 'Runner on first. High fly drifting toward the line between first and right.',
    category: 'Fly balls',
    teaches: 'Right fielder calls it early, catches it coming in, and throws to first to double off the runner.',
    roles: {
      '1B': 'Peel off the catch, then get back to the bag for the throw behind the runner.',
      RF: 'Call it, catch it moving in, and throw to first without winding up.',
    },
    batterTo: { at: [45, 45] },
    runners: [{ from: { base: 'first' }, to: { base: 'first' } }],
    moves: { RF: HIT.downTheRightLine, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'RF' }, { base: 'first' }],
  },
  {
    id: 'outfield-priority',
    name: 'Gap fly — catch and throw to second',
    situation: 'Runner on first. Fly ball splitting the left and centre fielders.',
    category: 'Fly balls',
    teaches: 'Centre fielder takes it, left fielder backs him up, and the throw goes to second to double off the runner.',
    roles: {
      LF: 'Peel off and back up the centre fielder.',
      CF: 'Call it, catch it, and throw to second before the runner can get back.',
    },
    batterTo: { at: [45, 45] },
    runners: [{ from: { base: 'first' }, to: { base: 'first' } }],
    moves: { CF: { at: [300, -16] }, LF: { at: [268, -26] } },
    ball: [{ base: 'home' }, { fielder: 'CF' }, { base: 'second' }],
  },

  {
    id: 'rundown-third-home',
    name: 'Rundown between third and home',
    situation: 'Runner caught off third base.',
    category: 'Runners moving',
    teaches: 'Run him back toward third. Never chase him toward the plate.',
    roles: {
      'P': 'Back up the play — somebody has to be behind the tag.',
      'C': 'Run him back toward third. Never chase him toward the plate.',
    },
    runners: [{ from: { at: [48, -45] }, to: { base: 'third' } }],
    moves: { '3B': { base: 'third' }, C: { at: [30, -30] }, P: { at: [55, -22] } },
    ball: [{ base: 'home' }, { base: 'third' }],
  },
  {
    id: 'delayed-steal',
    name: 'Delayed steal of second',
    situation: 'Runner breaks as the catcher lobs the ball back to the pitcher.',
    category: 'Runners moving',
    teaches: 'Middle infielders watch the runner, not the ball. Pitcher turns and throws.',
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: { SS: { base: 'second' } },
    ball: [{ base: 'home' }, { base: 'mound' }, { base: 'second' }],
  },
  {
    id: 'pickoff-first',
    name: 'Pickoff at first',
    situation: 'Runner on first taking too much of a lead.',
    category: 'Runners moving',
    teaches: 'First baseman holds him on and gives a target on the inside corner of the bag.',
    runners: [{ from: { at: [98, 42] }, to: { base: 'first' } }],
    moves: { '1B': { base: 'first' } },
    ball: [{ base: 'mound' }, { base: 'first' }],
  },
  {
    id: 'freeze-the-runner',
    name: 'Freeze the runner on second',
    situation: 'Runner on second. Ground ball hit in front of him to the shortstop.',
    category: 'Runners moving',
    teaches: 'Look him back to the bag first, then throw. He cannot run with you looking at him.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'second' } }],
    moves: { SS: { at: [152, -14] }, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'SS' }, { base: 'first' }],
  },

  {
    id: 'pitcher-backs-up-home',
    name: 'Pitcher backs up home',
    situation: 'Base hit to left with a runner scoring from second.',
    category: 'Pitcher and catcher',
    teaches: 'Throw home means the pitcher is behind the plate, deep enough to matter.',
    batterTo: { base: 'first' },
    runners: [{ from: { base: 'second' }, to: { base: 'home' } }],
    moves: { LF: HIT.chargingLeft },
    ball: [{ base: 'home' }, { fielder: 'LF' }, { base: 'home' }],
  },
  {
    id: 'pickoff-second',
    name: 'Pickoff at second',
    situation: 'Runner on second with a big lead and nobody holding him.',
    category: 'Pitcher and catcher',
    teaches: 'A timing play: the shortstop breaks behind him and the pitcher turns on a count.',
    runners: [{ from: { at: [135, -6] }, to: { base: 'second' } }],
    moves: { SS: { base: 'second' } },
    ball: [{ base: 'mound' }, { base: 'second' }],
  },
  {
    id: 'wild-pitch-second',
    name: 'Wild pitch with a runner on second',
    situation: 'Pitch skips to the backstop with a runner ninety feet from third.',
    category: 'Pitcher and catcher',
    teaches: 'Catcher retrieves and comes up throwing. Third baseman has to be at the bag already.',
    roles: {
      'P': 'Back up third base.',
      'C': 'Get to the ball and come up throwing to third.',
    },
    runners: [{ from: { base: 'second' }, to: { base: 'third' } }],
    moves: { C: HIT.passedBall, '3B': { base: 'third' }, P: { at: [48, -30] } },
    ball: [{ base: 'mound' }, HIT.passedBall, { base: 'third' }],
  },
  {
    id: 'first-and-third-look',
    name: 'First and third — look him back',
    situation: 'Runners on the corners, the runner at first steals, and the man at third is fast.',
    category: 'Pitcher and catcher',
    teaches: 'Give up the base. Throw to the pitcher, check third, and keep the run off the board.',
    runners: [
      { from: { base: 'first' }, to: { base: 'second' } },
      { from: { base: 'third' } },
    ],
    moves: { SS: { base: 'second' }, '3B': { base: 'third' } },
    ball: [{ base: 'mound' }, { base: 'home' }, { base: 'mound' }],
  },
  ...MORE_PLAYS,
];

export const PLAY_CATEGORIES = [...new Set(PLAYS.map((p) => p.category))];

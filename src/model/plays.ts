import { BASES, MOUND, defaultFielderPosition, FIELDER_SPOTS, pointAt } from './fieldGeometry';
import type { Point } from './path';
import { capturePositions, defaultTokens, nextId } from './diagramState';
import type { PositionMap, Token } from './types';

/**
 * A library of situations a 10-11U team works on. Each play is written the way
 * a coach would describe it — who moves where, and where the ball goes — and
 * compiled into the same arrangement-plus-route the board already animates.
 *
 * Positions are given in real feet and bearings (0 is straight to centre
 * field, negative toward third), so a play reads as baseball rather than as
 * coordinates, and stays correct if the field's drawing ever changes.
 */

export type Spot =
  /** A base, or the pitcher's mound. */
  | { base: 'home' | 'first' | 'second' | 'third' | 'mound' }
  /** Anywhere on the field: distance from home plate, and bearing. */
  | { at: [feet: number, angle: number] }
  /** Wherever a fielder ends up — a throw goes *to the shortstop*. */
  | { fielder: string };

export interface PlayDef {
  id: string;
  name: string;
  /** The situation, as a coach would set it up. */
  situation: string;
  category: string;
  /** What the players should take away. */
  teaches: string;
  /** Where the runners start, and where they finish. */
  runners?: { from: Spot; to?: Spot }[];
  /** Fielders that move, and where they end. Everyone else holds. */
  moves?: Record<string, Spot>;
  /** The ball's journey, first point to last. */
  ball: Spot[];
}

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
  start: PositionMap;
  end: PositionMap;
}

/** Turn a play into the arrangements and route the board animates. */
export function compilePlay(def: PlayDef): CompiledPlay {
  const tokens = defaultTokens();

  // Where each fielder finishes — resolved first, so the ball can be thrown to
  // a fielder's finishing spot rather than to where they started.
  const fielderEnds: Record<string, Point> = {};
  for (const spot of FIELDER_SPOTS) fielderEnds[spot.label] = defaultFielderPosition(spot);
  for (const [label, target] of Object.entries(def.moves ?? {})) {
    fielderEnds[label] = resolve(target, fielderEnds);
  }

  const runnerEnds: Record<string, Point> = {};
  for (const runner of def.runners ?? []) {
    const from = resolve(runner.from, fielderEnds);
    const token: Token = { id: nextId('runner'), type: 'runner', x: from.x, y: from.y };
    tokens.push(token);
    runnerEnds[token.id] = runner.to ? resolve(runner.to, fielderEnds) : from;
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

  return { tokens, ballRoute, start, end };
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
};

export const PLAYS: readonly PlayDef[] = [
  // --- Routine outs ------------------------------------------------------
  {
    id: '6-3',
    name: '6-3 — short to first',
    situation: 'Nobody on. Ground ball in the hole at short.',
    category: 'Routine outs',
    teaches: 'Field it, set your feet, then throw. First baseman gets to the bag early.',
    moves: { SS: HIT.holeAtShort, '1B': { base: 'first' }, '2B': { at: [150, 10] } },
    ball: [{ base: 'home' }, { fielder: 'SS' }, { base: 'first' }],
  },
  {
    id: '4-3',
    name: '4-3 — second to first',
    situation: 'Nobody on. Ground ball to the second baseman.',
    category: 'Routine outs',
    teaches: 'The second baseman works around the ball so the throw carries toward first.',
    moves: { '2B': HIT.toSecond, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '2B' }, { base: 'first' }],
  },
  {
    id: '5-3',
    name: '5-3 — third to first',
    situation: 'Nobody on. Ground ball to third.',
    category: 'Routine outs',
    teaches: 'The longest throw on the infield: charge it and get something behind it.',
    moves: { '3B': HIT.toThird, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: '3B' }, { base: 'first' }],
  },
  {
    id: '1-3',
    name: '1-3 — comebacker',
    situation: 'Nobody on. Ball hit straight back at the pitcher.',
    category: 'Routine outs',
    teaches: 'Field it, turn to the glove side, and throw chest-high to first.',
    moves: { P: HIT.comebacker, '1B': { base: 'first' } },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'first' }],
  },
  {
    id: '3-1',
    name: '3-1 — pitcher covers first',
    situation: 'Nobody on. Ground ball pulls the first baseman off the bag.',
    category: 'Routine outs',
    teaches: 'Every ground ball to the right side, the pitcher breaks for first. No exceptions.',
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
    runners: [{ from: { base: 'first' }, to: { base: 'second' } }],
    moves: {
      P: HIT.buntThirdSide,
      '3B': { at: [55, -30] },
      '1B': { at: [60, 32] },
      '2B': { base: 'first' },
      SS: { at: [120, -22] },
    },
    ball: [{ base: 'home' }, { fielder: 'P' }, { base: 'first' }],
  },
  {
    id: 'bunt-second',
    name: 'Bunt — force at second',
    situation: 'Runner on first, bunt fielded quickly out front.',
    category: 'Bunt defense',
    teaches: 'Only if the pitcher is there fast. Listen for the catcher to make the call.',
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
    runners: [{ from: { base: 'second' }, to: { base: 'home' } }],
    moves: { LF: HIT.singleLeft, '3B': { at: [120, -22] }, SS: { base: 'third' } },
    ball: [{ base: 'home' }, { fielder: 'LF' }, { fielder: '3B' }, { base: 'home' }],
  },
  {
    id: 'cut-third-right',
    name: 'Single to right — throw to third',
    situation: 'Runner on first. Base hit to right, runner tries for third.',
    category: 'Cutoffs and relays',
    teaches: 'Shortstop lines up the cut to third. Third baseman stays on the bag.',
    runners: [{ from: { base: 'first' }, to: { base: 'third' } }],
    moves: { RF: HIT.singleRight, SS: { at: [175, 6] }, '3B': { base: 'third' } },
    ball: [{ base: 'home' }, { fielder: 'RF' }, { fielder: 'SS' }, { base: 'third' }],
  },
  {
    id: 'relay-gap',
    name: 'Ball in the gap — relay',
    situation: 'Ball splits left and centre. Batter is running hard.',
    category: 'Cutoffs and relays',
    teaches: 'Shortstop sprints out as the relay, second baseman trails behind him.',
    runners: [{ from: { base: 'home' }, to: { base: 'second' } }],
    moves: {
      LF: HIT.gapLeftCenter,
      CF: { at: [320, -12] },
      SS: { at: [215, -18] },
      '2B': { base: 'second' },
    },
    ball: [{ base: 'home' }, { fielder: 'LF' }, { fielder: 'SS' }, { base: 'second' }],
  },
  {
    id: 'hit-center-second',
    name: 'Base hit to centre — throw to second',
    situation: 'Base hit up the middle. Batter thinks about stretching it.',
    category: 'Cutoffs and relays',
    teaches: 'Shortstop covers on a ball hit to centre, second baseman backs him up.',
    runners: [{ from: { base: 'home' }, to: { base: 'first' } }],
    moves: { CF: HIT.singleCenter, SS: { base: 'second' }, '2B': { at: [200, 14] } },
    ball: [{ base: 'home' }, { fielder: 'CF' }, { base: 'second' }],
  },

  // --- Fly balls ----------------------------------------------------------
  {
    id: 'tag-from-third',
    name: 'Tag up from third',
    situation: 'Runner on third, one out. Fly ball to right field.',
    category: 'Fly balls',
    teaches: 'Catch it moving toward the plate. First baseman lines up the cut.',
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { RF: HIT.flyRight, '1B': { at: [120, 20] } },
    ball: [{ base: 'home' }, { fielder: 'RF' }, { fielder: '1B' }, { base: 'home' }],
  },
  {
    id: 'sac-fly-center',
    name: 'Sacrifice fly to centre',
    situation: 'Runner on third, fewer than two out. Fly ball to centre.',
    category: 'Fly balls',
    teaches: 'Centre fielder gets behind it so he can catch it going forward.',
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { CF: HIT.flyCenter, '1B': { at: [125, 12] } },
    ball: [{ base: 'home' }, { fielder: 'CF' }, { fielder: '1B' }, { base: 'home' }],
  },
  {
    id: 'pop-up-priority',
    name: 'Pop-up priority',
    situation: 'Pop fly between the shortstop and the third baseman.',
    category: 'Fly balls',
    teaches: 'The player moving forward has it. Shortstop calls off third — call it loud, three times.',
    moves: { SS: HIT.popUpThirdSide, '3B': { at: [95, -40] } },
    ball: [{ base: 'home' }, { fielder: 'SS' }],
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
    runners: [
      { from: { base: 'first' }, to: { base: 'second' } },
      { from: { base: 'third' }, to: { base: 'home' } },
    ],
    moves: { SS: { base: 'second' } },
    ball: [{ base: 'mound' }, { base: 'home' }, { base: 'second' }],
  },
  {
    id: 'rundown',
    name: 'Rundown between first and second',
    situation: 'Runner caught off the bag.',
    category: 'Runners moving',
    teaches: 'Run him hard back toward the base he came from, and throw once.',
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
    runners: [{ from: { base: 'third' }, to: { base: 'home' } }],
    moves: { P: { base: 'home' }, C: HIT.ballInDirt },
    ball: [{ base: 'mound' }, HIT.ballInDirt, { base: 'home' }],
  },
  {
    id: 'pitcher-backs-up',
    name: 'Pitcher backs up third',
    situation: 'Runner on first, base hit to left field.',
    category: 'Pitcher and catcher',
    teaches: 'The pitcher has a job on every ball in play: get behind the base the throw is going to.',
    runners: [{ from: { base: 'first' }, to: { base: 'third' } }],
    moves: { LF: HIT.singleLeft, '3B': { base: 'third' }, SS: { at: [170, -24] }, P: { at: [150, -48] } },
    ball: [{ base: 'home' }, { fielder: 'LF' }, { base: 'third' }],
  },
];

export const PLAY_CATEGORIES = [...new Set(PLAYS.map((p) => p.category))];

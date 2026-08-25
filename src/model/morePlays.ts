import { cutManFor, relayManFor } from './defense';
import type { BaseName, PlayDef, Spot } from './playTypes';
import { feetOf } from './spots';

const HOME: Spot = { base: 'home' };
const FIRST: Spot = { base: 'first' };
const SECOND: Spot = { base: 'second' };
const THIRD: Spot = { base: 'third' };
const MOUND: Spot = { base: 'mound' };
/** Caught in the air: the batter ran, he just did not get there. */
const BATTER_OUT: Spot = { at: [45, 45] };
/** Foul ground behind third, where a middle infielder trails a throw. */
const BEHIND_THIRD: Spot = { at: [104, -52] };

/**
 * The rest of the library.
 *
 * The outfield series is generated, because the outfield's work is the same
 * three shapes in three places: get to the ball, hit the man lined up between
 * you and the bag, and make the runner earn the next base. Who that man is, who
 * covers behind him and who gets behind the bag are not written here — that is
 * doctrine, and defense.ts applies the same doctrine to all 150 plays.
 */

const SPOTS = {
  leftShallow: { at: [228, -30] } as Spot,
  leftMedium: { at: [258, -34] } as Spot,
  leftDeep: { at: [296, -26] } as Spot,
  leftGap: { at: [322, -16] } as Spot,
  leftWall: { at: [346, -28] } as Spot,
  leftCorner: { at: [334, -40] } as Spot,

  centerShallow: { at: [240, 2] } as Spot,
  centerMedium: { at: [262, 6] } as Spot,
  centerDeep: { at: [300, 0] } as Spot,
  centerAlley: { at: [278, 15] } as Spot,
  centerGap: { at: [322, -12] } as Spot,
  centerWall: { at: [348, -14] } as Spot,
  centerFence: { at: [358, 2] } as Spot,

  rightShallow: { at: [228, 28] } as Spot,
  rightMedium: { at: [258, 34] } as Spot,
  rightDeep: { at: [296, 24] } as Spot,
  rightGap: { at: [322, 14] } as Spot,
  rightWall: { at: [346, 30] } as Spot,
  rightCorner: { at: [334, 40] } as Spot,

  buntThird: { at: [40, -18] } as Spot,
  buntFirst: { at: [38, 18] } as Spot,
  buntMiddle: { at: [40, 2] } as Spot,
  chargeThird: { at: [50, -26] } as Spot,
  chargeFirst: { at: [52, 26] } as Spot,
  dribblerPlate: { at: [24, 182] } as Spot,
  passedBall: { at: [30, 154] } as Spot,
  passedBallFirst: { at: [24, 164] } as Spot,
  chopperMound: { at: [60, -4] } as Spot,
  slowRollerThird: { at: [56, -34] } as Spot,
  shortUpMiddle: { at: [150, 4] } as Spot,
  secondRight: { at: [148, 20] } as Spot,
  thirdHot: { at: [110, -36] } as Spot,
  firstHot: { at: [110, 36] } as Spot,
  plateFence: { at: [18, 214] } as Spot,
  /** Up the line off the mound: close enough to cover the plate, not on top of the catcher. */
  infrontOfPlate: { at: [24, 0] } as Spot,
};

interface Outfield {
  prefix: string;
  label: 'LF' | 'CF' | 'RF';
  /** How a coach says where it went. */
  zone: string;
  shallow: Spot;
  medium: Spot;
  deep: Spot;
  gap: Spot;
  gapName: string;
  wall: Spot;
  wallName: string;
  /** The deepest ball in this part of the park, and what a coach calls it. */
  far: Spot;
  farName: string;
  /** The far edge of his ground: the line for a corner, the alley for centre. */
  edge: Spot;
  edgeName: string;
}

/**
 * A ball hit to the outfield, thrown to a bag through whoever lines it up.
 *
 * The play names the chain — outfielder, relay man, cut man, bag — because who
 * touches the ball is the play. Where each of them stands is not: defense.ts
 * puts the cut man 45 feet off the bag on the throwing line and the relay man
 * out where he can turn it around, and it does that identically on all 150
 * plays. Writing the spots here as well would only be a second opinion, and the
 * second opinion is how a third baseman ends up cutting from the shortstop hole.
 */
function outfieldPlay(config: {
  id: string;
  name: string;
  situation: string;
  teaches: string;
  of: Outfield;
  at: Spot;
  batterTo?: Spot;
  runners?: { from: Spot; to?: Spot }[];
  /** Throw it straight in, through a relay man, or through both. */
  through?: 'cut' | 'relay' | 'double';
  to: Spot;
  /** The bag the throw was lined up for, when `to` is where it got redirected. */
  aim?: BaseName;
  roles?: Record<string, string>;
  category?: string;
}): PlayDef {
  const target = config.aim ?? ('base' in config.to ? config.to.base : 'home');
  const double = config.through === 'double';
  const chain: Spot[] = [];

  if (config.through === 'relay' || double) chain.push({ fielder: relayManFor(config.at) });
  if (config.through === 'cut' || double) {
    chain.push({
      fielder: cutManFor(target, config.of.label, feetOf(config.at)!, { relayed: double })[0],
    });
  }

  return {
    id: config.id,
    name: config.name,
    situation: config.situation,
    category: config.category ?? 'Cutoffs and relays',
    teaches: config.teaches,
    roles: config.roles,
    batterTo: config.batterTo,
    runners: config.runners,
    aim: config.aim,
    moves: { [config.of.label]: config.at },
    ball: [HOME, { fielder: config.of.label }, ...chain, config.to],
  };
}

/**
 * The twenty plays every outfielder works through, in his own part of the
 * field: twelve balls on the ground and eight in the air.
 */
function outfieldSeries(of: Outfield): PlayDef[] {
  const fly = (extra: Partial<PlayDef> & Pick<PlayDef, 'id' | 'name' | 'situation' | 'teaches'>) =>
    ({ category: 'Fly balls', batterTo: BATTER_OUT, ...extra }) as PlayDef;

  return [
    outfieldPlay({
      id: `${of.prefix}-single-home`,
      name: `Single to ${of.zone} — throw home`,
      situation: `Runner on second. Base hit on the ground into ${of.zone} field.`,
      teaches: 'Get it to the plate on a line, through the man lined up in front of it.',
      of,
      at: of.deep,
      batterTo: FIRST,
      runners: [{ from: SECOND, to: HOME }],
      to: HOME,
      roles: { C: 'Show a target up the line and call the cut loud enough to be heard.' },
    }),
    // First to third is a real play on a ball to right — the throw comes from
    // the far corner of the park — and a gift anywhere else. On the pull side
    // the lead runner has to stop at second, so the play is the throw behind him.
    of.label === 'RF'
      ? outfieldPlay({
          id: `${of.prefix}-single-third`,
          name: `Single to ${of.zone} — he goes first to third`,
          situation: `Runner on first. Base hit to ${of.zone}; he rounds second without stopping.`,
          teaches: 'The longest throw in the park. Hit the man lined up for it rather than the bag.',
          of,
          at: of.deep,
          batterTo: FIRST,
          runners: [{ from: FIRST, to: THIRD }],
          to: THIRD,
        })
      : outfieldPlay({
          id: `${of.prefix}-single-third`,
          name: `Single to ${of.zone} — throw behind him at second`,
          situation: `Runner on first. Base hit to ${of.zone}; he takes second and drifts off it.`,
          teaches: 'The out is behind the runner, not in front of him. Come up throwing to second.',
          of,
          at: of.deep,
          batterTo: FIRST,
          runners: [{ from: FIRST, to: SECOND }],
          to: SECOND,
        }),
    outfieldPlay({
      id: `${of.prefix}-hold-third`,
      name: `Single to ${of.zone} — hold him at third`,
      situation: `Runner on second. Clean single in front of the ${of.zone} fielder.`,
      teaches: 'Attack the ball so the throw beats him to third and the run stays on base.',
      of,
      at: of.shallow,
      batterTo: FIRST,
      runners: [{ from: SECOND, to: THIRD }],
      to: THIRD,
    }),
    outfieldPlay({
      id: `${of.prefix}-batter-second`,
      name: `${of.zone} single — the batter goes for two`,
      situation: `Base hit to shallow ${of.zone}. The batter never breaks stride at first.`,
      teaches: 'Come up throwing to second. A hit that stops at first is a hit that cost nothing.',
      of,
      at: of.shallow,
      batterTo: SECOND,
      to: SECOND,
    }),
    outfieldPlay({
      id: `${of.prefix}-gap-second`,
      name: `${of.gapName} — relay to second`,
      situation: `Ball splits ${of.gapName} with the batter stretching it into a double.`,
      teaches: 'The relay man comes out to meet the throw, so the double stays a double.',
      of,
      at: of.gap,
      batterTo: SECOND,
      through: 'relay',
      to: SECOND,
    }),
    outfieldPlay({
      id: `${of.prefix}-gap-third`,
      name: `${of.gapName} — relay to third`,
      situation: `Runner on first. Ball into ${of.gapName}; he is waved on to third.`,
      teaches: 'Hit the relay man with something he can turn on. Third base is still in play.',
      of,
      at: of.gap,
      batterTo: SECOND,
      runners: [{ from: FIRST, to: THIRD }],
      through: 'relay',
      to: THIRD,
    }),
    outfieldPlay({
      id: `${of.prefix}-off-wall-third`,
      name: `${of.wallName} — play the batter at third`,
      situation: `Drive one-hops ${of.wallName}. The batter is not stopping at second.`,
      teaches: 'Play the carom, hit the relay, and make third base the last bag he sees.',
      of,
      at: of.wall,
      batterTo: THIRD,
      through: 'relay',
      to: THIRD,
    }),
    outfieldPlay({
      id: `${of.prefix}-off-wall-home`,
      name: `${of.wallName} — relay home`,
      situation: `Runner on second. Ball rattles off ${of.wallName} and the run is coming.`,
      teaches: 'Get to where the ball is going, then throw through the relay, not over it.',
      of,
      at: of.wall,
      batterTo: SECOND,
      runners: [{ from: SECOND, to: HOME }],
      // Too far for one throw and too far for two men: a relay out in the grass
      // and a cut man in front of the plate.
      through: 'double',
      to: HOME,
      roles: { C: 'Line the relay man up and be ready to tag at the plate.' },
    }),
    outfieldPlay({
      id: `${of.prefix}-cut-batter`,
      name: `${of.zone} throw home — cut it and get the batter`,
      situation: `Runner scores from second on a hit to ${of.zone}; the batter rounds first too far.`,
      teaches: 'If the plate has no chance, the cut man takes it and gets the runner behind it.',
      of,
      at: of.deep,
      batterTo: SECOND,
      runners: [{ from: SECOND, to: HOME }],
      through: 'cut',
      // Lined up for the plate. Where it ends up is the cut man's decision.
      aim: 'home',
      to: SECOND,
    }),
    outfieldPlay({
      id: `${of.prefix}-flare-home`,
      name: `${of.zone} flare — do-or-die throw home`,
      situation: `Runner on second. Soft liner drops in front of the ${of.zone} fielder.`,
      teaches: 'Charge it and throw through the ball. There is no time to set your feet.',
      of,
      at: of.shallow,
      batterTo: FIRST,
      runners: [{ from: SECOND, to: HOME }],
      to: HOME,
      roles: { C: 'Own the plate and take the tag play.' },
    }),
    outfieldPlay({
      id: `${of.prefix}-far-home`,
      name: `${of.farName} — double cut home`,
      situation: `Runner on second. Ball runs all the way to ${of.farName}.`,
      teaches: 'The longest throw on the field is two throws: relay man, cut man, plate.',
      of,
      at: of.far,
      batterTo: SECOND,
      runners: [{ from: SECOND, to: HOME }],
      through: 'double',
      to: HOME,
      roles: { C: 'Line up the relay and keep talking until the ball is in.' },
    }),
    outfieldPlay({
      id: `${of.prefix}-far-third`,
      name: `${of.farName} — stop the lead runner at third`,
      situation: `Runner on first. Ball reaches ${of.farName} and he is sent to third.`,
      teaches: 'One clean relay is faster than a hero throw, and third base is where he stops.',
      of,
      at: of.far,
      batterTo: SECOND,
      runners: [{ from: FIRST, to: THIRD }],
      through: 'relay',
      to: THIRD,
    }),

    fly({
      id: `${of.prefix}-deep-tag-home`,
      name: `Deep ${of.zone} fly — tag at home`,
      situation: `Runner on third, one out. Fly ball deep enough in ${of.zone} to score him.`,
      teaches: 'Get behind it, catch it coming forward, and throw through the cut man.',
      runners: [{ from: THIRD, to: HOME }],
      moves: { [of.label]: of.deep },
      ball: [HOME, { fielder: of.label }, HOME],
      roles: {
        [of.label]: 'Catch it moving toward the plate and throw through the cut.',
        C: 'Set up in front of the plate and take the tag play.',
      },
    }),
    fly({
      id: `${of.prefix}-do-or-die`,
      name: `Shallow ${of.zone} fly — charge the catch`,
      situation: `Runner on third. Soft fly hangs up in front of the ${of.zone} fielder.`,
      teaches: 'Catch it on the run so the throw is already going where it needs to.',
      runners: [{ from: THIRD, to: HOME }],
      moves: { [of.label]: of.shallow },
      ball: [HOME, { fielder: of.label }, HOME],
      roles: { [of.label]: 'Charge through the catch and throw home without resetting.' },
    }),
    fly({
      id: `${of.prefix}-tag-third`,
      name: `Deep ${of.zone} fly — tag to third`,
      situation: `Runner on second, one out. Catchable fly ball to deep ${of.zone}.`,
      teaches: 'He is going to tag and go. The throw to third is what makes him think twice.',
      runners: [{ from: SECOND, to: THIRD }],
      moves: { [of.label]: of.deep },
      ball: [HOME, { fielder: of.label }, THIRD],
    }),
    fly({
      id: `${of.prefix}-line-double`,
      name: `${of.zone} line drive — double him off first`,
      situation: `Runner on first, and he is moving. Liner caught in shallow ${of.zone}.`,
      teaches: 'Secure the catch first, then throw behind him before he can turn around.',
      runners: [{ from: FIRST, to: FIRST }],
      moves: { [of.label]: of.shallow },
      ball: [HOME, { fielder: of.label }, FIRST],
      roles: { [of.label]: 'Catch it and come up throwing to first.' },
    }),
    fly({
      id: `${of.prefix}-edge-catch`,
      name: `${of.edgeName} catch — double him off second`,
      situation: `Runner on second with a big lead. Ball caught over toward ${of.edgeName}.`,
      teaches: 'The runner furthest off the bag is the out. Throw behind him, not ahead of him.',
      runners: [{ from: SECOND, to: SECOND }],
      moves: { [of.label]: of.edge },
      ball: [HOME, { fielder: of.label }, SECOND],
      roles: { [of.label]: 'Catch it under control and throw behind the runner at second.' },
    }),
    fly({
      id: `${of.prefix}-gap-priority`,
      name: `${of.gapName} fly — call it and throw behind him`,
      situation: `Runners on first and second. Fly ball splitting ${of.gapName}.`,
      teaches: 'Whoever calls it, catches it. Everybody else backs up and gets out of the way.',
      runners: [
        { from: SECOND, to: SECOND },
        { from: FIRST, to: FIRST },
      ],
      moves: { [of.label]: of.gap },
      ball: [HOME, { fielder: of.label }, SECOND],
      roles: {
        [of.label]: 'Call it loud, catch it, and throw behind the runner at second.',
      },
    }),
    fly({
      id: `${of.prefix}-two-runners`,
      name: `${of.zone} sacrifice fly — the run scores anyway`,
      situation: `Runners on first and third, one out. Fly ball to medium ${of.zone}.`,
      teaches: 'You cannot always stop the run. Throw to the cut man and keep the rest still.',
      runners: [
        { from: THIRD, to: HOME },
        { from: FIRST, to: FIRST },
      ],
      moves: { [of.label]: of.medium },
      ball: [HOME, { fielder: of.label }, HOME],
      roles: { C: 'Take the throw at the plate and check the other runners.' },
    }),
    fly({
      id: `${of.prefix}-hold-the-runner`,
      name: `Shallow ${of.zone} fly — hold him at third`,
      situation: `Runner on third, less than two out. Fly ball too shallow to tag on.`,
      teaches: 'Catch it moving in and show him the ball. A throw he can see keeps him at third.',
      runners: [{ from: THIRD }],
      moves: { [of.label]: of.shallow },
      // The throw never gets past the cut man, which is the point of it.
      aim: 'home',
      ball: [
        HOME,
        { fielder: of.label },
        { fielder: cutManFor('home', of.label, feetOf(of.shallow)!)[0] },
      ],
      roles: {
        [of.label]: 'Catch it coming in and throw to the cut man so the runner stays put.',
      },
    }),
  ];
}

const MORE_OUTFIELD_PLAYS = [
  ...outfieldSeries({
    prefix: 'lf',
    label: 'LF',
    zone: 'left',
    shallow: SPOTS.leftShallow,
    medium: SPOTS.leftMedium,
    deep: SPOTS.leftDeep,
    gap: SPOTS.leftGap,
    gapName: 'the left-centre gap',
    wall: SPOTS.leftWall,
    wallName: 'the wall in left',
    far: SPOTS.leftCorner,
    farName: 'the left-field corner',
    edge: SPOTS.leftMedium,
    edgeName: 'the left-field line',
  }),
  ...outfieldSeries({
    prefix: 'cf',
    label: 'CF',
    zone: 'centre',
    shallow: SPOTS.centerShallow,
    medium: SPOTS.centerMedium,
    deep: SPOTS.centerDeep,
    gap: SPOTS.centerGap,
    gapName: 'the left-centre gap',
    wall: SPOTS.centerWall,
    wallName: 'the wall in left-centre',
    far: SPOTS.centerFence,
    farName: 'the fence in dead centre',
    edge: SPOTS.centerAlley,
    edgeName: 'the alley in right-centre',
  }),
  ...outfieldSeries({
    prefix: 'rf',
    label: 'RF',
    zone: 'right',
    shallow: SPOTS.rightShallow,
    medium: SPOTS.rightMedium,
    deep: SPOTS.rightDeep,
    gap: SPOTS.rightGap,
    gapName: 'the right-centre gap',
    wall: SPOTS.rightWall,
    wallName: 'the wall in right',
    far: SPOTS.rightCorner,
    farName: 'the right-field corner',
    edge: SPOTS.rightMedium,
    edgeName: 'the right-field line',
  }),
];

const MORE_CATCHER_AND_PITCHER_PLAYS: readonly PlayDef[] = [
  {
    id: 'catcher-bunt-first',
    name: 'Bunt to the catcher — out at first',
    situation: 'Drag bunt dies in front of the plate with only one play on it.',
    category: 'Bunt defense',
    teaches: 'Catcher comes out fast, gets his feet around the ball, and throws inside the line.',
    batterTo: FIRST,
    moves: { C: SPOTS.dribblerPlate },
    ball: [HOME, { fielder: 'C' }, FIRST],
  },
  {
    id: 'catcher-bunt-home',
    name: 'Bunt to the catcher — play at the plate',
    situation: 'Runner on third breaking. Bunt pops dead in front of the plate.',
    category: 'Bunt defense',
    teaches: 'The catcher has to read it first, and somebody has to be standing on the plate.',
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: { C: SPOTS.dribblerPlate },
    ball: [HOME, { fielder: 'C' }, HOME],
  },
  {
    id: 'catcher-backpick-first',
    name: 'Catcher back-picks first',
    situation: 'Runner at first wanders off the bag after the pitch.',
    category: 'Runners moving',
    teaches: 'Quick feet and a short throw beat a runner who has stopped paying attention.',
    runners: [{ from: FIRST, to: FIRST }],
    ball: [MOUND, HOME, FIRST],
  },
  {
    id: 'catcher-backpick-second',
    name: 'Catcher back-picks second',
    situation: 'Runner on second gets lazy after taking the sign.',
    category: 'Runners moving',
    teaches: 'The middle infielder shows late and the catcher throws right through the bag.',
    runners: [{ from: SECOND, to: SECOND }],
    moves: { SS: SECOND },
    ball: [MOUND, HOME, SECOND],
  },
  {
    id: 'catcher-throw-second',
    name: 'Catcher throws out a steal at second',
    situation: 'Runner on first breaks on first movement.',
    category: 'Runners moving',
    teaches: 'Catch, replace the feet, and throw over the top of the mound.',
    runners: [{ from: FIRST, to: SECOND }],
    moves: { SS: SECOND },
    ball: [MOUND, HOME, SECOND],
  },
  {
    id: 'catcher-throw-third',
    name: 'Catcher throws out a steal at third',
    situation: 'Runner on second goes early and the defence is ready for it.',
    category: 'Runners moving',
    teaches: 'Third baseman beats the runner to the bag; everybody else gets behind the throw.',
    roles: { SS: 'Trail the runner and back up the throw to third.' },
    runners: [{ from: SECOND, to: THIRD }],
    moves: { '3B': THIRD, SS: BEHIND_THIRD },
    ball: [MOUND, HOME, THIRD],
  },
  {
    id: 'catcher-passed-ball-second',
    name: 'Passed ball — keep the runner at second',
    situation: 'Runner on first. Pitch skips away, but not far.',
    category: 'Pitcher and catcher',
    teaches: 'Catcher recovers fast enough that the extra base never happens.',
    roles: { C: 'Get to the ball, square up, and come up throwing to second.' },
    runners: [{ from: FIRST, to: SECOND }],
    moves: { C: SPOTS.passedBallFirst, SS: SECOND },
    ball: [MOUND, { fielder: 'C' }, SECOND],
  },
  {
    id: 'catcher-passed-ball-home',
    name: 'Passed ball — play at the plate',
    situation: 'Runner on third breaks as the ball kicks toward the screen.',
    category: 'Pitcher and catcher',
    teaches: 'Catcher goes and gets it; the pitcher owns the plate the moment he leaves it.',
    roles: { C: 'Get to the ball and flip it to the pitcher covering the plate.' },
    runners: [{ from: THIRD, to: HOME }],
    moves: { C: SPOTS.passedBall, P: HOME },
    ball: [MOUND, { fielder: 'C' }, HOME],
  },
  {
    id: 'catcher-pop-fence',
    name: 'Pop-up at the backstop — throw to first',
    situation: 'Runner on first. Foul ball climbs high and drifts back to the fence.',
    category: 'Fly balls',
    teaches: 'Turn, find it, catch it — then look the runner back before you celebrate.',
    roles: { C: 'Catch it at the fence, then throw to first if the runner has drifted.' },
    batterTo: BATTER_OUT,
    runners: [{ from: FIRST, to: FIRST }],
    moves: { C: SPOTS.plateFence },
    ball: [HOME, { fielder: 'C' }, FIRST],
  },
  {
    id: 'catcher-dribbler-home',
    name: 'Dribbler in front — flip home',
    situation: 'Bases loaded. Soft roller stops halfway to the mound.',
    category: 'Double plays',
    teaches: 'Catcher attacks the ball; the pitcher takes his place at the plate for the force.',
    batterTo: FIRST,
    runners: [
      { from: THIRD, to: HOME },
      { from: SECOND, to: THIRD },
      { from: FIRST, to: SECOND },
    ],
    moves: { C: SPOTS.dribblerPlate },
    ball: [HOME, { fielder: 'C' }, HOME],
  },
  {
    id: 'pitcher-bunt-third',
    name: 'Pitcher fields the bunt and gets third',
    situation: 'Runners on first and second. Bunt dies on the third-base side.',
    category: 'Bunt defense',
    teaches: 'The pitcher reads it early and gets the lead runner before everybody is safe.',
    roles: { '3B': 'Charge the line, then get out of the pitcher way if he calls you off.' },
    batterTo: FIRST,
    runners: [
      { from: SECOND, to: THIRD },
      { from: FIRST, to: SECOND },
    ],
    moves: { P: SPOTS.buntThird, SS: THIRD, '2B': FIRST, '3B': SPOTS.chargeThird },
    ball: [HOME, { fielder: 'P' }, THIRD],
  },
  {
    id: 'pitcher-bunt-first',
    name: 'Pitcher fields the bunt and gets first',
    situation: 'Bunt rolls up the first-base line with nobody forced ahead of the batter.',
    category: 'Bunt defense',
    teaches: 'Take the sure out and trust whoever is covering the bag behind you.',
    batterTo: FIRST,
    moves: { P: SPOTS.buntFirst, '1B': SPOTS.chargeFirst, '2B': FIRST },
    ball: [HOME, { fielder: 'P' }, FIRST],
  },
  {
    id: 'infield-in-throw-home',
    name: 'Infield in — throw home on the slow chopper',
    situation: 'Runner on third, infield in. Slow chopper to the shortstop.',
    category: 'Pitcher and catcher',
    teaches: 'The pitcher has no glove work here — his job is to be behind the plate.',
    roles: { P: 'Get behind the catcher, deep enough that a bad throw costs nothing.' },
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: { SS: SPOTS.shortUpMiddle },
    ball: [HOME, { fielder: 'SS' }, HOME],
  },
  {
    id: 'pitcher-backup-first-line',
    name: 'Pitcher backs up first on the line',
    situation: 'Ground ball hugs the first-base line and pulls the first baseman off the bag.',
    category: 'Pitcher and catcher',
    teaches: 'The pitcher never watches a play — the throw that gets away is his to stop.',
    batterTo: FIRST,
    moves: { '1B': SPOTS.firstHot, '2B': FIRST },
    ball: [HOME, { fielder: '1B' }, FIRST],
  },
  {
    id: 'pitcher-backup-home-center',
    name: 'Pitcher backs up home from centre field',
    situation: 'Runner on second. Base hit to centre and the throw is coming to the plate.',
    category: 'Pitcher and catcher',
    teaches: 'Deep enough behind the plate turns a throw that gets by into one base, not two.',
    roles: { P: 'Get behind the plate and keep the overthrow in front of you.' },
    batterTo: FIRST,
    runners: [{ from: SECOND, to: HOME }],
    moves: { CF: SPOTS.centerDeep },
    ball: [HOME, { fielder: 'CF' }, HOME],
  },
  {
    id: 'pitcher-comebacker-second',
    name: 'Comebacker — start it at second',
    situation: 'Runner on first. Ground ball right back through the box.',
    category: 'Double plays',
    teaches: 'Turn, find the bag man, and lead him across it. Do not rush the feed.',
    batterTo: FIRST,
    runners: [{ from: FIRST, to: SECOND }],
    moves: { P: SPOTS.chopperMound, SS: SECOND },
    ball: [HOME, { fielder: 'P' }, SECOND, FIRST],
  },
  {
    id: 'pitcher-comebacker-home',
    name: 'Comebacker — home to first',
    situation: 'Bases loaded. Soft comebacker gives the pitcher time to look at the plate.',
    category: 'Double plays',
    teaches: 'Get the force at home first and let the catcher finish it at first.',
    batterTo: FIRST,
    runners: [
      { from: THIRD, to: HOME },
      { from: SECOND, to: THIRD },
      { from: FIRST, to: SECOND },
    ],
    moves: { P: SPOTS.chopperMound },
    ball: [HOME, { fielder: 'P' }, HOME, FIRST],
  },
  {
    id: 'pitcher-slow-roller-home',
    name: 'Slow roller — pitcher to the plate',
    situation: 'Runner on third. Chopper dies between home and the mound.',
    category: 'Routine outs',
    teaches: 'Bare hand it and flip home. A throw from your feet is a throw too late.',
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: { P: SPOTS.chopperMound },
    ball: [HOME, { fielder: 'P' }, HOME],
  },
  {
    id: 'pitcher-cover-first-right',
    name: 'Pitcher covers first on the right-side play',
    situation: 'Second baseman ranges far to his glove side for a ground ball.',
    category: 'Routine outs',
    teaches: 'Any ball to the right side and the pitcher is already running to the bag.',
    roles: {
      '1B': 'Break for the ball — that is the whole reason the pitcher has the bag.',
    },
    batterTo: FIRST,
    moves: { '1B': SPOTS.firstHot, '2B': SPOTS.secondRight, P: FIRST },
    ball: [HOME, { fielder: '2B' }, { fielder: 'P' }],
  },
  {
    id: 'pitcher-backup-second-center',
    name: 'Pitcher trails the throw to second',
    situation: 'Base hit to centre with the batter trying to stretch it into a double.',
    category: 'Pitcher and catcher',
    teaches: 'Follow the throw. If it gets through the bag, the pitcher is the reason it stops.',
    roles: { P: 'Trail the throw to second and keep the ball from skipping away.' },
    batterTo: SECOND,
    moves: { CF: SPOTS.centerShallow, P: { at: [172, -6] } },
    ball: [HOME, { fielder: 'CF' }, SECOND],
  },
];

const MORE_INFIELD_AND_RUNNER_PLAYS: readonly PlayDef[] = [
  {
    id: 'wheel-third',
    name: 'Wheel play — out at third',
    situation: 'Runners on first and second. Corners crash the bunt and the shortstop rotates.',
    category: 'Bunt defense',
    teaches: 'The rotation starts before the ball is dead, or the lead runner is already safe.',
    roles: {
      '3B': 'Crash the line hard — the shortstop has third behind you.',
      P: 'Break for the middle and take anything the third baseman cannot reach.',
    },
    batterTo: FIRST,
    runners: [
      { from: SECOND, to: THIRD },
      { from: FIRST, to: SECOND },
    ],
    moves: {
      '3B': SPOTS.buntThird,
      P: SPOTS.buntMiddle,
      '1B': SPOTS.chargeFirst,
      SS: THIRD,
      '2B': FIRST,
    },
    ball: [HOME, { fielder: '3B' }, THIRD],
  },
  {
    id: 'wheel-home',
    name: 'Wheel play — play at the plate',
    situation: 'Runner on third. The infield crashes a bunt dropped in front of the plate.',
    category: 'Bunt defense',
    teaches: 'The whole point of crashing is the lead runner. Get him before he touches home.',
    roles: {
      '1B': 'Charge from the right side and take anything the pitcher cannot reach.',
      '3B': 'Crash from third and give the pitcher room to work in the middle.',
    },
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: {
      P: SPOTS.buntMiddle,
      '3B': SPOTS.chargeThird,
      '1B': SPOTS.chargeFirst,
      '2B': FIRST,
    },
    ball: [HOME, { fielder: 'P' }, HOME],
  },
  {
    id: 'first-third-daylight',
    name: 'First and third — daylight throw to first',
    situation: 'Runners on the corners. The catcher catches the trail runner leaning.',
    category: 'Runners moving',
    teaches: 'Throw behind the trail runner only when the run at third cannot beat it home.',
    roles: { P: 'Break for the plate the moment the catcher throws — the run is the risk.' },
    runners: [
      { from: FIRST, to: FIRST },
      { from: THIRD },
    ],
    // In front of the plate, not on it: the catcher is still standing there and
    // still the one making the throw.
    moves: { P: SPOTS.infrontOfPlate },
    ball: [MOUND, HOME, FIRST],
  },
  {
    id: 'first-third-cutoff',
    name: 'First and third — cut the throw and get the run',
    situation: 'The trail runner steals and the man at third breaks with the throw.',
    category: 'Runners moving',
    teaches: 'The middle infielder is the decision: take it and throw home, or let it go.',
    roles: { P: 'Break off the mound toward the plate — the catcher has thrown and cannot get back.' },
    runners: [
      { from: FIRST, to: SECOND },
      { from: THIRD, to: HOME },
    ],
    moves: { SS: SECOND, P: SPOTS.infrontOfPlate },
    ball: [MOUND, HOME, SECOND, { fielder: 'P' }],
  },
  {
    id: 'delayed-double-steal',
    name: 'Delayed double steal',
    situation: 'Runners on first and third move once the catcher relaxes.',
    category: 'Runners moving',
    teaches: 'Give up the base and keep the run. Nothing about second base is worth a run.',
    roles: {
      C: 'Step toward third, look the runner back, then throw to the pitcher.',
      P: 'Come off the mound toward the plate so the run cannot walk in behind the throw.',
    },
    runners: [
      { from: FIRST, to: SECOND },
      { from: THIRD },
    ],
    moves: { SS: SECOND, P: SPOTS.infrontOfPlate },
    ball: [MOUND, HOME, { fielder: 'P' }],
  },
  {
    id: 'snap-throw-third',
    name: 'Pitchout and snap throw to third',
    situation: 'Runner on second creeps too far toward third before the pitch.',
    category: 'Runners moving',
    teaches: 'Sell the pitch, get out of the crouch, and throw straight through the bag.',
    roles: { SS: 'Break in behind him and back up the throw.' },
    runners: [{ from: SECOND, to: SECOND }],
    moves: { '3B': THIRD, SS: BEHIND_THIRD },
    ball: [MOUND, HOME, THIRD],
  },
  {
    id: 'snap-throw-first',
    name: 'Pitchout and snap throw to first',
    situation: 'Runner on first drifts after the look-in.',
    category: 'Runners moving',
    teaches: 'A quick exchange beats a runner who thinks the ball is going back to the mound.',
    runners: [{ from: FIRST, to: FIRST }],
    ball: [MOUND, HOME, FIRST],
  },
  {
    id: 'rundown-second-third',
    name: 'Rundown between second and third',
    situation: 'Runner gets hung out trying for too much on a ground ball.',
    category: 'Runners moving',
    teaches: 'Run him back to the bag he left, and keep a defender behind the tag.',
    roles: { '2B': 'Trail the rundown so there is always somebody behind the throw.' },
    runners: [{ from: { at: [144, -24] }, to: SECOND }],
    moves: { SS: SECOND, '3B': THIRD, '2B': { at: [168, -4] } },
    ball: [THIRD, SECOND],
  },
  {
    id: 'squeeze-first-base',
    name: 'Safety squeeze — take the out at first',
    situation: 'Runner on third waits to see the bunt down before he breaks.',
    category: 'Bunt defense',
    teaches: 'Once he hesitates, the run is not the play — the batter is.',
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: { P: SPOTS.buntThird, '3B': SPOTS.chargeThird },
    ball: [HOME, { fielder: 'P' }, FIRST],
  },
  {
    id: 'middle-crash-home',
    name: 'Middle infield crash — out at home',
    situation: 'Runner on third, corners back. The shortstop reads the chop and crashes late.',
    category: 'Routine outs',
    teaches: 'A late crash still works if he comes under control and throws on line.',
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: { SS: SPOTS.shortUpMiddle },
    ball: [HOME, { fielder: 'SS' }, HOME],
  },
  {
    id: '6-2-home',
    name: '6-2 — shortstop home',
    situation: 'Bases loaded, infield in. Ground ball to the shortstop.',
    category: 'Double plays',
    teaches: 'With a force at every bag, the shortest out is the one at the plate.',
    batterTo: FIRST,
    runners: [
      { from: THIRD, to: HOME },
      { from: SECOND, to: THIRD },
      { from: FIRST, to: SECOND },
    ],
    moves: { SS: SPOTS.shortUpMiddle },
    ball: [HOME, { fielder: 'SS' }, HOME],
  },
  {
    id: '5-2-home',
    name: '5-2 — third base home',
    situation: 'Runner on third. Slow roller to third with the corners in.',
    category: 'Routine outs',
    teaches: 'Attack it and throw home before the runner can steal the plate.',
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: { '3B': SPOTS.thirdHot },
    ball: [HOME, { fielder: '3B' }, HOME],
  },
  {
    id: '4-2-home',
    name: '4-2 — second base home',
    situation: 'Runner on third. Chopper to the second baseman with the infield in.',
    category: 'Routine outs',
    teaches: 'Come through the ball and throw straight to the plate, not across your body.',
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: { '2B': SPOTS.secondRight },
    ball: [HOME, { fielder: '2B' }, HOME],
  },
  {
    id: '2-5-pick',
    name: '2-5 back-pick at third',
    situation: 'Runner takes a huge turn at third after a foul ball.',
    category: 'Runners moving',
    teaches: 'The catcher snaps it while the third baseman sneaks back behind the runner.',
    runners: [{ from: { at: [52, -54] }, to: THIRD }],
    moves: { '3B': THIRD },
    ball: [HOME, THIRD],
  },
  {
    id: '2-4-backpick',
    name: '2-4 snap throw to second',
    situation: 'Runner at second relaxes as the catcher receives the pitch.',
    category: 'Runners moving',
    teaches: 'A quick transfer gives the middle infield a chance to steal an out.',
    runners: [{ from: { at: [140, 6] }, to: SECOND }],
    moves: { '2B': SECOND },
    ball: [HOME, SECOND],
  },
  {
    id: '3-2-home',
    name: '3-2 — first baseman home',
    situation: 'Bases loaded, infield in. Ground ball right at the first baseman.',
    category: 'Double plays',
    teaches: 'The first baseman is a fielder first. Get the run, then worry about the bag.',
    batterTo: FIRST,
    runners: [
      { from: THIRD, to: HOME },
      { from: SECOND, to: THIRD },
      { from: FIRST, to: SECOND },
    ],
    moves: { '1B': SPOTS.firstHot, '2B': FIRST },
    ball: [HOME, { fielder: '1B' }, HOME],
  },
  {
    id: '6-5-force',
    name: 'Shortstop starts the force at third',
    situation: 'Runners on first and second. Ground ball through the left side.',
    category: 'Double plays',
    teaches: 'Third base is the first out while the lead runner is still in front of you.',
    batterTo: FIRST,
    runners: [
      { from: SECOND, to: THIRD },
      { from: FIRST, to: SECOND },
    ],
    moves: { SS: SPOTS.shortUpMiddle, '3B': THIRD },
    ball: [HOME, { fielder: 'SS' }, THIRD, FIRST],
  },
  {
    id: '4-1-cover',
    name: 'Second to the pitcher covering first',
    situation: 'Second baseman ranges deep into short right field.',
    category: 'Routine outs',
    teaches: 'Show the pitcher a target and throw it soft enough to catch on the run.',
    roles: {
      '1B': 'You went after it too. Clear the bag and let the pitcher have it.',
    },
    batterTo: FIRST,
    moves: { '1B': { at: [128, 34] }, '2B': { at: [176, 30] }, P: FIRST },
    ball: [HOME, { fielder: '2B' }, { fielder: 'P' }],
  },
  {
    id: '5-6-hole',
    name: 'Third baseman starts it in the hole',
    situation: 'Runner on first. Ground ball deep in the hole between third and short.',
    category: 'Double plays',
    teaches: 'If third can reach it, the shortstop still owns the bag — do not both go.',
    batterTo: FIRST,
    runners: [{ from: FIRST, to: SECOND }],
    moves: { '3B': SPOTS.slowRollerThird, SS: SECOND },
    ball: [HOME, { fielder: '3B' }, SECOND, FIRST],
  },
  {
    id: 'ss-flip-home',
    name: 'Shortstop flips home on the slow roller',
    situation: 'Runner on third. Slow roller toward short with the infield tight.',
    category: 'Routine outs',
    teaches: 'Go get the ball. When there is no time to throw, the short flip is the throw.',
    batterTo: FIRST,
    runners: [{ from: THIRD, to: HOME }],
    moves: { SS: SPOTS.shortUpMiddle },
    ball: [HOME, { fielder: 'SS' }, HOME],
  },
];

export const MORE_PLAYS: readonly PlayDef[] = [
  ...MORE_OUTFIELD_PLAYS,
  ...MORE_CATCHER_AND_PITCHER_PLAYS,
  ...MORE_INFIELD_AND_RUNNER_PLAYS,
];

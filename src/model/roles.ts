import { FIELDER_SPOTS } from './fieldGeometry';
import { PLAY_CATEGORIES, type PlayDef, type Spot } from './plays';

/**
 * What one position does on one play — and why.
 *
 * Most of the job is read straight off the play: if the ball comes to you, the
 * route already says where it goes next; if you move to a base, you cover it.
 * The why is derived from the situation (who is on, where the ball finishes,
 * which side of the field is live). Jobs that cannot be read that way —
 * charging, backing up, giving way — stay authored on the play itself.
 */

export const POSITIONS = FIELDER_SPOTS.map((spot) => spot.label);

export const POSITION_NAMES: Record<string, string> = {
  P: 'Pitcher',
  C: 'Catcher',
  '1B': 'First base',
  '2B': 'Second base',
  SS: 'Shortstop',
  '3B': 'Third base',
  LF: 'Left field',
  CF: 'Centre field',
  RF: 'Right field',
};

/** One practice block per position: the most important 25 in library order. */
export const POSITION_PLAY_LIMIT = 25;

const THE: Record<string, string> = {
  P: 'the pitcher',
  C: 'the catcher',
  '1B': 'the first baseman',
  '2B': 'the second baseman',
  SS: 'the shortstop',
  '3B': 'the third baseman',
  LF: 'the left fielder',
  CF: 'the centre fielder',
  RF: 'the right fielder',
};

const BASE_NAMES: Record<string, string> = {
  home: 'the plate',
  first: 'first base',
  second: 'second base',
  third: 'third base',
  mound: 'the pitcher',
};

export interface Role {
  /** Does this position have an active job on the ball or a bag? */
  involved: boolean;
  /** What they do and why, addressed to the player. */
  text: string;
}

function describe(spot: Spot): string {
  if ('base' in spot) return BASE_NAMES[spot.base] ?? 'the bag';
  if ('fielder' in spot) return THE[spot.fielder] ?? 'your teammate';
  return 'the ball';
}

/** Is this stop on the route a throw from a teammate, rather than a batted ball? */
function isThrow(spot: Spot): boolean {
  return 'fielder' in spot || ('base' in spot && spot.base !== 'home');
}

function baseOf(spot: Spot | undefined): string | null {
  return spot && 'base' in spot ? spot.base : null;
}

function runnerStarts(play: PlayDef): Set<string> {
  const starts = new Set<string>();
  for (const runner of play.runners ?? []) {
    const from = baseOf(runner.from);
    if (from) starts.add(from);
  }
  return starts;
}

function throwWhy(play: PlayDef, destination: Spot): string {
  const destBase = baseOf(destination);
  const on = runnerStarts(play);

  if (destBase === 'first') {
    if (on.has('first') && play.ball.some((s) => baseOf(s) === 'second')) {
      return 'finish the turn so the batter cannot beat the double play.';
    }
    return 'that is the surest out on the field.';
  }
  if (destBase === 'second') {
    if (on.has('first')) {
      return 'take the force before the lead runner can slide in.';
    }
    return 'keep the batter from turning a single into a double.';
  }
  if (destBase === 'third') {
    if (on.has('first') || on.has('second')) {
      return 'stop the lead runner before he takes the extra base.';
    }
    return 'make third the last bag on this ball.';
  }
  if (destBase === 'home') {
    if (on.has('third') || on.has('second')) {
      return 'cut down the run before he scores.';
    }
    return 'nothing else matters if the run walks in.';
  }
  if ('fielder' in destination) {
    const who = THE[destination.fielder] ?? 'your teammate';
    if (play.category === 'Cutoffs and relays' || play.category === 'Fly balls') {
      return `hit ${who} in the chest so the long throw stays online.`;
    }
    return `get the ball to ${who}, who is covering for you.`;
  }
  return 'move the ball before the runners can advance.';
}

function coverWhy(base: string, play: PlayDef): string {
  const on = runnerStarts(play);
  const isForce =
    (base === 'second' && on.has('first')) ||
    (base === 'third' && on.has('second')) ||
    (base === 'home' && on.has('third'));
  const stealOrPick =
    play.category === 'Runners moving' || /steal|pickoff|pitchout|back-pick|backpick/i.test(play.id);

  if (base === 'first') {
    return 'be there early with a chest-high target so the throw can beat the batter.';
  }
  if (base === 'second') {
    if (stealOrPick) {
      return 'straddle the bag and be ready to tag — this is not a force.';
    }
    if (isForce) {
      return 'own the force — the lead runner is coming straight at you.';
    }
    return 'give the throw a target so the batter cannot stretch a single.';
  }
  if (base === 'third') {
    if (stealOrPick) {
      return 'beat the runner there and be ready to tag.';
    }
    return 'make the lead runner stop or slide into a tag.';
  }
  if (base === 'home') {
    return 'block the plate and be ready to tag — the run is ninety feet away.';
  }
  return 'give your teammate a clear target.';
}

function fieldVerb(play: PlayDef, receiving: boolean): string {
  if (receiving) return 'Take the throw';
  if (play.category === 'Fly balls') return 'Catch it';
  if (play.category === 'Bunt defense') return 'Field the bunt';
  return 'Field it';
}

function sideOfPlay(play: PlayDef): 'left' | 'right' | 'middle' | 'plate' {
  const labels = play.ball
    .filter((s): s is { fielder: string } => 'fielder' in s)
    .map((s) => s.fielder);
  if (labels.some((l) => l === 'LF' || l === 'SS' || l === '3B')) {
    if (labels.some((l) => l === 'RF' || l === '1B' || l === '2B')) return 'middle';
    return 'left';
  }
  if (labels.some((l) => l === 'RF' || l === '1B' || l === '2B')) return 'right';
  if (labels.some((l) => l === 'CF' || l === 'P')) return 'middle';
  return 'plate';
}

/** Standard off-ball responsibility when this position is not on the ball or a bag. */
function supportingRole(play: PlayDef, label: string): string {
  const side = sideOfPlay(play);
  const on = runnerStarts(play);
  const last = play.ball[play.ball.length - 1];
  const finish = baseOf(last);
  const category = play.category;

  if (category === 'Runners moving' || category === 'Pitcher and catcher') {
    if (label === 'RF') {
      return 'Hold your depth in right and back up first if the throw gets away — you are the last line on that side.';
    }
    if (label === 'LF') {
      return 'Hold your depth in left and back up third if the ball kicks away — do not crash the infield.';
    }
    if (label === 'CF') {
      return 'Hold centre field and watch the runner — you are the backup if anything skips through the middle.';
    }
    if (label === '1B' && finish !== 'first') {
      return 'Hold the runner close at first and be ready if the catcher looks you back — do not let him wander.';
    }
    if (label === '3B' && finish !== 'third' && on.has('third')) {
      return 'Keep the runner at third honest — if he breaks, you have to win the race back to the bag.';
    }
    if (label === '2B' || label === 'SS') {
      return 'Stay alive in the middle — cover if the throw comes your way, and do not ball-watch the runner.';
    }
    if (label === 'P') {
      return 'Back up the base the throw is going to — a pitcher who watches is a pitcher who lets the extra base happen.';
    }
    if (label === 'C') {
      return 'After the ball leaves your hand, follow the play — be ready for a return throw or a rundown.';
    }
  }

  if (category === 'Fly balls') {
    if (label === 'P') {
      return 'Back up the base the throw is headed for — on a fly ball the pitcher is always the safety net.';
    }
    if (label === 'C') {
      if (finish === 'home' || on.has('third')) {
        return 'Own the plate and give a clear target — the tag play is yours if the runner comes.';
      }
      return 'Line up the play from behind the plate — call the cut if the throw is offline.';
    }
    if ((label === 'LF' || label === 'CF' || label === 'RF') && !(label in (play.moves ?? {}))) {
      return 'Shade toward the ball and back up your teammates — a dropped fly becomes a disaster if nobody is behind it.';
    }
    if (label === '1B' || label === '2B' || label === 'SS' || label === '3B') {
      return 'Help line up the throw and keep the runners honest — do not drift under a fly that belongs to someone else.';
    }
  }

  if (
    category === 'Cutoffs and relays' ||
    category === 'Bunt defense' ||
    category === 'Double plays' ||
    category === 'Routine outs'
  ) {
    if (label === 'P') {
      if (finish === 'home') {
        return 'Get behind the plate — if the throw home gets by, you are the only one who can keep it to one base.';
      }
      if (finish === 'third') {
        return 'Back up third base — overthrows on the left side are your responsibility.';
      }
      if (finish === 'first') {
        return 'Trail toward first — if the throw pulls the first baseman off the bag, it is your ball.';
      }
      return 'Move behind the play — the pitcher backs up every throw somewhere.';
    }
    if (label === 'C') {
      if (finish === 'home' || on.has('third')) {
        return 'Own the plate early and give a clear target — runs do not score because the catcher was late.';
      }
      return 'Track the ball from behind the plate — direct traffic if the cut man needs a call.';
    }
    if (label === 'RF' && (side === 'left' || side === 'middle')) {
      return 'Tuck in toward first and back up the infield — a throw that pulls first is your ball.';
    }
    if (label === 'LF' && (side === 'right' || side === 'middle')) {
      return 'Tuck in toward third and back up that side — do not spectate from deep left.';
    }
    if (label === 'CF') {
      return 'Shade toward the ball and back up whoever fields it — centre field cleans up mistakes.';
    }
    if (label === '1B' && side === 'left') {
      return 'Hold first base and watch the batter-runner — you still own that bag when the ball is on the other side.';
    }
    if (label === '1B' && (side === 'right' || side === 'middle')) {
      return 'Hold first and watch the batter-runner — even when the throw goes elsewhere, that bag is still yours.';
    }
    if (label === '3B' && side === 'left') {
      return 'Hold third and stay ready — the ball is on your side, so an overthrow or leftover runner is yours.';
    }
    if (label === '3B' && (side === 'right' || side === 'middle')) {
      return 'Hold third base and keep any lead runner honest — do not wander while the ball is elsewhere.';
    }
    if (label === '2B' && side === 'left') {
      return 'Shade toward the middle — be ready to cover second or trail a relay so you stay in the play.';
    }
    if (label === '2B' && (side === 'right' || side === 'middle')) {
      return 'Stay alive near the bag — be ready to take a cut or cover if the throw comes through.';
    }
    if (label === 'SS' && (side === 'right' || side === 'middle')) {
      return 'Shade toward the middle — be ready to cover second or take a cut so you stay in the play.';
    }
    if (label === 'SS' && side === 'left') {
      return 'Stay in the play on the left side — back up the throw or cover if the ball kicks away.';
    }
    if (label === 'LF' && (side === 'left' || side === 'middle')) {
      return 'Come in and back up the infield on your side — do not watch a ground ball from deep left.';
    }
    if (label === 'RF' && (side === 'right' || side === 'middle')) {
      return 'Come in and back up the infield on your side — do not watch a ground ball from deep right.';
    }
  }

  return 'Watch the ball, hold your area, and move to back up if it gets away — nobody is a spectator.';
}

function ensureWhy(text: string, why: string): string {
  const trimmed = text.trim().replace(/\.$/, '');
  // Authored text that already explains itself keeps its voice.
  if (/\b(so|because|before|if |in case|—| - )\b/i.test(trimmed)) {
    return `${trimmed}.`;
  }
  const clause = why.trim().replace(/\.$/, '');
  return `${trimmed} — ${clause.charAt(0).toLowerCase()}${clause.slice(1)}.`;
}

export function roleFor(play: PlayDef, label: string): Role {
  const authored = play.roles?.[label];
  if (authored) {
    return { involved: true, text: ensureWhy(authored, defaultAuthoredWhy(play, label)) };
  }

  const index = play.ball.findIndex((spot) => 'fielder' in spot && spot.fielder === label);
  if (index >= 0) {
    const next = play.ball[index + 1];
    const receiving = index > 0 && isThrow(play.ball[index - 1]);
    const verb = fieldVerb(play, receiving);
    if (!next) {
      return {
        involved: true,
        text: receiving
          ? `${verb} — that finishes the out, so secure it and look for the next runner.`
          : `${verb} and look the runners back — the catch is only half the play.`,
      };
    }
    const dest = describe(next);
    const why = throwWhy(play, next);
    if (receiving) {
      return { involved: true, text: `${verb} and go to ${dest} — ${why}` };
    }
    return { involved: true, text: `${verb} and throw to ${dest} — ${why}` };
  }

  const move = play.moves?.[label];
  if (move && 'base' in move) {
    return {
      involved: true,
      text: `Cover ${BASE_NAMES[move.base]} — ${coverWhy(move.base, play)}`,
    };
  }
  if (move) {
    const why =
      play.category === 'Cutoffs and relays'
        ? 'you are the cut or relay so the long throw stays online'
        : play.category === 'Bunt defense'
          ? 'the corners and middle have to crash or rotate together'
          : 'your movement is what makes this play work';
    return {
      involved: true,
      text: `Move to your spot on this play — ${why}.`,
    };
  }

  return { involved: false, text: supportingRole(play, label) };
}

function defaultAuthoredWhy(play: PlayDef, label: string): string {
  if (play.roles?.[label]?.toLowerCase().includes('back')) {
    return 'an overthrow turns into an extra base without you';
  }
  if (play.roles?.[label]?.toLowerCase().includes('give way')) {
    return 'two players under the same ball is how pop flies get dropped';
  }
  if (play.roles?.[label]?.toLowerCase().includes('charge')) {
    return 'hesitation lets the batter beat the play';
  }
  return supportingRole(play, label).replace(/\.$/, '');
}

/** Every position's job on this play, in field order. */
export function rolesForPlay(play: PlayDef): { label: string; role: Role }[] {
  return POSITIONS.map((label) => ({ label, role: roleFor(play, label) }));
}

/**
 * The plays this position has a job in, grouped by category exactly as the
 * library displays them — then capped for a one-position study session.
 */
export function playsForPosition(plays: readonly PlayDef[], label: string): PlayDef[] {
  const involved = plays.filter((play) => roleFor(play, label).involved);
  return PLAY_CATEGORIES.flatMap((category) => involved.filter((play) => play.category === category)).slice(
    0,
    POSITION_PLAY_LIMIT,
  );
}

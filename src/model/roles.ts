import { FIELDER_SPOTS } from './fieldGeometry';
import { PLAY_CATEGORIES, type PlayDef, type Spot } from './plays';

/**
 * What one position does on one play.
 *
 * Most of it is read straight off the play: if the ball comes to you, you field
 * it and throw somewhere; if you move to a base, you cover it. The jobs that
 * cannot be read that way — charging, backing up, giving way — are written into
 * the play itself, because guessing at them would put words in a coach's mouth.
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
  /** Does this position have something to do here? */
  involved: boolean;
  /** What they do, addressed to the player. */
  text: string;
}

const NOTHING_TO_DO = 'No job on this one. Watch the ball and back up your area.';

function describe(spot: Spot): string {
  if ('base' in spot) return BASE_NAMES[spot.base] ?? 'the bag';
  if ('fielder' in spot) return THE[spot.fielder] ?? 'your teammate';
  return 'the ball';
}

/** Is this stop on the route a throw from a teammate, rather than a batted ball? */
function isThrow(spot: Spot): boolean {
  return 'fielder' in spot || ('base' in spot && spot.base !== 'home');
}

export function roleFor(play: PlayDef, label: string): Role {
  const authored = play.roles?.[label];
  if (authored) return { involved: true, text: authored };

  const index = play.ball.findIndex((spot) => 'fielder' in spot && spot.fielder === label);
  if (index >= 0) {
    const next = play.ball[index + 1];
    const receiving = index > 0 && isThrow(play.ball[index - 1]);
    if (!next) {
      // A play should not end on a bare catch — callers must add a throw or an
      // authored job. This wording is a last resort for incomplete data.
      return {
        involved: true,
        text: receiving
          ? 'Take the throw — that is the out.'
          : 'Catch it and look the runners back.',
      };
    }
    return {
      involved: true,
      text: receiving
        ? `Take the throw and go to ${describe(next)}.`
        : play.category === 'Fly balls'
          ? `Catch it and throw to ${describe(next)}.`
          : `Field it and throw to ${describe(next)}.`,
    };
  }

  const move = play.moves?.[label];
  if (move && 'base' in move) {
    return { involved: true, text: `Cover ${BASE_NAMES[move.base]}.` };
  }
  if (move) {
    // Only reachable if a play adds a spot move without wording for it.
    return { involved: true, text: 'Move to your spot on this play.' };
  }

  return { involved: false, text: NOTHING_TO_DO };
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

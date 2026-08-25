import { assignDefense, type Job } from './defense';
import { FIELDER_SPOTS } from './fieldGeometry';
import { PLAY_CATEGORIES } from './plays';
import type { BaseName, PlayDef, Spot } from './playTypes';

/**
 * What one position does on one play — and why.
 *
 * Almost all of it is read off the play by way of defense.ts: if the ball comes
 * to you, you field it and throw where it goes next; if the throw is coming to
 * your bag, you cover it and take it; if it is going somewhere else, you get
 * behind it. The jobs that cannot be derived — charging, calling it, giving way
 * — are written into the play itself, because guessing at them would put words
 * in a coach's mouth.
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

const BASE_NAMES: Record<BaseName, string> = {
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

const NOTHING_TO_DO = 'No job on this one. Watch the ball and back up your area.';

/**
 * Only reachable if a play moves a fielder somewhere that is not a bag without
 * saying why. A test asserts nothing in the library does.
 */
export const UNEXPLAINED = 'Break with the ball and take the spot this play needs.';

function describe(spot: Spot): string {
  if ('base' in spot) return BASE_NAMES[spot.base];
  if ('fielder' in spot) return THE[spot.fielder] ?? 'your teammate';
  return 'the ball';
}

function bag(base: BaseName | undefined): string {
  return base ? BASE_NAMES[base] : 'your bag';
}

function textFor(play: PlayDef, job: Job): string {
  switch (job.kind) {
    case 'field': {
      const next = job.next;
      if (!next) {
        // A play should not end on a bare catch — callers must add a throw or
        // an authored job. This wording is a last resort for incomplete data.
        return 'Catch it and look the runners back.';
      }
      const where = describe(next);
      switch (job.arrival) {
        case 'throw':
          return `Take the throw and go to ${where}.`;
        case 'held':
          return `Come up throwing to ${where}.`;
        case 'pitch':
          return `Take the pitch and come up throwing to ${where}.`;
        case 'loose':
          return `Get to the ball and throw to ${where}.`;
        default:
          return play.category === 'Fly balls'
            ? `Catch it and throw to ${where}.`
            : `Field it and throw to ${where}.`;
      }
    }
    case 'relay':
      return `Go out as the relay man, take the throw, and turn it to ${bag(job.base)}.`;
    case 'cut':
      return `Line up the cut on the throw to ${bag(job.base)}. Take it if you hear the call, let it through if you do not.`;
    case 'receive':
      if (job.base === 'mound') return 'Take the throw back and look the runners in.';
      return job.named
        ? job.base
          ? `Take the throw at ${bag(job.base)} — that is the out.`
          : 'Take the throw — that is the out.'
        : `Cover ${bag(job.base)} and take the throw.`;
    case 'cover':
      return job.base ? `Cover ${BASE_NAMES[job.base]}.` : UNEXPLAINED;
    case 'call':
      return 'Own the plate, line the cut man up, and make the call loud enough to be heard.';
    case 'backup':
      return job.behind
        ? `Get behind ${THE[job.behind]} and keep the ball in front of you.`
        : `Get behind ${bag(job.base)} in case the throw gets by.`;
    case 'charge':
      return 'Charge the ball and take anything you can get to.';
    case 'clear':
      return 'Get off the throwing line. The worst thing you can do here is touch it.';
    case 'shift':
      return 'Shade over to the spot this play needs and cover your ground.';
    default:
      return NOTHING_TO_DO;
  }
}

export function roleFor(play: PlayDef, label: string): Role {
  const authored = play.roles?.[label];
  if (authored) return { involved: true, text: authored };

  const job = assignDefense(play).jobs[label] ?? { kind: 'idle' };
  // Backing up a throw is a real job and gets said out loud, but it is not what
  // a position is studying when it walks its own plays — every outfielder backs
  // up every throw in front of him, and a study list of that is a study list of
  // everything.
  const involved = job.kind !== 'idle' && job.kind !== 'backup';
  return { involved, text: textFor(play, job) };
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

/**
 * The shapes a play is written in.
 *
 * Kept apart from the library itself so the pieces that reason about a play —
 * where the ball goes, who covers what, how a runner gets from base to base —
 * can share the vocabulary without importing the 150 plays that use it.
 */

export type BaseName = 'home' | 'first' | 'second' | 'third' | 'mound';

export type Spot =
  /** A base, or the pitcher's mound. */
  | { base: BaseName }
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
  /**
   * What a given position does here, in their own words, for the jobs that
   * cannot be read off the play — charging, calling it, giving way. Fielding
   * the ball, cutting a throw, covering a base and backing one up are all
   * derived from the play instead. See defense.ts and roles.ts.
   */
  roles?: Record<string, string>;
  /**
   * Where the batter-runner finishes, for a ball put in play. Omitted when
   * there is no batter running — a pitch, or a ball the catcher already has.
   * Caught fly balls give a spot up the line: he ran, he just did not make it.
   */
  batterTo?: Spot;
  /** Where the other runners start, and where they finish. */
  runners?: { from: Spot; to?: Spot }[];
  /**
   * Fielders whose spot the play itself dictates: whoever goes to the ball,
   * anyone charging or shading off their normal position. Cut men, base
   * coverage and backups are worked out from the ball's route instead, so a
   * play only names them when it wants something other than the standard.
   */
  moves?: Record<string, Spot>;
  /** The ball's journey, first point to last. */
  ball: Spot[];
  /**
   * The bag the throw was lined up for, when the ball ends up somewhere else.
   * A cut man who takes the throw home and fires behind the runner is still a
   * cut man to the plate: he lines up there, the catcher calls it, and the
   * pitcher backs the plate up. Without this the defence would be arranged for
   * the bag the ball happened to finish at.
   */
  aim?: BaseName;
}

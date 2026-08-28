import type { Point } from './path';
import { clamp01, interpolatePositions } from './tween';
import type { PositionMap, Token } from './types';

/**
 * A play is a list of steps, and a step is a beat: everybody with an arrow in
 * it breaks at the same time, and the next step does not start until they have
 * all arrived. That is how a play is coached — "on the crack of the bat the
 * shortstop breaks and the runner goes; *then* the throw" — so it is how the
 * board stores one.
 *
 * A step holds only the tokens that move in it, as absolute destinations. Where
 * a token stands entering step N is therefore the start arrangement with every
 * earlier step's destinations laid over it, which is what `arrangementBefore`
 * works out. Nothing here mutates a token: the board's own positions are always
 * the top of the play, so playback is a pure overlay and the field is back at
 * the start the moment it finishes.
 */
export interface PlayStep {
  id: string;
  /** Token id -> where that token finishes this step. Only the movers appear. */
  moves: PositionMap;
}

/** How long one step takes at 1x. */
export const STEP_DURATION_MS = 1500;

/**
 * The tail of each step's slot spent standing still, so the beats read as
 * separate rather than running into one another.
 */
export const STEP_HOLD_SHARE = 0.18;

/** A step nobody moves in is a step waiting to be drawn, not part of the play. */
export function hasMoves(step: PlayStep): boolean {
  return Object.keys(step.moves).length > 0;
}

/** The indexes of the steps that actually animate, in order. */
export function playableSteps(steps: readonly PlayStep[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps.length; i++) if (hasMoves(steps[i])) out.push(i);
  return out;
}

export function durationForPlay(steps: readonly PlayStep[], speed: number): number {
  const count = Math.max(playableSteps(steps).length, 1);
  return (STEP_DURATION_MS * count) / speed;
}

/**
 * Where everything stands entering step `index`. Index 0 is the top of the
 * play — the tokens' own positions — and an index past the end is the finish.
 */
export function arrangementBefore(
  tokens: readonly Token[],
  steps: readonly PlayStep[],
  index: number,
): PositionMap {
  const at: PositionMap = {};
  for (const token of tokens) at[token.id] = { x: token.x, y: token.y };
  const upto = Math.min(Math.max(index, 0), steps.length);
  for (let i = 0; i < upto; i++) {
    for (const [id, p] of Object.entries(steps[i].moves)) {
      // A destination for a token that has since been erased is ignored rather
      // than resurrecting it into the arrangement.
      if (at[id]) at[id] = p;
    }
  }
  return at;
}

/** Where everything stands once step `index` has finished. */
export function arrangementAfter(
  tokens: readonly Token[],
  steps: readonly PlayStep[],
  index: number,
): PositionMap {
  return arrangementBefore(tokens, steps, index + 1);
}

/**
 * The last step at or before `limit` in which `id` is sent somewhere. Used to
 * work out what dragging a player means while a later step is being edited:
 * he is standing where an earlier step left him, so the drag adjusts that
 * arrival rather than the top of the play.
 */
export function lastStepMoving(
  steps: readonly PlayStep[],
  id: string,
  limit: number,
): number {
  for (let i = Math.min(limit, steps.length - 1); i >= 0; i--) {
    if (steps[i].moves[id]) return i;
  }
  return -1;
}

/**
 * The arrangement `t` of the way through the whole play, 0 to 1. Steps get an
 * equal slice each and are run in order; steps nobody moves in are skipped, so
 * an empty step waiting to be drawn costs no time.
 */
export function positionsDuring(
  tokens: readonly Token[],
  steps: readonly PlayStep[],
  t: number,
): PositionMap {
  const playable = playableSteps(steps);
  if (playable.length === 0) return arrangementBefore(tokens, steps, 0);

  const scaled = clamp01(t) * playable.length;
  const slot = Math.min(Math.floor(scaled), playable.length - 1);
  const index = playable[slot];
  // The hold is the tail of the slot: travel finishes early and everyone waits
  // there for the beat, which is what makes a step read as a step.
  const local = clamp01((scaled - slot) / (1 - STEP_HOLD_SHARE));

  return interpolatePositions(
    arrangementBefore(tokens, steps, index),
    arrangementAfter(tokens, steps, index),
    local,
  );
}

/** Is this token pointed anywhere in this step? */
export function destinationIn(step: PlayStep | undefined, id: string): Point | undefined {
  return step?.moves[id];
}

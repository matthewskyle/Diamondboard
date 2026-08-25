import { BASES, pointAt } from './fieldGeometry';
import type { Point } from './path';
import type { Token } from './types';

/**
 * Setting the situation up, rather than drawing the play.
 *
 * A coach thinks in "runner on second, one out", not in coordinates, so the
 * chips that put runners on bases work in those terms and toggle: tapping a
 * base that already has somebody on it takes him off again.
 */

export type BaseSlot = 'batter' | 'first' | 'second' | 'third';

/** Beside the plate on the first base side, clear of the ball, ready to run. */
export const BATTERS_BOX: Point = pointAt(13, 45);

export const SLOT_SPOTS: Record<BaseSlot, Point> = {
  batter: BATTERS_BOX,
  first: BASES.first,
  second: BASES.second,
  third: BASES.third,
};

export const SLOT_LABELS: Record<BaseSlot, string> = {
  batter: 'B',
  first: 'R1',
  second: 'R2',
  third: 'R3',
};

export const SLOT_NAMES: Record<BaseSlot, string> = {
  batter: 'Batter',
  first: '1st',
  second: '2nd',
  third: '3rd',
};

export const BASE_SLOTS: readonly BaseSlot[] = ['batter', 'first', 'second', 'third'];

/** Close enough to a bag to count as standing on it. */
const OCCUPIED_RADIUS = 30;

/** The runner already in this slot, if the coach has put one there. */
export function runnerInSlot(tokens: readonly Token[], slot: BaseSlot): Token | null {
  const spot = SLOT_SPOTS[slot];
  for (const token of tokens) {
    if (token.type !== 'runner') continue;
    if (Math.hypot(token.x - spot.x, token.y - spot.y) <= OCCUPIED_RADIUS) return token;
  }
  return null;
}

export function occupiedSlots(tokens: readonly Token[]): BaseSlot[] {
  return BASE_SLOTS.filter((slot) => runnerInSlot(tokens, slot) !== null);
}

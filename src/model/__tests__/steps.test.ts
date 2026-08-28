import { describe, expect, it } from 'vitest';
import {
  arrangementAfter,
  arrangementBefore,
  durationForPlay,
  hasMoves,
  lastStepMoving,
  playableSteps,
  positionsDuring,
  STEP_DURATION_MS,
  STEP_HOLD_SHARE,
  type PlayStep,
} from '../steps';
import type { Token } from '../types';

const tokens: Token[] = [
  { id: 'a', type: 'fielder', label: 'SS', x: 0, y: 0 },
  { id: 'b', type: 'fielder', label: '2B', x: 100, y: 0 },
];

const step = (id: string, moves: PlayStep['moves']): PlayStep => ({ id, moves });

describe('arrangements', () => {
  it('starts at the tokens themselves', () => {
    expect(arrangementBefore(tokens, [], 0)).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
    });
  });

  it('lays every earlier step over the start, in order', () => {
    const steps = [
      step('s1', { a: { x: 10, y: 10 } }),
      step('s2', { a: { x: 20, y: 20 }, b: { x: 50, y: 5 } }),
    ];
    expect(arrangementBefore(tokens, steps, 1).a).toEqual({ x: 10, y: 10 });
    expect(arrangementBefore(tokens, steps, 1).b).toEqual({ x: 100, y: 0 });
    expect(arrangementAfter(tokens, steps, 1)).toEqual({
      a: { x: 20, y: 20 },
      b: { x: 50, y: 5 },
    });
  });

  it('clamps an index past either end', () => {
    const steps = [step('s1', { a: { x: 10, y: 10 } })];
    expect(arrangementBefore(tokens, steps, -3)).toEqual(arrangementBefore(tokens, steps, 0));
    expect(arrangementBefore(tokens, steps, 9)).toEqual(arrangementAfter(tokens, steps, 0));
  });

  it('ignores a destination left behind by an erased token', () => {
    const steps = [step('s1', { gone: { x: 10, y: 10 } })];
    expect(arrangementAfter(tokens, steps, 0).gone).toBeUndefined();
  });
});

describe('which steps are part of the play', () => {
  it('counts only the steps somebody moves in', () => {
    const steps = [step('s1', { a: { x: 10, y: 10 } }), step('s2', {})];
    expect(steps.map(hasMoves)).toEqual([true, false]);
    expect(playableSteps(steps)).toEqual([0]);
  });

  it('gives every playable step its own share of the clock', () => {
    const one = [step('s1', { a: { x: 10, y: 10 } })];
    const two = [...one, step('s2', { b: { x: 0, y: 0 } })];
    expect(durationForPlay(one, 1)).toBe(STEP_DURATION_MS);
    expect(durationForPlay(two, 1)).toBe(STEP_DURATION_MS * 2);
    expect(durationForPlay(two, 2)).toBe(STEP_DURATION_MS);
    // An empty board still has a duration, rather than dividing by nothing.
    expect(durationForPlay([], 1)).toBe(STEP_DURATION_MS);
  });

  it('finds the last step before a limit that moves a token', () => {
    const steps = [
      step('s1', { a: { x: 10, y: 10 } }),
      step('s2', { b: { x: 1, y: 1 } }),
      step('s3', { a: { x: 20, y: 20 } }),
    ];
    expect(lastStepMoving(steps, 'a', 2)).toBe(2);
    expect(lastStepMoving(steps, 'a', 1)).toBe(0);
    expect(lastStepMoving(steps, 'a', -1)).toBe(-1);
    expect(lastStepMoving(steps, 'b', 0)).toBe(-1);
  });
});

describe('playback', () => {
  const steps = [
    step('s1', { a: { x: 0, y: 100 } }),
    step('s2', { b: { x: 100, y: 100 } }),
  ];

  it('starts at the start and finishes at the finish', () => {
    expect(positionsDuring(tokens, steps, 0)).toEqual(arrangementBefore(tokens, steps, 0));
    expect(positionsDuring(tokens, steps, 1)).toEqual(arrangementAfter(tokens, steps, 1));
  });

  it('runs one step at a time: nobody in step 2 has moved while step 1 runs', () => {
    const mid = positionsDuring(tokens, steps, 0.25);
    expect(mid.a.y).toBeGreaterThan(0);
    expect(mid.a.y).toBeLessThan(100);
    expect(mid.b).toEqual({ x: 100, y: 0 });
  });

  it('holds at the end of a step, so the beats read as separate', () => {
    // Just inside step 1's slot, past its travel share: everyone has arrived.
    const held = positionsDuring(tokens, steps, 0.5 - 0.5 * STEP_HOLD_SHARE * 0.5);
    expect(held.a).toEqual({ x: 0, y: 100 });
  });

  it('keeps step 1 finished while step 2 runs', () => {
    const mid = positionsDuring(tokens, steps, 0.75);
    expect(mid.a).toEqual({ x: 0, y: 100 });
    expect(mid.b.y).toBeGreaterThan(0);
  });

  it('moves everybody in a step at the same time', () => {
    const together = [step('s1', { a: { x: 0, y: 100 }, b: { x: 100, y: 100 } })];
    const mid = positionsDuring(tokens, together, 0.4);
    expect(mid.a.y).toBeCloseTo(mid.b.y);
    expect(mid.a.y).toBeGreaterThan(0);
  });

  it('skips an empty step rather than spending time on it', () => {
    const padded = [step('s0', {}), ...steps, step('s3', {})];
    expect(positionsDuring(tokens, padded, 0.25)).toEqual(positionsDuring(tokens, steps, 0.25));
  });

  it('stands still when nothing has been drawn', () => {
    expect(positionsDuring(tokens, [step('s1', {})], 0.5)).toEqual(
      arrangementBefore(tokens, [], 0),
    );
  });
});

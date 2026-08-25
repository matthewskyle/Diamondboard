import { describe, expect, it } from 'vitest';
import { easeInOutCubic, interpolatePositions, lerpPoint } from '../tween';

const start = { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } };
const end = { a: { x: 100, y: 200 }, b: { x: 10, y: 10 } };

describe('interpolatePositions', () => {
  it('lands exactly on the endpoints', () => {
    expect(interpolatePositions(start, end, 0).a).toEqual({ x: 0, y: 0 });
    expect(interpolatePositions(start, end, 1).a).toEqual({ x: 100, y: 200 });
  });

  it('clamps t outside [0,1]', () => {
    expect(interpolatePositions(start, end, -5).a).toEqual({ x: 0, y: 0 });
    expect(interpolatePositions(start, end, 5).a).toEqual({ x: 100, y: 200 });
  });

  it('moves monotonically toward the end', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const { x } = interpolatePositions(start, end, t).a;
      expect(x).toBeGreaterThanOrEqual(previous);
      previous = x;
    }
  });

  it('leaves a token without an end position where it started', () => {
    const result = interpolatePositions(start, { a: end.a }, 0.5);
    expect(result.b).toEqual({ x: 10, y: 10 });
  });

  it('ignores tokens missing from the start state', () => {
    const result = interpolatePositions({ a: start.a }, end, 0.5);
    expect(result.b).toBeUndefined();
  });

  it('accepts a swapped easing without changing the endpoints', () => {
    const linear = (t: number) => t;
    expect(interpolatePositions(start, end, 0.5, linear).a).toEqual({ x: 50, y: 100 });
    expect(interpolatePositions(start, end, 1, linear).a).toEqual({ x: 100, y: 200 });
  });
});

describe('easeInOutCubic', () => {
  it('is pinned at both ends and symmetric in the middle', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1);
  });
});

describe('lerpPoint', () => {
  it('interpolates both axes', () => {
    expect(lerpPoint({ x: 0, y: 0 }, { x: 8, y: 4 }, 0.25)).toEqual({ x: 2, y: 1 });
  });
});

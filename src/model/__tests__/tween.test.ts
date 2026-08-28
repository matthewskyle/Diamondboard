import { describe, expect, it } from 'vitest';
import {
  dwellShareFor,
  easeInOutCubic,
  interpolatePositions,
  lerpPoint,
  PLAYBACK_SPEEDS,
  pointAlongPath,
} from '../tween';
import { durationForPlay, STEP_DURATION_MS, type PlayStep } from '../steps';

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

describe('pointAlongPath', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 300 },
  ];

  it('starts and ends on the path', () => {
    expect(pointAlongPath(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(path, 1)).toEqual({ x: 100, y: 300 });
  });

  it('moves at constant speed, so a long leg takes longer than a short one', () => {
    // Total 400 units: the first leg is a quarter of it, so it ends at t=0.25.
    expect(pointAlongPath(path, 0.25)).toEqual({ x: 100, y: 0 });
    expect(pointAlongPath(path, 0.5)).toEqual({ x: 100, y: 100 });
    expect(pointAlongPath(path, 0.75)).toEqual({ x: 100, y: 200 });
  });

  it('covers equal distance in equal time across a corner', () => {
    const step = (a: number, b: number) => {
      const p = pointAlongPath(path, a);
      const q = pointAlongPath(path, b);
      return Math.hypot(q.x - p.x, q.y - p.y);
    };
    // A step that straddles the corner is shorter only by the corner itself.
    expect(step(0.1, 0.2)).toBeCloseTo(40);
    expect(step(0.6, 0.7)).toBeCloseTo(40);
  });

  it('clamps outside [0,1]', () => {
    expect(pointAlongPath(path, -3)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(path, 3)).toEqual({ x: 100, y: 300 });
  });

  it('survives degenerate paths', () => {
    expect(pointAlongPath([], 0.5)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath([{ x: 7, y: 9 }], 0.5)).toEqual({ x: 7, y: 9 });
    const stationary = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
    expect(pointAlongPath(stationary, 0.5)).toEqual({ x: 5, y: 5 });
  });
});

describe('playback speed', () => {
  const play: PlayStep[] = [{ id: 's1', moves: { a: { x: 1, y: 1 } } }];

  it('runs a step at its base pace at 1x', () => {
    expect(durationForPlay(play, 1)).toBe(STEP_DURATION_MS);
    expect(durationForPlay(play, 2)).toBe(STEP_DURATION_MS / 2);
    expect(durationForPlay(play, 0.5)).toBe(STEP_DURATION_MS * 2);
  });

  it('offers a slower option than the default', () => {
    expect(PLAYBACK_SPEEDS).toContain(1);
    expect(Math.min(...PLAYBACK_SPEEDS)).toBeLessThan(1);
    for (const speed of PLAYBACK_SPEEDS) {
      expect(durationForPlay(play, speed)).toBeGreaterThan(0);
    }
    // Slower speed, longer play.
    const sorted = [...PLAYBACK_SPEEDS].sort((a, b) => a - b);
    const durations = sorted.map((speed) => durationForPlay(play, speed));
    expect(durations).toEqual([...durations].sort((a, b) => b - a));
  });
});

describe('dwellShareFor', () => {
  it('is nothing when the ball never stops on the way', () => {
    expect(dwellShareFor(0)).toBe(0);
    expect(dwellShareFor(-1)).toBe(0);
  });

  it('grows with the number of stops but never eats the whole play', () => {
    expect(dwellShareFor(1)).toBeCloseTo(0.12);
    expect(dwellShareFor(2)).toBeCloseTo(0.24);
    expect(dwellShareFor(20)).toBeLessThanOrEqual(0.45);
    expect(dwellShareFor(20)).toBeLessThan(1);
  });
});

describe('pointAlongPath with a dwell at each stop', () => {
  // Two equal legs, so the maths is easy to read.
  const path = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
  ];
  const dwell = 0.2; // one stop, so the whole share is spent there

  it('holds still at the stop', () => {
    // Travel is 0.8 of the timeline, split evenly: leg one ends at t=0.4.
    expect(pointAlongPath(path, 0.4, dwell)).toEqual({ x: 100, y: 0 });
    expect(pointAlongPath(path, 0.5, dwell)).toEqual({ x: 100, y: 0 });
    expect(pointAlongPath(path, 0.6, dwell)).toEqual({ x: 100, y: 0 });
  });

  it('starts moving again after the dwell', () => {
    const after = pointAlongPath(path, 0.7, dwell);
    expect(after.x).toBeGreaterThan(100);
    expect(after.x).toBeLessThan(200);
  });

  it('still starts and finishes on the route', () => {
    expect(pointAlongPath(path, 0, dwell)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(path, 1, dwell)).toEqual({ x: 200, y: 0 });
  });

  it('never goes backwards', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const { x } = pointAlongPath(path, t, dwell);
      expect(x).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = x;
    }
  });

  it('spends real time paused — more than it would without a dwell', () => {
    const held = [];
    for (let t = 0; t <= 1.0001; t += 0.01) {
      if (Math.abs(pointAlongPath(path, t, dwell).x - 100) < 1e-9) held.push(t);
    }
    expect(held.length).toBeGreaterThan(15); // ~20% of the timeline
  });

  it('matches plain travel when there is no dwell', () => {
    for (let t = 0; t <= 1.0001; t += 0.1) {
      expect(pointAlongPath(path, t, 0)).toEqual(pointAlongPath(path, t));
    }
  });

  it('dwells at every stop of a relay, in order', () => {
    const relay = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 300, y: 0 },
    ];
    const share = dwellShareFor(2);
    const stopA: number[] = [];
    const stopB: number[] = [];
    for (let t = 0; t <= 1.0001; t += 0.005) {
      const { x } = pointAlongPath(relay, t, share);
      if (Math.abs(x - 100) < 1e-9) stopA.push(t);
      if (Math.abs(x - 200) < 1e-9) stopB.push(t);
    }
    expect(stopA.length).toBeGreaterThan(10);
    expect(stopB.length).toBeGreaterThan(10);
    expect(Math.max(...stopA)).toBeLessThan(Math.min(...stopB));
  });
});

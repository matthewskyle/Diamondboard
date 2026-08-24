import { describe, expect, it } from 'vitest';
import {
  BASES,
  FOUL_POLES,
  HOME,
  INFIELD_SCALE,
  MOUND,
  VIEW_BOX,
  feetToUnits,
  fenceDistanceFt,
  pointAt,
  clampToField,
  FIELDER_SPOTS,
  defaultFielderPosition,
} from '../fieldGeometry';

describe('radial scale', () => {
  it('is true to scale inside the infield', () => {
    expect(feetToUnits(90)).toBeCloseTo(90 * INFIELD_SCALE);
    expect(feetToUnits(60.5)).toBeCloseTo(60.5 * INFIELD_SCALE);
  });

  it('compresses the outfield but stays monotonic', () => {
    const outfieldRate = feetToUnits(300) - feetToUnits(299);
    const infieldRate = feetToUnits(90) - feetToUnits(89);
    expect(outfieldRate).toBeLessThan(infieldRate);
    for (let ft = 1; ft < 400; ft += 7) {
      expect(feetToUnits(ft + 1)).toBeGreaterThan(feetToUnits(ft));
    }
  });
});

describe('diamond', () => {
  it('keeps a square, 90-degree diamond', () => {
    const first = BASES.first;
    const third = BASES.third;
    expect(first.y).toBeCloseTo(third.y);
    expect(first.x - HOME.x).toBeCloseTo(HOME.x - third.x);
    // Home to first equals first to second: a real diamond, not a stretched one.
    const homeToFirst = Math.hypot(first.x - HOME.x, first.y - HOME.y);
    const firstToSecond = Math.hypot(BASES.second.x - first.x, BASES.second.y - first.y);
    expect(homeToFirst).toBeCloseTo(firstToSecond);
  });

  it('puts second base and the mound on the center line', () => {
    expect(BASES.second.x).toBeCloseTo(HOME.x);
    expect(MOUND.x).toBeCloseTo(HOME.x);
    expect(MOUND.y).toBeGreaterThan(BASES.second.y); // mound is nearer home
  });
});

describe('fence', () => {
  it('is deepest to center and shortest down the lines', () => {
    expect(fenceDistanceFt(0)).toBeGreaterThan(fenceDistanceFt(22.5));
    expect(fenceDistanceFt(22.5)).toBeGreaterThan(fenceDistanceFt(45));
    expect(fenceDistanceFt(-45)).toBeCloseTo(fenceDistanceFt(45));
    expect(fenceDistanceFt(80)).toBeCloseTo(fenceDistanceFt(45));
  });

  it('keeps both foul poles inside the viewBox', () => {
    for (const pole of [FOUL_POLES.left, FOUL_POLES.right]) {
      expect(pole.x).toBeGreaterThanOrEqual(0);
      expect(pole.x).toBeLessThanOrEqual(VIEW_BOX.width);
      expect(pole.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('default arrangement', () => {
  it('places all nine fielders in fair territory and on the board', () => {
    expect(FIELDER_SPOTS).toHaveLength(9);
    for (const spot of FIELDER_SPOTS) {
      const p = defaultFielderPosition(spot);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(VIEW_BOX.width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(VIEW_BOX.height);
      if (spot.label !== 'C') {
        // Inside the 90-degree wedge: |x offset| <= distance up the field.
        expect(Math.abs(p.x - HOME.x)).toBeLessThanOrEqual(HOME.y - p.y + 1e-6);
      }
    }
  });

  it('puts the catcher behind the plate', () => {
    const catcher = defaultFielderPosition(FIELDER_SPOTS.find((s) => s.label === 'C')!);
    expect(catcher.y).toBeGreaterThan(HOME.y);
  });

  it('places outfielders beyond the infielders', () => {
    const depth = (label: string) =>
      HOME.y - defaultFielderPosition(FIELDER_SPOTS.find((s) => s.label === label)!).y;
    expect(depth('CF')).toBeGreaterThan(depth('2B'));
    expect(depth('LF')).toBeGreaterThan(depth('SS'));
  });
});

describe('clampToField', () => {
  it('keeps tokens on the board', () => {
    expect(clampToField({ x: -50, y: -50 })).toEqual({ x: 24, y: 24 });
    expect(clampToField({ x: 5000, y: 5000 })).toEqual({
      x: VIEW_BOX.width - 24,
      y: VIEW_BOX.height - 24,
    });
    expect(clampToField(pointAt(90, 45))).toEqual(BASES.first);
  });
});

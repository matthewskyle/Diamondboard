import { describe, expect, it } from 'vitest';
import {
  BASES,
  FOUL_POLES,
  HOME,
  INFIELD_SCALE,
  MOUND,
  VERTICAL_SQUASH,
  VIEW_BOX,
  feetToUnits,
  pointAt,
  clampToField,
  FIELDER_SPOTS,
  FOUL_ANGLE,
  defaultFielderPosition,
  TOKEN_RADIUS,
  viewHeightFor,
  MIN_VIEW_HEIGHT,
} from '../fieldGeometry';

/** How far up the field a point sits, undoing the squash: real radial units. */
const depth = (y: number) => (HOME.y - y) / VERTICAL_SQUASH;

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

describe('the squashed projection', () => {
  it('flattens the field vertically without touching its width', () => {
    const p = pointAt(100, 0);
    expect(p.x).toBe(HOME.x);
    expect(HOME.y - p.y).toBeCloseTo(VERTICAL_SQUASH * feetToUnits(100));
    expect(pointAt(100, 90).x - HOME.x).toBeCloseTo(feetToUnits(100));
  });

  it('gives the foul lines the reference slope, not a true 45 degrees', () => {
    const { first } = BASES;
    const slope = (HOME.y - first.y) / (first.x - HOME.x);
    expect(slope).toBeCloseTo(VERTICAL_SQUASH);
    expect(slope).toBeLessThan(1);
  });

  it('keeps both bases and both foul poles on the same lines', () => {
    for (const [base, pole] of [
      [BASES.first, FOUL_POLES.right],
      [BASES.third, FOUL_POLES.left],
    ]) {
      const baseSlope = (HOME.y - base.y) / (base.x - HOME.x);
      const poleSlope = (HOME.y - pole.y) / (pole.x - HOME.x);
      expect(baseSlope).toBeCloseTo(poleSlope);
    }
  });
});

describe('diamond', () => {
  it('is symmetric about the center line', () => {
    expect(BASES.first.y).toBeCloseTo(BASES.third.y);
    expect(BASES.first.x - HOME.x).toBeCloseTo(HOME.x - BASES.third.x);
    expect(FOUL_POLES.right.x - HOME.x).toBeCloseTo(HOME.x - FOUL_POLES.left.x);
    expect(FOUL_POLES.left.y).toBeCloseTo(FOUL_POLES.right.y);
  });

  it('puts second base and the mound on the center line', () => {
    expect(BASES.second.x).toBeCloseTo(HOME.x);
    expect(MOUND.x).toBeCloseTo(HOME.x);
    expect(MOUND.y).toBeGreaterThan(BASES.second.y); // the mound is nearer home
  });

  it('keeps real base-path proportions underneath the squash', () => {
    // Undo the projection and home-to-first should be a real 90 ft again.
    const { first } = BASES;
    const radial = Math.hypot(first.x - HOME.x, depth(first.y));
    expect(radial / INFIELD_SCALE).toBeCloseTo(90);
    expect(Math.hypot(0, depth(BASES.second.y)) / INFIELD_SCALE).toBeCloseTo(90 * Math.SQRT2);
  });
});

describe('the fence', () => {
  it('keeps both foul poles inside the viewBox', () => {
    for (const pole of [FOUL_POLES.left, FOUL_POLES.right]) {
      expect(pole.x).toBeGreaterThanOrEqual(0);
      expect(pole.x).toBeLessThanOrEqual(VIEW_BOX.width);
      expect(pole.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deeper to center than down the lines', () => {
    // The arc is a circle about the mound, so center field is the far point.
    const poleDepth = depth(FOUL_POLES.right.y);
    const centerDepth = depth(MOUND.y) + 460 / VERTICAL_SQUASH;
    expect(centerDepth).toBeGreaterThan(poleDepth);
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
        expect(Math.abs(spot.angle)).toBeLessThanOrEqual(FOUL_ANGLE);
        // Inside the wedge once the squash is undone.
        expect(Math.abs(p.x - HOME.x)).toBeLessThanOrEqual(depth(p.y) + 1e-6);
      }
    }
  });

  it('puts the catcher behind the plate and the pitcher on the mound', () => {
    const spot = (label: string) => FIELDER_SPOTS.find((s) => s.label === label)!;
    expect(defaultFielderPosition(spot('C')).y).toBeGreaterThan(HOME.y);
    expect(defaultFielderPosition(spot('P'))).toEqual(MOUND);
  });

  it('places outfielders beyond the infielders', () => {
    const at = (label: string) => defaultFielderPosition(FIELDER_SPOTS.find((s) => s.label === label)!);
    expect(depth(at('CF').y)).toBeGreaterThan(depth(at('2B').y));
    expect(depth(at('LF').y)).toBeGreaterThan(depth(at('SS').y));
  });

  it('mirrors the corner outfielders', () => {
    const lf = defaultFielderPosition(FIELDER_SPOTS.find((s) => s.label === 'LF')!);
    const rf = defaultFielderPosition(FIELDER_SPOTS.find((s) => s.label === 'RF')!);
    expect(lf.y).toBeCloseTo(rf.y);
    expect(HOME.x - lf.x).toBeCloseTo(rf.x - HOME.x);
  });
});

describe('clampToField', () => {
  it('keeps tokens on the board', () => {
    expect(clampToField({ x: -50, y: -50 })).toEqual({ x: TOKEN_RADIUS, y: TOKEN_RADIUS });
    expect(clampToField({ x: 5000, y: 5000 })).toEqual({
      x: VIEW_BOX.width - TOKEN_RADIUS,
      y: VIEW_BOX.height - TOKEN_RADIUS,
    });
    expect(clampToField(pointAt(90, 45))).toEqual(BASES.first);
  });
});

describe('viewHeightFor', () => {
  it('keeps the full board in portrait', () => {
    expect(viewHeightFor(820 / 1000)).toBe(VIEW_BOX.height); // iPad portrait
    expect(viewHeightFor(390 / 760)).toBe(VIEW_BOX.height); // phone portrait
  });

  it('crops the empty green below home once the container goes wide', () => {
    const landscape = viewHeightFor(1180 / 764); // iPad Air landscape
    expect(landscape).toBeLessThan(VIEW_BOX.height);
    expect(landscape).toBe(MIN_VIEW_HEIGHT);
  });

  it('never crops into the field itself', () => {
    // The catcher is the lowest thing drawn; no crop may cut into any token.
    for (const aspect of [0.4, 0.8, 1, 1.5, 2.5, 10]) {
      const h = viewHeightFor(aspect);
      expect(h).toBeGreaterThanOrEqual(MIN_VIEW_HEIGHT);
      for (const spot of FIELDER_SPOTS) {
        expect(defaultFielderPosition(spot).y + TOKEN_RADIUS).toBeLessThanOrEqual(h);
      }
    }
  });

  it('shrinks monotonically as the container widens, then holds at the floor', () => {
    let previous = Infinity;
    for (let aspect = 0.4; aspect <= 3; aspect += 0.2) {
      const h = viewHeightFor(aspect);
      expect(h).toBeLessThanOrEqual(previous);
      previous = h;
    }
  });

  it('falls back to the full board for a degenerate container', () => {
    expect(viewHeightFor(0)).toBe(VIEW_BOX.height);
    expect(viewHeightFor(Number.NaN)).toBe(VIEW_BOX.height);
  });
});

describe('clampToField with a cropped board', () => {
  it('keeps tokens above the current bottom edge', () => {
    expect(clampToField({ x: 500, y: 5000 }, MIN_VIEW_HEIGHT)).toEqual({
      x: 500,
      y: MIN_VIEW_HEIGHT - TOKEN_RADIUS,
    });
    // The full board still allows the open area below home plate.
    expect(clampToField({ x: 500, y: 900 }).y).toBe(900);
  });
});

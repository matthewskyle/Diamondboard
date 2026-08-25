import { describe, expect, it } from 'vitest';
import { strokeAt, tokenAt } from '../hitTest';
import { hitRadiusForScale, MIN_TOUCH_TARGET_PX, TOKEN_HIT_RADIUS } from '../fieldGeometry';
import type { Stroke, Token } from '../types';

const token = (id: string, x: number, y: number): Token => ({ id, type: 'runner', x, y });

describe('tokenAt', () => {
  const tokens = [token('a', 100, 100), token('b', 400, 400)];

  it('finds a token within the touch radius', () => {
    expect(tokenAt(tokens, { x: 100 + TOKEN_HIT_RADIUS - 1, y: 100 })?.id).toBe('a');
    expect(tokenAt(tokens, { x: 100 + TOKEN_HIT_RADIUS + 1, y: 100 })).toBeNull();
  });

  it('picks the nearest token when hit areas overlap', () => {
    const stacked = [token('left', 100, 100), token('right', 160, 100)];
    expect(tokenAt(stacked, { x: 115, y: 100 }, 80)?.id).toBe('left');
    expect(tokenAt(stacked, { x: 145, y: 100 }, 80)?.id).toBe('right');
  });

  it('breaks an exact tie in favor of the token drawn on top', () => {
    const stacked = [token('under', 100, 100), token('over', 100, 100)];
    expect(tokenAt(stacked, { x: 100, y: 100 })?.id).toBe('over');
  });

  it('clears the 44px touch target at iPad scale', () => {
    // The field renders ~0.75 CSS px per unit on an iPad in portrait.
    expect(TOKEN_HIT_RADIUS * 2 * 0.75).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });

  it('grows the hit area on smaller screens to keep that target', () => {
    for (const pxPerUnit of [0.3, 0.36, 0.5, 0.75, 1.2]) {
      expect(hitRadiusForScale(pxPerUnit) * 2 * pxPerUnit).toBeGreaterThanOrEqual(
        MIN_TOUCH_TARGET_PX - 1e-9,
      );
    }
    // Never shrinks below the baseline, and survives a missing CTM.
    expect(hitRadiusForScale(10)).toBe(TOKEN_HIT_RADIUS);
    expect(hitRadiusForScale(0)).toBe(TOKEN_HIT_RADIUS);
    expect(hitRadiusForScale(Number.NaN)).toBe(TOKEN_HIT_RADIUS);
  });
});

describe('strokeAt', () => {
  const stroke: Stroke = {
    id: 's1',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  };

  it('hits near the line and misses far from it', () => {
    expect(strokeAt([stroke], { x: 50, y: 10 })?.id).toBe('s1');
    expect(strokeAt([stroke], { x: 50, y: 200 })).toBeNull();
  });

  it('does not hit past the ends of the segment', () => {
    expect(strokeAt([stroke], { x: 300, y: 0 })).toBeNull();
  });

  it('hits a single-point dot stroke', () => {
    expect(strokeAt([{ id: 'dot', points: [{ x: 10, y: 10 }] }], { x: 12, y: 12 })?.id).toBe('dot');
  });
});

import { describe, expect, it } from 'vitest';
import { BASE_SLOTS, BATTERS_BOX, occupiedSlots, runnerInSlot, SLOT_SPOTS } from '../setup';
import { BASES, HOME } from '../fieldGeometry';
import type { Token } from '../types';

const runner = (id: string, x: number, y: number): Token => ({ id, type: 'runner', x, y });

describe('runnerInSlot', () => {
  it('finds a runner standing on a bag', () => {
    const tokens = [runner('r', BASES.second.x, BASES.second.y)];
    expect(runnerInSlot(tokens, 'second')?.id).toBe('r');
    expect(runnerInSlot(tokens, 'third')).toBeNull();
  });

  it('tolerates a runner dropped near the bag rather than exactly on it', () => {
    const tokens = [runner('r', BASES.first.x + 12, BASES.first.y - 8)];
    expect(runnerInSlot(tokens, 'first')?.id).toBe('r');
  });

  it('does not count somebody standing well off the bag', () => {
    const tokens = [runner('r', BASES.first.x + 90, BASES.first.y)];
    expect(runnerInSlot(tokens, 'first')).toBeNull();
  });

  it('ignores fielders and the ball', () => {
    const tokens: Token[] = [
      { id: 'f', type: 'fielder', label: '2B', x: BASES.second.x, y: BASES.second.y },
      { id: 'b', type: 'ball', x: BASES.third.x, y: BASES.third.y },
    ];
    expect(runnerInSlot(tokens, 'second')).toBeNull();
    expect(runnerInSlot(tokens, 'third')).toBeNull();
  });
});

describe('the batter slot', () => {
  it('stands beside the plate, not on it', () => {
    const fromPlate = Math.hypot(BATTERS_BOX.x - HOME.x, BATTERS_BOX.y - HOME.y);
    expect(fromPlate).toBeGreaterThan(12);
    expect(fromPlate).toBeLessThan(60);
  });

  it('is far enough from first base to be a separate slot', () => {
    const gap = Math.hypot(BATTERS_BOX.x - BASES.first.x, BATTERS_BOX.y - BASES.first.y);
    expect(gap).toBeGreaterThan(60);
  });
});

describe('occupiedSlots', () => {
  it('reports the bases that have somebody on them, in base order', () => {
    const tokens = [
      runner('a', BASES.third.x, BASES.third.y),
      runner('b', BASES.first.x, BASES.first.y),
    ];
    expect(occupiedSlots(tokens)).toEqual(['first', 'third']);
  });

  it('is empty for a clean board', () => {
    expect(occupiedSlots([])).toEqual([]);
  });

  it('covers every slot when the bases are loaded and a batter is up', () => {
    const tokens = BASE_SLOTS.map((slot, i) =>
      runner(`r${i}`, SLOT_SPOTS[slot].x, SLOT_SPOTS[slot].y),
    );
    expect(occupiedSlots(tokens)).toEqual([...BASE_SLOTS]);
  });

  it('keeps the slots far enough apart that one runner fills only one', () => {
    for (const slot of BASE_SLOTS) {
      const tokens = [runner('r', SLOT_SPOTS[slot].x, SLOT_SPOTS[slot].y)];
      expect(occupiedSlots(tokens), slot).toEqual([slot]);
    }
  });
});

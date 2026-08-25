import { describe, expect, it } from 'vitest';
import { POSITIONS, POSITION_NAMES, POSITION_PLAY_LIMIT, playsForPosition, roleFor } from '../roles';
import { PLAYS, PLAY_CATEGORIES } from '../plays';

const play = (id: string) => PLAYS.find((p) => p.id === id)!;

describe('roleFor', () => {
  it('tells a fielder who fields the ball where to throw it', () => {
    expect(roleFor(play('6-3'), 'SS')).toEqual({
      involved: true,
      text: 'Field it and throw to first base.',
    });
  });

  it('knows the difference between fielding a ball and taking a throw', () => {
    // On the 6-4-3 the shortstop fields it; the ball reaches first as a throw.
    expect(roleFor(play('6-4-3'), 'SS').text).toContain('Field it');
    expect(roleFor(play('3-6-1'), 'P').text).toContain('Take the throw');
  });

  it('names a fielder as the target when the throw is to a person', () => {
    expect(roleFor(play('3-1'), '1B').text).toBe('Field it and throw to the pitcher.');
  });

  it('says to cover the bag when that is the whole job', () => {
    expect(roleFor(play('6-4-3'), '1B')).toEqual({ involved: true, text: 'Cover first base.' });
    expect(roleFor(play('steal-second'), 'SS').text).toBe('Cover second base.');
  });

  it('treats a catch that ends the play as the play', () => {
    expect(roleFor(play('pop-up-catcher'), 'C').text).toContain('Make the catch');
  });

  it('uses the play own words where the job cannot be read off it', () => {
    expect(roleFor(play('pop-up-priority'), '3B').text).toContain('Give way');
    expect(roleFor(play('pitcher-backs-up'), 'P').text).toContain('behind third base');
  });

  it('is honest when a position has nothing to do', () => {
    const idle = roleFor(play('steal-second'), 'RF');
    expect(idle.involved).toBe(false);
    expect(idle.text).toContain('No job');
  });

  it('never falls back to the vague wording — every job is derived or written', () => {
    for (const play of PLAYS) {
      for (const label of POSITIONS) {
        expect(roleFor(play, label).text, `${play.id} / ${label}`).not.toBe(
          'Move to your spot on this play.',
        );
      }
    }
  });

  it('speaks in whole sentences', () => {
    for (const play of PLAYS) {
      for (const label of POSITIONS) {
        const { text } = roleFor(play, label);
        expect(text.length, `${play.id} / ${label}`).toBeGreaterThan(10);
        expect(text.trim().endsWith('.'), `${play.id} / ${label}: ${text}`).toBe(true);
      }
    }
  });
});

describe('playsForPosition', () => {
  it('gives every position a worthwhile set of plays', () => {
    for (const label of POSITIONS) {
      const plays = playsForPosition(PLAYS, label);
      expect(plays.length, label).toBeGreaterThan(3);
      expect(plays.length, label).toBeLessThanOrEqual(POSITION_PLAY_LIMIT);
    }
  });

  it('keeps the infield busiest, which is where the ball goes', () => {
    expect(playsForPosition(PLAYS, 'SS').length).toBeGreaterThan(
      playsForPosition(PLAYS, 'RF').length,
    );
  });

  it('is ordered the way the library displays it, so the count matches the list', () => {
    // Grouped by category, and in library order within each group. Stepping to
    // "4 of 25" has to land on the fourth play a coach can actually see.
    for (const label of POSITIONS) {
      const plays = playsForPosition(PLAYS, label);
      const categoryOrder = plays.map((p) => PLAY_CATEGORIES.indexOf(p.category));
      expect(categoryOrder, label).toEqual([...categoryOrder].sort((a, b) => a - b));

      for (const category of PLAY_CATEGORIES) {
        const within = plays.filter((p) => p.category === category).map((p) => PLAYS.indexOf(p));
        expect(within, `${label} / ${category}`).toEqual([...within].sort((a, b) => a - b));
      }
    }
  });

  it('keeps the first study-sized slice after regrouping', () => {
    for (const label of POSITIONS) {
      const grouped = playsForPosition(PLAYS, label);
      const plain = PLAYS.filter((p) => roleFor(p, label).involved);
      const regrouped = PLAY_CATEGORIES.flatMap((category) =>
        plain.filter((p) => p.category === category),
      );
      expect(grouped).toEqual(regrouped.slice(0, POSITION_PLAY_LIMIT));
    }
  });

  it('names every position', () => {
    for (const label of POSITIONS) expect(POSITION_NAMES[label], label).toBeTruthy();
  });
});

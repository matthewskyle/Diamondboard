import { describe, expect, it } from 'vitest';
import {
  POSITIONS,
  POSITION_NAMES,
  POSITION_PLAY_LIMIT,
  playsForPosition,
  roleFor,
  rolesForPlay,
} from '../roles';
import { PLAYS, PLAY_CATEGORIES } from '../plays';

const play = (id: string) => PLAYS.find((p) => p.id === id)!;

describe('roleFor', () => {
  it('tells a fielder who fields the ball where to throw it, and why', () => {
    const role = roleFor(play('6-3'), 'SS');
    expect(role.involved).toBe(true);
    expect(role.text).toContain('Field it and throw to first base');
    expect(role.text).toMatch(/surest out|surest play/i);
  });

  it('knows the difference between fielding a ball and taking a throw', () => {
    expect(roleFor(play('6-4-3'), 'SS').text).toContain('Field it');
    expect(roleFor(play('3-6-1'), 'P').text).toContain('Take the throw');
  });

  it('names a fielder as the target when the throw is to a person', () => {
    expect(roleFor(play('3-1'), '1B').text).toContain('Field it and throw to the pitcher');
  });

  it('says to cover the bag and explains why', () => {
    expect(roleFor(play('6-4-3'), '1B').text).toContain('Cover first base');
    expect(roleFor(play('6-4-3'), '1B').text).toMatch(/target|beat the batter/i);
    expect(roleFor(play('steal-second'), 'SS').text).toContain('Cover second base');
  });

  it('treats a catch that ends with a throw as the whole play', () => {
    expect(roleFor(play('pop-up-catcher'), 'C').text).toContain('Catch it');
    expect(roleFor(play('pop-up-catcher'), 'C').text).toContain('first');
  });

  it('never leaves a fielder with only "make the catch" as the job', () => {
    for (const play of PLAYS) {
      for (const label of POSITIONS) {
        const { text } = roleFor(play, label);
        expect(text, `${play.id} / ${label}`).not.toMatch(/Make the catch\. That is the play/i);
        expect(text, `${play.id} / ${label}`).not.toMatch(/That is the play/i);
      }
    }
  });

  it('uses the play own words where the job cannot be read off it', () => {
    expect(roleFor(play('pop-up-priority'), '3B').text).toContain('Give way');
    expect(roleFor(play('pitcher-backs-up'), 'P').text).toContain('behind third base');
  });

  it('still gives supporting positions a real job and a reason', () => {
    const idle = roleFor(play('steal-second'), 'RF');
    expect(idle.involved).toBe(false);
    expect(idle.text).toMatch(/back up|hold|watch/i);
    expect(idle.text.length).toBeGreaterThan(40);
  });

  it('explains what every position does on every play', () => {
    for (const play of PLAYS) {
      const roles = rolesForPlay(play);
      expect(roles).toHaveLength(9);
      for (const { label, role } of roles) {
        expect(role.text.length, `${play.id} / ${label}`).toBeGreaterThan(24);
        expect(role.text, `${play.id} / ${label}`).toMatch(
          /—| so | because | before | if |in case| and /i,
        );
        expect(role.text.trim().endsWith('.'), `${play.id} / ${label}: ${role.text}`).toBe(true);
      }
    }
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
  it('gives every position a full 25-play study block', () => {
    for (const label of POSITIONS) {
      const plays = playsForPosition(PLAYS, label);
      expect(plays.length, label).toBe(POSITION_PLAY_LIMIT);
    }
  });

  it('is ordered the way the library displays it, so the count matches the list', () => {
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

import { describe, expect, it } from 'vitest';
import { compilePlay, PLAYS, PLAY_CATEGORIES } from '../plays';
import { VIEW_BOX, MIN_VIEW_HEIGHT, TOKEN_RADIUS } from '../fieldGeometry';

describe('the play library', () => {
  it('has 50 plays with unique ids', () => {
    expect(PLAYS).toHaveLength(50);
    expect(new Set(PLAYS.map((p) => p.id)).size).toBe(50);
  });

  it('describes every play for a coach', () => {
    for (const play of PLAYS) {
      expect(play.name.length).toBeGreaterThan(3);
      expect(play.situation.length).toBeGreaterThan(10);
      expect(play.teaches.length).toBeGreaterThan(10);
      expect(PLAY_CATEGORIES).toContain(play.category);
    }
  });

  it('gives the ball somewhere to go in every play', () => {
    for (const play of PLAYS) {
      expect(play.ball.length, play.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('compilePlay', () => {
  it('produces a playable arrangement for every play', () => {
    for (const play of PLAYS) {
      const { tokens, ballRoute, start, end } = compilePlay(play);

      // Nine fielders, a ball, and however many runners the situation calls for.
      expect(tokens.filter((t) => t.type === 'fielder'), play.id).toHaveLength(9);
      expect(tokens.filter((t) => t.type === 'ball'), play.id).toHaveLength(1);
      expect(tokens.filter((t) => t.type === 'runner'), play.id).toHaveLength(
        play.runners?.length ?? 0,
      );

      // Both arrangements cover every token, or the tween would leave one behind.
      for (const token of tokens) {
        expect(start[token.id], `${play.id} start ${token.id}`).toBeDefined();
        expect(end[token.id], `${play.id} end ${token.id}`).toBeDefined();
      }

      expect(ballRoute.length, play.id).toBe(play.ball.length);
      // The ball starts where its route starts and finishes where it finishes.
      const ball = tokens.find((t) => t.type === 'ball')!;
      expect({ x: ball.x, y: ball.y }, play.id).toEqual(ballRoute[0]);
      expect(end[ball.id], play.id).toEqual(ballRoute[ballRoute.length - 1]);
    }
  });

  it('keeps every position on the visible board, in both arrangements', () => {
    // The shortest the board is ever drawn — a play must be watchable in landscape.
    for (const play of PLAYS) {
      const { start, end, ballRoute } = compilePlay(play);
      for (const [label, map] of [
        ['start', start],
        ['end', end],
      ] as const) {
        for (const [id, p] of Object.entries(map)) {
          expect(p.x, `${play.id} ${label} ${id} x`).toBeGreaterThanOrEqual(0);
          expect(p.x, `${play.id} ${label} ${id} x`).toBeLessThanOrEqual(VIEW_BOX.width);
          expect(p.y, `${play.id} ${label} ${id} y`).toBeGreaterThanOrEqual(0);
          expect(p.y, `${play.id} ${label} ${id} y`).toBeLessThanOrEqual(
            MIN_VIEW_HEIGHT - TOKEN_RADIUS,
          );
        }
      }
      for (const p of ballRoute) {
        expect(p.x, play.id).toBeGreaterThanOrEqual(0);
        expect(p.x, play.id).toBeLessThanOrEqual(VIEW_BOX.width);
      }
    }
  });

  it('actually moves something in every play', () => {
    for (const play of PLAYS) {
      const { start, end } = compilePlay(play);
      const moved = Object.keys(start).some(
        (id) => start[id].x !== end[id].x || start[id].y !== end[id].y,
      );
      expect(moved, `${play.id} has nothing happening`).toBe(true);
    }
  });

  it('gives the ball real distance to cover, even when it comes back home', () => {
    // A throw home ends where it began, so comparing the ball's first and last
    // position says nothing: the route's length is what makes it a play.
    for (const play of PLAYS) {
      const { ballRoute } = compilePlay(play);
      let length = 0;
      for (let i = 0; i < ballRoute.length - 1; i++) {
        length += Math.hypot(
          ballRoute[i + 1].x - ballRoute[i].x,
          ballRoute[i + 1].y - ballRoute[i].y,
        );
      }
      expect(length, `${play.id} route goes nowhere`).toBeGreaterThan(40);
    }
  });

  it('covers every category with more than a single play', () => {
    for (const category of PLAY_CATEGORIES) {
      expect(PLAYS.filter((p) => p.category === category).length, category).toBeGreaterThan(1);
    }
  });

  it('throws to where a fielder ends up, not where they started', () => {
    // In the 6-3 the shortstop moves to the ball; the throw must come from there.
    const play = PLAYS.find((p) => p.id === '6-3')!;
    const { ballRoute, end, tokens } = compilePlay(play);
    const ss = tokens.find((t) => t.label === 'SS')!;
    expect(ballRoute[1]).toEqual(end[ss.id]);
  });

  it('gives fresh token ids each time, so loading twice cannot collide', () => {
    const a = compilePlay(PLAYS[0]);
    const b = compilePlay(PLAYS[0]);
    const overlap = a.tokens.filter((t) => t.type !== 'fielder').map((t) => t.id)
      .filter((id) => b.tokens.some((t) => t.id === id));
    expect(overlap).toEqual([]);
  });
});

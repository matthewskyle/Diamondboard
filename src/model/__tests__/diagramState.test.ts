import { describe, expect, it } from 'vitest';
import {
  diagramReducer,
  hasMovedFrom,
  initialState,
  resolvePlayback,
  UNDO_DEPTH,
  type DiagramAction,
} from '../diagramState';
import type { DiagramState } from '../types';

const run = (state: DiagramState, ...actions: DiagramAction[]) =>
  actions.reduce(diagramReducer, state);

const at = (x: number, y: number) => ({ at: { x, y } }) as const;

describe('initial state', () => {
  it('starts with nine fielders and nothing else', () => {
    const s = initialState();
    expect(s.tokens.filter((t) => t.type === 'fielder')).toHaveLength(9);
    expect(s.tokens).toHaveLength(9);
    expect(s.strokes).toEqual([]);
    expect(s.undoStack).toEqual([]);
  });
});

describe('moving tokens', () => {
  it('moves a token and undoes back to the original spot', () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    const before = { x: s0.tokens[0].x, y: s0.tokens[0].y };
    const s1 = diagramReducer(s0, { type: 'moveToken', id, x: 111, y: 222 });
    expect(s1.tokens[0]).toMatchObject({ x: 111, y: 222 });

    const s2 = diagramReducer(s1, { type: 'undo' });
    expect(s2.tokens[0]).toMatchObject(before);
    expect(s2.undoStack).toHaveLength(0);
  });

  it('ignores a no-op move so undo is not wasted on it', () => {
    const s0 = initialState();
    const t = s0.tokens[0];
    expect(diagramReducer(s0, { type: 'moveToken', id: t.id, x: t.x, y: t.y })).toBe(s0);
  });
});

describe('runners', () => {
  it('adds unlabeled runners at the tapped point', () => {
    const s = run(initialState(), { type: 'addRunner', ...at(10, 10) }, {
      type: 'addRunner',
      ...at(20, 20),
    });
    const runners = s.tokens.filter((t) => t.type === 'runner');
    expect(runners).toHaveLength(2);
    expect(runners.map((t) => t.label)).toEqual([undefined, undefined]);
    expect(runners[1]).toMatchObject({ x: 20, y: 20 });
  });

  it('gives every runner a distinct id', () => {
    const s = run(initialState(), { type: 'addRunner', ...at(10, 10) }, {
      type: 'addRunner',
      ...at(20, 20),
    });
    const ids = s.tokens.filter((t) => t.type === 'runner').map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('restores a deleted runner in place on undo', () => {
    let s = run(initialState(), { type: 'addRunner', ...at(10, 10) });
    const runner = s.tokens.at(-1)!;
    s = diagramReducer(s, { type: 'removeToken', id: runner.id });
    expect(s.tokens).toHaveLength(9);
    s = diagramReducer(s, { type: 'undo' });
    expect(s.tokens.at(-1)).toEqual(runner);
  });
});

describe('the ball', () => {
  it('never exists more than once — a second placement relocates it', () => {
    const s = run(initialState(), { type: 'addBall', ...at(10, 10) }, {
      type: 'addBall',
      ...at(400, 500),
    });
    const balls = s.tokens.filter((t) => t.type === 'ball');
    expect(balls).toHaveLength(1);
    expect(balls[0]).toMatchObject({ x: 400, y: 500 });
  });

  it('undoes a relocation back to the previous spot', () => {
    let s = run(initialState(), { type: 'addBall', ...at(10, 10) }, {
      type: 'addBall',
      ...at(400, 500),
    });
    s = diagramReducer(s, { type: 'undo' });
    expect(s.tokens.find((t) => t.type === 'ball')).toMatchObject({ x: 10, y: 10 });
  });
});

describe('fielders are permanent', () => {
  it('refuses to erase a fielder', () => {
    const s0 = initialState();
    expect(diagramReducer(s0, { type: 'removeToken', id: s0.tokens[0].id })).toBe(s0);
  });
});

describe('strokes', () => {
  it('adds, erases, and undoes strokes', () => {
    const points = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    let s = diagramReducer(initialState(), { type: 'addStroke', points });
    expect(s.strokes).toHaveLength(1);

    const id = s.strokes[0].id;
    s = diagramReducer(s, { type: 'removeStroke', id });
    expect(s.strokes).toHaveLength(0);

    s = diagramReducer(s, { type: 'undo' });
    expect(s.strokes.map((x) => x.id)).toEqual([id]);

    s = diagramReducer(s, { type: 'undo' });
    expect(s.strokes).toHaveLength(0);
  });

  it('drops an empty stroke', () => {
    const s0 = initialState();
    expect(diagramReducer(s0, { type: 'addStroke', points: [] })).toBe(s0);
  });
});

describe('animation capture', () => {
  it('captures start and end without touching the undo stack', () => {
    const s0 = initialState();
    const s1 = diagramReducer(s0, { type: 'captureStart' });
    expect(Object.keys(s1.start ?? {})).toHaveLength(9);
    expect(s1.undoStack).toHaveLength(0);

    const s2 = run(s1, { type: 'moveToken', id: s1.tokens[0].id, x: 5, y: 5 }, {
      type: 'captureEnd',
    });
    expect(s2.end![s2.tokens[0].id]).toEqual({ x: 5, y: 5 });
    // The capture is a snapshot, not a live view of the tokens.
    expect(s2.start![s2.tokens[0].id]).not.toEqual({ x: 5, y: 5 });
  });

  it('applies bulk positions without making them undoable', () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    const s1 = diagramReducer(s0, { type: 'setPositions', positions: { [id]: { x: 7, y: 8 } } });
    expect(s1.tokens[0]).toMatchObject({ x: 7, y: 8 });
    expect(s1.undoStack).toHaveLength(0);
  });
});

describe('undo stack', () => {
  it('is bounded', () => {
    let s = initialState();
    const id = s.tokens[0].id;
    for (let i = 0; i < UNDO_DEPTH + 20; i++) {
      s = diagramReducer(s, { type: 'moveToken', id, x: i + 1, y: i + 1 });
    }
    expect(s.undoStack).toHaveLength(UNDO_DEPTH);
  });

  it('is a no-op when empty', () => {
    const s0 = initialState();
    expect(diagramReducer(s0, { type: 'undo' })).toBe(s0);
  });
});

describe('reset', () => {
  it('clears everything back to the default arrangement', () => {
    const s = run(
      initialState(),
      { type: 'addRunner', ...at(10, 10) },
      { type: 'addBall', ...at(20, 20) },
      { type: 'addStroke', points: [{ x: 1, y: 1 }] },
      { type: 'captureStart' },
      { type: 'reset' },
    );
    expect(s.tokens).toHaveLength(9);
    expect(s.strokes).toHaveLength(0);
    expect(s.start).toBeNull();
    expect(s.undoStack).toHaveLength(0);
  });
});

describe('hasMovedFrom — the guard on re-recording', () => {
  it('is false right after a capture', () => {
    const s = diagramReducer(initialState(), { type: 'captureStart' });
    expect(hasMovedFrom(s.tokens, s.start)).toBe(false);
  });

  it('is false when there is nothing captured yet', () => {
    expect(hasMovedFrom(initialState().tokens, null)).toBe(false);
  });

  it('notices a token that moved', () => {
    let s = diagramReducer(initialState(), { type: 'captureStart' });
    s = diagramReducer(s, { type: 'moveToken', id: s.tokens[0].id, x: 100, y: 100 });
    expect(hasMovedFrom(s.tokens, s.start)).toBe(true);
  });

  it('ignores sub-pixel drift', () => {
    const s = diagramReducer(initialState(), { type: 'captureStart' });
    const nudged = s.tokens.map((t, i) => (i === 0 ? { ...t, x: t.x + 0.001 } : t));
    expect(hasMovedFrom(nudged, s.start)).toBe(false);
  });

  it('notices a token added or removed since the capture', () => {
    let s = diagramReducer(initialState(), { type: 'captureStart' });
    s = diagramReducer(s, { type: 'addRunner', at: { x: 10, y: 10 } });
    expect(hasMovedFrom(s.tokens, s.start)).toBe(true);

    const runner = s.tokens.at(-1)!;
    s = diagramReducer(s, { type: 'removeToken', id: runner.id });
    expect(hasMovedFrom(s.tokens, s.start)).toBe(false); // back to the captured set
  });

  it('stays true after the play is stopped, so recording cannot be restarted', () => {
    let s = diagramReducer(initialState(), { type: 'captureStart' });
    s = diagramReducer(s, { type: 'moveToken', id: s.tokens[0].id, x: 100, y: 100 });
    s = diagramReducer(s, { type: 'captureEnd' });
    expect(hasMovedFrom(s.tokens, s.start)).toBe(true);
  });

  it('is false again after a reset, so a new play can be recorded', () => {
    let s = diagramReducer(initialState(), { type: 'captureStart' });
    s = diagramReducer(s, { type: 'moveToken', id: s.tokens[0].id, x: 100, y: 100 });
    s = diagramReducer(s, { type: 'reset' });
    expect(hasMovedFrom(s.tokens, s.start)).toBe(false);
    expect(s.start).toBeNull();
  });
});

describe('the bug this guard prevents', () => {
  it('re-capturing the start after a play collapses it to nothing', () => {
    // Record, move, stop: a real play.
    let s = diagramReducer(initialState(), { type: 'captureStart' });
    const id = s.tokens[0].id;
    s = diagramReducer(s, { type: 'moveToken', id, x: 100, y: 100 });
    s = diagramReducer(s, { type: 'captureEnd' });
    expect(s.start![id]).not.toEqual(s.end![id]);

    // Pressing record again here is what silently destroyed the play.
    const clobbered = diagramReducer(s, { type: 'captureStart' });
    expect(clobbered.start![id]).toEqual(clobbered.end![id]);
    // Which is exactly the state the UI now refuses to reach.
    expect(hasMovedFrom(s.tokens, s.start)).toBe(true);
  });
});

describe('the ball route', () => {
  const withBall = () => diagramReducer(initialState(), { type: 'addBall', at: { x: 5, y: 5 } });

  it('needs a ball before it can start', () => {
    const s0 = initialState();
    expect(diagramReducer(s0, { type: 'addRouteLeg', at: { x: 10, y: 10 } })).toBe(s0);
  });

  it('anchors the first leg at the ball, then adds stops in order', () => {
    const s = run(
      withBall(),
      { type: 'addRouteLeg', at: { x: 10, y: 10 } },
      { type: 'addRouteLeg', at: { x: 20, y: 20 } },
    );
    expect(s.ballRoute).toEqual([
      { x: 5, y: 5 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ]);
  });

  it('stays put when the ball is moved afterwards', () => {
    let s = run(withBall(), { type: 'addRouteLeg', at: { x: 10, y: 10 } });
    const drawn = s.ballRoute;
    const ball = s.tokens.find((t) => t.type === 'ball')!;
    s = diagramReducer(s, { type: 'moveToken', id: ball.id, x: 900, y: 900 });
    expect(s.ballRoute).toEqual(drawn);
  });

  it('undoes one stop at a time', () => {
    let s = run(
      withBall(),
      { type: 'addRouteLeg', at: { x: 10, y: 10 } },
      { type: 'addRouteLeg', at: { x: 20, y: 20 } },
    );
    s = diagramReducer(s, { type: 'undo' });
    expect(s.ballRoute).toEqual([{ x: 5, y: 5 }, { x: 10, y: 10 }]);
    s = diagramReducer(s, { type: 'undo' });
    expect(s.ballRoute).toEqual([]);
  });

  it('clears the whole route, and undo puts it back', () => {
    let s = run(
      withBall(),
      { type: 'addRouteLeg', at: { x: 10, y: 10 } },
      { type: 'addRouteLeg', at: { x: 20, y: 20 } },
      { type: 'clearRoute' },
    );
    expect(s.ballRoute).toEqual([]);
    s = diagramReducer(s, { type: 'undo' });
    expect(s.ballRoute).toHaveLength(3);
  });

  it('ignores clearing an empty route', () => {
    const s0 = initialState();
    expect(diagramReducer(s0, { type: 'clearRoute' })).toBe(s0);
  });

  it('is cleared by a reset', () => {
    const s = run(withBall(), { type: 'addRouteLeg', at: { x: 1, y: 1 } }, { type: 'reset' });
    expect(s.ballRoute).toEqual([]);
  });
});

describe('resolvePlayback', () => {
  const recorded = () => {
    let s = diagramReducer(initialState(), { type: 'captureStart' });
    s = diagramReducer(s, { type: 'moveToken', id: s.tokens[0].id, x: 100, y: 100 });
    return s;
  };

  it('has nothing to play before anything is recorded', () => {
    const s = initialState();
    expect(resolvePlayback(s.tokens, s.start, s.end)).toBeNull();
  });

  it('has nothing to play when recording started but nothing moved', () => {
    const s = diagramReducer(initialState(), { type: 'captureStart' });
    expect(resolvePlayback(s.tokens, s.start, s.end)).toBeNull();
  });

  it('treats the movement since Record as the play, and captures the end', () => {
    const s = recorded();
    const playback = resolvePlayback(s.tokens, s.start, s.end)!;
    expect(playback.captureEnd).toBe(true);
    expect(playback.from).toBe(s.start);
    expect(playback.to[s.tokens[0].id]).toEqual({ x: 100, y: 100 });
  });

  it('replays the stored play when the board is back at the start', () => {
    let s = recorded();
    s = diagramReducer(s, { type: 'captureEnd' });
    // Rewind: the board now matches the start exactly.
    s = diagramReducer(s, { type: 'setPositions', positions: s.start! });
    const playback = resolvePlayback(s.tokens, s.start, s.end)!;
    expect(playback.captureEnd).toBe(false);
    expect(playback.to).toBe(s.end);
  });

  it('picks up further movement after a play, without a second Record', () => {
    let s = recorded();
    s = diagramReducer(s, { type: 'captureEnd' });
    s = diagramReducer(s, { type: 'moveToken', id: s.tokens[1].id, x: 400, y: 400 });
    const playback = resolvePlayback(s.tokens, s.start, s.end)!;
    expect(playback.captureEnd).toBe(true);
    expect(playback.to[s.tokens[1].id]).toEqual({ x: 400, y: 400 });
  });
});

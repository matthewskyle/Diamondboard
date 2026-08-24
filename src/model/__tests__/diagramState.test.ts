import { describe, expect, it } from 'vitest';
import { diagramReducer, initialState, UNDO_DEPTH, type DiagramAction } from '../diagramState';
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
  it('adds runners with sequential labels', () => {
    const s = run(initialState(), { type: 'addRunner', ...at(10, 10) }, {
      type: 'addRunner',
      ...at(20, 20),
    });
    expect(s.tokens.filter((t) => t.type === 'runner').map((t) => t.label)).toEqual(['R1', 'R2']);
  });

  it('reuses the lowest free number after a delete', () => {
    let s = run(initialState(), { type: 'addRunner', ...at(10, 10) }, {
      type: 'addRunner',
      ...at(20, 20),
    });
    const r1 = s.tokens.find((t) => t.label === 'R1')!;
    s = run(s, { type: 'removeToken', id: r1.id }, { type: 'addRunner', ...at(30, 30) });
    expect(s.tokens.filter((t) => t.type === 'runner').map((t) => t.label).sort()).toEqual([
      'R1',
      'R2',
    ]);
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

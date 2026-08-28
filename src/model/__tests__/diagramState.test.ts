import { describe, expect, it } from 'vitest';
import {
  boardArrangement,
  diagramReducer,
  hasPlay,
  initialState,
  UNDO_DEPTH,
  type DiagramAction,
} from '../diagramState';
import { arrangementAfter, hasMoves } from '../steps';
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
    // One empty step, so the first arrow has somewhere to land.
    expect(s.steps).toHaveLength(1);
    expect(hasMoves(s.steps[0])).toBe(false);
    expect(s.activeStep).toBe(0);
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
describe('bulk positions', () => {
  it('applies bulk positions without making them undoable', () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    const s1 = diagramReducer(s0, { type: 'setPositions', positions: { [id]: { x: 7, y: 8 } } });
    expect(s1.tokens[0]).toMatchObject({ x: 7, y: 8 });
    expect(s1.undoStack).toHaveLength(0);
  });
});

describe('drawing a step', () => {
  it('points a player somewhere in the active step', () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    const s = diagramReducer(s0, { type: 'setDestination', id, to: { x: 500, y: 383 } });
    expect(s.steps[0].moves[id]).toEqual({ x: 500, y: 383 });
    // Pointing somebody does not move him: the board is still the play's start.
    expect(s.tokens[0]).toMatchObject({ x: s0.tokens[0].x, y: s0.tokens[0].y });
  });

  it('leaves everybody else out of the step', () => {
    const s0 = initialState();
    const s = diagramReducer(s0, {
      type: 'setDestination',
      id: s0.tokens[0].id,
      to: { x: 500, y: 383 },
    });
    expect(Object.keys(s.steps[0].moves)).toEqual([s0.tokens[0].id]);
  });

  it('re-aiming replaces the arrow, and undo restores the previous one', () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    let s = diagramReducer(s0, { type: 'setDestination', id, to: { x: 500, y: 383 } });
    s = diagramReducer(s, { type: 'setDestination', id, to: { x: 300, y: 300 } });
    expect(s.steps[0].moves[id]).toEqual({ x: 300, y: 300 });
    s = diagramReducer(s, { type: 'undo' });
    expect(s.steps[0].moves[id]).toEqual({ x: 500, y: 383 });
  });

  it('ignores an arrow aimed where one already points', () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    const s = diagramReducer(s0, { type: 'setDestination', id, to: { x: 500, y: 383 } });
    expect(diagramReducer(s, { type: 'setDestination', id, to: { x: 500, y: 383 } })).toBe(s);
  });

  it('ignores a token that is not on the field', () => {
    const s0 = initialState();
    expect(diagramReducer(s0, { type: 'setDestination', id: 'ghost', to: { x: 1, y: 1 } })).toBe(s0);
  });

  it('clears an arrow, and undo puts it back', () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    let s = diagramReducer(s0, { type: 'setDestination', id, to: { x: 500, y: 383 } });
    s = diagramReducer(s, { type: 'clearDestination', id });
    expect(s.steps[0].moves[id]).toBeUndefined();
    s = diagramReducer(s, { type: 'undo' });
    expect(s.steps[0].moves[id]).toEqual({ x: 500, y: 383 });
  });

  it('ignores clearing an arrow nobody drew', () => {
    const s0 = initialState();
    expect(diagramReducer(s0, { type: 'clearDestination', id: s0.tokens[0].id })).toBe(s0);
  });

  it('only clears the arrow in the step being edited', () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    let s = diagramReducer(s0, { type: 'setDestination', id, to: { x: 500, y: 383 } });
    s = diagramReducer(s, { type: 'addStep' });
    s = diagramReducer(s, { type: 'setDestination', id, to: { x: 300, y: 300 } });
    s = diagramReducer(s, { type: 'clearDestination', id });
    expect(s.steps[0].moves[id]).toEqual({ x: 500, y: 383 });
    expect(s.steps[1].moves[id]).toBeUndefined();
  });
});

describe('steps', () => {
  const aimed = () => {
    const s0 = initialState();
    return diagramReducer(s0, {
      type: 'setDestination',
      id: s0.tokens[0].id,
      to: { x: 500, y: 383 },
    });
  };

  it('adds a step and makes it the one being drawn into', () => {
    const s = diagramReducer(aimed(), { type: 'addStep' });
    expect(s.steps).toHaveLength(2);
    expect(s.activeStep).toBe(1);
  });

  it('does not stack a second empty step behind an empty one', () => {
    const s = diagramReducer(initialState(), { type: 'addStep' });
    expect(s.steps).toHaveLength(1);
    expect(s.activeStep).toBe(0);
    expect(s.undoStack).toHaveLength(0);
  });

  it('undoes an added step', () => {
    let s = diagramReducer(aimed(), { type: 'addStep' });
    s = diagramReducer(s, { type: 'undo' });
    expect(s.steps).toHaveLength(1);
    expect(s.activeStep).toBe(0);
  });

  it('removes a step and undoes back to it', () => {
    let s = diagramReducer(aimed(), { type: 'addStep' });
    const id = s.tokens[0].id;
    s = diagramReducer(s, { type: 'setDestination', id, to: { x: 300, y: 300 } });
    s = diagramReducer(s, { type: 'removeStep', index: 0 });
    expect(s.steps).toHaveLength(1);
    expect(s.steps[0].moves[id]).toEqual({ x: 300, y: 300 });
    expect(s.activeStep).toBe(0);

    s = diagramReducer(s, { type: 'undo' });
    expect(s.steps).toHaveLength(2);
    expect(s.steps[0].moves[id]).toEqual({ x: 500, y: 383 });
  });

  it('always leaves a step to draw into', () => {
    const s = diagramReducer(aimed(), { type: 'removeStep', index: 0 });
    expect(s.steps).toHaveLength(1);
    expect(hasMoves(s.steps[0])).toBe(false);
  });

  it('ignores a step index that is not there', () => {
    const s0 = aimed();
    expect(diagramReducer(s0, { type: 'removeStep', index: 4 })).toBe(s0);
    expect(diagramReducer(s0, { type: 'setActiveStep', index: 4 })).toBe(s0);
  });

  it('switches the step being edited without touching undo', () => {
    const s = diagramReducer(diagramReducer(aimed(), { type: 'addStep' }), {
      type: 'setActiveStep',
      index: 0,
    });
    expect(s.activeStep).toBe(0);
    expect(s.undoStack).toHaveLength(2); // the arrow and the added step, nothing since
  });

  it('clears the play but leaves the players where they stand', () => {
    const s0 = aimed();
    const s = diagramReducer(s0, { type: 'clearSteps' });
    expect(s.steps).toHaveLength(1);
    expect(hasMoves(s.steps[0])).toBe(false);
    expect(s.tokens).toEqual(s0.tokens);
    expect(diagramReducer(s, { type: 'undo' }).steps[0].moves).toEqual(s0.steps[0].moves);
  });

  it('ignores clearing a play nobody has drawn', () => {
    const s0 = initialState();
    expect(diagramReducer(s0, { type: 'clearSteps' })).toBe(s0);
  });

  it('knows whether there is anything to play', () => {
    expect(hasPlay(initialState())).toBe(false);
    expect(hasPlay(aimed())).toBe(true);
  });
});

describe('the board while a later step is being edited', () => {
  /** A shortstop sent to second in step 1, with step 2 open. */
  const twoSteps = () => {
    const s0 = initialState();
    const id = s0.tokens[0].id;
    let s = diagramReducer(s0, { type: 'setDestination', id, to: { x: 500, y: 383 } });
    s = diagramReducer(s, { type: 'addStep' });
    return { state: s, id };
  };

  it('shows everybody where the earlier steps left them', () => {
    const { state, id } = twoSteps();
    expect(boardArrangement(state)[id]).toEqual({ x: 500, y: 383 });
    expect(boardArrangement({ ...state, activeStep: 0 })[id]).toEqual({
      x: state.tokens[0].x,
      y: state.tokens[0].y,
    });
  });

  it('drags a player by adjusting where the earlier step left him', () => {
    const { state, id } = twoSteps();
    const s = diagramReducer(state, { type: 'placeToken', id, to: { x: 480, y: 400 } });
    // The arrival moved; the top of the play did not.
    expect(s.steps[0].moves[id]).toEqual({ x: 480, y: 400 });
    expect(s.tokens[0]).toMatchObject({ x: state.tokens[0].x, y: state.tokens[0].y });
  });

  it('drags a player who has not moved yet by moving the start', () => {
    const { state } = twoSteps();
    const id = state.tokens[1].id;
    const s = diagramReducer(state, { type: 'placeToken', id, to: { x: 200, y: 200 } });
    expect(s.tokens[1]).toMatchObject({ x: 200, y: 200 });
    expect(s.steps[0].moves[id]).toBeUndefined();
  });
});

describe('erasing a token', () => {
  it('takes its arrows with it, and undo brings them back', () => {
    let s = diagramReducer(initialState(), { type: 'addRunner', at: { x: 10, y: 10 } });
    const runner = s.tokens.at(-1)!;
    s = diagramReducer(s, { type: 'setDestination', id: runner.id, to: { x: 500, y: 383 } });
    s = diagramReducer(s, { type: 'removeToken', id: runner.id });
    expect(s.steps[0].moves[runner.id]).toBeUndefined();

    s = diagramReducer(s, { type: 'undo' });
    expect(s.tokens.at(-1)).toEqual(runner);
    expect(s.steps[0].moves[runner.id]).toEqual({ x: 500, y: 383 });
  });

  it('leaves an erased token out of the arrangement it was pointed into', () => {
    let s = diagramReducer(initialState(), { type: 'addRunner', at: { x: 10, y: 10 } });
    const runner = s.tokens.at(-1)!;
    s = diagramReducer(s, { type: 'setDestination', id: runner.id, to: { x: 500, y: 383 } });
    s = diagramReducer(s, { type: 'removeToken', id: runner.id });
    expect(arrangementAfter(s.tokens, s.steps, 0)[runner.id]).toBeUndefined();
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
    const s0 = initialState();
    const s = run(
      s0,
      { type: 'addRunner', ...at(10, 10) },
      { type: 'addBall', ...at(20, 20) },
      { type: 'addStroke', points: [{ x: 1, y: 1 }] },
      { type: 'setDestination', id: s0.tokens[0].id, to: { x: 500, y: 383 } },
      { type: 'reset' },
    );
    expect(s.tokens).toHaveLength(9);
    expect(s.strokes).toHaveLength(0);
    expect(s.steps).toHaveLength(1);
    expect(hasMoves(s.steps[0])).toBe(false);
    expect(s.undoStack).toHaveLength(0);
  });
});

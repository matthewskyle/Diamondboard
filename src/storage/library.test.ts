import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diagramReducer, initialState } from '../model/diagramState';
import type { DiagramState, Token } from '../model/types';
import {
  AUTOSAVE_DELAY_MS,
  SCHEMA_VERSION,
  STORAGE_KEY,
  applyMigrations,
  browserLocalStorage,
  createAutosave,
  migrations,
  persistAfterLoad,
  readLibrary,
  writeCurrentBoard,
  type KeyValueStore,
} from './library';

/**
 * A board whose highest id lives only inside an undo entry. A restore that
 * walks the top-level tokens and steps but not the undo stack mints a
 * colliding id.
 */
function highWaterBoard(): DiagramState {
  return {
    tokens: [{ id: 'runner-40', type: 'runner', label: 'R2', x: 3, y: 4 }],
    strokes: [{ id: 'stroke-50', points: [{ x: 1, y: 1 }] }],
    steps: [{ id: 'step-9', moves: {} }],
    activeStep: 0,
    undoStack: [
      {
        kind: 'restoreSteps',
        steps: [{ id: 'step-80', moves: { 'runner-40': { x: 5, y: 6 } } }],
        activeStep: 0,
      },
    ],
  };
}

/** A board a coach might actually leave on the screen, built through the reducer. */
function coachedBoard(): DiagramState {
  let state = initialState();
  const shortstop = state.tokens.find((token) => token.label === 'SS');
  if (!shortstop) throw new Error('the default board has no shortstop');
  state = diagramReducer(state, { type: 'moveToken', id: shortstop.id, x: 100.25, y: 200.5 });
  state = diagramReducer(state, { type: 'addRunner', at: { x: 12, y: 34 }, label: 'R2' });
  state = diagramReducer(state, { type: 'addRunner', at: { x: 50, y: 60 } });
  state = diagramReducer(state, { type: 'addBall', at: { x: 400, y: 500 } });
  state = diagramReducer(state, {
    type: 'addStroke',
    points: [
      { x: 1, y: 2 },
      { x: 8, y: 9 },
      { x: 15, y: 3 },
    ],
  });
  state = diagramReducer(state, {
    type: 'setDestination',
    id: shortstop.id,
    to: { x: 300, y: 320 },
  });
  state = diagramReducer(state, { type: 'addStep' });
  const ball = state.tokens.find((token) => token.type === 'ball');
  if (!ball) throw new Error('the ball was not added');
  state = diagramReducer(state, { type: 'setDestination', id: ball.id, to: { x: 10, y: 11 } });
  return state;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function memoryStorage(initial?: Record<string, string>): KeyValueStore {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

describe('restoring ids', () => {
  it('mints the next id past every id in the saved board, including ones buried in undo', () => {
    const storage = memoryStorage();
    const board = highWaterBoard();
    expect(writeCurrentBoard(storage, board)).toBe(true);

    const result = readLibrary(storage);
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;

    const next = diagramReducer(result.board, { type: 'addRunner', at: { x: 1, y: 2 } });
    const created = next.tokens.find((token) => token.type === 'runner' && token.id !== 'runner-40');
    expect(created).toBeDefined();
    const suffix = Number(created?.id.slice(created.id.lastIndexOf('-') + 1));
    expect(suffix).toBeGreaterThan(80);

    const ids = next.tokens.map((token) => token.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('round trip', () => {
  it('writes schema version 1 and reads the board back unchanged', () => {
    const storage = memoryStorage();
    const board = coachedBoard();
    expect(writeCurrentBoard(storage, board)).toBe(true);

    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const document = JSON.parse(raw ?? '') as {
      version: number;
      plays: unknown[];
      current: DiagramState;
    };
    expect(document.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(1);
    expect(document.plays).toEqual([]);
    expect(document.current.tokens.some((token: Token) => token.label === 'R2')).toBe(true);

    const result = readLibrary(storage);
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;
    expect(jsonClone(result.board)).toEqual(jsonClone(board));
  });

  it('keeps coaching notes on their steps', () => {
    const storage = memoryStorage();
    let board = coachedBoard();
    board = diagramReducer(board, { type: 'setStepNote', index: 0, note: 'SS breaks on contact.' });
    board = diagramReducer(board, { type: 'setStepNote', index: 1, note: 'Ball to second.' });
    expect(writeCurrentBoard(storage, board)).toBe(true);

    const result = readLibrary(storage);
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;
    expect(result.board.steps.map((step) => step.note)).toEqual([
      'SS breaks on contact.',
      'Ball to second.',
    ]);
  });

  it('rejects a step note that is not text', () => {
    const board = jsonClone(highWaterBoard()) as unknown as { steps: Record<string, unknown>[] };
    board.steps[0].note = 42;
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: SCHEMA_VERSION, current: board, plays: [] }),
    });
    expect(readLibrary(storage)).toEqual({ status: 'rejected', reason: 'corrupt' });
  });

  it('restores undo, so the last arrow comes back off', () => {
    const storage = memoryStorage();
    const board = coachedBoard();
    writeCurrentBoard(storage, board);
    const result = readLibrary(storage);
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;

    const ball = result.board.tokens.find((token) => token.type === 'ball');
    expect(ball).toBeDefined();
    expect(result.board.steps[1].moves[ball?.id ?? '']).toEqual({ x: 10, y: 11 });
    expect(result.board.activeStep).toBe(1);

    const undone = diagramReducer(result.board, { type: 'undo' });
    expect(undone.steps[1].moves[ball?.id ?? '']).toBeUndefined();
    expect(undone.undoStack).toHaveLength(board.undoStack.length - 1);
    expect(undone.tokens.some((token) => token.label === 'R2')).toBe(true);
    expect(undone.strokes).toHaveLength(1);
  });

  it('keeps named plays in the same document when the open board is saved', () => {
    const storage = memoryStorage();
    const open = highWaterBoard();
    const playBoard = jsonClone(open);
    const play = {
      id: 'play-1',
      name: 'Hit and run',
      updatedAt: 1_700_000_000_000,
      board: playBoard,
      note: 'kept for a later My Plays list',
    };
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, current: jsonClone(open), plays: [play, { id: 'broken' }, null] }),
    );

    const replacement = diagramReducer(open, { type: 'addRunner', at: { x: 9, y: 9 }, label: 'R1' });
    expect(writeCurrentBoard(storage, replacement)).toBe(true);

    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '') as { plays: unknown[]; version: number };
    expect(saved.version).toBe(1);
    expect(saved.plays).toEqual([play]);

    const result = readLibrary(storage);
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;
    expect(result.board.tokens.some((token) => token.label === 'R1')).toBe(true);
  });

  it('still restores the open board when the plays list is the wrong shape', () => {
    const storage = memoryStorage();
    const board = jsonClone(highWaterBoard());
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, current: board, plays: 'nope' }));
    const result = readLibrary(storage);
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;
    expect(jsonClone(result.board)).toEqual(board);
  });
});

describe('failures fall back instead of throwing', () => {
  it('reports an empty store when nothing has been saved', () => {
    expect(readLibrary(memoryStorage())).toEqual({ status: 'empty' });
  });

  it('rejects corrupt JSON and corrupt documents', () => {
    const board = jsonClone(highWaterBoard());
    const corrupt = [
      '{',
      '',
      'null',
      '[]',
      '"hello"',
      '0',
      JSON.stringify({ version: '1', current: board, plays: [] }),
      JSON.stringify({ version: 1.5, current: board, plays: [] }),
      JSON.stringify({ version: 0, current: board, plays: [] }),
      JSON.stringify({ version: 1, plays: [] }),
      JSON.stringify({ version: 1, current: null, plays: [] }),
      JSON.stringify({
        version: 1,
        plays: [],
        current: { ...board, tokens: [{ id: 'x', type: 'umpire', x: 1, y: 1 }] },
      }),
      JSON.stringify({
        version: 1,
        plays: [],
        current: { ...board, activeStep: 5 },
      }),
      JSON.stringify({
        version: 1,
        plays: [],
        current: { ...board, activeStep: -1 },
      }),
      JSON.stringify({
        version: 1,
        plays: [],
        current: { ...board, steps: [] },
      }),
      JSON.stringify({
        version: 1,
        plays: [],
        current: { ...board, strokes: [{ id: 'stroke-1', points: [{ x: 'no', y: 1 }] }] },
      }),
      JSON.stringify({
        version: 1,
        plays: [],
        current: { ...board, undoStack: [{ kind: 'explode' }] },
      }),
      JSON.stringify({
        version: 1,
        plays: [],
        current: {
          ...board,
          tokens: [
            board.tokens[0],
            { ...board.tokens[0] },
          ],
        },
      }),
    ];

    for (const raw of corrupt) {
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      expect(readLibrary(storage), raw).toEqual({ status: 'rejected', reason: 'corrupt' });
    }
  });

  it('rejects a future version and refuses to overwrite it', () => {
    const raw = '{ "version": 99, "current": {"no": true}, "plays": [{"id":"later"}] }';
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    expect(readLibrary(storage)).toEqual({ status: 'rejected', reason: 'future' });
    expect(writeCurrentBoard(storage, highWaterBoard())).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('treats a throwing store as unavailable and does not throw', () => {
    const storage: KeyValueStore = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    expect(readLibrary(storage)).toEqual({ status: 'rejected', reason: 'unavailable' });
    expect(() => writeCurrentBoard(storage, highWaterBoard())).not.toThrow();
    expect(writeCurrentBoard(storage, highWaterBoard())).toBe(false);
  });

  it('swallows a quota error on write', () => {
    const storage: KeyValueStore = {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => writeCurrentBoard(storage, highWaterBoard())).not.toThrow();
    expect(writeCurrentBoard(storage, highWaterBoard())).toBe(false);
  });

  it('treats a missing localStorage as unavailable', () => {
    expect(readLibrary(browserLocalStorage())).toEqual({ status: 'rejected', reason: 'unavailable' });
  });

  it('autosaves after an empty, restored, or corrupt load, and not after a future or failed one', () => {
    const board = highWaterBoard();
    expect(persistAfterLoad({ status: 'empty' })).toBe(true);
    expect(persistAfterLoad({ status: 'restored', board })).toBe(true);
    expect(persistAfterLoad({ status: 'rejected', reason: 'corrupt' })).toBe(true);
    expect(persistAfterLoad({ status: 'rejected', reason: 'future' })).toBe(false);
    expect(persistAfterLoad({ status: 'rejected', reason: 'unavailable' })).toBe(false);
  });

  it('replaces a corrupt save once a board is written again', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
    expect(readLibrary(storage)).toEqual({ status: 'rejected', reason: 'corrupt' });
    expect(writeCurrentBoard(storage, highWaterBoard())).toBe(true);
    expect(readLibrary(storage).status).toBe('restored');
  });
});

describe('migrations', () => {
  it('leaves the current version in place and has no step away from it yet', () => {
    const doc = { version: 1, current: null, plays: [] };
    expect(applyMigrations(doc, SCHEMA_VERSION, migrations)).toEqual(doc);
    expect(migrations[SCHEMA_VERSION]).toBeUndefined();
  });

  it('walks an older document one version at a time', () => {
    const steps = {
      1: (doc: Record<string, unknown>) => ({ ...doc, version: 2, current: doc.legacy }),
      2: (doc: Record<string, unknown>) => ({ ...doc, version: 3, plays: doc.plays ?? [] }),
    };
    expect(applyMigrations({ version: 1, legacy: { a: 1 }, plays: [] }, 3, steps)).toEqual({
      version: 3,
      legacy: { a: 1 },
      plays: [],
      current: { a: 1 },
    });
  });

  it('stops when a step is missing, a migration throws, or the version does not advance', () => {
    expect(applyMigrations({ version: 1 }, 3, { 2: (doc) => ({ ...doc, version: 3 }) })).toBeNull();
    expect(
      applyMigrations({ version: 1 }, 2, {
        1: () => {
          throw new Error('boom');
        },
      }),
    ).toBeNull();
    expect(applyMigrations({ version: 1 }, 2, { 1: (doc) => doc })).toBeNull();
    expect(applyMigrations({ version: 4 }, 1, {})).toBeNull();
    expect(applyMigrations({ version: 0 }, 1, {})).toBeNull();
    expect(applyMigrations([], 1, {})).toBeNull();
  });

  it('loads a pre-current document through the migration path without rewriting storage', () => {
    const board = jsonClone(highWaterBoard());
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, legacy: board, plays: [] }),
    });
    const result = readLibrary(storage, {
      schemaVersion: 2,
      migrations: {
        1: (doc) => ({ version: 2, current: doc.legacy, plays: doc.plays }),
      },
    });
    expect(result).toEqual({ status: 'restored', board });
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '').version).toBe(1);
  });

  it('rejects a document when the migration that would advance it is missing', () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, current: jsonClone(highWaterBoard()), plays: [] }),
    });
    expect(
      readLibrary(storage, {
        schemaVersion: 3,
        migrations: { 2: (doc) => ({ ...doc, version: 3 }) },
      }),
    ).toEqual({ status: 'rejected', reason: 'corrupt' });
  });
});

describe('autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits out the debounce and keeps only the latest board', () => {
    const storage = memoryStorage();
    const autosave = createAutosave(storage);
    const first = highWaterBoard();
    const second = diagramReducer(first, { type: 'addRunner', at: { x: 8, y: 8 }, label: 'R3' });

    autosave.schedule(first);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    autosave.schedule(second);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(1);
    const result = readLibrary(storage);
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;
    expect(result.board.tokens.some((token) => token.label === 'R3')).toBe(true);
    expect(jsonClone(result.board)).toEqual(jsonClone(second));
  });

  it('collapses a burst of edits into one write', () => {
    let writes = 0;
    const storage: KeyValueStore = {
      getItem() {
        return null;
      },
      setItem() {
        writes += 1;
      },
    };
    const autosave = createAutosave(storage);
    let board = highWaterBoard();
    for (let i = 0; i < 30; i++) {
      board = diagramReducer(board, { type: 'addStroke', points: [{ x: i, y: i }] });
      autosave.schedule(board);
    }
    expect(writes).toBe(0);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(writes).toBe(1);
  });

  it('flush writes immediately and does not write again when the timer fires', () => {
    let writes = 0;
    const storage: KeyValueStore = {
      getItem() {
        return null;
      },
      setItem() {
        writes += 1;
      },
    };
    const autosave = createAutosave(storage);
    autosave.schedule(highWaterBoard());
    autosave.flush();
    expect(writes).toBe(1);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(writes).toBe(1);
    autosave.flush();
    expect(writes).toBe(1);
  });

  it('does not write when persistence is disabled', () => {
    const storage = memoryStorage();
    const autosave = createAutosave(storage, { enabled: false });
    autosave.schedule(highWaterBoard());
    autosave.flush();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('swallows a storage throw while a debounced write lands', () => {
    const storage: KeyValueStore = {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    const autosave = createAutosave(storage);
    expect(() => {
      autosave.schedule(highWaterBoard());
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
      autosave.flush();
    }).not.toThrow();
  });
});

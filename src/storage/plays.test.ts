import { describe, expect, it } from 'vitest';
import { diagramReducer, initialState } from '../model/diagramState';
import type { DiagramState, Token } from '../model/types';
import {
  STORAGE_KEY,
  deletePlay,
  duplicatePlay,
  listPlays,
  openPlay,
  openPracticePlay,
  readLibrary,
  readPracticeQueue,
  renamePlay,
  savePlay,
  writeCurrentBoard,
  writePracticeQueue,
  type KeyValueStore,
} from './library';

function runnerBoard(): DiagramState {
  return diagramReducer(initialState(), { type: 'addRunner', at: { x: 12, y: 34 }, label: 'R2' });
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function memoryStorage(initial?: Record<string, string>): KeyValueStore & {
  raw: () => string | null;
} {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    raw() {
      return Object.prototype.hasOwnProperty.call(data, STORAGE_KEY) ? data[STORAGE_KEY] : null;
    },
  };
}

function throwingStorage(): KeyValueStore {
  return {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
}

function documentOf(storage: { raw: () => string | null }) {
  return JSON.parse(storage.raw() ?? 'null') as {
    version: number;
    current: DiagramState;
    plays: Array<{
      id: string;
      name: string;
      updatedAt: number;
      board: DiagramState;
      note?: string;
    }>;
  };
}

describe('the practice queue', () => {
  it('keeps queue order and the current play across autosaves and saved-play edits', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    const cutoffs = initialState();
    savePlay(storage, board, 'Bunts', { id: 'bunts' });
    savePlay(storage, cutoffs, 'Cutoffs', { id: 'cutoffs' });
    expect(writePracticeQueue(storage, board, {
      name: '  Tuesday  ',
      playIds: ['bunts', 'cutoffs', 'bunts'],
      activeIndex: null,
    })).toMatchObject({ ok: true, queue: { name: 'Tuesday' } });

    expect(openPracticePlay(storage, 1)).toMatchObject({ ok: true, queue: { activeIndex: 1 } });
    expect(readLibrary(storage)).toMatchObject({ status: 'restored', board: cutoffs });
    writeCurrentBoard(storage, board);
    renamePlay(storage, 'cutoffs', 'Relay');
    duplicatePlay(storage, 'cutoffs', { id: 'relay-copy' });
    savePlay(storage, board, 'Steals', { id: 'steals' });
    expect(readPracticeQueue(storage)).toEqual({
      ok: true,
      queue: { name: 'Tuesday', playIds: ['bunts', 'cutoffs', 'bunts'], activeIndex: 1 },
    });

    deletePlay(storage, 'bunts');
    expect(readPracticeQueue(storage)).toEqual({
      ok: true,
      queue: { name: 'Tuesday', playIds: ['cutoffs'], activeIndex: 0 },
    });
  });

  it('keeps both the queue position and board when storage rejects a play switch', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    savePlay(storage, board, 'Bunts', { id: 'bunts' });
    savePlay(storage, initialState(), 'Cutoffs', { id: 'cutoffs' });
    writePracticeQueue(storage, board, {
      name: 'Tuesday', playIds: ['bunts', 'cutoffs'], activeIndex: null,
    });
    openPracticePlay(storage, 0);
    const before = storage.raw();
    expect(openPracticePlay({
      getItem: storage.getItem,
      setItem() { throw new Error('QuotaExceededError'); },
    }, 1)).toEqual({ ok: false, reason: 'unavailable' });
    expect(storage.raw()).toBe(before);
  });

  it('leaves a future library document intact', () => {
    const future = '{"version":100}';
    const storage = memoryStorage({ [STORAGE_KEY]: future });
    expect(writePracticeQueue(storage, initialState(), {
      name: 'Tuesday', playIds: [], activeIndex: null,
    })).toEqual({ ok: false, reason: 'future' });
    expect(storage.raw()).toBe(future);
  });
});

/** A board whose ids sit far above anything the rest of the suite mints. */
function highIdBoard(): DiagramState {
  return {
    tokens: [{ id: 'runner-999999', type: 'runner', label: 'R2', x: 3, y: 4 }],
    strokes: [],
    steps: [{ id: 'step-1', moves: {} }],
    activeStep: 0,
    undoStack: [
      {
        kind: 'restoreSteps',
        steps: [{ id: 'step-999998', moves: {} }],
        activeStep: 0,
      },
    ],
  };
}

describe('savePlay', () => {
  it('stores a named snapshot beside the open board and trims the name', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    const saved = savePlay(storage, board, '  Hit and run  ', { id: 'play-1', now: 1_700_000_000_000 });

    expect(saved).toMatchObject({
      ok: true,
      play: { id: 'play-1', name: 'Hit and run', updatedAt: 1_700_000_000_000 },
    });
    if (!saved.ok) return;
    expect(saved.play.board).not.toBe(board);
    expect(jsonClone(saved.play.board)).toEqual(jsonClone(board));

    const document = documentOf(storage);
    expect(document.version).toBe(1);
    expect(document.plays).toHaveLength(1);
    expect(document.plays[0].name).toBe('Hit and run');
    expect(jsonClone(document.current)).toEqual(jsonClone(board));
    expect(jsonClone(document.plays[0].board)).toEqual(jsonClone(board));

    board.tokens = board.tokens.filter((token) => token.label !== 'R2');
    expect(documentOf(storage).plays[0].board.tokens.some((token: Token) => token.label === 'R2')).toBe(
      true,
    );
  });

  it('keeps plays already in the document, including fields this build does not use', () => {
    const board = runnerBoard();
    const storage = memoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        current: jsonClone(board),
        plays: [
          {
            id: 'play-1',
            name: 'Hit and run',
            updatedAt: 1,
            board: jsonClone(board),
            note: 'kept for a later reader',
          },
          { id: 'broken' },
        ],
      }),
    );

    const saved = savePlay(storage, board, 'Bunt', { id: 'play-2', now: 2 });
    expect(saved.ok).toBe(true);
    const document = documentOf(storage);
    expect(document.plays.map((play) => play.id)).toEqual(['play-1', 'play-2']);
    expect(document.plays[0].note).toBe('kept for a later reader');
    expect(document.version).toBe(1);
  });

  it('stays a snapshot when the open board is autosaved afterwards', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    expect(savePlay(storage, board, 'Hit and run', { id: 'play-1', now: 5 }).ok).toBe(true);

    const edited = diagramReducer(board, { type: 'addRunner', at: { x: 8, y: 8 }, label: 'R1' });
    expect(writeCurrentBoard(storage, edited)).toBe(true);

    const listed = listPlays(storage);
    expect(listed).toEqual({
      ok: true,
      plays: [{ id: 'play-1', name: 'Hit and run', updatedAt: 5 }],
    });

    const restored = readLibrary(storage);
    expect(restored.status).toBe('restored');
    if (restored.status !== 'restored') return;
    expect(restored.board.tokens.some((token) => token.label === 'R1')).toBe(true);
    expect(documentOf(storage).plays[0].board.tokens.some((token) => token.label === 'R2')).toBe(true);
    expect(documentOf(storage).plays[0].board.tokens.some((token) => token.label === 'R1')).toBe(false);
  });

  it('mints distinct ids and a timestamp when the caller does not', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    const first = savePlay(storage, board, 'One');
    const second = savePlay(storage, board, 'Two');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.play.id).not.toBe(second.play.id);
    expect(first.play.id.length).toBeGreaterThan(0);
    expect(second.play.updatedAt).toBeGreaterThan(1_700_000_000_000);
    expect(listPlays(storage)).toEqual({
      ok: true,
      plays: [
        { id: first.play.id, name: 'One', updatedAt: first.play.updatedAt },
        { id: second.play.id, name: 'Two', updatedAt: second.play.updatedAt },
      ],
    });
  });

  it('rejects a blank name and does not write', () => {
    const board = runnerBoard();
    for (const name of ['', '   ', '\n\t']) {
      const storage = memoryStorage();
      expect(savePlay(storage, board, name)).toEqual({ ok: false, reason: 'empty-name' });
      expect(storage.raw()).toBeNull();
    }
  });
});

describe('listPlays', () => {
  it('is an empty list when nothing has been saved', () => {
    expect(listPlays(memoryStorage())).toEqual({ ok: true, plays: [] });
  });

  it('skips entries that are not plays and still reads a valid board', () => {
    const board = jsonClone(runnerBoard());
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        current: board,
        plays: [{ id: 'play-1', name: 'Hit and run', updatedAt: 4, board }, null, { id: 'nope' }],
      }),
    });
    expect(listPlays(storage)).toEqual({
      ok: true,
      plays: [{ id: 'play-1', name: 'Hit and run', updatedAt: 4 }],
    });
  });

  it('treats a plays list of the wrong shape as no plays', () => {
    const board = jsonClone(runnerBoard());
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, current: board, plays: 'nope' }),
    });
    expect(listPlays(storage)).toEqual({ ok: true, plays: [] });
  });
});

describe('openPlay', () => {
  it('returns the saved board and makes it the board a reload would paint', () => {
    const storage = memoryStorage();
    const open = runnerBoard();
    const savedBoard = diagramReducer(initialState(), {
      type: 'addRunner',
      at: { x: 50, y: 60 },
      label: 'R1',
    });
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        current: jsonClone(open),
        plays: [{ id: 'play-1', name: 'Hit and run', updatedAt: 1, board: jsonClone(savedBoard) }],
      }),
    );

    const opened = openPlay(storage, 'play-1');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(jsonClone(opened.board)).toEqual(jsonClone(savedBoard));
    expect(opened.board).not.toBe(savedBoard);

    const document = documentOf(storage);
    expect(jsonClone(document.current)).toEqual(jsonClone(savedBoard));
    expect(document.plays).toHaveLength(1);
    expect(document.plays[0].updatedAt).toBe(1);
    expect(jsonClone(document.plays[0].board)).toEqual(jsonClone(savedBoard));

    const again = openPlay(storage, 'play-1');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.board).not.toBe(opened.board);
  });

  it('adopts ids so the next token cannot collide with one stored in the play', () => {
    const storage = memoryStorage();
    const board = highIdBoard();
    expect(savePlay(storage, board, 'Hit and run', { id: 'play-1', now: 1 }).ok).toBe(true);

    const opened = openPlay(storage, 'play-1');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const next = diagramReducer(opened.board, { type: 'addRunner', at: { x: 1, y: 2 } });
    const created = next.tokens.find((token) => token.id !== 'runner-999999');
    expect(created).toBeDefined();
    const suffix = Number(created?.id.slice(created.id.lastIndexOf('-') + 1));
    expect(suffix).toBeGreaterThan(999999);
  });

  it('reports a missing play and does not write', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    expect(savePlay(storage, board, 'Hit and run', { id: 'play-1', now: 1 }).ok).toBe(true);
    const before = storage.raw();
    expect(openPlay(storage, 'play-9')).toEqual({ ok: false, reason: 'missing' });
    expect(openPlay(memoryStorage(), 'play-9')).toEqual({ ok: false, reason: 'missing' });
    expect(storage.raw()).toBe(before);
  });
});

describe('renamePlay', () => {
  it('renames one play and leaves the board, the others, and the open board alone', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    savePlay(storage, board, 'Hit and run', { id: 'play-1', now: 1 });
    savePlay(storage, board, 'Bunt', { id: 'play-2', now: 2 });
    const before = jsonClone(documentOf(storage).current);

    const renamed = renamePlay(storage, 'play-1', '  Squeeze  ', { now: 9 });
    expect(renamed).toMatchObject({
      ok: true,
      play: { id: 'play-1', name: 'Squeeze', updatedAt: 9 },
    });
    const document = documentOf(storage);
    expect(document.plays.map((play) => play.name)).toEqual(['Squeeze', 'Bunt']);
    expect(document.plays[1].updatedAt).toBe(2);
    expect(jsonClone(document.plays[0].board)).toEqual(jsonClone(board));
    expect(jsonClone(document.current)).toEqual(before);
    expect(document.version).toBe(1);
  });

  it('keeps fields this build does not use', () => {
    const board = jsonClone(runnerBoard());
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        current: board,
        plays: [{ id: 'play-1', name: 'Hit and run', updatedAt: 1, board, note: 'kept' }],
      }),
    });
    expect(renamePlay(storage, 'play-1', 'Squeeze', { now: 3 }).ok).toBe(true);
    expect(documentOf(storage).plays[0].note).toBe('kept');
  });

  it('rejects a blank name and a missing play without writing', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    savePlay(storage, board, 'Hit and run', { id: 'play-1', now: 1 });
    const before = storage.raw();
    expect(renamePlay(storage, 'play-1', '   ')).toEqual({ ok: false, reason: 'empty-name' });
    expect(renamePlay(storage, 'play-9', 'Squeeze')).toEqual({ ok: false, reason: 'missing' });
    expect(storage.raw()).toBe(before);
  });
});

describe('duplicatePlay', () => {
  it('inserts a copy after the original under a new id', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    savePlay(storage, board, 'Hit and run', { id: 'play-1', now: 1 });
    savePlay(storage, board, 'Bunt', { id: 'play-2', now: 2 });

    const copied = duplicatePlay(storage, 'play-1', { id: 'play-3', now: 8 });
    expect(copied).toMatchObject({
      ok: true,
      play: { id: 'play-3', name: 'Hit and run copy', updatedAt: 8 },
    });
    if (!copied.ok) return;
    expect(jsonClone(copied.play.board)).toEqual(jsonClone(board));
    copied.play.board.tokens[0].x = 12345;

    const document = documentOf(storage);
    expect(document.plays.map((play) => play.id)).toEqual(['play-1', 'play-3', 'play-2']);
    expect(document.plays.map((play) => play.name)).toEqual(['Hit and run', 'Hit and run copy', 'Bunt']);
    expect(document.plays[0].updatedAt).toBe(1);
    expect(document.plays[1].board.tokens[0].x).not.toBe(12345);
    expect(jsonClone(document.plays[1].board)).toEqual(jsonClone(document.plays[0].board));
    expect(jsonClone(document.current)).toEqual(jsonClone(board));
  });

  it('reports a missing play and does not write', () => {
    const storage = memoryStorage();
    savePlay(storage, runnerBoard(), 'Hit and run', { id: 'play-1', now: 1 });
    const before = storage.raw();
    expect(duplicatePlay(storage, 'play-9')).toEqual({ ok: false, reason: 'missing' });
    expect(storage.raw()).toBe(before);
  });
});

describe('deletePlay', () => {
  it('removes one play and leaves the open board and the rest', () => {
    const storage = memoryStorage();
    const board = runnerBoard();
    savePlay(storage, board, 'Hit and run', { id: 'play-1', now: 1 });
    savePlay(storage, board, 'Bunt', { id: 'play-2', now: 2 });

    expect(deletePlay(storage, 'play-1')).toEqual({ ok: true });
    const document = documentOf(storage);
    expect(document.plays.map((play) => play.id)).toEqual(['play-2']);
    expect(jsonClone(document.current)).toEqual(jsonClone(board));
    expect(document.version).toBe(1);

    expect(deletePlay(storage, 'play-2')).toEqual({ ok: true });
    expect(documentOf(storage).plays).toEqual([]);
    expect(readLibrary(storage).status).toBe('restored');
  });

  it('reports a missing play and does not write', () => {
    const storage = memoryStorage();
    savePlay(storage, runnerBoard(), 'Hit and run', { id: 'play-1', now: 1 });
    const before = storage.raw();
    expect(deletePlay(storage, 'play-9')).toEqual({ ok: false, reason: 'missing' });
    expect(storage.raw()).toBe(before);
  });
});

describe('plays survive a bad store', () => {
  it('rejects corrupt documents without throwing, and a save replaces one', () => {
    const board = runnerBoard();
    const corrupt = ['{not json', '[]', JSON.stringify({ version: 0, current: board, plays: [] })];
    for (const raw of corrupt) {
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      expect(listPlays(storage), raw).toEqual({ ok: false, reason: 'corrupt' });
      expect(openPlay(storage, 'play-1'), raw).toEqual({ ok: false, reason: 'corrupt' });
      expect(renamePlay(storage, 'play-1', 'Squeeze'), raw).toEqual({ ok: false, reason: 'corrupt' });
      expect(duplicatePlay(storage, 'play-1'), raw).toEqual({ ok: false, reason: 'corrupt' });
      expect(deletePlay(storage, 'play-1'), raw).toEqual({ ok: false, reason: 'corrupt' });
      expect(storage.raw(), raw).toBe(raw);
    }

    const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
    expect(savePlay(storage, board, 'Hit and run', { id: 'play-1', now: 1 }).ok).toBe(true);
    expect(readLibrary(storage).status).toBe('restored');
    expect(listPlays(storage)).toEqual({
      ok: true,
      plays: [{ id: 'play-1', name: 'Hit and run', updatedAt: 1 }],
    });
  });

  it('refuses to overwrite a future schema', () => {
    const raw = '{"version":99,"current":{"no":true},"plays":[{"id":"later"}]}';
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const board = runnerBoard();
    expect(listPlays(storage)).toEqual({ ok: false, reason: 'future' });
    expect(savePlay(storage, board, 'Hit and run')).toEqual({ ok: false, reason: 'future' });
    expect(openPlay(storage, 'later')).toEqual({ ok: false, reason: 'future' });
    expect(renamePlay(storage, 'later', 'Squeeze')).toEqual({ ok: false, reason: 'future' });
    expect(duplicatePlay(storage, 'later')).toEqual({ ok: false, reason: 'future' });
    expect(deletePlay(storage, 'later')).toEqual({ ok: false, reason: 'future' });
    expect(storage.raw()).toBe(raw);
  });

  it('treats a throwing store as unavailable and does not throw', () => {
    const storage = throwingStorage();
    const board = runnerBoard();
    expect(() => listPlays(storage)).not.toThrow();
    expect(listPlays(storage)).toEqual({ ok: false, reason: 'unavailable' });
    expect(savePlay(storage, board, 'Hit and run')).toEqual({ ok: false, reason: 'unavailable' });
    expect(openPlay(storage, 'play-1')).toEqual({ ok: false, reason: 'unavailable' });
    expect(renamePlay(storage, 'play-1', 'Squeeze')).toEqual({ ok: false, reason: 'unavailable' });
    expect(duplicatePlay(storage, 'play-1')).toEqual({ ok: false, reason: 'unavailable' });
    expect(deletePlay(storage, 'play-1')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('swallows a quota error on write and leaves the document', () => {
    const board = runnerBoard();
    const raw = JSON.stringify({
      version: 1,
      current: jsonClone(board),
      plays: [{ id: 'play-1', name: 'Hit and run', updatedAt: 1, board: jsonClone(board) }],
    });
    const storage: KeyValueStore = {
      getItem() {
        return raw;
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    expect(savePlay(storage, board, 'Bunt')).toEqual({ ok: false, reason: 'unavailable' });
    expect(renamePlay(storage, 'play-1', 'Squeeze')).toEqual({ ok: false, reason: 'unavailable' });
    expect(duplicatePlay(storage, 'play-1', { id: 'play-2', now: 2 })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(deletePlay(storage, 'play-1')).toEqual({ ok: false, reason: 'unavailable' });
    expect(openPlay(storage, 'play-1')).toEqual({ ok: false, reason: 'unavailable' });
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
});

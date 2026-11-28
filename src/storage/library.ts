import { adoptIds } from '../model/diagramState';
import type { Point } from '../model/path';
import type { PlayStep } from '../model/steps';
import type { DiagramState, Stroke, Token, UndoEntry } from '../model/types';

/**
 * The on-device library. One JSON document holds the board that is open and
 * the named plays beside it. Version 1 is the first schema; older documents
 * walk `migrations` one version at a time.
 *
 * localStorage, not IndexedDB: the read is synchronous, so the first paint is
 * already the restored board, and a store that throws fails immediately
 * instead of leaving the app waiting on a request that never settles.
 */
export const STORAGE_KEY = 'diamondboard.library';

export const SCHEMA_VERSION = 1;

/** Long enough to fold a burst of taps into one write, short enough to feel saved. */
export const AUTOSAVE_DELAY_MS = 400;

export interface SavedPlay {
  id: string;
  name: string;
  updatedAt: number;
  board: DiagramState;
}

export interface LibraryDocument {
  version: number;
  /** The board open right now. Autosave rewrites this and leaves `plays` alone. */
  current: DiagramState;
  /** Named plays. Autosave rewrites `current` and must not drop entries it finds. */
  plays: SavedPlay[];
  /** Optional so existing on-device libraries work without a migration. */
  practice?: PracticeQueue;
}

export interface PracticeQueue {
  name: string;
  playIds: string[];
  activeIndex: number | null;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ReadResult =
  | { status: 'restored'; board: DiagramState }
  | { status: 'empty' }
  | { status: 'rejected'; reason: 'corrupt' | 'future' | 'unavailable' };

/** Upgrades a document from version N to N+1. None are registered while v1 is current. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

export const migrations: Record<number, Migration> = {};

export interface ReadOptions {
  schemaVersion?: number;
  migrations?: Readonly<Record<number, Migration>>;
}

/**
 * `migrations[v]` must return a document whose `version` is `v + 1`. A missing
 * step, a throw, or a step that forgets to advance the version rejects the
 * document — skipping a version would guess at data this build doesn't know.
 */
export function applyMigrations(
  doc: unknown,
  target: number,
  steps: Readonly<Record<number, Migration>>,
): Record<string, unknown> | null {
  if (!isRecord(doc)) return null;
  const version = doc.version;
  if (!isInteger(version) || version < 1 || version > target) return null;
  let current: Record<string, unknown> = doc;
  for (let v = version; v < target; v++) {
    const step = steps[v];
    if (!step) return null;
    let next: unknown;
    try {
      next = step(current);
    } catch {
      return null;
    }
    if (!isRecord(next) || next.version !== v + 1) return null;
    current = next;
  }
  return current;
}

export function readLibrary(storage: KeyValueStore, options?: ReadOptions): ReadResult {
  const schemaVersion = options?.schemaVersion ?? SCHEMA_VERSION;
  const steps = options?.migrations ?? migrations;
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'rejected', reason: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'rejected', reason: 'corrupt' };
  }
  if (!isRecord(parsed) || !isInteger(parsed.version)) {
    return { status: 'rejected', reason: 'corrupt' };
  }
  if (parsed.version > schemaVersion) return { status: 'rejected', reason: 'future' };
  const upgraded = applyMigrations(parsed, schemaVersion, steps);
  if (!upgraded) return { status: 'rejected', reason: 'corrupt' };
  const board = parseBoard(upgraded.current);
  if (!board) return { status: 'rejected', reason: 'corrupt' };
  adoptIds(board);
  return { status: 'restored', board };
}

/**
 * A future document is left byte for byte: this build must not overwrite a
 * schema it does not understand. Corrupt JSON is replaced, because it cannot
 * be read by any version. A throwing store reports failure and leaves the
 * in-memory board alone.
 */
export function writeCurrentBoard(storage: KeyValueStore, board: DiagramState): boolean {
  try {
    const existing = storage.getItem(STORAGE_KEY);
    if (isFutureDocument(existing)) return false;
    const document: LibraryDocument = {
      version: SCHEMA_VERSION,
      current: board,
      ...libraryItemsFrom(existing),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(document));
    return true;
  } catch {
    return false;
  }
}

/** Whether this session may write. A future or unreadable store is left untouched. */
export function persistAfterLoad(result: ReadResult): boolean {
  if (result.status === 'restored' || result.status === 'empty') return true;
  return result.reason === 'corrupt';
}

/** What the My Plays list shows. The board itself stays in the document until opened. */
export interface PlaySummary {
  id: string;
  name: string;
  updatedAt: number;
}

export interface SavePlayOptions {
  id?: string;
  now?: number;
}

export type SavePlayResult =
  | { ok: true; play: SavedPlay }
  | { ok: false; reason: 'empty-name' | 'future' | 'unavailable' };

export type OpenPlayResult =
  | { ok: true; board: DiagramState }
  | { ok: false; reason: 'missing' | 'corrupt' | 'future' | 'unavailable' };

export type RenamePlayResult =
  | { ok: true; play: SavedPlay }
  | { ok: false; reason: 'empty-name' | 'missing' | 'corrupt' | 'future' | 'unavailable' };

export type DuplicatePlayResult =
  | { ok: true; play: SavedPlay }
  | { ok: false; reason: 'missing' | 'corrupt' | 'future' | 'unavailable' };

export type DeletePlayResult = { ok: true } | { ok: false; reason: 'missing' | 'corrupt' | 'future' | 'unavailable' };

export type ListPlaysResult =
  | { ok: true; plays: PlaySummary[] }
  | { ok: false; reason: 'corrupt' | 'future' | 'unavailable' };

/**
 * Append a named snapshot of the open board. A corrupt document is replaced,
 * same as autosave: it cannot be read by any version. A future document is
 * left byte for byte.
 */
export function savePlay(
  storage: KeyValueStore,
  board: DiagramState,
  name: string,
  options?: SavePlayOptions,
): SavePlayResult {
  const cleaned = cleanName(name);
  if (!cleaned) return { ok: false, reason: 'empty-name' };
  const doc = readDocument(storage);
  if (doc.kind === 'future' || doc.kind === 'unavailable') return { ok: false, reason: doc.kind };
  const play: SavedPlay = {
    id: options?.id ?? newPlayId(),
    name: cleaned,
    updatedAt: options?.now ?? Date.now(),
    board: cloneBoard(board),
  };
  const plays = doc.kind === 'ready' ? [...doc.plays, play] : [play];
  const practice = doc.kind === 'ready' ? doc.practice : undefined;
  if (!commitDocument(storage, cloneBoard(board), plays, practice)) return { ok: false, reason: 'unavailable' };
  return { ok: true, play };
}

export function listPlays(storage: KeyValueStore): ListPlaysResult {
  const doc = readDocument(storage);
  if (doc.kind === 'empty') return { ok: true, plays: [] };
  if (doc.kind !== 'ready') return { ok: false, reason: doc.kind };
  return {
    ok: true,
    plays: doc.plays.map((play) => ({ id: play.id, name: play.name, updatedAt: play.updatedAt })),
  };
}

/**
 * Hand the play back and make it `current` in the same write. The next reload
 * paints `current` on the first frame, so opening has to land there before
 * the autosave debounce or a refresh would show the previous board.
 */
export function openPlay(storage: KeyValueStore, id: string): OpenPlayResult {
  const doc = readDocument(storage);
  if (doc.kind === 'empty') return { ok: false, reason: 'missing' };
  if (doc.kind !== 'ready') return { ok: false, reason: doc.kind };
  const play = doc.plays.find((item) => item.id === id);
  if (!play) return { ok: false, reason: 'missing' };
  const board = cloneBoard(play.board);
  // Opening from My Plays leaves the rundown intact and ends its active session.
  const practice = doc.practice && { ...doc.practice, activeIndex: null };
  if (!commitDocument(storage, cloneBoard(board), doc.plays, practice)) return { ok: false, reason: 'unavailable' };
  adoptIds(board);
  return { ok: true, board };
}

export function renamePlay(
  storage: KeyValueStore,
  id: string,
  name: string,
  options?: { now?: number },
): RenamePlayResult {
  const cleaned = cleanName(name);
  if (!cleaned) return { ok: false, reason: 'empty-name' };
  const doc = readDocument(storage);
  if (doc.kind === 'empty') return { ok: false, reason: 'missing' };
  if (doc.kind !== 'ready') return { ok: false, reason: doc.kind };
  const index = doc.plays.findIndex((play) => play.id === id);
  if (index < 0) return { ok: false, reason: 'missing' };
  const plays = doc.plays.map((play, i) =>
    i === index ? { ...play, name: cleaned, updatedAt: options?.now ?? Date.now() } : play,
  );
  if (!commitDocument(storage, doc.current, plays, doc.practice)) return { ok: false, reason: 'unavailable' };
  return { ok: true, play: plays[index] };
}

export function duplicatePlay(
  storage: KeyValueStore,
  id: string,
  options?: SavePlayOptions,
): DuplicatePlayResult {
  const doc = readDocument(storage);
  if (doc.kind === 'empty') return { ok: false, reason: 'missing' };
  if (doc.kind !== 'ready') return { ok: false, reason: doc.kind };
  const index = doc.plays.findIndex((play) => play.id === id);
  if (index < 0) return { ok: false, reason: 'missing' };
  const source = doc.plays[index];
  const play: SavedPlay = {
    id: options?.id ?? newPlayId(),
    name: `${source.name} copy`,
    updatedAt: options?.now ?? Date.now(),
    board: cloneBoard(source.board),
  };
  const plays = doc.plays.slice();
  plays.splice(index + 1, 0, play);
  if (!commitDocument(storage, doc.current, plays, doc.practice)) return { ok: false, reason: 'unavailable' };
  return { ok: true, play };
}

export function deletePlay(storage: KeyValueStore, id: string): DeletePlayResult {
  const doc = readDocument(storage);
  if (doc.kind === 'empty') return { ok: false, reason: 'missing' };
  if (doc.kind !== 'ready') return { ok: false, reason: doc.kind };
  if (!doc.plays.some((play) => play.id === id)) return { ok: false, reason: 'missing' };
  const plays = doc.plays.filter((play) => play.id !== id);
  if (!commitDocument(storage, doc.current, plays, practiceFrom(doc.practice, plays))) {
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true };
}

type PracticeResult =
  | { ok: true; queue: PracticeQueue }
  | { ok: false; reason: 'empty-name' | 'future' | 'unavailable' };

export function readPracticeQueue(storage: KeyValueStore): PracticeResult {
  const doc = readDocument(storage);
  if (doc.kind === 'future' || doc.kind === 'unavailable') return { ok: false, reason: doc.kind };
  const queue = doc.kind === 'ready' ? doc.practice : undefined;
  return { ok: true, queue: queue ?? { name: 'Practice', playIds: [], activeIndex: null } };
}

export function writePracticeQueue(
  storage: KeyValueStore,
  board: DiagramState,
  draft: PracticeQueue,
): PracticeResult {
  const name = cleanName(draft.name);
  if (!name) return { ok: false, reason: 'empty-name' };
  const doc = readDocument(storage);
  if (doc.kind === 'future' || doc.kind === 'unavailable') return { ok: false, reason: doc.kind };
  const plays = doc.kind === 'ready' ? doc.plays : [];
  const queue = retainSavedEntries({ ...draft, name }, plays);
  if (!commitDocument(storage, board, plays, queue)) return { ok: false, reason: 'unavailable' };
  return { ok: true, queue };
}

export function openPracticePlay(
  storage: KeyValueStore,
  index: number,
): { ok: true; board: DiagramState; queue: PracticeQueue } | Extract<OpenPlayResult, { ok: false }> {
  const doc = readDocument(storage);
  if (doc.kind === 'empty') return { ok: false, reason: 'missing' };
  if (doc.kind !== 'ready') return { ok: false, reason: doc.kind };
  const id = doc.practice?.playIds[index];
  const play = doc.plays.find((entry) => entry.id === id);
  if (!doc.practice || !play) return { ok: false, reason: 'missing' };
  const queue = { ...doc.practice, activeIndex: index };
  const board = { ...cloneBoard(play.board), activeStep: 0 };
  // Keep the open board and the queue position together across reload or write failure.
  if (!commitDocument(storage, board, doc.plays, queue)) return { ok: false, reason: 'unavailable' };
  adoptIds(board);
  return { ok: true, board, queue };
}

export interface Autosave {
  schedule(board: DiagramState): void;
  /** Write now. A reload or a backgrounded app should not wait out the debounce. */
  flush(): void;
}

export function createAutosave(
  storage: KeyValueStore,
  options?: { delayMs?: number; enabled?: boolean },
): Autosave {
  const delayMs = options?.delayMs ?? AUTOSAVE_DELAY_MS;
  const enabled = options?.enabled ?? true;
  let pending: DiagramState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!enabled || pending === null) return;
    const board = pending;
    pending = null;
    writeCurrentBoard(storage, board);
  };

  return {
    schedule(board) {
      if (!enabled) return;
      pending = board;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}

/** The browser store, or one that throws when storage is missing or blocked. */
export function browserLocalStorage(): KeyValueStore {
  try {
    if (typeof localStorage === 'undefined') return unavailableStorage();
    return localStorage;
  } catch {
    return unavailableStorage();
  }
}

function unavailableStorage(): KeyValueStore {
  return {
    getItem() {
      throw new Error('localStorage is unavailable');
    },
    setItem() {
      throw new Error('localStorage is unavailable');
    },
  };
}

function isFutureDocument(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) && isInteger(parsed.version) && parsed.version > SCHEMA_VERSION;
  } catch {
    return false;
  }
}

function libraryItemsFrom(raw: string | null): Pick<LibraryDocument, 'plays' | 'practice'> {
  if (!raw) return { plays: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return { plays: [] };
    const plays = validPlays(parsed.plays);
    return { plays, practice: practiceFrom(parsed.practice, plays) };
  } catch {
    return { plays: [] };
  }
}

type ReadDocument =
  | { kind: 'ready'; current: DiagramState; plays: SavedPlay[]; practice?: PracticeQueue }
  | { kind: 'empty' }
  | { kind: 'future' }
  | { kind: 'corrupt' }
  | { kind: 'unavailable' };

/** The document when this build can read it. A bad `plays` list is an empty shelf, not a failed read. */
function readDocument(storage: KeyValueStore): ReadDocument {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { kind: 'unavailable' };
  }
  if (raw === null) return { kind: 'empty' };
  if (isFutureDocument(raw)) return { kind: 'future' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt' };
  }
  if (!isRecord(parsed) || !isInteger(parsed.version) || parsed.version < 1 || parsed.version > SCHEMA_VERSION) {
    return { kind: 'corrupt' };
  }
  const current = parseBoard(parsed.current);
  if (!current) return { kind: 'corrupt' };
  const plays = validPlays(parsed.plays);
  return { kind: 'ready', current, plays, practice: practiceFrom(parsed.practice, plays) };
}

function validPlays(value: unknown): SavedPlay[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isSavedPlay);
}

function practiceFrom(value: unknown, plays: SavedPlay[]): PracticeQueue | undefined {
  if (!isRecord(value) || typeof value.name !== 'string' || !Array.isArray(value.playIds)) return;
  const name = cleanName(value.name);
  if (!name || !value.playIds.every(isId)) return;
  const activeIndex = isIndex(value.activeIndex) ? value.activeIndex : null;
  return retainSavedEntries({ name, playIds: value.playIds, activeIndex }, plays);
}

function retainSavedEntries(queue: PracticeQueue, plays: SavedPlay[]): PracticeQueue {
  const savedIds = new Set(plays.map((play) => play.id));
  const playIds: string[] = [];
  let activeIndex: number | null = null;
  for (const [index, id] of queue.playIds.entries()) {
    if (!savedIds.has(id)) continue;
    if (index === queue.activeIndex) activeIndex = playIds.length;
    playIds.push(id);
  }
  return { name: queue.name, playIds, activeIndex };
}

function commitDocument(
  storage: KeyValueStore,
  current: DiagramState,
  plays: SavedPlay[],
  practice?: PracticeQueue,
): boolean {
  try {
    if (isFutureDocument(storage.getItem(STORAGE_KEY))) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, current, plays, practice }));
    return true;
  } catch {
    return false;
  }
}

function cloneBoard(board: DiagramState): DiagramState {
  return JSON.parse(JSON.stringify(board)) as DiagramState;
}

function cleanName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function newPlayId(): string {
  return `play-${crypto.randomUUID()}`;
}

function isSavedPlay(value: unknown): value is SavedPlay {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (typeof value.name !== 'string') return false;
  if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return false;
  return parseBoard(value.board) !== null;
}

function parseBoard(value: unknown): DiagramState | null {
  if (!isRecord(value)) return null;
  const tokens = parseTokens(value.tokens);
  const strokes = parseStrokes(value.strokes);
  const steps = parseSteps(value.steps);
  const undoStack = parseUndoStack(value.undoStack);
  if (!tokens || !strokes || !steps || !undoStack) return null;
  if (!isInteger(value.activeStep) || value.activeStep < 0 || value.activeStep >= steps.length) {
    return null;
  }
  return { tokens, strokes, steps, activeStep: value.activeStep, undoStack };
}

function parseTokens(value: unknown): Token[] | null {
  if (!Array.isArray(value)) return null;
  const tokens: Token[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const token = parseToken(raw);
    if (!token || seen.has(token.id)) return null;
    seen.add(token.id);
    tokens.push(token);
  }
  return tokens;
}

function parseToken(value: unknown): Token | null {
  if (!isRecord(value)) return null;
  if (!isId(value.id)) return null;
  if (value.type !== 'fielder' && value.type !== 'runner' && value.type !== 'ball') return null;
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
  const token: Token = { id: value.id, type: value.type, x: value.x, y: value.y };
  if (value.label === undefined) return token;
  if (typeof value.label !== 'string') return null;
  token.label = value.label;
  return token;
}

function parseStrokes(value: unknown): Stroke[] | null {
  if (!Array.isArray(value)) return null;
  const strokes: Stroke[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw) || !isId(raw.id) || seen.has(raw.id)) return null;
    if (!Array.isArray(raw.points) || raw.points.length === 0) return null;
    const points: Point[] = [];
    for (const point of raw.points) {
      const parsed = parsePoint(point);
      if (!parsed) return null;
      points.push(parsed);
    }
    seen.add(raw.id);
    strokes.push({ id: raw.id, points });
  }
  return strokes;
}

function parseSteps(value: unknown): PlayStep[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const steps: PlayStep[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw) || !isId(raw.id) || seen.has(raw.id) || !isRecord(raw.moves)) return null;
    const moves: PlayStep['moves'] = {};
    for (const [id, point] of Object.entries(raw.moves)) {
      const parsed = parsePoint(point);
      if (!isId(id) || !parsed) return null;
      moves[id] = parsed;
    }
    seen.add(raw.id);
    const step: PlayStep = { id: raw.id, moves };
    if (raw.note !== undefined) {
      if (typeof raw.note !== 'string') return null;
      step.note = raw.note;
    }
    steps.push(step);
  }
  return steps;
}

function parseUndoStack(value: unknown): UndoEntry[] | null {
  if (!Array.isArray(value)) return null;
  const stack: UndoEntry[] = [];
  for (const raw of value) {
    const entry = parseUndo(raw);
    if (!entry) return null;
    stack.push(entry);
  }
  return stack;
}

function parseUndo(value: unknown): UndoEntry | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null;
  switch (value.kind) {
    case 'move': {
      if (!isId(value.id) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
      return { kind: 'move', id: value.id, x: value.x, y: value.y };
    }
    case 'removeToken':
    case 'removeStroke': {
      if (!isId(value.id)) return null;
      return { kind: value.kind, id: value.id };
    }
    case 'addToken': {
      const token = parseToken(value.token);
      const steps = parseSteps(value.steps);
      if (!token || !steps || !isIndex(value.index)) return null;
      return { kind: 'addToken', token, index: value.index, steps };
    }
    case 'addStroke': {
      const strokes = parseStrokes([value.stroke]);
      if (!strokes || !isIndex(value.index)) return null;
      return { kind: 'addStroke', stroke: strokes[0], index: value.index };
    }
    case 'restoreDestination': {
      if (!isId(value.id) || !isIndex(value.step)) return null;
      if (!('to' in value) || value.to === undefined) {
        return { kind: 'restoreDestination', step: value.step, id: value.id, to: undefined };
      }
      const to = parsePoint(value.to);
      if (!to) return null;
      return { kind: 'restoreDestination', step: value.step, id: value.id, to };
    }
    case 'restoreSteps': {
      const steps = parseSteps(value.steps);
      if (!steps || !isIndex(value.activeStep)) return null;
      return { kind: 'restoreSteps', steps, activeStep: value.activeStep };
    }
    default:
      return null;
  }
}

function parsePoint(value: unknown): Point | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
  return { x: value.x, y: value.y };
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIndex(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

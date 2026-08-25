import type { Point } from './path';

export type TokenType = 'fielder' | 'runner' | 'ball';

export interface Token {
  id: string;
  type: TokenType;
  /** Fielders show a position label; runners and the ball are unlabeled. */
  label?: string;
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
}

/** Token id -> position. Used for animation start/end capture. */
export type PositionMap = Record<string, Point>;

export type Tool = 'select' | 'move' | 'addRunner' | 'addBall' | 'ballRoute' | 'pen' | 'erase';

export interface DiagramState {
  tokens: Token[];
  strokes: Stroke[];
  /**
   * Where the ball goes: a self-contained polyline whose first point is where
   * the route starts (seeded from the ball) and whose every later point is one
   * throw or carry. Empty until the coach draws one.
   */
  ballRoute: Point[];
  /**
   * Runner token id -> the base paths that runner covers. A runner cannot tween
   * in a straight line: a man scoring from second goes by way of third, not
   * across the mound. Only library plays carry these; a hand-recorded play is
   * whatever the coach dragged.
   */
  runnerRoutes: Record<string, Point[]>;
  /**
   * Captured animation states. Null until the coach captures them.
   *
   * A token whose start and end differ has a movement arrow drawn for it, so
   * recording a play and pointing an arrow at a base are two ways of filling in
   * the same pair of arrangements.
   */
  start: PositionMap | null;
  end: PositionMap | null;
  undoStack: UndoEntry[];
}

export type UndoEntry =
  | { kind: 'move'; id: string; x: number; y: number }
  | { kind: 'addToken'; token: Token; index: number }
  | { kind: 'removeToken'; id: string }
  | { kind: 'addStroke'; stroke: Stroke; index: number }
  | { kind: 'removeStroke'; id: string }
  | { kind: 'restoreRoute'; route: Point[] }
  | {
      kind: 'restoreDestination';
      id: string;
      /** The previous arrow tip, or undefined when there was no arrow. */
      to: Point | undefined;
      route: Point[] | undefined;
    };

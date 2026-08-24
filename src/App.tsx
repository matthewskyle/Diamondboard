import { useCallback, useMemo, useReducer, useState } from 'react';
import { FieldStage } from './components/FieldStage';
import { Toolbar } from './components/Toolbar';
import { diagramReducer, initialState } from './model/diagramState';
import { DEFAULT_DURATION_MS, interpolatePositions } from './model/tween';
import type { PositionMap, Tool } from './model/types';
import { useTween } from './hooks/useTween';

export default function App() {
  const [state, dispatch] = useReducer(diagramReducer, undefined, initialState);
  const [tool, setTool] = useState<Tool>('select');
  const [animating, setAnimating] = useState<PositionMap | null>(null);

  const { start, end } = state;

  const { play, isPlaying } = useTween({
    durationMs: DEFAULT_DURATION_MS,
    onFrame: useCallback(
      (t: number) => {
        if (start && end) setAnimating(interpolatePositions(start, end, t));
      },
      [start, end],
    ),
    onDone: useCallback(() => {
      if (end) dispatch({ type: 'setPositions', positions: end });
      setAnimating(null);
    }, [end]),
  });

  const handlePlay = useCallback(() => {
    if (!start || !end) return;
    play();
  }, [start, end, play]);

  const handleToStart = useCallback(() => {
    if (start) dispatch({ type: 'setPositions', positions: start });
  }, [start]);

  const handleReset = useCallback(() => {
    setAnimating(null);
    dispatch({ type: 'reset' });
  }, []);

  const hint = useMemo(() => HINTS[tool], [tool]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Diamondboard</h1>
        <p className="hint">{hint}</p>
      </header>

      <main className="stage">
        <FieldStage state={state} dispatch={dispatch} tool={tool} animating={animating} />
      </main>

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onUndo={() => dispatch({ type: 'undo' })}
        onReset={handleReset}
        canUndo={state.undoStack.length > 0}
        onSetStart={() => dispatch({ type: 'captureStart' })}
        onSetEnd={() => dispatch({ type: 'captureEnd' })}
        onPlay={handlePlay}
        onToStart={handleToStart}
        hasStart={start !== null}
        hasEnd={end !== null}
        isPlaying={isPlaying}
      />
    </div>
  );
}

const HINTS: Record<Tool, string> = {
  select: 'Drag any player, runner, or the ball.',
  addRunner: 'Tap the field to add a runner.',
  addBall: 'Tap the field to place the ball.',
  pen: 'Draw on the field with a finger or pencil.',
  erase: 'Tap a runner, the ball, or a drawing to remove it.',
};

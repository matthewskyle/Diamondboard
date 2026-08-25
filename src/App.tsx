import { useCallback, useReducer, useState } from 'react';
import { FieldStage } from './components/FieldStage';
import { PlayControls } from './components/PlayControls';
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
    if (start && end) play();
  }, [start, end, play]);

  const handleToStart = useCallback(() => {
    if (start) dispatch({ type: 'setPositions', positions: start });
  }, [start]);

  const handleReset = useCallback(() => {
    setAnimating(null);
    dispatch({ type: 'reset' });
  }, []);

  return (
    <div className="app">
      <main className="stage">
        <FieldStage state={state} dispatch={dispatch} tool={tool} animating={animating} />
        <PlayControls
          onReset={handleReset}
          onSetStart={() => dispatch({ type: 'captureStart' })}
          onSetEnd={() => dispatch({ type: 'captureEnd' })}
          onPlay={handlePlay}
          onToStart={handleToStart}
          hasStart={start !== null}
          hasEnd={end !== null}
          isPlaying={isPlaying}
        />
      </main>

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onUndo={() => dispatch({ type: 'undo' })}
        canUndo={state.undoStack.length > 0}
      />
    </div>
  );
}

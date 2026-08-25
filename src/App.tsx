import { useCallback, useReducer, useRef, useState } from 'react';
import { FieldStage } from './components/FieldStage';
import { PlayControls, type RecordState } from './components/PlayControls';
import { PlayLibrary } from './components/PlayLibrary';
import { Toolbar } from './components/Toolbar';
import {
  diagramReducer,
  hasMovedFrom,
  initialState,
  resolvePlayback,
} from './model/diagramState';
import {
  durationForSpeed,
  dwellShareFor,
  interpolatePositions,
  pointAlongPath,
  type PlaybackSpeed,
} from './model/tween';
import { compilePlay, type PlayDef } from './model/plays';
import type { PositionMap, Tool } from './model/types';
import { useTween } from './hooks/useTween';

export default function App() {
  const [state, dispatch] = useReducer(diagramReducer, undefined, initialState);
  const [tool, setTool] = useState<Tool>('select');
  const [animating, setAnimating] = useState<PositionMap | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [loadedPlay, setLoadedPlay] = useState<PlayDef | null>(null);

  const { start, end, ballRoute } = state;

  /** The two arrangements being tweened, fixed when Play is pressed. */
  const clip = useRef<{ from: PositionMap; to: PositionMap; route: readonly PositionMap[] } | null>(
    null,
  );
  /** The ball's route for this playback, and how long it waits at each stop. */
  const ballLeg = useRef<{
    id: string;
    path: { x: number; y: number }[];
    dwellShare: number;
  } | null>(null);

  const { play, isPlaying } = useTween({
    durationMs: durationForSpeed(speed),
    onFrame: useCallback((t: number) => {
      const current = clip.current;
      if (!current) return;
      const positions = interpolatePositions(current.from, current.to, t);
      const leg = ballLeg.current;
      // The ball follows its route instead of cutting straight across, and at a
      // constant speed, so a long throw takes longer than a short one.
      if (leg) positions[leg.id] = pointAlongPath(leg.path, t, leg.dwellShare);
      setAnimating(positions);
    }, []),
    onDone: useCallback(() => {
      const current = clip.current;
      if (current) {
        const positions = { ...current.to };
        const leg = ballLeg.current;
        if (leg) positions[leg.id] = leg.path[leg.path.length - 1];
        dispatch({ type: 'setPositions', positions });
      }
      setAnimating(null);
    }, []),
  });

  const handlePlay = useCallback(() => {
    const playback = resolvePlayback(state.tokens, start, end);
    if (!playback) return;
    if (playback.captureEnd) dispatch({ type: 'captureEnd' });

    clip.current = { from: playback.from, to: playback.to, route: [] };

    const ball = state.tokens.find((t) => t.type === 'ball');
    // The route is already a complete path, origin included.
    ballLeg.current =
      ball && ballRoute.length > 1
        ? { id: ball.id, path: ballRoute, dwellShare: dwellShareFor(ballRoute.length - 2) }
        : null;

    play();
  }, [state.tokens, start, end, ballRoute, play]);

  const handleToStart = useCallback(() => {
    if (start) dispatch({ type: 'setPositions', positions: start });
  }, [start]);

  const handleReset = useCallback(() => {
    setAnimating(null);
    setLoadedPlay(null);
    dispatch({ type: 'reset' });
  }, []);

  const handleSelectPlay = useCallback((play: PlayDef) => {
    const compiled = compilePlay(play);
    setAnimating(null);
    setLoadedPlay(play);
    setLibraryOpen(false);
    setTool('select');
    dispatch({ type: 'loadPlay', ...compiled });
  }, []);

  const recordState: RecordState =
    start === null ? 'idle' : end === null ? 'recording' : 'recorded';

  return (
    <div className="app">
      <main className="stage">
        <FieldStage state={state} dispatch={dispatch} tool={tool} animating={animating} />
        <div className="play-dock">
          {loadedPlay && (
            <div className="play-caption">
              <strong>{loadedPlay.name}</strong>
              <span>{loadedPlay.teaches}</span>
            </div>
          )}
          <PlayControls
            onOpenLibrary={() => setLibraryOpen(true)}
            onReset={handleReset}
            onRecord={() => dispatch({ type: 'captureStart' })}
            onPlay={handlePlay}
            onToStart={handleToStart}
            recordState={recordState}
            canPlay={resolvePlayback(state.tokens, start, end) !== null}
            canRewind={start !== null && (end !== null || hasMovedFrom(state.tokens, start))}
            speed={speed}
            onSpeedChange={setSpeed}
            isPlaying={isPlaying}
          />
        </div>
      </main>

      <PlayLibrary
        open={libraryOpen}
        currentId={loadedPlay?.id ?? null}
        onSelect={handleSelectPlay}
        onClose={() => setLibraryOpen(false)}
      />

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onUndo={() => dispatch({ type: 'undo' })}
        canUndo={state.undoStack.length > 0}
      />
    </div>
  );
}

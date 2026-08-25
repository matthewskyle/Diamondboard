import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { FieldStage } from './components/FieldStage';
import { PlayControls, type RecordState } from './components/PlayControls';
import { PlayLibrary } from './components/PlayLibrary';
import { PlayRoleList } from './components/PlayRoleList';
import { Toolbar } from './components/Toolbar';
import {
  diagramReducer,
  hasMovedFrom,
  initialState,
  resolvePlayback,
} from './model/diagramState';
import {
  clamp01,
  durationForSpeed,
  dwellShareFor,
  easeInOutCubic,
  interpolatePositions,
  pointAlongPath,
  type PlaybackSpeed,
} from './model/tween';
import { compilePlay, PLAYS, type PlayDef } from './model/plays';
import { playsForPosition, roleFor } from './model/roles';
import type { PositionMap, Tool } from './model/types';
import { useTween } from './hooks/useTween';

export default function App() {
  const [state, dispatch] = useReducer(diagramReducer, undefined, initialState);
  const [tool, setTool] = useState<Tool>('select');
  const [animating, setAnimating] = useState<PositionMap | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [loadedPlay, setLoadedPlay] = useState<PlayDef | null>(null);
  const [position, setPosition] = useState<string | null>(null);

  const { start, end, ballRoute, runnerRoutes } = state;

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
  /** The base paths the runners cover, for a play that came with them. */
  const runnerLegs = useRef<{ id: string; path: { x: number; y: number }[] }[]>([]);

  const { play, isPlaying } = useTween({
    durationMs: durationForSpeed(speed),
    onFrame: useCallback((t: number) => {
      const current = clip.current;
      if (!current) return;
      const positions = interpolatePositions(current.from, current.to, t);
      // Runners follow the base paths. They are people, so they share the
      // fielders' easing rather than the ball's constant speed.
      const eased = easeInOutCubic(clamp01(t));
      for (const runner of runnerLegs.current) {
        positions[runner.id] = pointAlongPath(runner.path, eased);
      }
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

    // A stored route only describes the play it was loaded with. Once the board
    // has been rearranged, whatever moved is the play, and it moves in a line.
    runnerLegs.current = playback.captureEnd
      ? []
      : Object.entries(runnerRoutes)
          .filter(([id, path]) => path.length > 2 && state.tokens.some((t) => t.id === id))
          .map(([id, path]) => ({ id, path }));

    play();
  }, [state.tokens, start, end, ballRoute, runnerRoutes, play]);

  const handleToStart = useCallback(() => {
    if (start) dispatch({ type: 'setPositions', positions: start });
  }, [start]);

  const handleStop = useCallback(() => {
    dispatch({ type: 'stopRecording' });
  }, []);

  const handleReset = useCallback(() => {
    setAnimating(null);
    setLoadedPlay(null);
    setPosition(null);
    dispatch({ type: 'reset' });
  }, []);

  // Studying a position walks the plays it has a job in, in library order.
  // Memoised so stepping does not rebuild the list on every render.
  const studyPlays = useMemo(
    () => (position ? playsForPosition(PLAYS, position) : []),
    [position],
  );
  const studyIndex = loadedPlay ? studyPlays.indexOf(loadedPlay) : -1;

  const loadPlay = useCallback((play: PlayDef) => {
    setAnimating(null);
    setLoadedPlay(play);
    setTool('select');
    dispatch({ type: 'loadPlay', ...compilePlay(play) });
  }, []);

  const handleSelectPlay = useCallback(
    (play: PlayDef) => {
      loadPlay(play);
      setLibraryOpen(false);
    },
    [loadPlay],
  );

  const handleStep = useCallback(
    (delta: number) => {
      if (studyPlays.length === 0) return;
      const next = (studyIndex + delta + studyPlays.length) % studyPlays.length;
      loadPlay(studyPlays[next]);
    },
    [studyPlays, studyIndex, loadPlay],
  );

  const handlePositionChange = useCallback(
    (next: string | null) => {
      setPosition(next);
      // Show this position's first play behind the list, so the field is already
      // answering the question while the coach reads the rest of the options.
      if (next) {
        const plays = playsForPosition(PLAYS, next);
        if (plays.length > 0) loadPlay(plays[0]);
      }
    },
    [loadPlay],
  );

  const recordState: RecordState =
    start === null ? 'idle' : end === null ? 'recording' : 'recorded';

  return (
    <div className="app">
      <main className="stage">
        <FieldStage
          state={state}
          dispatch={dispatch}
          tool={tool}
          animating={animating}
          highlight={position}
        />
        <div className="play-dock">
          {loadedPlay && (
            <div className="play-caption">
              <strong>{loadedPlay.name}</strong>
              <span>
                {position ? roleFor(loadedPlay, position).text : loadedPlay.teaches}
              </span>
              <PlayRoleList play={loadedPlay} highlight={position} />
            </div>
          )}
          <PlayControls
            onOpenLibrary={() => setLibraryOpen(true)}
            onReset={handleReset}
            onRecord={() => dispatch({ type: 'captureStart' })}
            onStop={handleStop}
            onPlay={handlePlay}
            onToStart={handleToStart}
            recordState={recordState}
            canPlay={resolvePlayback(state.tokens, start, end) !== null}
            canRewind={start !== null && (end !== null || hasMovedFrom(state.tokens, start))}
            speed={speed}
            onSpeedChange={setSpeed}
            isPlaying={isPlaying}
            study={
              position && studyIndex >= 0
                ? { label: position, index: studyIndex, total: studyPlays.length }
                : null
            }
            onStep={handleStep}
          />
        </div>
      </main>

      <PlayLibrary
        open={libraryOpen}
        currentId={loadedPlay?.id ?? null}
        position={position}
        onPositionChange={handlePositionChange}
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

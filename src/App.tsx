import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FieldStage } from './components/FieldStage';
import { PlayControls } from './components/PlayControls';
import { SetupChips } from './components/SetupChips';
import { StepBar } from './components/StepBar';
import { Toolbar } from './components/Toolbar';
import { diagramReducer, hasPlay, initialState } from './model/diagramState';
import { durationForPlay, hasMoves, positionsDuring } from './model/steps';
import { type PlaybackSpeed } from './model/tween';
import type { PositionMap, Tool } from './model/types';
import {
  BASE_SLOTS,
  occupiedSlots,
  runnerInSlot,
  SLOT_LABELS,
  SLOT_SPOTS,
  type BaseSlot,
} from './model/setup';
import { useTween } from './hooks/useTween';

/** How long the finished arrangement is left on screen before the board resets. */
const HOLD_AFTER_PLAY_MS = 700;

export default function App() {
  const [state, dispatch] = useReducer(diagramReducer, undefined, initialState);
  const [tool, setTool] = useState<Tool>('arrow');
  const [animating, setAnimating] = useState<PositionMap | null>(null);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  /** The play as it stood when Play was pressed, so editing mid-run can't shift it. */
  const clip = useRef<{ tokens: typeof state.tokens; steps: typeof state.steps } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, []);
  useEffect(() => clearHold, [clearHold]);

  const { play, isPlaying } = useTween({
    durationMs: durationForPlay(state.steps, speed),
    onFrame: useCallback((t: number) => {
      const current = clip.current;
      if (!current) return;
      setAnimating(positionsDuring(current.tokens, current.steps, t));
    }, []),
    // Playback never wrote to the board, so letting the overlay go is the
    // rewind: everyone is standing at the top of the play again, ready to run
    // it a second time. The last frame is held for a beat first, or the finish
    // — the part worth seeing — would vanish the instant it arrived.
    onDone: useCallback(() => {
      holdTimer.current = setTimeout(() => {
        setAnimating(null);
        holdTimer.current = null;
      }, HOLD_AFTER_PLAY_MS);
    }, []),
  });

  const handlePlay = useCallback(() => {
    if (!hasPlay(state)) return;
    clearHold();
    clip.current = { tokens: state.tokens, steps: state.steps };
    play();
  }, [state, play, clearHold]);

  // Tap a base to put a runner on it; tap it again to take him off.
  const handleToggleSlot = useCallback(
    (slot: BaseSlot) => {
      const existing = runnerInSlot(state.tokens, slot);
      if (existing) dispatch({ type: 'removeToken', id: existing.id });
      else
        dispatch({
          type: 'addRunner',
          at: SLOT_SPOTS[slot],
          label: SLOT_LABELS[slot],
        });
    },
    [state.tokens],
  );

  const handleLoadBases = useCallback(() => {
    for (const slot of BASE_SLOTS) {
      if (slot === 'batter') continue;
      if (!runnerInSlot(state.tokens, slot)) {
        dispatch({ type: 'addRunner', at: SLOT_SPOTS[slot], label: SLOT_LABELS[slot] });
      }
    }
  }, [state.tokens]);

  const handleReset = useCallback(() => {
    clearHold();
    setAnimating(null);
    setTool('arrow');
    dispatch({ type: 'reset' });
  }, [clearHold]);

  const stepMovers = Object.keys(state.steps[state.activeStep]?.moves ?? {}).length;
  const drawn = state.steps.some(hasMoves);

  return (
    <div className="app">
      <main className="stage">
        <FieldStage state={state} dispatch={dispatch} tool={tool} animating={animating} />
        <div className="play-dock">
          <SetupChips
            occupied={occupiedSlots(state.tokens)}
            onToggle={handleToggleSlot}
            onLoadBases={handleLoadBases}
            disabled={isPlaying}
          />
          <div className="play-caption">
            <strong>Step {state.activeStep + 1}</strong>
            <span>
              {stepMovers === 0
                ? drawn
                  ? 'Nobody moves yet — hold a player and drag him where he goes.'
                  : 'Hold a player and drag to where he goes. Everyone drawn in a step breaks together.'
                : stepMovers === 1
                  ? 'One player moving. Point anyone else who breaks on this beat too.'
                  : `${stepMovers} players break together here. Add a step for what happens next.`}
            </span>
          </div>
          <StepBar
            steps={state.steps}
            activeStep={state.activeStep}
            onSelect={(index) => dispatch({ type: 'setActiveStep', index })}
            onAdd={() => dispatch({ type: 'addStep' })}
            onRemove={(index) => dispatch({ type: 'removeStep', index })}
            disabled={isPlaying}
          />
          <PlayControls
            onPlay={handlePlay}
            onClear={() => dispatch({ type: 'clearSteps' })}
            onReset={handleReset}
            canPlay={drawn}
            speed={speed}
            onSpeedChange={setSpeed}
            isPlaying={isPlaying}
          />
        </div>
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

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FieldStage } from './components/FieldStage';
import { MyPlays } from './components/MyPlays';
import { PlayControls } from './components/PlayControls';
import { SetupChips } from './components/SetupChips';
import { StepBar } from './components/StepBar';
import { StepNote } from './components/StepNote';
import { Toolbar } from './components/Toolbar';
import { useAutosave } from './hooks/useAutosave';
import { diagramReducer, hasPlay, initialState } from './model/diagramState';
import {
  browserLocalStorage,
  deletePlay,
  duplicatePlay,
  listPlays,
  openPlay,
  persistAfterLoad,
  readLibrary,
  renamePlay,
  savePlay,
  type PlaySummary,
} from './storage/library';
import { durationForPlay, hasMoves, playableSteps, positionsDuring, stepPlayingAt } from './model/steps';
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

function playsFailure(reason: 'empty-name' | 'missing' | 'corrupt' | 'future' | 'unavailable'): string {
  switch (reason) {
    case 'future':
      return 'These plays were saved by a newer version of Diamondboard.';
    case 'unavailable':
      return "Plays can't be saved on this device.";
    case 'corrupt':
      return 'The saved plays could not be read.';
    case 'missing':
      return 'That play is no longer on this device.';
    case 'empty-name':
      return 'Name the play before saving it.';
  }
}

/**
 * Synchronous, so the restored board is the first paint. A future schema or a
 * store that throws is not written back: saving the clean board over it would
 * destroy data this build cannot read.
 */
function bootBoard(): { board: ReturnType<typeof initialState>; persist: boolean } {
  const loaded = readLibrary(browserLocalStorage());
  return {
    board: loaded.status === 'restored' ? loaded.board : initialState(),
    persist: persistAfterLoad(loaded),
  };
}

export default function App() {
  const [boot] = useState(bootBoard);
  const [state, dispatch] = useReducer(diagramReducer, boot.board);
  useAutosave(state, boot.persist);
  const [tool, setTool] = useState<Tool>('arrow');
  const [animating, setAnimating] = useState<PositionMap | null>(null);
  /**
   * The running step and its note, taken from the clip so an edit mid-run
   * cannot change what is being taught. Null when no play is on screen.
   */
  const [playing, setPlaying] = useState<{ step: number; note: string | undefined } | null>(null);
  /** The coaching note being typed, or null when no editor is open. */
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [playsOpen, setPlaysOpen] = useState(false);
  const [savedPlays, setSavedPlays] = useState<PlaySummary[]>([]);
  const [playsNotice, setPlaysNotice] = useState<string | null>(null);
  const [playsWritable, setPlaysWritable] = useState(true);

  /** The play as it stood when Play was pressed, so editing mid-run can't shift it. */
  const clip = useRef<{ tokens: typeof state.tokens; steps: typeof state.steps } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, []);
  useEffect(() => clearHold, [clearHold]);

  const { play, stop, seek, progress, isPlaying } = useTween({
    durationMs: durationForPlay(state.steps, speed),
    loop,
    onFrame: useCallback((t: number) => {
      const current = clip.current;
      if (!current) return;
      setAnimating(positionsDuring(current.tokens, current.steps, t));
      const step = stepPlayingAt(current.steps, t);
      setPlaying((prev) =>
        prev?.step === step ? prev : { step, note: current.steps[step]?.note },
      );
      setProgressValue(t);
    }, []),
    // Playback never wrote to the board, so letting the overlay go is the
    // rewind: everyone is standing at the top of the play again, ready to run
    // it a second time. The last frame is held for a beat first, or the finish
    // — the part worth seeing — would vanish the instant it arrived.
    onDone: useCallback(() => {
      holdTimer.current = setTimeout(() => {
        setAnimating(null);
        setPlaying(null);
        setPlaybackActive(false);
        clip.current = null;
        holdTimer.current = null;
      }, HOLD_AFTER_PLAY_MS);
    }, []),
  });

  const handlePlay = useCallback(() => {
    if (!hasPlay(state)) return;
    setNoteDraft(null);
    clearHold();
    if (playbackActive && clip.current) {
      play(progress.current === 1 ? 0 : progress.current);
    } else {
      clip.current = { tokens: state.tokens, steps: state.steps };
      setPlaybackActive(true);
      play();
    }
  }, [state, play, clearHold, playbackActive, progress]);

  const handlePause = useCallback(() => {
    clearHold();
    stop();
  }, [clearHold, stop]);

  const handleStop = useCallback(() => {
    clearHold();
    stop();
    clip.current = null;
    setAnimating(null);
    setPlaying(null);
    setPlaybackActive(false);
    setProgressValue(0);
    dispatch({ type: 'setActiveStep', index: 0 });
  }, [clearHold, stop]);

  const handleBeat = useCallback((direction: number) => {
    if (!hasPlay(state)) return;
    clearHold();
    if (!clip.current) clip.current = { tokens: state.tokens, steps: state.steps };
    const count = playableSteps(clip.current.steps).length;
    const current = playbackActive ? progress.current * count : 0;
    const beat = direction > 0 ? Math.floor(current + 0.000001) + 1 : Math.ceil(current - 0.000001) - 1;
    setPlaybackActive(true);
    seek(Math.max(0, Math.min(count, beat)) / count);
  }, [state, clearHold, playbackActive, progress, seek]);

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
    setPlaying(null);
    setNoteDraft(null);
    setTool('arrow');
    dispatch({ type: 'reset' });
  }, [clearHold]);

  const showPlays = useCallback(() => {
    const result = listPlays(browserLocalStorage());
    if (result.ok) {
      setSavedPlays(result.plays);
      setPlaysNotice(null);
      setPlaysWritable(true);
    } else if (result.reason === 'corrupt') {
      setSavedPlays([]);
      setPlaysNotice(playsFailure(result.reason));
      setPlaysWritable(true);
    } else {
      setSavedPlays([]);
      setPlaysNotice(playsFailure(result.reason));
      setPlaysWritable(false);
    }
    setPlaysOpen(true);
  }, []);

  const handleSavePlay = useCallback(
    (name: string) => {
      const result = savePlay(browserLocalStorage(), state, name);
      if (!result.ok) {
        setPlaysNotice(playsFailure(result.reason));
        return false;
      }
      setPlaysNotice(null);
      const listed = listPlays(browserLocalStorage());
      setSavedPlays(listed.ok ? listed.plays : []);
      return true;
    },
    [state],
  );

  const handleOpenPlay = useCallback(
    (id: string) => {
      const result = openPlay(browserLocalStorage(), id);
      if (!result.ok) {
        setPlaysNotice(playsFailure(result.reason));
        return;
      }
      // One swap. Resetting first would paint the default nine before the play.
      clearHold();
      clip.current = null;
      stop();
      setAnimating(null);
      setPlaying(null);
      setNoteDraft(null);
      dispatch({ type: 'load', board: result.board });
      setPlaysOpen(false);
    },
    [clearHold, stop],
  );

  const handleRenamePlay = useCallback((id: string, name: string) => {
    const result = renamePlay(browserLocalStorage(), id, name);
    if (!result.ok) {
      setPlaysNotice(playsFailure(result.reason));
      return false;
    }
    setPlaysNotice(null);
    const listed = listPlays(browserLocalStorage());
    setSavedPlays(listed.ok ? listed.plays : []);
    return true;
  }, []);

  const handleDuplicatePlay = useCallback((id: string) => {
    const result = duplicatePlay(browserLocalStorage(), id);
    if (!result.ok) {
      setPlaysNotice(playsFailure(result.reason));
      return;
    }
    setPlaysNotice(null);
    const listed = listPlays(browserLocalStorage());
    setSavedPlays(listed.ok ? listed.plays : []);
  }, []);

  const handleDeletePlay = useCallback((id: string) => {
    const result = deletePlay(browserLocalStorage(), id);
    if (!result.ok) {
      setPlaysNotice(playsFailure(result.reason));
      return;
    }
    setPlaysNotice(null);
    const listed = listPlays(browserLocalStorage());
    setSavedPlays(listed.ok ? listed.plays : []);
  }, []);

  const stepMovers = Object.keys(state.steps[state.activeStep]?.moves ?? {}).length;
  const drawn = state.steps.some(hasMoves);
  // During Play, and the hold after it, the note follows the running step.
  const noteStep = playing ? playing.step : state.activeStep;
  const shownNote = playing ? playing.note : state.steps[state.activeStep]?.note;

  return (
    <div className="app">
      <main className="stage">
        <FieldStage state={state} dispatch={dispatch} tool={tool} animating={animating} />
        <div className="play-dock">
          <SetupChips
            occupied={occupiedSlots(state.tokens)}
            onToggle={handleToggleSlot}
            onLoadBases={handleLoadBases}
            disabled={playbackActive}
          />
          <div className="play-caption">
            <strong>Step {noteStep + 1}</strong>
            <span hidden={shownNote !== undefined}>
              {stepMovers === 0
                ? drawn
                  ? 'Nobody moves yet — hold a player and drag him where he goes.'
                  : 'Hold a player and drag to where he goes. Everyone drawn in a step breaks together.'
                : stepMovers === 1
                  ? 'One player moving. Point anyone else who breaks on this beat too.'
                  : `${stepMovers} players break together here. Add a step for what happens next.`}
            </span>
          </div>
          <StepNote
            stepNumber={noteStep + 1}
            note={shownNote}
            draft={playing ? null : noteDraft}
            onDraftChange={setNoteDraft}
            onCommit={(note) => dispatch({ type: 'setStepNote', index: state.activeStep, note })}
          />
          <StepBar
            steps={state.steps}
            activeStep={state.activeStep}
            // Changing steps drops an unsaved draft rather than writing it onto
            // the wrong step.
            onSelect={(index) => {
              setNoteDraft(null);
              dispatch({ type: 'setActiveStep', index });
            }}
            onAdd={() => {
              setNoteDraft(null);
              dispatch({ type: 'addStep' });
            }}
            onRemove={(index) => {
              setNoteDraft(null);
              dispatch({ type: 'removeStep', index });
            }}
            onEditNote={() => setNoteDraft(state.steps[state.activeStep]?.note ?? '')}
            disabled={playbackActive}
          />
          <PlayControls
            onPlay={handlePlay}
            onClear={() => dispatch({ type: 'clearSteps' })}
            onReset={handleReset}
            canPlay={drawn}
            speed={speed}
            onSpeedChange={setSpeed}
            isPlaying={isPlaying}
            playbackActive={playbackActive}
            onPause={handlePause}
            onStop={handleStop}
            onBeat={handleBeat}
            progress={playbackActive ? progressValue : 0}
            loop={loop}
            onLoopChange={() => setLoop((value) => !value)}
            onMyPlays={showPlays}
          />
        </div>
      </main>

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onUndo={() => dispatch({ type: 'undo' })}
        canUndo={state.undoStack.length > 0 && !playbackActive}
      />

      {playsOpen && (
        <MyPlays
          plays={savedPlays}
          notice={playsNotice}
          canWrite={playsWritable}
          onSave={handleSavePlay}
          onOpen={handleOpenPlay}
          onRename={handleRenamePlay}
          onDuplicate={handleDuplicatePlay}
          onDelete={handleDeletePlay}
          onClose={() => setPlaysOpen(false)}
        />
      )}
    </div>
  );
}

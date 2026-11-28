import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../model/tween';

interface Props {
  onPlay: () => void;
  onClear: () => void;
  onReset: () => void;
  /** True once at least one step has somebody moving in it. */
  canPlay: boolean;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  isPlaying: boolean;
  onMyPlays: () => void;
  playbackActive: boolean;
  onPause: () => void;
  onStop: () => void;
  onBeat: (direction: number) => void;
  progress: number;
  loop: boolean;
  onLoopChange: () => void;
}

type PlayPauseProps = Pick<Props, 'onPlay' | 'onPause' | 'isPlaying' | 'playbackActive' | 'canPlay'>;

function PlayPauseButton({ onPlay, onPause, isPlaying, playbackActive, canPlay }: PlayPauseProps) {
  return (
    <button
      type="button"
      className="pill pill-primary"
      data-testid="play"
      onClick={isPlaying ? onPause : onPlay}
      aria-label={isPlaying ? 'Pause playback' : playbackActive ? 'Resume playback' : 'Play'}
      disabled={!canPlay}
    >
      {isPlaying ? 'Pause' : playbackActive ? 'Resume' : 'Play'}
    </button>
  );
}

function LoopButton({ loop, onLoopChange }: Pick<Props, 'loop' | 'onLoopChange'>) {
  return (
    <button type="button" className="pill" onClick={onLoopChange} aria-pressed={loop} aria-label="Loop playback">
      Loop
    </button>
  );
}

interface PresentationProps extends PlayPauseProps, Pick<Props, 'loop' | 'onLoopChange'> {
  step: number;
  stepCount: number;
  onStep: (index: number) => void;
  onExit: () => void;
}

export function PresentationControls({ step, stepCount, onStep, onExit, loop, onLoopChange, ...playback }: PresentationProps) {
  return (
    <div className="presentation-controls" role="group" aria-label="Presentation controls">
      <PlayPauseButton {...playback} />
      <button type="button" className="pill" aria-label="Previous step" disabled={step === 0} onClick={() => onStep(step - 1)}>
        Prev
      </button>
      <button type="button" className="pill" aria-label="Next step" disabled={step === stepCount - 1} onClick={() => onStep(step + 1)}>
        Next
      </button>
      <LoopButton loop={loop} onLoopChange={onLoopChange} />
      <button type="button" className="pill pill-light" aria-label="Exit presentation" onClick={onExit}>
        Exit
      </button>
    </div>
  );
}

/** Floats over the bottom-left of the field, clear of the tool bar. */
export function PlayControls({
  onPlay,
  onClear,
  onReset,
  canPlay,
  speed,
  onSpeedChange,
  isPlaying,
  onMyPlays,
  playbackActive,
  onPause,
  onStop,
  onBeat,
  progress,
  loop,
  onLoopChange,
}: Props) {
  // One button that steps through the speeds, so the bar stays thumb-sized.
  const nextSpeed = PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(speed) + 1) % PLAYBACK_SPEEDS.length];

  return (
    <div className="play-controls">
      <div className="pill-group transport-controls">
        <PlayPauseButton {...{ onPlay, onPause, isPlaying, playbackActive, canPlay }} />
        <button
          type="button"
          className="pill pill-speed"
          onClick={() => onSpeedChange(nextSpeed)}
          disabled={playbackActive}
          aria-label={`Playback speed ${speed}x — tap for ${nextSpeed}x`}
        >
          {speed}×
        </button>
        <button
          type="button"
          className="pill"
          onClick={onStop}
          disabled={!playbackActive}
          aria-label="Stop playback and return to start"
        >
          Stop
        </button>
        <button
          type="button"
          className="pill"
          onClick={() => onBeat(-1)}
          disabled={!canPlay || progress <= 0}
          aria-label="Previous beat"
        >
          Prev
        </button>
        <button
          type="button"
          className="pill"
          onClick={() => onBeat(1)}
          disabled={!canPlay || progress >= 1}
          aria-label="Next beat"
        >
          Next
        </button>
        <LoopButton loop={loop} onLoopChange={onLoopChange} />
      </div>
      <div className="pill-group">
        <button
          type="button"
          className="pill pill-light"
          onClick={onClear}
          disabled={!canPlay || playbackActive}
          aria-label="Clear the arrows, leaving the players where they stand"
        >
          Clear play
        </button>
        <button
          type="button"
          className="pill pill-light"
          onClick={onReset}
          disabled={playbackActive}
          aria-label="Start over: clear the play and send everyone home"
        >
          New
        </button>
        <button
          type="button"
          className="pill pill-light"
          data-testid="my-plays"
          onClick={onMyPlays}
          disabled={playbackActive}
        >
          My plays
        </button>
      </div>
    </div>
  );
}

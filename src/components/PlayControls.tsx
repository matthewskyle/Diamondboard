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
}: Props) {
  // One button that steps through the speeds, so the bar stays thumb-sized.
  const nextSpeed = PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(speed) + 1) % PLAYBACK_SPEEDS.length];

  return (
    <div className="play-controls">
      <div className="pill-group">
        <button
          type="button"
          className="pill pill-primary"
          onClick={onPlay}
          disabled={!canPlay || isPlaying}
        >
          ▶ Play
        </button>
        <button
          type="button"
          className="pill pill-speed"
          onClick={() => onSpeedChange(nextSpeed)}
          disabled={isPlaying}
          aria-label={`Playback speed ${speed}x — tap for ${nextSpeed}x`}
        >
          {speed}×
        </button>
      </div>
      <div className="pill-group">
        <button
          type="button"
          className="pill pill-light"
          onClick={onClear}
          disabled={!canPlay || isPlaying}
          aria-label="Clear the arrows, leaving the players where they stand"
        >
          Clear play
        </button>
        <button
          type="button"
          className="pill pill-light"
          onClick={onReset}
          disabled={isPlaying}
          aria-label="Start over: clear the play and send everyone home"
        >
          New
        </button>
      </div>
    </div>
  );
}

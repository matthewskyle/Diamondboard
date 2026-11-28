import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clamp01 } from '../model/tween';

interface TweenOptions {
  durationMs: number;
  onFrame: (t: number) => void;
  onDone: () => void;
  loop?: boolean;
}

/**
 * requestAnimationFrame transport. Owns only "how far along are we"; what to do
 * with `t` is the caller's business.
 */
export function useTween({ durationMs, onFrame, onDone, loop = false }: TweenOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const progress = useRef(0);
  const frameRef = useRef<number | null>(null);
  // Kept in a ref so a running tween always calls the latest closures without
  // restarting the animation when they change identity.
  const callbacks = useRef({ onFrame, onDone, loop });
  useLayoutEffect(() => {
    callbacks.current = { onFrame, onDone, loop };
  });

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setIsPlaying(false);
  }, []);

  const seek = useCallback((t: number) => {
    stop();
    progress.current = clamp01(t);
    callbacks.current.onFrame(progress.current);
  }, [stop]);

  const play = useCallback((from = 0) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    let startedAt = performance.now() - from * durationMs;
    setIsPlaying(true);
    progress.current = from;
    callbacks.current.onFrame(from);

    const step = (now: number) => {
      const elapsed = (now - startedAt) / durationMs;
      const t = callbacks.current.loop ? elapsed % 1 : clamp01(elapsed);
      if (callbacks.current.loop && elapsed >= 1) startedAt = now - t * durationMs;
      progress.current = t;
      callbacks.current.onFrame(t);
      if (t < 1 || callbacks.current.loop) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
        setIsPlaying(false);
        callbacks.current.onDone();
      }
    };
    frameRef.current = requestAnimationFrame(step);
  }, [durationMs]);

  useEffect(() => stop, [stop]);

  return { play, stop, seek, progress, isPlaying };
}

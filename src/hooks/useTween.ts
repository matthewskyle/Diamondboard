import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clamp01 } from '../model/tween';

interface TweenOptions {
  durationMs: number;
  onFrame: (t: number) => void;
  onDone: () => void;
}

/**
 * requestAnimationFrame transport. Owns only "how far along are we"; what to do
 * with `t` is the caller's business.
 */
export function useTween({ durationMs, onFrame, onDone }: TweenOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);
  // Kept in a ref so a running tween always calls the latest closures without
  // restarting the animation when they change identity.
  const callbacks = useRef({ onFrame, onDone });
  useLayoutEffect(() => {
    callbacks.current = { onFrame, onDone };
  });

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const startedAt = performance.now();
    setIsPlaying(true);
    callbacks.current.onFrame(0);

    const step = (now: number) => {
      const t = clamp01((now - startedAt) / durationMs);
      callbacks.current.onFrame(t);
      if (t < 1) {
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

  return { play, stop, isPlaying };
}

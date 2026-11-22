import { useEffect, useRef } from 'react';
import type { DiagramState } from '../model/types';
import { browserLocalStorage, createAutosave, type Autosave } from '../storage/library';

/**
 * Writes the open board a beat after the last edit, and immediately when the
 * page is going away. Drawing commits on pointer-up, so the debounce never
 * runs mid-stroke; it folds a run of taps into one `setItem`.
 */
export function useAutosave(board: DiagramState, enabled: boolean): void {
  const autosave = useRef<Autosave | null>(null);

  useEffect(() => {
    if (autosave.current === null) {
      autosave.current = createAutosave(browserLocalStorage(), { enabled });
    }
    autosave.current.schedule(board);
  }, [board, enabled]);

  useEffect(() => {
    const flush = () => autosave.current?.flush();
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, []);
}

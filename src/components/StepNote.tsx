import { useEffect, useRef } from 'react';
import { NOTE_MAX_LENGTH } from '../model/diagramState';

interface Props {
  /** The step the note belongs to, 1-based, for labels. */
  stepNumber: number;
  /** The note on that step, if any. */
  note: string | undefined;
  /** The text being edited, or null when the note is only shown. */
  draft: string | null;
  onDraftChange: (draft: string | null) => void;
  onCommit: (note: string) => void;
}

/**
 * The coaching note for one step, in the play dock where the caption already
 * lives, so it never floats over a fielder. With no note and no edit it takes
 * no room at all: the button that opens it sits in the step bar. Editing
 * commits once on Done (or Return, or leaving the field), so the whole edit is
 * one undo, not one per keystroke.
 */
export function StepNote({ stepNumber, note, draft, onDraftChange, onCommit }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const editing = draft !== null;

  useEffect(() => {
    if (!editing) return;
    const el = input.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const commit = () => {
    if (draft === null) return;
    onCommit(draft);
    onDraftChange(null);
  };

  if (editing) {
    return (
      <div className="step-note step-note-editing">
        <textarea
          ref={input}
          className="step-note-input"
          data-testid="step-note-input"
          aria-label={`Coaching note for step ${stepNumber}`}
          placeholder="Who fields, who cuts, who covers, and why"
          rows={2}
          maxLength={NOTE_MAX_LENGTH}
          enterKeyHint="done"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              onDraftChange(null);
            }
          }}
          onBlur={commit}
        />
        <button
          type="button"
          className="pill pill-primary step-note-done"
          data-testid="step-note-done"
          // Keep focus in the field so the tap commits once, here, not via blur.
          onPointerDown={(event) => event.preventDefault()}
          onClick={commit}
        >
          Done
        </button>
      </div>
    );
  }

  if (!note) return null;
  return (
    <div className="step-note">
      <p className="step-note-text" data-testid="step-note" aria-live="polite">
        {note}
      </p>
    </div>
  );
}

import { hasMoves, type PlayStep } from '../model/steps';

interface Props {
  steps: readonly PlayStep[];
  activeStep: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Open the coaching note editor for the active step. */
  onEditNote: () => void;
  disabled: boolean;
}

function moverCount(step: PlayStep): number {
  return Object.keys(step.moves).length;
}

/**
 * The play, as a row of beats. Tapping one puts the board where it stands
 * entering that step, so a coach builds the play the way it happens: set the
 * first break, add a step, set what follows.
 */
export function StepBar({ steps, activeStep, onSelect, onAdd, onRemove, onEditNote, disabled }: Props) {
  const active = steps[activeStep];
  const removable = steps.length > 1 || (active !== undefined && hasMoves(active));

  return (
    <div className="step-bar" role="group" aria-label="Play steps">
      <span className="step-bar-title">Steps</span>
      {steps.map((step, index) => {
        const movers = moverCount(step);
        return (
          <button
            key={step.id}
            type="button"
            className="step-chip"
            aria-pressed={index === activeStep}
            aria-label={
              movers === 0
                ? `Step ${index + 1}, nobody moving yet`
                : `Step ${index + 1}, ${movers} moving`
            }
            data-testid={`step-${index + 1}`}
            data-movers={movers}
            disabled={disabled}
            onClick={() => onSelect(index)}
          >
            {index + 1}
            {movers > 0 && <span className="step-chip-count">{movers}</span>}
          </button>
        );
      })}
      <button
        type="button"
        className="step-chip step-chip-add"
        aria-label="Add a step"
        data-testid="add-step"
        disabled={disabled}
        onClick={onAdd}
      >
        +
      </button>
      <button
        type="button"
        className="step-chip step-chip-remove"
        aria-label={`Delete step ${activeStep + 1}`}
        disabled={disabled || !removable}
        onClick={() => onRemove(activeStep)}
      >
        ✕
      </button>
      <button
        type="button"
        className="pill pill-light step-note-edit"
        data-testid="step-note-edit"
        aria-label={
          active?.note ? `Edit the note on step ${activeStep + 1}` : `Add a note to step ${activeStep + 1}`
        }
        disabled={disabled}
        onClick={onEditNote}
      >
        {active?.note ? 'Edit note' : '+ Note'}
      </button>
    </div>
  );
}

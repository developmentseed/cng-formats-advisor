import { FAMILIES, focusOption } from '../framework/data/families';
import { INTENTS, INTENT_LABEL } from '../framework/data/intents';
import type { AppState } from '../framework/state';
import { OUTCOME_SHORT, type StepId } from '../framework/steps';
import type { ControlOutcome } from '../framework/types';

/** Your answers on one line. Each part opens its step. */
export function PathSummary({
  state,
  control,
  onGo,
}: {
  state: AppState;
  control: ControlOutcome;
  onGo: (s: StepId) => void;
}) {
  const top = INTENTS.filter((i) => state.intentWeights[i] > 0).sort((a, b) => state.intentWeights[b] - state.intentWeights[a]);
  const focus = focusOption(state.topology, state.familyFocus);
  const parts: { step: StepId; text: string }[] = [{ step: 'control', text: OUTCOME_SHORT[control.kind] }];
  if (control.continuesToStage2 && state.topology) {
    parts.push({ step: 'shape', text: FAMILIES[state.topology].label.split(',')[0]! });
    if (focus) parts.push({ step: 'shape', text: focus.chip.split(':')[0]!.toLowerCase() });
    if (top[0]) {
      const equal = top.length === INTENTS.length && new Set(top.map((i) => state.intentWeights[i])).size === 1;
      parts.push({ step: 'priorities', text: equal ? 'all uses equal' : `${INTENT_LABEL[top[0]].toLowerCase()} first` });
    }
  }
  return (
    <p className="path-line">
      {parts.map((p, i) => (
        <span key={`${p.step}-${i}`}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <button type="button" className="path-part" onClick={() => onGo(p.step)} title="Change this answer">
            {p.text}
          </button>
        </span>
      ))}
      <span aria-hidden="true"> · </span>
      <button type="button" className="link-btn" onClick={() => onGo('control')}>
        change answers
      </button>
    </p>
  );
}

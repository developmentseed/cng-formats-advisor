import { FAMILIES } from '../framework/data/families';
import { INTENTS, INTENT_LABEL } from '../framework/data/intents';
import type { AppState } from '../framework/state';
import { OUTCOME_SHORT, type StepId } from '../framework/steps';
import type { ControlOutcome } from '../framework/types';

/** "Your path": a recap of the answers on the result step, with a link back to each step. */
export function PathSummary({
  state,
  control,
  onGo,
}: {
  state: AppState;
  control: ControlOutcome;
  onGo: (s: StepId) => void;
}) {
  const intents = INTENTS.filter((i) => state.intentWeights[i] > 0)
    .sort((a, b) => state.intentWeights[b] - state.intentWeights[a])
    .map((i) => `${INTENT_LABEL[i]} (${state.intentWeights[i]})`);
  const rows: { step: StepId; label: string; value: string }[] = [
    { step: 'control', label: 'Control', value: OUTCOME_SHORT[control.kind] },
  ];
  if (control.continuesToStage2) {
    rows.push({ step: 'shape', label: 'Shape', value: state.topology ? FAMILIES[state.topology].label : 'not set' });
    rows.push({
      step: 'priorities',
      label: 'Priorities',
      value: `${intents.join(', ') || 'no intent'} · maturity L${state.minMaturity}+ · encoding ${state.encodingImportance}`,
    });
  }
  return (
    <dl className="path">
      {rows.map((r) => (
        <div key={r.step}>
          <dt>{r.label}</dt>
          <dd>
            {r.value}{' '}
            <button type="button" className="link-btn small" onClick={() => onGo(r.step)}>
              Change
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

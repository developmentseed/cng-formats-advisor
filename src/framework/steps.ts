/**
 * The four steps of the dashboard and their status. Pure: no React.
 * Step 1 is Stage 1 of the guide (control). Steps 2 and 3 are Stage 2
 * (topology, then refinements). Step 4 is the result.
 */
import { FAMILIES } from './data/families';
import { FORMATS } from './data/formats';
import { INTENTS, INTENT_LABEL } from './data/intents';
import type { AppState } from './state';
import type { ControlOutcome, Ranking } from './types';

export type StepId = 'control' | 'shape' | 'priorities' | 'result';

export const STEPS: StepId[] = ['control', 'shape', 'priorities', 'result'];

export const STEP_TITLE: Record<StepId, string> = {
  control: 'Do you have a choice?',
  shape: 'What shape are the data?',
  priorities: 'What matters most?',
  result: 'Your short list',
};

export const STEP_SHORT: Record<StepId, string> = {
  control: 'Control',
  shape: 'Shape',
  priorities: 'Priorities',
  result: 'Result',
};

export const OUTCOME_SHORT: Record<ControlOutcome['kind'], string> = {
  incomplete: 'Not complete',
  free: 'Free choice',
  mandate: 'Mandate, plus a copy',
  repackage: 'Repackage',
  virtual: 'Virtual Zarr',
  'not-yet-possible': 'Not yet possible',
};

export interface StepStatus {
  /** The person can open this step now. */
  available: boolean;
  /** The step has all the answers it needs. */
  done: boolean;
  /** The step does not apply to this decision (for example, no Stage 2). */
  skipped: boolean;
  /** One short line for the stepper, when done. */
  summary: string;
}

export function stepStatuses(s: AppState, control: ControlOutcome, ranking: Ranking | null): Record<StepId, StepStatus> {
  const controlDone = control.kind !== 'incomplete';
  const stage2 = control.continuesToStage2;
  const shapeDone = stage2 && s.topology !== null;
  const weighted = INTENTS.filter((i) => s.intentWeights[i] > 0).sort((a, b) => s.intentWeights[b] - s.intentWeights[a]);
  const priorities = weighted.length > 0;
  const top = ranking?.candidates[0];

  return {
    control: {
      available: true,
      done: controlDone,
      skipped: false,
      summary: controlDone ? OUTCOME_SHORT[control.kind] : '',
    },
    shape: {
      available: stage2,
      done: shapeDone,
      skipped: controlDone && !stage2,
      summary: shapeDone && s.topology ? FAMILIES[s.topology].label.split(',')[0]! : '',
    },
    priorities: {
      available: shapeDone,
      done: shapeDone && priorities,
      skipped: controlDone && !stage2,
      summary: !shapeDone
        ? ''
        : !priorities
          ? 'No intent set'
          : weighted.length === INTENTS.length && new Set(weighted.map((i) => s.intentWeights[i])).size === 1
            ? 'All intents equal'
            : weighted.slice(0, 2).map((i) => INTENT_LABEL[i]).join(', '),
    },
    result: {
      available: controlDone && (!stage2 || shapeDone),
      done: false,
      skipped: false,
      summary: top ? `${FORMATS[top.format].name} first` : controlDone && !stage2 ? OUTCOME_SHORT[control.kind] : '',
    },
  };
}

/** The step to open first: the result when the decision is complete, else the first open question. */
export function firstStep(statuses: Record<StepId, StepStatus>): StepId {
  if (!statuses.control.done) return 'control';
  if (statuses.shape.available && !statuses.shape.done) return 'shape';
  return 'result';
}

/** The step after this one, or null. Skips steps that do not apply. */
export function nextStep(step: StepId, statuses: Record<StepId, StepStatus>): StepId | null {
  const i = STEPS.indexOf(step);
  for (const s of STEPS.slice(i + 1)) {
    if (!statuses[s].skipped) return s;
  }
  return null;
}

export function prevStep(step: StepId, statuses: Record<StepId, StepStatus>): StepId | null {
  const i = STEPS.indexOf(step);
  for (const s of STEPS.slice(0, i).reverse()) {
    if (!statuses[s].skipped) return s;
  }
  return null;
}

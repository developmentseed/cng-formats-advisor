import { MATURITY_SCALE } from '../framework/data/formats';
import { REF } from '../framework/data/guide';
import { INTENTS, INTENT_LABEL, INTENT_NOTES } from '../framework/data/intents';
import { CNES_TIERS } from '../framework/data/tiers';
import { BENCHMARK_CRITERIA, BENCHMARK_LABEL } from '../framework/score';
import { withTierPolicy, type AppState } from '../framework/state';
import type { Importance, MaturityLevel, ProcessingMode, Tier, TierPolicyKind } from '../framework/types';
import { Ref, Segmented, WeightPicker } from './common';

const MiB = 1024 * 1024;

export function Refinements({
  state,
  hasBenchmark,
  onChange,
}: {
  state: AppState;
  hasBenchmark: boolean;
  onChange: (s: AppState) => void;
}) {
  const custom = state.customTiers;
  const setCustom = (tiers: Tier[]) => onChange(withTierPolicy(state, 'custom', tiers));

  return (
    <section className="panel" aria-labelledby="ref-h">
      <h2 id="ref-h">
        <span className="step">Stage 2</span> Refinements
      </h2>
      <p className="small">
        Four refinements rank the candidates inside the family. <Ref to={REF.refinements} />
      </p>

      <div className="field">
        <span className="label">Intent mix (weight 0 to 3)</span>
        <span className="small muted">
          Most products serve several intents. The intent mix decides the ranking. <Ref to={REF.intent} />
        </span>
        {INTENTS.map((i) => (
          <div className="field-row" key={i}>
            <span>{INTENT_LABEL[i]}</span>
            <WeightPicker
              label={`Weight of ${INTENT_LABEL[i]}`}
              value={state.intentWeights[i]}
              onChange={(v) => onChange({ ...state, intentWeights: { ...state.intentWeights, [i]: v } })}
            />
          </div>
        ))}
        {state.intentWeights.fusion > 0 && <span className="small muted">{INTENT_NOTES.fusion}</span>}
      </div>

      <div className="field">
        <div className="field-row">
          <span className="label" id="pm-l">
            Processing
          </span>
          <Segmented<ProcessingMode>
            label="Processing mode"
            value={state.processingMode}
            options={[
              { value: 'on-the-fly', label: 'On the fly' },
              { value: 'batched', label: 'Batched' },
            ]}
            onChange={(v) => onChange({ ...state, processingMode: v })}
          />
        </div>
        <span className="small muted">
          {INTENT_NOTES.processing} This changes the layout advice, not the score.
        </span>
      </div>

      <div className="field">
        <div className="field-row">
          <span className="label">Lowest maturity you accept</span>
          <Segmented<MaturityLevel>
            label="Lowest maturity level you accept"
            value={state.minMaturity}
            options={([1, 2, 3, 4, 5] as MaturityLevel[]).map((l) => ({ value: l, label: `L${l}`, title: MATURITY_SCALE[l] }))}
            onChange={(v) => onChange({ ...state, minMaturity: v })}
          />
        </div>
        <span className="small muted">
          L{state.minMaturity}: {MATURITY_SCALE[state.minMaturity]}. A lower level gives a warning, not a veto.{' '}
          <Ref to={REF.maturity} />
        </span>
      </div>

      <div className="field">
        <div className="field-row">
          <span className="label">Interpretation encoding importance</span>
          <Segmented<Importance>
            label="Interpretation encoding importance"
            value={state.encodingImportance}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            onChange={(v) => onChange({ ...state, encodingImportance: v })}
          />
        </div>
        <span className="small muted">
          Set "high" if your product stores scaled integers, or if an undeclared fill value would change a computed
          result. <Ref to={REF.encoding} />
        </span>
      </div>

      <div className="field">
        <div className="field-row">
          <span className="label">Object-size tier policy</span>
          <Segmented<TierPolicyKind>
            label="Tier policy"
            value={state.tierPolicy.kind}
            options={[
              { value: 'none', label: 'None' },
              { value: 'cnes', label: 'CNES example' },
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={(v) => onChange(withTierPolicy(state, v))}
          />
        </div>
        {state.tierPolicy.kind === 'cnes' && (
          <span className="small muted">
            CNES Datalake example: {CNES_TIERS.map((t) => `${t.name} ≥ ${t.minObjectBytes / MiB} MiB`).join(', ')} mean
            object size. Advisory floors, not a general rule.
          </span>
        )}
        {state.tierPolicy.kind === 'custom' && (
          <div style={{ display: 'grid', gap: 6 }}>
            {custom.map((t, idx) => (
              <div className="field-row" key={idx}>
                <input
                  type="text"
                  aria-label={`Name of tier ${idx + 1}`}
                  value={t.name}
                  size={10}
                  onChange={(e) => setCustom(custom.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))}
                />
                <span>
                  ≥{' '}
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    aria-label={`Minimum mean object size of tier ${idx + 1}, in MiB`}
                    value={Number((t.minObjectBytes / MiB).toFixed(3))}
                    style={{ width: '7rem' }}
                    onChange={(e) =>
                      setCustom(custom.map((x, j) => (j === idx ? { ...x, minObjectBytes: Number(e.target.value) * MiB } : x)))
                    }
                  />{' '}
                  MiB
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={custom.length <= 1}
                  onClick={() => setCustom(custom.filter((_, j) => j !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="btn"
                onClick={() => setCustom([...custom, { name: `tier ${custom.length + 1}`, minObjectBytes: 128 * MiB }])}
              >
                Add a tier
              </button>
            </div>
          </div>
        )}
        <span className="small muted">
          Without benchmark data, the object size gives advice only (the grouping lever), not a score.{' '}
          <Ref to={REF.groupingLever} />
        </span>
      </div>

      <div className="field">
        <span className="label">Measured criteria (weight 0 to 3)</span>
        <span className="small muted">
          {hasBenchmark
            ? 'Each value is relative to the best candidate. Formats with no data have the term left out.'
            : 'Upload benchmark results to use these criteria. They are off by default.'}{' '}
          <Ref to={REF.quantitative} />
        </span>
        {BENCHMARK_CRITERIA.map((c) => (
          <div className="field-row" key={c}>
            <span>{BENCHMARK_LABEL[c]}</span>
            <WeightPicker
              label={`Weight of ${BENCHMARK_LABEL[c]}`}
              value={state.benchmarkWeights[c]}
              onChange={(v) => onChange({ ...state, benchmarkWeights: { ...state.benchmarkWeights, [c]: v } })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

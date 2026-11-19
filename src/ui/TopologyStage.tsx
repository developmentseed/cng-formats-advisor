import { FAMILIES, TOPOLOGY_NOTE } from '../framework/data/families';
import { FORMATS } from '../framework/data/formats';
import { REF } from '../framework/data/guide';
import type { Topology } from '../framework/types';
import { Ref } from './common';
import { ShapeIcon } from './ShapeIcon';

export function TopologyStage({
  value,
  focus,
  onChange,
  onFocus,
}: {
  value: Topology | null;
  focus: string | null;
  onChange: (t: Topology) => void;
  onFocus: (id: string | null) => void;
}) {
  const family = value ? FAMILIES[value] : null;
  return (
    <div>
      <div className="topologies">
        {Object.values(FAMILIES).map((f) => (
          <button
            key={f.topology}
            type="button"
            className="topology"
            aria-pressed={value === f.topology}
            onClick={() => onChange(f.topology)}
          >
            <ShapeIcon topology={f.topology} />
            <span className="topology-text">
              <strong>{f.label}</strong>
              {f.example && <span className="small muted">for example {f.example}</span>}
              <span className="members">{f.members.map((m) => FORMATS[m].name).join(', ')}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
        {TOPOLOGY_NOTE}
      </p>
      {family && (
        <fieldset className="focus">
          <legend>
            {family.focusQuestion} <span className="badge">Optional</span>
          </legend>
          <p className="small muted" style={{ margin: '0 0 6px' }}>
            Answer for your readers, not for a format. Each answer is one line of the guide's "Where each member
            wins" column, and the score uses it. <Ref to={REF.topology} />
          </p>
          {family.focus.map((o) => (
            <label key={o.id} className="focus-option">
              <input type="radio" name="family-focus" checked={focus === o.id} onChange={() => onFocus(o.id)} />
              <span>{o.label}</span>
            </label>
          ))}
          <label className="focus-option">
            <input type="radio" name="family-focus" checked={focus === null} onChange={() => onFocus(null)} />
            <span>Not sure (no effect on the score)</span>
          </label>
        </fieldset>
      )}
    </div>
  );
}

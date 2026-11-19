import { FAMILIES, TOPOLOGY_NOTE } from '../framework/data/families';
import { FORMATS } from '../framework/data/formats';
import type { Topology } from '../framework/types';

export function TopologyStage({ value, onChange }: { value: Topology | null; onChange: (t: Topology) => void }) {
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
            <strong>{f.label}</strong>
            {f.example && <div className="small muted">for example {f.example}</div>}
            <div className="members">{f.members.map((m) => FORMATS[m].name).join(', ')}</div>
          </button>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
        {TOPOLOGY_NOTE}
      </p>
    </div>
  );
}

import { FAMILIES, TOPOLOGY_NOTE } from '../framework/data/families';
import { FORMATS } from '../framework/data/formats';
import type { Topology } from '../framework/types';
import { ShapeIcon } from './ShapeIcon';

/** A short line under each shape: the example of the guide, or a plain hint. */
const HINT: Record<Topology, string> = {
  'raster-2d': 'One scene or tile at a time',
  'nd-cube': 'Time × y × x, or more',
  'point-cloud': 'LiDAR, altimetry points',
  vector: 'Features, rows',
};

const SHORT_LABEL: Record<Topology, string> = {
  'raster-2d': '2D raster',
  'nd-cube': 'Data cube',
  'point-cloud': 'Point cloud',
  vector: 'Vector or table',
};

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
      <div className="shape-tiles" role="group" aria-label="Shape of the data">
        {Object.values(FAMILIES).map((f) => (
          <button
            key={f.topology}
            type="button"
            className="shape-tile"
            aria-pressed={value === f.topology}
            onClick={() => onChange(f.topology)}
            title={`${f.label}: ${f.members.map((m) => FORMATS[m].name).join(', ')}`}
          >
            <ShapeIcon topology={f.topology} />
            <b>{SHORT_LABEL[f.topology]}</b>
            <span>{HINT[f.topology]}</span>
          </button>
        ))}
      </div>
      <p className="center-note">
        {TOPOLOGY_NOTE.split('.')[0]}.
      </p>

      {family && (
        <fieldset className="follow-up">
          <legend>{family.focusQuestion}</legend>
          <div className="chips">
            {family.focus.map((o) => (
              <label key={o.id} className={`chip${focus === o.id ? ' on' : ''}`} title={o.label}>
                <input type="radio" name="family-focus" checked={focus === o.id} onChange={() => onFocus(o.id)} />
                {o.chip}
              </label>
            ))}
            <label className={`chip${focus === null ? ' on' : ''}`}>
              <input type="radio" name="family-focus" checked={focus === null} onChange={() => onFocus(null)} />
              Not sure
            </label>
          </div>
        </fieldset>
      )}
    </div>
  );
}

import { FORMATS } from '../framework/data/formats';
import type { Ranking } from '../framework/types';

/** A compact live view of the ranking, beside the questions. */
export function ShortList({ ranking, onOpen }: { ranking: Ranking; onOpen: () => void }) {
  return (
    <aside className="panel shortlist" aria-labelledby="shortlist-h" aria-live="polite">
      <h2 id="shortlist-h" className="small-h">
        Live short list
      </h2>
      <ol className="mini-rank">
        {ranking.candidates.map((c) => (
          <li key={c.format}>
            <span className="mini-name">{FORMATS[c.format].name}</span>
            <span className="mini-bar" aria-hidden="true">
              <span style={{ width: `${c.score}%` }} />
            </span>
            <span className="mini-score">{c.score.toFixed(0)}</span>
          </li>
        ))}
      </ol>
      {ranking.close && <p className="small muted">The first two are close: measure them.</p>}
      <button type="button" className="link-btn small" onClick={onOpen}>
        See the details →
      </button>
    </aside>
  );
}

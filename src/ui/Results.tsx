import { useState } from 'react';
import { FAMILIES } from '../framework/data/families';
import { ENCODING_TEXT, FORMATS } from '../framework/data/formats';
import { BENCHMARK_DOCS_URL, REF } from '../framework/data/guide';
import type { RankedCandidate, Ranking, ScoreTerm, Topology } from '../framework/types';
import { Ref, WarningList } from './common';

type Group = 'intent' | 'maturity' | 'encoding' | 'size' | 'measured';

export const GROUP_LABEL: Record<Group, string> = {
  intent: 'Intent fit',
  maturity: 'Maturity',
  encoding: 'Encoding',
  size: 'Object size',
  measured: 'Measured',
};

function groupOf(t: ScoreTerm): Group {
  if (t.kind.startsWith('intent:')) return 'intent';
  if (t.kind === 'maturity') return 'maturity';
  if (t.kind === 'encoding') return 'encoding';
  if (t.kind === 'object-size') return 'size';
  return 'measured';
}

export function ScoreLegend({ groups }: { groups: Group[] }) {
  return (
    <div className="legend" aria-label="Score bar legend">
      {groups.map((g) => (
        <span key={g}>
          <i className={`g-${g}`} aria-hidden="true" />
          {GROUP_LABEL[g]}
        </span>
      ))}
    </div>
  );
}

function ScoreBar({ c }: { c: RankedCandidate }) {
  const [tip, setTip] = useState<{ text: string; left: number } | null>(null);
  const segs = c.terms.filter((t) => t.points > 0.05);
  let acc = 0;
  return (
    <div className="scorebar" onMouseLeave={() => setTip(null)}>
      <div
        className="scorebar-track"
        role="img"
        aria-label={`Score ${c.score.toFixed(0)} of 100. ${segs.map((t) => `${t.label} ${t.points.toFixed(1)}`).join(', ')}.`}
      >
        {segs.map((t) => {
          const left = acc + t.points / 2;
          acc += t.points;
          const name = groupOf(t) === 'intent' ? `Intent fit, ${t.label.toLowerCase()}` : t.label;
          const text = `${name}. Weight ${t.weight}, value ${t.value?.toFixed(2)}. ${t.points.toFixed(1)} points.`;
          return (
            <div
              key={t.kind}
              className={`scorebar-seg g-${groupOf(t)}`}
              style={{ width: `${t.points}%` }}
              tabIndex={0}
              aria-label={text}
              onMouseEnter={() => setTip({ text, left })}
              onFocus={() => setTip({ text, left })}
              onBlur={() => setTip(null)}
            />
          );
        })}
      </div>
      {tip && (
        <div className="tooltip" role="tooltip" style={{ left: `clamp(80px, ${tip.left}%, calc(100% - 80px))` }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

function Breakdown({ c }: { c: RankedCandidate }) {
  return (
    <details>
      <summary className="small">Score breakdown</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Criterion</th>
              <th className="num">Weight</th>
              <th className="num">Value</th>
              <th className="num">Points</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {c.terms.map((t) => (
              <tr key={t.kind}>
                <td>
                  <i className={`g-${groupOf(t)}`} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6 }} aria-hidden="true" />
                  {t.label}
                </td>
                <td className="num">{t.weight}</td>
                <td className="num">{t.value === null ? '—' : t.value.toFixed(2)}</td>
                <td className="num">{t.points.toFixed(1)}</td>
                <td>
                  {t.explanation} {t.ref && <Ref to={t.ref}>source</Ref>}
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Score</strong>
              </td>
              <td />
              <td />
              <td className="num">
                <strong>{c.score.toFixed(1)}</strong>
              </td>
              <td className="muted">Weighted mean of the values, times 100.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Card({ c, topology }: { c: RankedCandidate; topology: Topology }) {
  const f = FORMATS[c.format];
  const win = FAMILIES[topology].wins[c.format];
  return (
    <article className={`card${c.rank === 1 ? ' first' : ''}`} aria-labelledby={`card-${c.format}`}>
      <div className="card-head">
        <h3 id={`card-${c.format}`}>
          <span className="rank">#{c.rank}</span>
          {f.name}
        </h3>
        <span className="score">
          {c.score.toFixed(0)} <small>/ 100</small>
        </span>
      </div>
      <ScoreBar c={c} />
      <dl className="facts">
        {win && (
          <>
            <dt>Where it wins</dt>
            <dd>{win}</dd>
          </>
        )}
        <dt>Maturity</dt>
        <dd>
          {f.maturity === null ? 'Not rated in the guide' : `L${f.maturity}`}
          {f.specification && ` · ${f.specification}`}
          {f.maturityNote && <div className="muted">{f.maturityNote}</div>}
        </dd>
        <dt>Encoding</dt>
        <dd>{ENCODING_TEXT[f.encoding]}</dd>
        <dt>Grouping lever</dt>
        <dd>
          {f.groupingLever ?? 'Not in the grouping-lever table of the guide.'} <Ref to={f.groupingLeverRef}>lever</Ref>
        </dd>
        <dt>Format page</dt>
        <dd>
          <Ref to={f.page}>{f.page.label}</Ref>
        </dd>
      </dl>
      <WarningList items={c.warnings} />
      <Breakdown c={c} />
    </article>
  );
}

export function Results({ ranking, topology }: { ranking: Ranking; topology: Topology }) {
  const groups = [...new Set(ranking.candidates.flatMap((c) => c.terms.filter((t) => t.points > 0.05).map(groupOf)))];
  const order: Group[] = ['intent', 'maturity', 'encoding', 'size', 'measured'];
  return (
    <section className="panel" aria-labelledby="results-h">
      <h2 id="results-h">Ranked candidates</h2>
      <p className="small muted">
        The score helps, you make the final call. No format is removed: a low score or a low maturity gives a warning.{' '}
        <Ref to={REF.whatItIs} />
      </p>
      {ranking.close && (
        <div className="callout warn" style={{ marginBottom: 12 }}>
          <strong>The first two candidates are close.</strong> The framework does not replace a benchmark: measure them.
          Use{' '}
          <a href={BENCHMARK_DOCS_URL} target="_blank" rel="noopener noreferrer">
            cng-formats-benchmark ↗
          </a>{' '}
          on your own data, then upload the results below.
        </div>
      )}
      {ranking.measureNotes.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <WarningList items={ranking.measureNotes.map((t) => ({ text: t, info: true, ref: REF.quantitative }))} />
        </div>
      )}
      <ScoreLegend groups={order.filter((g) => groups.includes(g))} />
      <div className="cards">
        {ranking.candidates.map((c) => (
          <Card key={c.format} c={c} topology={topology} />
        ))}
      </div>
      {ranking.notes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3>Layout advice</h3>
          <WarningList items={ranking.notes.map((n) => ({ text: n, info: true, ref: REF.intent }))} />
        </div>
      )}
    </section>
  );
}

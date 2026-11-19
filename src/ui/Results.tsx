import { useState } from 'react';
import { FAMILIES } from '../framework/data/families';
import { ENCODING_TEXT, FORMATS } from '../framework/data/formats';
import { REF } from '../framework/data/guide';
import type { RankedCandidate, Ranking, ScoreTerm, Topology } from '../framework/types';
import { Ref, WarningList } from './common';

type Group = 'intent' | 'maturity' | 'encoding' | 'measured';

export const GROUP_LABEL: Record<Group, string> = {
  intent: 'Intent and family fit',
  maturity: 'Maturity',
  encoding: 'Encoding',
  measured: 'Measured',
};

function groupOf(t: ScoreTerm): Group {
  if (t.kind.startsWith('intent:') || t.kind === 'family-fit') return 'intent';
  if (t.kind === 'maturity') return 'maturity';
  if (t.kind === 'encoding') return 'encoding';
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
          const name = t.kind.startsWith('intent:') ? `Intent fit, ${t.label.toLowerCase()}` : t.label;
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

function BreakdownTable({ c }: { c: RankedCandidate }) {
  return (
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
                <i className={`swatch g-${groupOf(t)}`} aria-hidden="true" />
                {t.label}
              </td>
              <td className="num">{t.weight}</td>
              <td className="num">{t.value === null ? '—' : t.value.toFixed(2)}</td>
              <td className="num">{t.points.toFixed(1)}</td>
              <td>
                {t.explanation}
                {t.detail ? (
                  <span className="why-detail">
                    {t.ref ? (
                      <>
                        From the guide, <Ref to={t.ref}>{t.ref.label}</Ref>:{' '}
                      </>
                    ) : null}
                    {t.detail}
                  </span>
                ) : (
                  t.ref && (
                    <>
                      {' '}
                      <Ref to={t.ref}>source</Ref>
                    </>
                  )
                )}
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
  );
}

/** Everything about one format: the score bar, the facts, the warnings and the breakdown. Behind a toggle. */
function FormatDetails({ c, topology, label }: { c: RankedCandidate; topology: Topology; label: string }) {
  const f = FORMATS[c.format];
  const win = FAMILIES[topology].wins[c.format];
  const groups = [...new Set(c.terms.filter((t) => t.points > 0.05).map(groupOf))];
  const order: Group[] = ['intent', 'maturity', 'encoding', 'measured'];
  return (
    <details className="format-details">
      <summary>{label}</summary>
      <ScoreLegend groups={order.filter((g) => groups.includes(g))} />
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
      <WarningList items={c.warnings.map((w) => ({ text: w.text, ref: w.ref, info: w.info }))} />
      <BreakdownTable c={c} />
    </details>
  );
}

interface Fact {
  text: string;
  warn?: boolean;
}

/** Three or four short facts for the hero card, from the score terms and the warnings. */
function factsFor(c: RankedCandidate, focusChip: string | undefined): Fact[] {
  const out: Fact[] = [];
  const fam = c.terms.find((t) => t.kind === 'family-fit');
  if (fam && fam.value === 1 && focusChip) out.push({ text: `Fits: ${focusChip}` });
  const best = c.terms
    .filter((t) => t.kind.startsWith('intent:') && t.value === 1)
    .sort((a, b) => b.weight - a.weight)[0];
  if (best) out.push({ text: `Best fit for ${best.label.toLowerCase()}` });
  const enc = c.terms.find((t) => t.kind === 'encoding');
  if (enc && enc.value === 1 && FORMATS[c.format].encoding === 'first-class') out.push({ text: 'Scale, offset and nodata built in' });
  const level = FORMATS[c.format].maturity;
  const below = c.warnings.find((w) => w.kind === 'maturity');
  if (below) out.push({ text: `L${level}: plan for change`, warn: true });
  else if (level !== null) out.push({ text: `Maturity L${level}` });
  const tier = c.warnings.find((w) => w.kind === 'tier');
  if (tier) out.push({ text: tier.info ? 'Object size clears your tiers' : 'Objects too small for your tiers', warn: !tier.info });
  return out;
}

/** The headline of the result page. */
export function verdict(ranking: Ranking): string {
  const [a, b] = ranking.candidates;
  if (!a) return 'No candidate';
  if (ranking.close && b) return `${FORMATS[a.format].name} or ${FORMATS[b.format].name}: a close call`;
  return `${FORMATS[a.format].name} is the best starting point`;
}

export function Results({
  ranking,
  topology,
  focusChip,
}: {
  ranking: Ranking;
  topology: Topology;
  focusChip?: string;
}) {
  const [first, ...others] = ranking.candidates;
  if (!first) return null;
  const fWins = (c: RankedCandidate) => {
    const w = FAMILIES[topology].wins[c.format];
    return w ? w.charAt(0).toUpperCase() + w.slice(1) : undefined;
  };
  return (
    <section aria-label="Ranked candidates" className="results">
      <div className="hero-grid">
        <article className="best-card" aria-labelledby={`card-${first.format}`}>
          <div className="best-score">
            {first.score.toFixed(0)}
            <small> / 100</small>
          </div>
          <h2 id={`card-${first.format}`}>{FORMATS[first.format].name}</h2>
          <div className="facts-chips">
            {factsFor(first, focusChip).map((f) => (
              <span key={f.text} className={`fact${f.warn ? ' warn' : ''}`}>
                {f.text}
              </span>
            ))}
          </div>
          <FormatDetails c={first} topology={topology} label="See how the score is made" />
        </article>
        <div className="other-cards">
          {others.map((c) => (
            <article key={c.format} className="other-card" aria-labelledby={`card-${c.format}`}>
              <div className="other-head">
                <h3 id={`card-${c.format}`}>{FORMATS[c.format].name}</h3>
                <span className="other-score">{c.score.toFixed(0)}</span>
              </div>
              {fWins(c) && <p className="other-line">{fWins(c)}</p>}
              <FormatDetails c={c} topology={topology} label="Details" />
            </article>
          ))}
        </div>
      </div>
      {ranking.measureNotes.length > 0 && (
        <WarningList items={ranking.measureNotes.map((t) => ({ text: t, info: true, ref: REF.quantitative }))} />
      )}
      <p className="center-note">
        The score helps, you make the final call. No format is removed by one answer. <Ref to={REF.whatItIs}>Why</Ref>
      </p>
      {ranking.notes.length > 0 && (
        <details className="more">
          <summary>Layout tips for your answers</summary>
          <WarningList items={ranking.notes.map((n) => ({ text: n, info: true, ref: REF.intent }))} />
        </details>
      )}
    </section>
  );
}

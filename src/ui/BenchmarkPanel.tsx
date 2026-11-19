import { useRef, useState, type DragEvent } from 'react';
import { armsByFormat, deriveRun, displayLatencies, runWarnings, setWarnings } from '../framework/benchmark/criteria';
import type { ParsedRun } from '../framework/benchmark/parse';
import { quantityToBytes, type CasePreset, type Quantity } from '../framework/data/cases';
import { FORMATS } from '../framework/data/formats';
import { BENCHMARK_DOCS_URL, BENCHMARK_REPO_URL, REF } from '../framework/data/guide';
import { tierFit } from '../framework/data/tiers';
import { formatBytes } from '../framework/score';
import type { AnyFormatId, Tier } from '../framework/types';
import { Ref, WarningList } from './common';

export interface UploadError {
  fileName: string;
  error: string;
}

function q(x?: Quantity): string {
  return x ? `${x.value.toLocaleString('en-US')} ${x.unit}` : '—';
}

function HBars({ rows, unit }: { rows: { label: string; value: number }[]; unit: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || max <= 0) return null;
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.label} title={`${r.label}: ${unit(r.value)}`}>
          <span className="lbl">{r.label}</span>
          <div className="bar" style={{ width: `${(100 * r.value) / max}%` }} />
          <span className="num">{unit(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Histogram({ run }: { run: ParsedRun }) {
  const bins = run.profile?.histogram ?? [];
  if (!bins.length) return <p className="small muted">No histogram in this file.</p>;
  const max = Math.max(...bins.map((b) => b.count));
  return (
    <figure style={{ margin: 0 }}>
      <div className="hist" role="img" aria-label={`Object size histogram of ${run.armLabel}`}>
        {bins.map((b, i) => (
          <div
            key={i}
            style={{ height: `${(100 * b.count) / max}%` }}
            title={`${formatBytes(b.lower)} to ${formatBytes(b.upper)}: ${b.count} objects`}
          />
        ))}
      </div>
      <figcaption className="small muted">
        Object sizes, {formatBytes(bins[0]!.lower)} to {formatBytes(bins[bins.length - 1]!.upper)}. Hover a bar for the
        count.
      </figcaption>
    </figure>
  );
}

export function BenchmarkPanel({
  runs,
  errors,
  selection,
  tiers,
  preset,
  onFiles,
  onSelect,
  onClear,
}: {
  runs: ParsedRun[];
  errors: UploadError[];
  selection: Partial<Record<AnyFormatId, string>>;
  tiers: Tier[];
  preset: CasePreset | undefined;
  onFiles: (files: File[]) => void;
  onSelect: (format: AnyFormatId, runId: string) => void;
  onClear: () => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const arms = armsByFormat(runs);
  const derived = runs.map((r) => ({ run: r, d: deriveRun(r, tiers) }));
  const conds = runs.filter((r) => r.conditions.length > 0);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFiles([...e.dataTransfer.files]);
  };

  return (
    <section className="panel" aria-labelledby="bench-h">
      <h2 id="bench-h">
        <span className="step">Optional</span> Measurements
      </h2>
      <p className="small">
        When two candidates are close, measure them with{' '}
        <a href={BENCHMARK_REPO_URL} target="_blank" rel="noopener noreferrer">
          cng-formats-benchmark ↗
        </a>{' '}
        (<a href={BENCHMARK_DOCS_URL} target="_blank" rel="noopener noreferrer">documentation ↗</a>). Upload the{' '}
        <code>result.json</code> files of <code>cng-benchmark run --output</code>. <Ref to={REF.quantitative} />
      </p>

      {preset && preset.measurements.length > 0 && (
        <details open>
          <summary>Published measurements: {preset.title}</summary>
          <p className="small muted">
            Copied from the guide. The tier column applies your current tier policy to the published mean object size.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Arm</th>
                  <th>Unit measured</th>
                  <th className="num">Total</th>
                  <th className="num">Objects</th>
                  <th className="num">Mean object</th>
                  <th>Tier (guide)</th>
                  <th>Tier (your policy)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {preset.measurements.map((m) => {
                  const bytes = m.meanObjectSize ? quantityToBytes(m.meanObjectSize) : null;
                  const fit = bytes !== null && tiers.length ? tierFit(bytes, tiers) : null;
                  return (
                    <tr key={m.label + m.unit}>
                      <td>{m.label}</td>
                      <td>{m.unit}</td>
                      <td className="num">{q(m.totalSize)}</td>
                      <td className="num">{m.objectCount?.toLocaleString('en-US') ?? '—'}</td>
                      <td className="num">{q(m.meanObjectSize)}</td>
                      <td>{m.tierAsPublished ?? '—'}</td>
                      <td>{fit === null ? '—' : fit.length ? fit.join(', ') : 'none'}</td>
                      <td>{m.notes?.join(' ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preset.ref && (
            <p className="small">
              <Ref to={preset.ref} />
            </p>
          )}
        </details>
      )}

      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        style={{ marginTop: 12 }}
      >
        <span>Drop result.json files here, or</span>
        <button type="button" className="btn" onClick={() => input.current?.click()}>
          Choose files
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={(e) => {
            onFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <span className="small muted">The files stay in your browser. They are not sent anywhere and are not in the share link.</span>
      </div>

      {errors.length > 0 && (
        <ul className="small error" aria-live="polite">
          {errors.map((e, i) => (
            <li key={i}>
              <strong>{e.fileName}</strong>: {e.error}
            </li>
          ))}
        </ul>
      )}

      {runs.length > 0 && (
        <>
          <div className="field-row" style={{ marginTop: 12 }}>
            <h3 style={{ margin: 0 }}>Uploaded runs ({runs.length})</h3>
            <button type="button" className="btn" onClick={onClear}>
              Remove all
            </button>
          </div>
          <WarningList items={setWarnings(runs).map((t) => ({ text: t }))} />

          {(Object.entries(arms) as [AnyFormatId, ParsedRun[]][])
            .filter(([, list]) => list.length > 1)
            .map(([fmt, list]) => (
              <fieldset key={fmt} style={{ border: '1px solid var(--border)', borderRadius: 6, marginTop: 8 }}>
                <legend className="small">
                  <strong>{FORMATS[fmt].name}</strong>: two or more arms. Select the arm for the score.
                </legend>
                {list.map((r) => (
                  <label key={r.id} className="small" style={{ display: 'block' }}>
                    <input
                      type="radio"
                      name={`arm-${fmt}`}
                      checked={(selection[fmt] ?? list[0]!.id) === r.id}
                      onChange={() => onSelect(fmt, r.id)}
                    />{' '}
                    {r.armLabel}
                  </label>
                ))}
              </fieldset>
            ))}

          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Arm</th>
                  <th>Dataset</th>
                  <th className="num">Objects</th>
                  <th className="num">Total</th>
                  <th className="num">Mean</th>
                  <th className="num">p50</th>
                  <th>Tier fit</th>
                  <th className="num">Read p50</th>
                  <th className="num">Display</th>
                  <th className="num">Write</th>
                  <th className="num">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {derived.map(({ run, d }) => (
                  <tr key={run.id}>
                    <td>{run.armLabel}</td>
                    <td>{run.datasetId}</td>
                    <td className="num">{d.objectCount?.toLocaleString('en-US') ?? '—'}</td>
                    <td className="num">{d.totalBytes !== undefined ? formatBytes(d.totalBytes) : '—'}</td>
                    <td className="num">{d.meanObjectBytes !== undefined ? formatBytes(d.meanObjectBytes) : '—'}</td>
                    <td className="num">{d.p50ObjectBytes !== undefined ? formatBytes(d.p50ObjectBytes) : '—'}</td>
                    <td>{!tiers.length ? 'no policy' : d.meanObjectBytes === undefined ? '—' : d.tierFit.length ? d.tierFit.join(', ') : 'none'}</td>
                    <td className="num">{d.readLatencyP50 !== undefined ? `${d.readLatencyP50.toFixed(3)} s` : '—'}</td>
                    <td className="num">{d.displayLatency !== undefined ? `${d.displayLatency.toFixed(3)} s` : '—'}</td>
                    <td className="num">{d.writeThroughput !== undefined ? `${formatBytes(d.writeThroughput)}/s` : '—'}</td>
                    <td className="num">{d.compressionRatio !== undefined ? `${d.compressionRatio.toFixed(2)}x` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 12 }}>Total size</h3>
          <HBars
            rows={derived.filter(({ d }) => d.totalBytes !== undefined).map(({ run, d }) => ({ label: run.armLabel, value: d.totalBytes! }))}
            unit={formatBytes}
          />
          <h3>Mean object size</h3>
          <HBars
            rows={derived.filter(({ d }) => d.meanObjectBytes !== undefined).map(({ run, d }) => ({ label: run.armLabel, value: d.meanObjectBytes! }))}
            unit={formatBytes}
          />
          {tiers.length > 0 && (
            <p className="small muted">
              Tier floors: {tiers.map((t) => `${t.name} ${formatBytes(t.minObjectBytes)}`).join(', ')}.
            </p>
          )}

          {derived.map(({ run }) => {
            const warns = runWarnings(run);
            const disp = displayLatencies(run);
            return (
              <details key={run.id} style={{ marginTop: 8 }}>
                <summary className="small">
                  {run.armLabel}
                  {warns.length > 0 && ` (${warns.length} warning${warns.length > 1 ? 's' : ''})`}
                </summary>
                <WarningList items={warns.map((t) => ({ text: t }))} />
                <p className="small">
                  Format: {run.formatId} · codec: {run.codecs.join(', ') || '—'} · layouts: {run.layoutKinds.join(', ') || '—'} ·{' '}
                  {run.timestamp}
                </p>
                <Histogram run={run} />
                {disp.length > 0 && (
                  <>
                    <h4 className="small">Display latency per scenario</h4>
                    <HBars rows={disp} unit={(v) => `${v.toFixed(3)} s`} />
                  </>
                )}
              </details>
            );
          })}

          {conds.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary className="small">Run-protocol conditions (cold / warm, concurrency)</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Arm</th>
                      <th>Phase</th>
                      <th>Cache</th>
                      <th className="num">Workers</th>
                      <th className="num">Replicates</th>
                      <th>Aggregate (mean of replicates)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conds.flatMap((r) =>
                      r.conditions.map((c, i) => (
                        <tr key={`${r.id}-${i}`}>
                          <td>{r.armLabel}</td>
                          <td>{c.phase}</td>
                          <td>{c.cache}</td>
                          <td className="num">{c.concurrency}</td>
                          <td className="num">{c.replicates}</td>
                          <td>
                            {c.aggregate
                              .map((m) => `${m.name} ${m.value === null ? '—' : m.value.toFixed(3)}${m.unit ? ` ${m.unit}` : ''}`)
                              .join('; ')}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

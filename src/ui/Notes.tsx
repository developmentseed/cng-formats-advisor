import type { CasePreset } from '../framework/data/cases';
import { FORMATS } from '../framework/data/formats';
import { BENCHMARK_REPO_URL, FRAMEWORK_URL, GUIDE_BASE, REF } from '../framework/data/guide';
import { INTENTS, INTENT_LABEL } from '../framework/data/intents';
import {
  BENCHMARK_TERMS,
  CLOSE_MARGIN,
  ENCODING_TERM,
  FIT_SCALE,
  INTENT_FIT,
  INTENT_TERM_RULE,
  MATURITY_TERM,
  OBJECT_SIZE_TERM,
  type Fit,
} from '../framework/data/judgements';
import type { Cited, FormatId } from '../framework/types';
import { Ref, WarningList } from './common';

export function Preconditions() {
  return (
    <details className="panel">
      <summary>Before you start: preconditions P1 and P2</summary>
      <p className="small">
        <strong>P1. The format must support partial and parallel reads over HTTP.</strong> A reader loads the metadata
        in a single read, then fetches only the chunks or tiles that it needs with HTTP range requests.
      </p>
      <p className="small">
        <strong>P2. No opaque bundles.</strong> An archive is not disqualified just for being an archive: PMTiles has an
        internal directory. A zipped Zarr store, a LAZ file without COPC metadata, and a single Parquet file with no row
        groups fail: the client must fetch the whole object first.
      </p>
      <p className="small" style={{ marginBottom: 0 }}>
        Information only. <Ref to={REF.preconditions} />
      </p>
    </details>
  );
}

export function PresetOutcome({ preset, modified }: { preset: CasePreset; modified: boolean }) {
  return (
    <section className="panel" aria-labelledby="preset-out-h">
      <h2 id="preset-out-h">
        {preset.inGuide ? 'Where it lands in the guide' : 'About this preset'}
        {!preset.inGuide && <span className="badge">Not in the guide</span>}
      </h2>
      <p className="small muted">
        {preset.title} · {preset.product}
        {preset.sourceFormat && ` · source: ${preset.sourceFormat}`}
      </p>
      <p>
        <strong>{preset.outcome}</strong>
      </p>
      {modified && preset.inGuide && (
        <p className="small muted">You changed some inputs, so the ranking can differ from the guide.</p>
      )}
      <WarningList items={preset.cautions.map((t) => ({ text: t }))} />
      {preset.ref && (
        <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>
          <Ref to={preset.ref} />
        </p>
      )}
    </section>
  );
}

export function CrossCutting() {
  return (
    <details className="panel">
      <summary>Cross-cutting considerations</summary>
      <p className="small">These do not change which format you choose. They change how you implement it.</p>
      <ul className="small">
        <li>
          <strong>Metadata and cataloging.</strong> At tens of thousands to millions of files, collection-level discovery
          becomes critical. STAC has an essential role, but it is not a format and not a decision point.{' '}
          <Ref to={REF.metadata}>more</Ref>
        </li>
        <li>
          <strong>Within-format depth.</strong> Base codecs (ZSTD, Deflate), data types and scale-offset encoding, and
          sharding in Zarr v3. Check the data types each format supports. <Ref to={REF.withinFormat}>more</Ref>
        </li>
        <li>
          <strong>Multiscale and native mixed resolution.</strong> Overviews, levels of detail and multiscale pyramids
          interact with the grouping lever and with interpretation encoding. <Ref to={REF.multiscale}>more</Ref>
        </li>
        <li>
          <strong>Overviews before codecs.</strong> In the measured cases, a codec change moves the total by 0.3 % to 2 %.
          An overview pyramid adds 28 % to 34 %. <Ref to={REF.workedExamples}>more</Ref>
        </li>
      </ul>
    </details>
  );
}

function CitedRow({ name, c }: { name: string; c: Cited<unknown> }) {
  return (
    <tr>
      <td>{name}</td>
      <td>{String(c.value)}</td>
      <td>
        {c.why} <Ref to={c.ref}>source</Ref>
      </td>
    </tr>
  );
}

export function Method() {
  const formats = Object.keys(INTENT_FIT) as FormatId[];
  return (
    <details className="panel" id="method">
      <summary>How the score works, and the values to review</summary>
      <p className="small">
        The guide gives rules in words. The score needs numbers. The values below are our encoding of the guide text.
        Each value shows the guide text that supports it. Hover a cell of the matrix for the reason.
      </p>
      <h3>Intent-fit matrix (0 to 3)</h3>
      <ul className="small">
        {([3, 2, 1, 0] as Fit[]).map((f) => (
          <li key={f}>
            <strong>{f}</strong>: {FIT_SCALE[f]}
          </li>
        ))}
      </ul>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Format</th>
              {INTENTS.map((i) => (
                <th key={i} className="num">
                  {INTENT_LABEL[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {formats.map((f) => (
              <tr key={f}>
                <td>{FORMATS[f].name}</td>
                {INTENTS.map((i) => (
                  <td key={i} className="num" title={INTENT_FIT[f][i].why}>
                    <a href={INTENT_FIT[f][i].ref.url} target="_blank" rel="noopener noreferrer" aria-label={`${FORMATS[f].name}, ${INTENT_LABEL[i]}: ${INTENT_FIT[f][i].value}. ${INTENT_FIT[f][i].why}`}>
                      {INTENT_FIT[f][i].value}
                    </a>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary className="small">Reason for each cell</summary>
        <ul className="small">
          {formats.flatMap((f) =>
            INTENTS.map((i) => (
              <li key={`${f}-${i}`}>
                <strong>
                  {FORMATS[f].name} × {INTENT_LABEL[i]} = {INTENT_FIT[f][i].value}
                </strong>
                : {INTENT_FIT[f][i].why} <Ref to={INTENT_FIT[f][i].ref}>source</Ref>
              </li>
            )),
          )}
        </ul>
      </details>
      <h3 style={{ marginTop: 12 }}>Score rules</h3>
      <p className="small">
        Score = 100 × Σ(weight × value) / Σ(weight). Each value is between 0 and 1. A measured term with no data for a
        format is left out of its mean.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Value</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            <CitedRow name="Intent term" c={INTENT_TERM_RULE} />
            <CitedRow name="Maturity weight" c={MATURITY_TERM.weight} />
            <CitedRow name="Maturity penalty per level below your limit" c={MATURITY_TERM.penaltyPerLevel} />
            <CitedRow name="Maturity not rated" c={MATURITY_TERM.notRated} />
            <CitedRow name="Encoding weight, low" c={ENCODING_TERM.weight.low} />
            <CitedRow name="Encoding weight, medium" c={ENCODING_TERM.weight.medium} />
            <CitedRow name="Encoding weight, high" c={ENCODING_TERM.weight.high} />
            <CitedRow name="Encoding value, first-class" c={ENCODING_TERM.value['first-class']} />
            <CitedRow name="Encoding value, CRS only" c={ENCODING_TERM.value['crs-only']} />
            <CitedRow name="Encoding not rated" c={ENCODING_TERM.notRated} />
            <CitedRow name="Object-size weight" c={OBJECT_SIZE_TERM.weight} />
            <CitedRow name="Object-size value" c={OBJECT_SIZE_TERM.rule} />
            <CitedRow name="Measured criteria" c={BENCHMARK_TERMS.rule} />
            <CitedRow name="Measured criteria, default weight" c={BENCHMARK_TERMS.defaultWeight} />
            <CitedRow name="Close margin (points)" c={CLOSE_MARGIN} />
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>
          This dashboard applies the{' '}
          <a href={FRAMEWORK_URL} target="_blank" rel="noopener noreferrer">
            format selection decision framework
          </a>{' '}
          of the{' '}
          <a href={GUIDE_BASE} target="_blank" rel="noopener noreferrer">
            Cloud-Optimized Geospatial Formats Guide
          </a>
          . Measurements:{' '}
          <a href={BENCHMARK_REPO_URL} target="_blank" rel="noopener noreferrer">
            cng-formats-benchmark
          </a>
          .
        </p>
        <p>
          The framework was developed as part of a study for the Centre National d'Études Spatiales (CNES), carried out by
          Development Seed. It builds on earlier work in the guide supported by NASA IMPACT (now NASA ODSI).
        </p>
        <p>
          This site uses Plausible analytics. Uploaded files stay in your browser and are not sent anywhere.
        </p>
        <p>
          <a href="https://github.com/developmentseed/cng-formats-advisor" target="_blank" rel="noopener noreferrer">
            Source code (MIT)
          </a>
        </p>
      </div>
    </footer>
  );
}

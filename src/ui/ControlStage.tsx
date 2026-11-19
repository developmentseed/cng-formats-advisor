import { PARSER_FORMATS, PARSER_LABEL, VIRTUAL_TEST_TEXT, visibleQuestions } from '../framework/control';
import { REF } from '../framework/data/guide';
import { OUTCOME_LABEL, QUESTION_LABEL } from '../framework/summary';
import type { Answer, ControlAnswers, ControlOutcome, ParserFormat } from '../framework/types';
import { Ref, WarningList, YesNo } from './common';

const HELP: Partial<Record<keyof ControlAnswers, string>> = {
  existingData: 'Do the data already exist, or are you designing a new product?',
  mandate: 'A requirement to keep a specific archival format, such as HDF5, netCDF or GRIB.',
  canReprocess: 'You have the processor, the inputs and the budget to run the production chain again, and you are allowed to.',
  canRepackage:
    'You cannot run the chain again, but you may rewrite the delivered files (a byte-level rewrite: the values are not computed again).',
  existingUsers: 'Advisory only. It does not change the outcome or the score.',
};

const SOURCE_OPTIONS: ParserFormat[] = [...PARSER_FORMATS, 'other'];

export function ControlStage({
  answers,
  outcome,
  onChange,
}: {
  answers: ControlAnswers;
  outcome: ControlOutcome;
  onChange: (a: ControlAnswers) => void;
}) {
  const qs = visibleQuestions(answers);
  const set = (k: keyof ControlAnswers, v: Answer) => onChange({ ...answers, [k]: v });

  return (
    <div>

      {qs.map((k) => {
        const isVirtual = k === 'chunkedInternally' || k === 'workableChunkSize' || k === 'sourceFormat';
        const label =
          k === 'chunkedInternally'
            ? VIRTUAL_TEST_TEXT.chunked.question
            : k === 'workableChunkSize'
              ? VIRTUAL_TEST_TEXT['chunk-size'].question
              : k === 'sourceFormat'
                ? VIRTUAL_TEST_TEXT.parser.question
                : QUESTION_LABEL[k];
        return (
          <div className="field" key={k}>
            {k === 'chunkedInternally' && (
              <p className="small muted" style={{ margin: 0 }}>
                Can you virtualize? Three tests, in order.
              </p>
            )}
            <div className="field-row">
              <span className="label" id={`q-${k}`}>
                {isVirtual && '· '}
                {label}
              </span>
              {k === 'sourceFormat' ? (
                <select
                  aria-labelledby={`q-${k}`}
                  value={answers.sourceFormat ?? ''}
                  onChange={(e) =>
                    onChange({ ...answers, sourceFormat: e.target.value ? (e.target.value as ParserFormat) : null })
                  }
                >
                  <option value="">Select the source format</option>
                  {SOURCE_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {PARSER_LABEL[f]}
                    </option>
                  ))}
                </select>
              ) : (
                <YesNo label={label} value={answers[k] as Answer} onChange={(v) => set(k, v)} />
              )}
            </div>
            {HELP[k] && <span className="small muted">{HELP[k]}</span>}
          </div>
        );
      })}

      {outcome.kind !== 'incomplete' && <OutcomeBox outcome={outcome} answers={answers} />}
    </div>
  );
}

/** The Stage 1 outcome, with what is missing and the notes. */
export function OutcomeBox({ outcome, answers }: { outcome: ControlOutcome; answers: ControlAnswers }) {
  return (
      <div
      className={`outcome${outcome.kind === 'not-yet-possible' ? ' blocked' : ''}`}
      role="status"
      aria-live="polite"
    >
      <strong>{OUTCOME_LABEL[outcome.kind]}</strong>
      {outcome.missing.length > 0 && (
        <>
          <p className="small" style={{ marginTop: 6 }}>
            What is missing:
          </p>
          <ul className="small">
            {outcome.missing.map((m) => (
              <li key={m}>{VIRTUAL_TEST_TEXT[m].missing}</li>
            ))}
          </ul>
        </>
      )}
      {outcome.notes.length > 0 && (
        <WarningList items={outcome.notes.map((n) => ({ text: n, info: true }))} />
      )}
      {outcome.kind !== 'incomplete' && (
        <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>
          <Ref to={outcome.ref} />
          {outcome.kind === 'not-yet-possible' && (
            <>
              {' '}
              · <Ref to={REF.case6} />
            </>
          )}
          {answers.existingUsers && (
            <>
              {' '}
              · <Ref to={REF.existingUsers} />
            </>
          )}
        </p>
      )}
    </div>
  );
}

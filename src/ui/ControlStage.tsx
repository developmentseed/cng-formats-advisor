import { PARSER_FORMATS, PARSER_LABEL, VIRTUAL_TEST_TEXT, visibleQuestions } from '../framework/control';
import { REF } from '../framework/data/guide';
import { OUTCOME_LABEL, QUESTION_LABEL } from '../framework/summary';
import type { Answer, ControlAnswers, ControlOutcome, ParserFormat } from '../framework/types';
import { Ref, WarningList } from './common';

const HELP: Partial<Record<keyof ControlAnswers, string>> = {
  existingData: 'Or are you designing a new product?',
  mandate: 'A rule to keep an archival format, such as HDF5, netCDF or GRIB.',
  canReprocess: 'You have the processor, the inputs and the budget to run the production chain again, and you are allowed to.',
  canRepackage: 'You may rewrite the delivered files. The values are not computed again.',
  existingUsers: 'Optional. It adds advice, and does not change the result.',
};

const SOURCE_OPTIONS: ParserFormat[] = [...PARSER_FORMATS, 'other'];

/** Full questions for the one-question layout. */
const QUESTION: Partial<Record<keyof ControlAnswers, string>> = {
  existingData: 'Do the data already exist?',
  mandate: 'Must you keep an archival format?',
  canReprocess: 'Can you reprocess the data?',
  canRepackage: 'Can you repackage the delivered files?',
  existingUsers: 'Do people already read the data with their own tools?',
};

function label(k: keyof ControlAnswers): string {
  if (QUESTION[k]) return QUESTION[k]!;
  if (k === 'chunkedInternally') return VIRTUAL_TEST_TEXT.chunked.question;
  if (k === 'workableChunkSize') return VIRTUAL_TEST_TEXT['chunk-size'].question;
  if (k === 'sourceFormat') return VIRTUAL_TEST_TEXT.parser.question;
  return QUESTION_LABEL[k];
}

function answerText(a: ControlAnswers, k: keyof ControlAnswers): string {
  const v = a[k];
  if (k === 'sourceFormat') return v ? PARSER_LABEL[v as ParserFormat].split(' (')[0]! : '';
  return v ? 'Yes' : 'No';
}

/** Stage 1: one question at a time. Answered questions shrink to one line with a "Change" link. */
export function ControlStage({
  answers,
  outcome,
  onChange,
}: {
  answers: ControlAnswers;
  outcome: ControlOutcome;
  onChange: (a: ControlAnswers) => void;
}) {
  const path = visibleQuestions(answers).filter((k) => k !== 'existingUsers');
  const current = outcome.kind === 'incomplete' ? (path.find((k) => answers[k] === null) ?? null) : null;
  const answered = [...path, 'existingUsers' as const].filter((k) => answers[k] !== null);
  const askUsers = outcome.kind !== 'incomplete' && answers.existingUsers === null;
  const set = (k: keyof ControlAnswers, v: Answer | ParserFormat | null) => onChange({ ...answers, [k]: v });

  return (
    <div className="control">
      {answered.length > 0 && (
        <ul className="answered" aria-label="Your answers">
          {answered.map((k) => (
            <li key={k}>
              <span className="answered-q">{label(k)}</span>
              <span className="answered-a">{answerText(answers, k)}</span>
              <button type="button" className="link-btn small" onClick={() => set(k, null)}>
                Change
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && (
        <div className="question" key={current}>
          {current === 'chunkedInternally' && <p className="eyebrow">Can you virtualize? Three tests, in order</p>}
          <h2 className="question-title" id={`q-${current}`}>
            {label(current)}
          </h2>
          {HELP[current] && <p className="question-help">{HELP[current]}</p>}
          {current === 'sourceFormat' ? (
            <div className="choice-tiles six" role="group" aria-labelledby={`q-${current}`}>
              {SOURCE_OPTIONS.map((f) => (
                <button key={f} type="button" className="choice-tile" onClick={() => set('sourceFormat', f)}>
                  <b>{PARSER_LABEL[f].split(' (')[0]}</b>
                  {f === 'other' && <span>HDF4, encrypted, no parser</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="choice-tiles two" role="group" aria-labelledby={`q-${current}`}>
              <button type="button" className="choice-tile" onClick={() => set(current, true)}>
                <b>Yes</b>
              </button>
              <button type="button" className="choice-tile" onClick={() => set(current, false)}>
                <b>No</b>
              </button>
            </div>
          )}
        </div>
      )}

      {outcome.kind !== 'incomplete' && <OutcomeBox outcome={outcome} answers={answers} />}

      {askUsers && (
        <div className="question optional">
          <h2 className="question-title small-q" id="q-existingUsers">
            {label('existingUsers')}
          </h2>
          <p className="question-help">{HELP.existingUsers}</p>
          <div className="chips" role="group" aria-labelledby="q-existingUsers">
            <button type="button" className="chip" onClick={() => set('existingUsers', true)}>
              Yes
            </button>
            <button type="button" className="chip" onClick={() => set('existingUsers', false)}>
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The Stage 1 outcome, with what is missing and the notes. */
export function OutcomeBox({ outcome, answers }: { outcome: ControlOutcome; answers: ControlAnswers }) {
  return (
    <div className={`outcome${outcome.kind === 'not-yet-possible' ? ' blocked' : ''}`} role="status" aria-live="polite">
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
      {outcome.notes.length > 0 && <WarningList items={outcome.notes.map((n) => ({ text: n, info: true }))} />}
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

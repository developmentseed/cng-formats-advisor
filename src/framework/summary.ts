/** The "Copy summary" Markdown: the decision path and the ranking. */
import { FAMILIES } from './data/families';
import { FORMATS } from './data/formats';
import { FRAMEWORK_URL } from './data/guide';
import { INTENTS, INTENT_LABEL } from './data/intents';
import { getCase } from './data/cases';
import { PARSER_LABEL, VIRTUAL_TEST_TEXT } from './control';
import type { AppState } from './state';
import type { ControlAnswers, ControlOutcome, Ranking } from './types';

export const OUTCOME_LABEL: Record<ControlOutcome['kind'], string> = {
  incomplete: 'Not complete: answer the next question',
  free: 'Free choice: go to the topology question',
  mandate: 'Archival-format mandate: optimize the mandated format and publish a cloud-optimized copy',
  repackage: 'Repackage: format free, content fixed as delivered',
  virtual: 'Virtual Zarr (VirtualiZarr / Kerchunk / Icechunk): limited, better than nothing',
  'not-yet-possible': 'Not yet possible: say what is missing',
};

export const QUESTION_LABEL: Record<keyof ControlAnswers, string> = {
  existingData: 'Existing data?',
  mandate: 'Archival-format mandate?',
  canReprocess: 'Can you reprocess?',
  canRepackage: 'Can you repackage the delivered files?',
  chunkedInternally: 'Is the data chunked internally?',
  workableChunkSize: 'Are those chunks a workable size?',
  sourceFormat: 'Source format (is there a parser?)',
  existingUsers: 'Existing users and tools?',
};

function answerText(a: ControlAnswers, k: keyof ControlAnswers): string | null {
  const v = a[k];
  if (v === null) return null;
  if (k === 'sourceFormat') return PARSER_LABEL[v as keyof typeof PARSER_LABEL];
  return v ? 'Yes' : 'No';
}

export function buildSummary(
  s: AppState,
  control: ControlOutcome,
  ranking: Ranking | null,
  shareUrl: string,
): string {
  const lines: string[] = ['# Format selection summary', ''];
  const preset = s.preset ? getCase(s.preset) : undefined;
  if (preset) lines.push(`Preset: ${preset.title}${preset.inGuide ? '' : ' (not in the guide)'}`, '');

  lines.push('## Stage 1: control', '');
  for (const k of Object.keys(QUESTION_LABEL) as (keyof ControlAnswers)[]) {
    const t = answerText(s.answers, k);
    if (t !== null) lines.push(`- ${QUESTION_LABEL[k]} ${t}`);
  }
  lines.push(`- **Outcome:** ${OUTCOME_LABEL[control.kind]}`);
  for (const m of control.missing) lines.push(`  - Missing: ${VIRTUAL_TEST_TEXT[m].missing}`);
  for (const n of control.notes) lines.push(`  - ${n}`);
  lines.push('');

  if (ranking && s.topology) {
    lines.push('## Stage 2: topology and refinements', '');
    lines.push(`- Topology: ${FAMILIES[s.topology].label}`);
    lines.push(`- Intent weights (0-3): ${INTENTS.map((i) => `${INTENT_LABEL[i]} ${s.intentWeights[i]}`).join(', ')}`);
    lines.push(`- Lowest maturity accepted: L${s.minMaturity}`);
    lines.push(`- Interpretation encoding importance: ${s.encodingImportance}`);
    lines.push(
      `- Tier policy: ${s.tierPolicy.kind === 'none' ? 'none' : s.tierPolicy.tiers.map((t) => `${t.name} >= ${(t.minObjectBytes / 1048576).toFixed(0)} MiB`).join(', ')}`,
    );
    lines.push('', '| Rank | Format | Score | Warnings |', '| --- | --- | --- | --- |');
    for (const c of ranking.candidates) {
      const w = c.warnings.map((x) => x.text.replace(/\|/g, '/')).join(' ');
      lines.push(`| ${c.rank} | ${FORMATS[c.format].name} | ${c.score.toFixed(0)} | ${w} |`);
    }
    lines.push('');
    if (ranking.close) lines.push('The two first candidates are close. Measure them before you decide.', '');
  }
  lines.push(
    'The score is a help, not a verdict: you make the final call.',
    '',
    `Decision framework: ${FRAMEWORK_URL}`,
    `This decision: ${shareUrl}`,
  );
  return lines.join('\n');
}

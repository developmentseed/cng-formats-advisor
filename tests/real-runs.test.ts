/**
 * Optional check against real benchmark output: set CNG_RUNS_DIR to a folder
 * that holds result.json files from `cng-benchmark run --output`. Every file
 * must parse, and every roll-up must give an object profile.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveRun } from '../src/framework/benchmark/criteria';
import { parseBenchmarkText } from '../src/framework/benchmark/parse';
import { CNES_TIERS } from '../src/framework/data/tiers';

const dir = process.env.CNG_RUNS_DIR;

describe.skipIf(!dir || !existsSync(dir))('real benchmark runs', () => {
  it('every result.json parses, and roll-ups have an object profile', () => {
    const files = execFileSync('find', [dir!, '-name', 'result.json']).toString().trim().split('\n').filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    const errors: string[] = [];
    for (const f of files) {
      for (const r of parseBenchmarkText(readFileSync(f, 'utf8'), f)) {
        if (!r.ok) {
          errors.push(`${f}: ${r.error}`);
          continue;
        }
        if (r.run.scope === 'rollup') {
          const d = deriveRun(r.run, CNES_TIERS);
          if (d.meanObjectBytes === undefined) errors.push(`${f}: roll-up with no object profile`);
          const ratio = r.run.compressionRatio;
          if (ratio !== undefined && !(Number.isFinite(ratio) && ratio > 0)) {
            errors.push(`${f}: compression ratio ${ratio} is not a positive number`);
          }
        }
      }
    }
    expect(errors).toEqual([]);
  });
});

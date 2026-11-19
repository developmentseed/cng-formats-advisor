#!/usr/bin/env node
/**
 * Extract compact copies of the benchmark runs behind the case studies.
 *
 * Usage: node scripts/extract-runs.mjs <runs-dir>
 *   <runs-dir>: the folder with the cng-formats-benchmark outputs
 *   (for example cnes-cng-study/deliverables/D3-benchmarks/testbed/runs/scaleway).
 *
 * Reads scripts/runs-manifest.json and writes public/runs/<case>.json: a list
 * of BenchmarkRun objects that the app parses like an uploaded result.json.
 *
 * Kept: object profile and histogram, metrics, condition aggregates, codecs,
 * compression ratio, the run parameters that describe the layout.
 * Dropped: product ids and selection patterns, per-object layouts (aggregated
 * per kind and codec), raw replicate timings (only their count is kept).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runsDir = process.argv[2];
if (!runsDir) {
  console.error('Usage: node scripts/extract-runs.mjs <runs-dir>');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(root, 'scripts', 'runs-manifest.json'), 'utf8'));
const KEEP_PARAMS = ['scope', 'product_count', 'codec', 'multiscale_levels', 'chunk_shape', 'shard_shape', 'block_size', 'scale_offset', 'grouping_lever'];
const FLAGS = ['content_subset', 'geometry_fabricated', 'geometry_synthesized'];

function aggregateLayouts(layouts) {
  const groups = new Map();
  for (const l of layouts) {
    const key = `${l.kind}|${l.codec ?? ''}`;
    const g = groups.get(key) ?? { kind: l.kind, name: `${l.kind} (${l.codec ?? 'no codec'})`, codec: l.codec, size_bytes: 0, raw_bytes: 0, rated_bytes: 0, layout_count: 0 };
    g.size_bytes += l.size_bytes ?? 0;
    g.layout_count += 1;
    if (typeof l.compression_ratio === 'number' && l.compression_ratio > 0) {
      g.rated_bytes += l.size_bytes ?? 0;
      g.raw_bytes += (l.size_bytes ?? 0) * l.compression_ratio;
    }
    for (const f of FLAGS) if (l[f] === true) g[f] = true;
    groups.set(key, g);
  }
  return [...groups.values()].map(({ raw_bytes, rated_bytes, ...g }) => ({
    ...g,
    ...(rated_bytes > 0 ? { compression_ratio: Number((raw_bytes / rated_bytes).toFixed(4)) } : {}),
  }));
}

mkdirSync(join(root, 'public', 'runs'), { recursive: true });
for (const [caseId, entries] of Object.entries(manifest.cases)) {
  const out = entries.map(({ path, label }) => {
    const d = JSON.parse(readFileSync(join(runsDir, path), 'utf8'));
    const params = Object.fromEntries(Object.entries(d.params ?? {}).filter(([k]) => KEEP_PARAMS.includes(k)));
    const [benchmark, stamp] = path.split('/').slice(1, 3);
    return {
      timestamp: d.timestamp,
      tool_versions: d.tool_versions ?? {},
      dataset_id: d.dataset_id,
      format_id: d.format_id,
      params: { ...params, arm_label: label, source: `${manifest.source}: ${benchmark}, ${stamp}` },
      object_profile: d.object_profile ?? null,
      object_layouts: aggregateLayouts(d.object_layouts ?? []),
      metrics: d.metrics ?? [],
      artifacts: [],
      conditions: (d.conditions ?? []).map((c) => ({
        phase: c.phase,
        cache: c.cache,
        concurrency: c.concurrency,
        replicates: (c.replicates ?? []).map((r) => ({ index: r.index, metrics: [] })),
        aggregate: (c.aggregate ?? []).map((m) => ({ name: m.name, value: m.value, unit: m.unit ?? null, detail: {} })),
      })),
    };
  });
  const file = join(root, 'public', 'runs', `${caseId}.json`);
  writeFileSync(file, JSON.stringify(out) + '\n');
  console.log(`${file}: ${out.length} runs, ${Math.round(JSON.stringify(out).length / 1024)} KB`);
}

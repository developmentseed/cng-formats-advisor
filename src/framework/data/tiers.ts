import type { Tier, TierPolicy } from '../types';

const MiB = 1024 * 1024;

/**
 * The CNES Datalake example of the guide: about 32 MB mean object size for the
 * warm tier on disk, about 100 MB for the cold tier on tape. The thresholds in
 * bytes are the values of the cng-formats-benchmark configs (32 MiB, 100 MiB).
 * These floors are advisory. They are an example, not a general rule.
 */
export const CNES_TIERS: Tier[] = [
  { name: 'warm', minObjectBytes: 32 * MiB },
  { name: 'cold', minObjectBytes: 100 * MiB },
];

export const NO_TIER_POLICY: TierPolicy = { kind: 'none', tiers: [] };
export const CNES_TIER_POLICY: TierPolicy = { kind: 'cnes', tiers: CNES_TIERS };

/** The names of the tiers that a mean object size satisfies (same rule as tiers.py). */
export function tierFit(meanObjectBytes: number, tiers: Tier[]): string[] {
  return tiers.filter((t) => meanObjectBytes >= t.minObjectBytes).map((t) => t.name);
}

/** The coldest tier that a mean object size satisfies, or null. */
export function highestTier(meanObjectBytes: number, tiers: Tier[]): string | null {
  const ok = tiers.filter((t) => meanObjectBytes >= t.minObjectBytes);
  if (ok.length === 0) return null;
  return ok.reduce((a, b) => (b.minObjectBytes > a.minObjectBytes ? b : a)).name;
}

/** Sort tiers from the smallest threshold to the largest and drop invalid ones. */
export function normalizeTiers(tiers: Tier[]): Tier[] {
  return tiers
    .filter((t) => t.name.trim() !== '' && Number.isFinite(t.minObjectBytes) && t.minObjectBytes > 0)
    .slice()
    .sort((a, b) => a.minObjectBytes - b.minObjectBytes);
}

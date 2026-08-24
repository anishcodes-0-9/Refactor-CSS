import type { Evidence, SelectorDefinition } from '../domain/index.js';
import type { SelectorRecord } from './types.js';

/**
 * Pure join: SelectorDefinition[] x Evidence[] -> SelectorRecord[], keyed by
 * the normalized class name (B4). Sorted by key for determinism (I8).
 *
 * The index is built from definition keys: a SelectorRecord exists for
 * every key with >=1 SelectorDefinition. Evidence for a key with no
 * matching definition (e.g. a typo, or a class defined in a file M1 does
 * not parse) simply does not join to anything in M1 — no diagnostic is
 * raised for it; that is out of M1 scope.
 *
 * No sinks exist yet (M1 has no dynamic/pattern/opaque extraction), so
 * referenceStatus is only ever REFERENCED (>=1 exact reference) or
 * UNREFERENCED (zero) — REFERENCED_DYNAMICALLY is unreachable until a
 * pattern-sink-producing extractor lands.
 */
export function buildIndex(definitions: SelectorDefinition[], evidence: Evidence[]): SelectorRecord[] {
  const byKey = new Map<string, SelectorDefinition[]>();
  for (const definition of definitions) {
    const existing = byKey.get(definition.key);
    if (existing) existing.push(definition);
    else byKey.set(definition.key, [definition]);
  }

  const evidenceByKey = new Map<string, Evidence[]>();
  for (const item of evidence) {
    if (item.key === null) continue;
    const existing = evidenceByKey.get(item.key);
    if (existing) existing.push(item);
    else evidenceByKey.set(item.key, [item]);
  }

  const records: SelectorRecord[] = [];
  for (const [key, keyDefinitions] of byKey) {
    const references = (evidenceByKey.get(key) ?? []).filter((item) => item.resolution === 'exact');
    records.push({
      key,
      definitions: keyDefinitions,
      references,
      referenceStatus: references.length > 0 ? 'REFERENCED' : 'UNREFERENCED',
    });
  }

  records.sort((a, b) => a.key.localeCompare(b.key));
  return records;
}

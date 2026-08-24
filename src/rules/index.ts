import type { Evidence, Finding } from '../domain/index.js';
import type { SelectorRecord } from '../index/types.js';

const BASE_CAVEAT = 'runtime, CMS, and backend-template consumers are not analyzed';

/**
 * The only v0.1 rule (ADR-001 §4.4), M1 slice: `unreferenced-selector`.
 *
 * M1 preconditions actually evaluated: referenceStatus === 'UNREFERENCED',
 * and every definition for the key has scope === 'global' (B15's safety
 * boundary — a key with even one 'css-module' definition is skipped
 * entirely, conservatively, rather than risk a global/module key
 * collision producing a finding neither side actually earned). The other
 * §4.4 preconditions (nature === 'CLASS', ownership === 'APPLICATION',
 * config.protectedSelectors, css-annotation protect) are not separately
 * checked here because M1's upstream extractors make them trivially,
 * structurally true: css/ only ever emits nature 'CLASS' + ownership
 * 'APPLICATION' definitions (see src/css/index.ts), and no
 * config/annotation machinery exists yet to protect anything. I2
 * therefore still holds — it just holds one layer upstream of this
 * function in M1, not by a redundant check here. Sinks (opaque-sink
 * caveat, DELETE->BLOCKED on html-injection) and B16 namespace caveats
 * are both out of M1 scope — no sink-producing extractor exists yet, so
 * risk is always 'REVIEW', never 'BLOCKED'.
 *
 * Evidence cited on the finding is the selector's own definition site(s)
 * — the only real, non-fabricated provenance available for "why do we
 * believe this selector is unreferenced" (there is, by definition, no
 * reference evidence for an UNREFERENCED selector). This never claims
 * usage; it only proves the selector exists and where.
 */
export function applyRules(records: SelectorRecord[]): Finding[] {
  const findings: Finding[] = [];

  for (const record of records) {
    if (record.referenceStatus !== 'UNREFERENCED') continue;
    if (!record.definitions.every((d) => d.scope === 'global')) continue;

    const evidence: Evidence[] = record.definitions.map((definition) => ({
      key: definition.key,
      kind: 'css-selector-definition',
      resolution: 'exact',
      loc: definition.loc,
      snippet: definition.rawSelector,
      extractor: 'rules',
    }));

    const caveats = [BASE_CAVEAT];
    if (record.definitions.length > 1) {
      const locs = record.definitions.map((d) => `${d.loc.file}:${d.loc.line}:${d.loc.column}`).join(', ');
      caveats.push(`defined in ${record.definitions.length} places: ${locs}`);
    }

    findings.push({
      rule: 'unreferenced-selector',
      key: record.key,
      operation: 'DELETE',
      risk: 'REVIEW',
      evidence,
      caveats,
    });
  }

  findings.sort((a, b) => a.risk.localeCompare(b.risk) || a.key.localeCompare(b.key));
  return findings;
}

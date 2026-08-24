import type { Diagnostic, Finding } from '../domain/index.js';
import type { SelectorRecord } from '../index/types.js';
import { VERSION } from '../version.js';
import type { Coverage, Report } from './types.js';

export function buildReport(
  root: string,
  selectors: SelectorRecord[],
  findings: Finding[],
  coverage: Coverage,
  diagnostics: Diagnostic[],
): Report {
  return {
    schemaVersion: 1,
    tool: { name: 'refactor-css', version: VERSION },
    root,
    coverage,
    selectors,
    findings,
    diagnostics,
  };
}

function locString(loc: { file: string; line: number; column: number }): string {
  return `${loc.file}:${loc.line}:${loc.column}`;
}

/**
 * ADR-001 §6's per-selector terminal layout. Column widths are cosmetic
 * and not covered by any test — only the fixture's semantic result
 * (selectors/findings, checked via JSON in test/fixtures.test.ts) is a
 * contractual output in M1.
 *
 * `durationMs` is accepted as a separate, optional display-only argument
 * — never read from `report`, since Report itself carries no timing
 * (timing is telemetry, not analysis output; see report/types.ts).
 */
export function renderTerminal(report: Report, options: { durationMs?: number } = {}): string {
  const findingsByKey = new Map<string, Finding[]>();
  for (const finding of report.findings) {
    const existing = findingsByKey.get(finding.key);
    if (existing) existing.push(finding);
    else findingsByKey.set(finding.key, [finding]);
  }

  const blocks: string[] = [];
  for (const record of report.selectors) {
    const lines: string[] = [`.${record.key}`, `  Status      ${record.referenceStatus}`];

    const evidenceLines: string[] = [];
    for (const reference of record.references) {
      evidenceLines.push(
        `${locString(reference.loc)} ${reference.snippet} (${reference.kind}, ${reference.resolution})`,
      );
    }
    for (const definition of record.definitions) {
      evidenceLines.push(`${locString(definition.loc)} ${definition.rawSelector} (css-selector-definition)`);
    }
    evidenceLines.forEach((line, i) => {
      lines.push(`  ${i === 0 ? 'Evidence    ' : '            '}${line}`);
    });

    const keyFindings = findingsByKey.get(record.key) ?? [];
    if (keyFindings.length === 0) {
      lines.push('  Findings    none');
    } else {
      for (const finding of keyFindings) {
        lines.push(`  Finding     ${finding.rule} · ${finding.operation} · ${finding.risk}`);
        lines.push(`  Caveats     ${finding.caveats.join('; ')}`);
      }
    }

    blocks.push(lines.join('\n'));
  }

  const c = report.coverage;
  const durationSuffix = options.durationMs === undefined ? '' : ` · ${options.durationMs}ms`;
  const coverageLine =
    `Coverage      ${c.filesScanned} files scanned · ${c.filesFailed} failed · ` +
    `${c.opaqueSinks} opaque sinks · ${c.patternSinks} pattern sinks · ` +
    `${c.duplicateDefinitionKeys} duplicate keys · ${c.cssModuleSelectorsExcluded} module selectors excluded` +
    durationSuffix;

  return `${blocks.join('\n\n')}\n\n${coverageLine}\n`;
}

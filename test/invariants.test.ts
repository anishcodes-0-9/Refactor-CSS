import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/index.js';
import { buildIndex } from '../src/index/index.js';
import { extractSource } from '../src/source/index.js';
import type { SelectorDefinition } from '../src/domain/index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(repoRoot, 'fixtures/01-static-class');

/**
 * ADR-001 §5's executable safety contract, run across every fixture.
 * M1's Definition of done (§6) activated only I6, I8, I11. M2A adds the
 * first truthfully-enforceable slice of I10 (the opaque half only —
 * source/index.ts now produces real opaque Evidence for an unresolved
 * ternary/`&&` branch, so `key === null` is a real, checkable claim for
 * the first time). I10's pattern half, I1-I5, I7, and I9 remain deferred:
 * no pattern Evidence exists yet (M2B), and no rule/risk/BLOCKED logic
 * changed in M2A.
 */
describe('invariants', () => {
  it('I6: every finding has non-empty evidence, and every SourceLocation resolves to a real file in the fixture', () => {
    const report = analyze(fixtureRoot);
    expect(report.findings.length).toBeGreaterThan(0);

    for (const finding of report.findings) {
      expect(finding.evidence.length).toBeGreaterThan(0);
      for (const evidence of finding.evidence) {
        const absolute = path.join(fixtureRoot, evidence.loc.file);
        expect(existsSync(absolute)).toBe(true);
        const content = readFileSync(absolute, 'utf8');
        const lines = content.split('\n');
        expect(evidence.loc.line).toBeGreaterThanOrEqual(1);
        expect(evidence.loc.line).toBeLessThanOrEqual(lines.length);
      }
    }
  });

  it('I8: running analyze twice on the same input produces byte-identical JSON', () => {
    // Report carries no timing or other non-reproducible field (see
    // report/types.ts) — no normalization or field exclusion is needed.
    const first = JSON.stringify(analyze(fixtureRoot));
    const second = JSON.stringify(analyze(fixtureRoot));
    expect(first).toBe(second);
  });

  it('I11: a key with definitions.length > 1 is never dropped, merged, or excluded from the index', () => {
    const definitions: SelectorDefinition[] = [
      {
        key: 'dup',
        rawSelector: '.dup',
        nature: 'CLASS',
        scope: 'global',
        loc: { file: 'a.css', line: 1, column: 1 },
        stylesheet: 'a.css',
        ownership: 'APPLICATION',
        contentHash: 'hash-a',
      },
      {
        key: 'dup',
        rawSelector: '.dup',
        nature: 'CLASS',
        scope: 'global',
        loc: { file: 'b.css', line: 5, column: 1 },
        stylesheet: 'b.css',
        ownership: 'APPLICATION',
        contentHash: 'hash-b',
      },
    ];

    const records = buildIndex(definitions, []);
    expect(records).toHaveLength(1);
    expect(records[0]?.definitions).toHaveLength(2);
    expect(records[0]?.definitions.map((d) => d.stylesheet)).toEqual(['a.css', 'b.css']);
  });

  it('I10 (opaque half): every Evidence with resolution "opaque" has key === null', () => {
    const content = 'const x = <div className={active ? "hero" : getClassName()} />;';
    const evidence = extractSource('x.tsx', content);
    const opaque = evidence.filter((e) => e.resolution === 'opaque');

    expect(opaque.length).toBeGreaterThan(0);
    for (const item of opaque) expect(item.key).toBeNull();
  });
});

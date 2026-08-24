import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface ExpectedFixture {
  selectors: { key: string; referenceStatus: string }[];
  findings: { rule: string; key: string; operation: string; risk: string }[];
}

/**
 * The M1 vertical-slice proof (ADR-001 §6): runs analyze() on
 * fixtures/01-static-class and compares the projected subset of the
 * result that expected.json commits to — see the fixture's own
 * "description" field for exactly what is, and is not, pinned.
 */
describe('fixture: 01-static-class', () => {
  const fixtureRoot = path.join(repoRoot, 'fixtures/01-static-class');
  const expected = JSON.parse(readFileSync(path.join(fixtureRoot, 'expected.json'), 'utf8')) as ExpectedFixture;

  it('matches the expected selectors and findings', () => {
    const report = analyze(fixtureRoot);

    const actualSelectors = report.selectors.map((s) => ({ key: s.key, referenceStatus: s.referenceStatus }));
    expect(actualSelectors).toEqual(expected.selectors);

    const actualFindings = report.findings.map((f) => ({
      rule: f.rule,
      key: f.key,
      operation: f.operation,
      risk: f.risk,
    }));
    expect(actualFindings).toEqual(expected.findings);
  });

  it('classifies the unreferenced selector as UNREFERENCED, never as a fabricated "unused" status (B9)', () => {
    const report = analyze(fixtureRoot);
    const unused = report.selectors.find((s) => s.key === 'unused');
    expect(unused?.referenceStatus).toBe('UNREFERENCED');
    // B9: no enum in the domain model is ever named UNUSED.
    expect(['REFERENCED', 'REFERENCED_DYNAMICALLY', 'UNREFERENCED']).toContain(unused?.referenceStatus);
  });
});

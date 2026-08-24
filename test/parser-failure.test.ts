import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/index.js';

/**
 * Per-file failure isolation (run.ts): a malformed stylesheet must not
 * crash the whole analysis. Malformed CSS is used because postcss
 * genuinely throws a CssSyntaxError on it; ts.createSourceFile, by
 * design, does not throw on malformed TSX (it is a resilient parser that
 * always returns a SourceFile), so there is no reachable "thrown
 * exception" path to exercise for TSX — see the M1 correction report.
 */
describe('per-file parser failure isolation', () => {
  it('a malformed CSS file is isolated: analysis continues, filesFailed increments, a Diagnostic is recorded', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'refactor-css-parser-failure-'));
    try {
      writeFileSync(path.join(dir, 'broken.css'), '.broken { color: red;');
      writeFileSync(path.join(dir, 'ok.css'), '.hero { color: red; }');
      writeFileSync(path.join(dir, 'Hero.tsx'), 'export const x = <div className="hero" />;');

      const report = analyze(dir);

      expect(report.coverage.filesFailed).toBe(1);
      expect(report.diagnostics).toHaveLength(1);
      expect(report.diagnostics[0]).toEqual(
        expect.objectContaining({ severity: 'error', code: 'stylesheet-parse-failed' }),
      );
      expect(report.diagnostics[0]?.loc?.file).toBe('broken.css');

      // The valid files were still analyzed despite the broken one.
      expect(report.selectors.find((s) => s.key === 'hero')?.referenceStatus).toBe('REFERENCED');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { describe, expect, it } from 'vitest';
import { applyRules } from '../src/rules/index.js';
import type { SelectorRecord } from '../src/index/types.js';
import type { SelectorDefinition } from '../src/domain/index.js';

const loc = { file: 'x', line: 1, column: 1 };

function definition(key: string): SelectorDefinition {
  return {
    key,
    rawSelector: `.${key}`,
    nature: 'CLASS',
    scope: 'global',
    loc,
    stylesheet: 'x',
    ownership: 'APPLICATION',
    contentHash: 'hash',
  };
}

describe('rules/applyRules (unreferenced-selector)', () => {
  it('fires for an UNREFERENCED class selector: DELETE risk REVIEW, non-empty evidence and caveats', () => {
    const record: SelectorRecord = {
      key: 'unused',
      definitions: [definition('unused')],
      references: [],
      referenceStatus: 'UNREFERENCED',
    };

    const findings = applyRules([record]);
    expect(findings).toEqual([
      expect.objectContaining({ rule: 'unreferenced-selector', key: 'unused', operation: 'DELETE', risk: 'REVIEW' }),
    ]);
    expect(findings[0]?.evidence.length).toBeGreaterThan(0);
    expect(findings[0]?.caveats.length).toBeGreaterThan(0);
  });

  it('never fires for a REFERENCED selector', () => {
    const record: SelectorRecord = {
      key: 'hero',
      definitions: [definition('hero')],
      references: [
        { key: 'hero', kind: 'jsx-class-attribute', resolution: 'exact', loc, snippet: 'className="hero"', extractor: 'source' },
      ],
      referenceStatus: 'REFERENCED',
    };
    expect(applyRules([record])).toEqual([]);
  });

  it('a key with multiple definitions gets a "defined in N places" caveat (B4)', () => {
    const record: SelectorRecord = {
      key: 'dup',
      definitions: [definition('dup'), { ...definition('dup'), loc: { file: 'y', line: 2, column: 1 } }],
      references: [],
      referenceStatus: 'UNREFERENCED',
    };
    const [finding] = applyRules([record]);
    expect(finding?.caveats.some((c) => c.includes('defined in 2 places'))).toBe(true);
  });
});

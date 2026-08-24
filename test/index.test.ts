import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/index/index.js';
import type { Evidence, SelectorDefinition } from '../src/domain/index.js';

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

function reference(key: string): Evidence {
  return { key, kind: 'jsx-class-attribute', resolution: 'exact', loc, snippet: `className="${key}"`, extractor: 'source' };
}

describe('index/buildIndex', () => {
  it('joins exact evidence to the matching selector by key, producing REFERENCED', () => {
    const records = buildIndex([definition('hero')], [reference('hero')]);
    expect(records).toEqual([
      expect.objectContaining({ key: 'hero', referenceStatus: 'REFERENCED' }),
    ]);
    expect(records[0]?.references).toHaveLength(1);
  });

  it('a selector with no matching evidence is UNREFERENCED, not any "unused" value', () => {
    const records = buildIndex([definition('unused')], []);
    expect(records[0]?.referenceStatus).toBe('UNREFERENCED');
    expect(records[0]?.references).toHaveLength(0);
  });

  it('evidence for a key with no definition does not fabricate a record', () => {
    const records = buildIndex([], [reference('phantom')]);
    expect(records).toHaveLength(0);
  });

  it('output is sorted by key regardless of input order (determinism)', () => {
    const records = buildIndex([definition('zebra'), definition('alpha')], []);
    expect(records.map((r) => r.key)).toEqual(['alpha', 'zebra']);
  });
});

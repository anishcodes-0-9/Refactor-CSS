import { describe, expect, it } from 'vitest';
import { extractStylesheet } from '../src/css/index.js';

describe('css/extractStylesheet', () => {
  it('extracts a simple class selector as a SelectorDefinition with nature CLASS', () => {
    const { definitions } = extractStylesheet('styles.css', '.hero { color: red; }');
    expect(definitions).toEqual([
      expect.objectContaining({ key: 'hero', nature: 'CLASS', rawSelector: '.hero' }),
    ]);
  });

  it('excludes non-class selectors (element, id) from the index, and counts them instead of guessing a nature', () => {
    const { definitions, excludedNonClassSelectorCount } = extractStylesheet(
      'styles.css',
      'body { margin: 0; }\n#main { padding: 0; }\n.real { color: blue; }',
    );

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.key).toBe('real');
    expect(excludedNonClassSelectorCount).toBe(2);
  });

  it('every definition carries a real source location and content hash (B13)', () => {
    const { definitions } = extractStylesheet('styles.css', '.hero { color: red; }');
    const [definition] = definitions;
    expect(definition?.loc).toEqual({ file: 'styles.css', line: 1, column: 1 });
    expect(definition?.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

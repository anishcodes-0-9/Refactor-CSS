import { describe, expect, it } from 'vitest';
import { extractStylesheet } from '../src/css/index.js';
import { buildIndex } from '../src/index/index.js';
import { applyRules } from '../src/rules/index.js';

/**
 * B15's M1 safety boundary: filename-level CSS Module detection only.
 * No namespaced key, no module-consumer extraction — just: a module
 * selector must never reach an unreferenced-selector finding.
 */
describe('B15: CSS Modules safety boundary', () => {
  it('detects *.module.scss and *.module.css by filename as scope css-module', () => {
    const scss = extractStylesheet('Card.module.scss', '.card { color: red; }');
    expect(scss.definitions[0]?.scope).toBe('css-module');

    const css = extractStylesheet('Card.module.css', '.card { color: red; }');
    expect(css.definitions[0]?.scope).toBe('css-module');
  });

  it('a plain (non-module) stylesheet is still scope global', () => {
    const { definitions } = extractStylesheet('styles.scss', '.hero { color: red; }');
    expect(definitions[0]?.scope).toBe('global');
  });

  it('an unreferenced CSS Module selector is indexed but never produces an unreferenced-selector finding', () => {
    const { definitions } = extractStylesheet('Card.module.scss', '.card { color: red; }');
    const records = buildIndex(definitions, []);

    expect(records[0]?.referenceStatus).toBe('UNREFERENCED');
    expect(applyRules(records)).toEqual([]);
  });

  it('reports an honest coverage count of excluded module selectors, not a hardcoded 0', () => {
    const { definitions } = extractStylesheet('Card.module.scss', '.card { color: red; }\n.icon { color: blue; }');
    const moduleCount = definitions.filter((d) => d.scope === 'css-module').length;
    expect(moduleCount).toBe(2);
  });
});

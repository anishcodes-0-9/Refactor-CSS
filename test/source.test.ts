import { describe, expect, it } from 'vitest';
import { extractSource } from '../src/source/index.js';

describe('source/extractSource', () => {
  it('a static className reference produces exact Evidence with source provenance', () => {
    const content = 'export function Hero() {\n  return <div className="hero">Hello</div>;\n}\n';
    const evidence = extractSource('Hero.tsx', content);

    expect(evidence).toEqual([
      expect.objectContaining({
        key: 'hero',
        kind: 'jsx-class-attribute',
        resolution: 'exact',
        extractor: 'source',
      }),
    ]);
    expect(evidence[0]?.loc.file).toBe('Hero.tsx');
    expect(evidence[0]?.loc.line).toBe(2);
  });

  it('splits a multi-class literal into one exact Evidence per class', () => {
    const content = '<div className="a b" />;';
    const evidence = extractSource('x.tsx', content);
    expect(evidence.map((e) => e.key)).toEqual(['a', 'b']);
    expect(evidence.every((e) => e.resolution === 'exact')).toBe(true);
  });

  it('ignores className attributes that are not bare string literals (out of M1 scope)', () => {
    const content = 'const x = <div className={props.cls} />;';
    const evidence = extractSource('x.tsx', content);
    expect(evidence).toHaveLength(0);
  });
});

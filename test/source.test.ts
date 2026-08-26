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

  it('M2A: a JSX-expression-wrapped string literal produces exact Evidence', () => {
    const content = 'const x = <div className={"hero"} />;';
    const evidence = extractSource('x.tsx', content);
    expect(evidence).toEqual([
      expect.objectContaining({ key: 'hero', kind: 'jsx-class-attribute', resolution: 'exact' }),
    ]);
  });

  it('M2A: a no-substitution template literal produces exact Evidence, tokenized', () => {
    const content = 'const x = <div className={`hero active`} />;';
    const evidence = extractSource('x.tsx', content);
    expect(evidence.map((e) => e.key)).toEqual(['hero', 'active']);
    expect(evidence.every((e) => e.resolution === 'exact')).toBe(true);
  });

  it('M2A: a ternary with both branches static string literals walks both branches', () => {
    const content = 'const x = <div className={active ? "hero active" : "hero"} />;';
    const evidence = extractSource('x.tsx', content);
    expect(evidence.map((e) => e.key)).toEqual(['hero', 'active', 'hero']);
    expect(evidence.every((e) => e.resolution === 'exact')).toBe(true);
  });

  it('M2A: `&&` produces exact Evidence for the right operand only', () => {
    const content = 'const x = <div className={condition && "badge"} />;';
    const evidence = extractSource('x.tsx', content);
    expect(evidence).toEqual([
      expect.objectContaining({ key: 'badge', kind: 'jsx-class-attribute', resolution: 'exact' }),
    ]);
  });

  it('M2A: a mixed ternary produces exact evidence for the static branch and opaque for the unresolved branch, never silently dropping either', () => {
    const content = 'const x = <div className={active ? "hero" : getClassName()} />;';
    const evidence = extractSource('x.tsx', content);

    expect(evidence).toEqual([
      expect.objectContaining({ key: 'hero', resolution: 'exact' }),
      expect.objectContaining({ key: null, resolution: 'opaque', kind: 'jsx-class-attribute' }),
    ]);
  });

  it('M2A: `&&` with a dynamic right operand produces opaque Evidence, not silently dropped (resolveBranch is shared with the ternary case)', () => {
    const content = 'const x = <div className={condition && getClassName()} />;';
    const evidence = extractSource('x.tsx', content);

    expect(evidence).toEqual([
      expect.objectContaining({ key: null, resolution: 'opaque', kind: 'jsx-class-attribute' }),
    ]);
  });
});

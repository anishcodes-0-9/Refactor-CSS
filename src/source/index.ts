import * as ts from 'typescript';
import type { Evidence } from '../domain/index.js';

/**
 * file/content -> Evidence[]. Pure (B13): parses with the TypeScript
 * compiler API, extracts facts, and discards the AST before returning.
 *
 * M1 scope: only a `className` JSX attribute whose value is a bare string
 * literal — `className="hero"` or `className="a b"` (ADR-001 §4.2's first
 * two extraction-table rows). Each whitespace-separated token in the
 * literal becomes its own exact Evidence (`className="a b"` -> exact x2).
 * `className={"hero"}` (string wrapped in a JSX expression container),
 * ternaries, template literals, clsx/classnames/cn, and every DOM API are
 * all out of scope for M1 — none are attempted, and none are silently
 * approximated with a regex.
 *
 * A hand-rolled regex was deliberately rejected for this extractor: JSX
 * attribute syntax (nested braces, expressions, escaping) is exactly the
 * kind of grammar a regex would get subtly wrong. `typescript` is already
 * a real dependency (this package's own build tool), so using its
 * compiler API for a real AST costs nothing new.
 *
 * All tokens from one attribute share that attribute's own location —
 * per-token column offsets within the string are not computed in M1 (no
 * fixture exercises multi-class literals).
 */
export function extractSource(file: string, content: string): Evidence[] {
  const evidence: Evidence[] = [];
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function visit(node: ts.Node): void {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sourceFile) === 'className' &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const loc = { file, line: line + 1, column: character + 1 };
      const snippet = node.getText(sourceFile);
      const tokens = node.initializer.text.split(/\s+/).filter((token) => token.length > 0);

      for (const key of tokens) {
        evidence.push({
          key,
          kind: 'jsx-class-attribute',
          resolution: 'exact',
          loc,
          snippet,
          extractor: 'source',
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return evidence;
}

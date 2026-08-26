import * as ts from 'typescript';
import type { Evidence } from '../domain/index.js';

/**
 * file/content -> Evidence[]. Pure (B13): parses with the TypeScript
 * compiler API, extracts facts, and discards the AST before returning.
 *
 * M2A scope (ADR-001 §4.2 rows implemented so far):
 *   className="hero"                     -> exact (M1)
 *   className="a b"                      -> exact x2 (M1)
 *   className={"hero"}                   -> exact (M2A)
 *   className={`hero`}                   -> exact, tokenized (M2A)
 *   className={cond ? "a" : "b"}         -> exact from both branches (M2A)
 *   className={cond && "a"}              -> exact from the right operand
 *                                            only; the left/condition is
 *                                            never treated as a class-name
 *                                            candidate (M2A)
 *
 * A ternary or `&&` branch that is itself unresolved (not a string
 * literal, not a nested ternary/`&&`, not a template literal) becomes an
 * *opaque* Evidence (`key: null`) rather than being silently dropped --
 * e.g. `cond ? "hero" : getClassName()` yields exact "hero" *and* one
 * opaque record for the `getClassName()` branch. The `opaque` Resolution
 * already exists in the domain model (M1 shipped it, unused); M2A is the
 * first extractor to actually produce one. M2A stops there: no pattern
 * matching, no `dynamicMatches`, no Coverage sink counts, no rule/caveat
 * changes based on it. Those are M2B.
 *
 * A fully-unsupported *top-level* className expression
 * (`className={props.cls}`, with no ternary/`&&` in sight) still produces
 * zero evidence, exactly as in M1 -- it was never traversed, so there is
 * no "traversed branch" to avoid discarding. Promoting every unresolved
 * className expression to an opaque sink, not just ones reached while
 * walking a recognized branch, is explicitly deferred to M2B.
 *
 * Template-literal *patterns* (`` `btn-${size}` ``), string-concatenation
 * patterns, clsx/classnames/cn, DOM APIs, and every other M2B/M3+
 * construct remain out of scope and untouched by this file.
 *
 * All evidence produced from one JSX attribute still shares that
 * attribute's own location and full-attribute snippet (per-branch/
 * per-token column offsets are not computed -- an M1 simplification
 * carried forward unchanged; no fixture exercises finer granularity).
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

  type Resolved = { kind: 'exact'; text: string } | { kind: 'opaque' };

  /**
   * Resolves an expression already reached by walking into a recognized
   * conditional shape (a ternary branch, or `&&`'s right operand). Unlike
   * resolveTopLevel, an unrecognized shape here becomes `opaque` rather
   * than being dropped -- this is the traversed-branch guarantee described
   * above.
   */
  function resolveBranch(expr: ts.Expression): Resolved[] {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return [{ kind: 'exact', text: expr.text }];
    }
    if (ts.isConditionalExpression(expr)) {
      return [...resolveBranch(expr.whenTrue), ...resolveBranch(expr.whenFalse)];
    }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return resolveBranch(expr.right);
    }
    return [{ kind: 'opaque' }];
  }

  /**
   * Resolves the top-level expression inside a className JSX-expression
   * container (or the bare string-literal initializer form). Only
   * recognized shapes are traversed at all; anything else yields no
   * evidence -- matching M1's silent-ignore behavior for constructs this
   * extractor does not understand at the top level.
   */
  function resolveTopLevel(expr: ts.Expression): Resolved[] {
    if (
      ts.isStringLiteral(expr) ||
      ts.isNoSubstitutionTemplateLiteral(expr) ||
      ts.isConditionalExpression(expr) ||
      (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
    ) {
      return resolveBranch(expr);
    }
    return [];
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'className' && node.initializer) {
      const expr: ts.Expression | undefined = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;

      if (expr) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const loc = { file, line: line + 1, column: character + 1 };
        const snippet = node.getText(sourceFile);

        for (const piece of resolveTopLevel(expr)) {
          if (piece.kind === 'exact') {
            const tokens = piece.text.split(/\s+/).filter((token) => token.length > 0);
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
          } else {
            evidence.push({
              key: null,
              kind: 'jsx-class-attribute',
              resolution: 'opaque',
              loc,
              snippet,
              extractor: 'source',
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return evidence;
}

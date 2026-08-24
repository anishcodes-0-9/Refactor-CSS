import { createHash } from 'node:crypto';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import type { SelectorDefinition } from '../domain/index.js';

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

const MODULE_FILENAME = /\.module\.(css|scss)$/;

function scopeForFile(file: string): 'global' | 'css-module' {
  return MODULE_FILENAME.test(file) ? 'css-module' : 'global';
}

/**
 * file/content -> SelectorDefinition[]. Pure (B13): parses with postcss,
 * extracts facts, and discards the AST before returning — nothing here
 * survives past this call.
 *
 * M1 scope: only a rule whose selector is a single, simple class selector
 * (`.hero`, or each member of a comma list like `.a, .b`) becomes a
 * SelectorDefinition, with nature 'CLASS'. Every other selector shape
 * (element, id, attribute, compound/contextual, global root, keyframes,
 * custom property, ...) is silently skipped at extraction — not merely
 * excluded from findings later — because full nature classification (B10)
 * is explicitly deferred past M1 (ADR-001 §6: "nature beyond CLASS" is
 * absent in M1). This keeps I2 true by construction: no non-CLASS
 * SelectorDefinition is ever produced here, so none can ever reach a
 * finding.
 *
 * `scope` is derived from the filename alone: `*.module.css` / `*.module.scss`
 * -> 'css-module', everything else -> 'global' (B15's filename-level safety
 * boundary — see MODULE_FILENAME below). This is detection only: no
 * namespaced key, no module-consumer extraction. `ownership` is hardcoded
 * 'APPLICATION': ownership classification is out of M1 scope, and every M1
 * fixture selector is, in fact, application-owned — a known M1 limitation,
 * not real classification logic.
 *
 * A comma-separated selector list's members all share their rule's start
 * location — per-selector column offsets are not computed in M1 (no
 * fixture exercises this).
 *
 * `excludedNonClassSelectorCount` is a real, honest count of the rules
 * skipped above (feeds Coverage.globalOrElementSelectorsExcluded) — not a
 * hardcoded 0, since a general CSS file can genuinely contain them even
 * though fixture 01 does not.
 */
export interface StylesheetExtraction {
  definitions: SelectorDefinition[];
  excludedNonClassSelectorCount: number;
}

export function extractStylesheet(file: string, content: string): StylesheetExtraction {
  const definitions: SelectorDefinition[] = [];
  let excludedNonClassSelectorCount = 0;
  const hash = contentHash(content);
  const scope = scopeForFile(file);
  const root = postcss.parse(content, { from: file });

  root.walkRules((rule) => {
    const start = rule.source?.start;
    if (!start) return;

    let parsed;
    try {
      parsed = selectorParser().astSync(rule.selector);
    } catch {
      return;
    }

    for (const selector of parsed.nodes) {
      const node = selector.nodes.length === 1 ? selector.nodes[0] : undefined;
      if (!node || node.type !== 'class') {
        excludedNonClassSelectorCount += 1;
        continue;
      }

      definitions.push({
        key: node.value,
        rawSelector: selector.toString().trim(),
        nature: 'CLASS',
        scope,
        loc: { file, line: start.line, column: start.column },
        stylesheet: file,
        ownership: 'APPLICATION',
        contentHash: hash,
      });
    }
  });

  return { definitions, excludedNonClassSelectorCount };
}

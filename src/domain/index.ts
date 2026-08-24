export const SCHEMA_VERSION = 1 as const;

/* ── supporting unions ────────────────────────────────────────────────── */

export type Resolution = 'exact' | 'pattern' | 'opaque';

export type EvidenceKind =
  | 'css-selector-definition'
  | 'jsx-class-attribute'
  | 'class-utility-call'      // clsx / classnames / cn / cx
  | 'dom-api-call'            // querySelector, classList.add, closest, matches, ...
  | 'html-literal'            // class="..." inside a string/template literal
  | 'html-injection'          // dangerouslySetInnerHTML, .innerHTML =
  | 'config-protected'
  | 'css-annotation'          // /* refactor-css-protect: reason */
  | (string & {});            // open: new extractors add kinds without a domain change

export type SelectorNature =
  | 'CLASS'                   // .card
  | 'CLASS_CONTEXTUAL'        // .checkout .card  — class, but part of a compound/descendant
  | 'ELEMENT'                 // h1, p, ul
  | 'GLOBAL_ROOT'             // html, body, :root, *
  | 'ID'                      // #main
  | 'ATTRIBUTE'               // [data-state="open"]
  | 'KEYFRAMES'
  | 'CUSTOM_PROPERTY';        // --brand-color

export type Ownership =
  | 'APPLICATION' | 'DESIGN_SYSTEM' | 'THIRD_PARTY' | 'GENERATED' | 'UNKNOWN';

export type ReferenceStatus =
  | 'REFERENCED'              // >=1 evidence with resolution 'exact'
  | 'REFERENCED_DYNAMICALLY'  // 0 exact, but >=1 matching pattern sink
  | 'UNREFERENCED';           // 0 exact, 0 matching pattern sink   <- NOT "unused" (B9)

export type Operation = 'DELETE' | 'RENAME' | 'MOVE';

/** B8: 'SAFE' exists for forward-compat but is never emitted in v0.1. */
export type Risk = 'SAFE' | 'SAFE_WITH_VALIDATION' | 'REVIEW' | 'BLOCKED';

export type BlockReason =
  | 'BLOCKED_THIRD_PARTY_OWNERSHIP'
  | 'BLOCKED_GENERATED_SOURCE'
  | 'BLOCKED_HTML_INJECTION_SINK'
  | 'BLOCKED_PROTECTED_BY_CONFIG'
  | 'BLOCKED_PROTECTED_BY_ANNOTATION'
  | 'BLOCKED_GLOBAL_SELECTOR_NATURE'
  | 'BLOCKED_DUPLICATE_DEFINITION';

/* ── 1. SourceLocation — the backbone ─────────────────────────────────── */

export interface SourceLocation {
  file: string;          // repo-relative, POSIX separators, ALWAYS
  line: number;          // 1-based
  column: number;        // 1-based
  endLine?: number;
  endColumn?: number;
}

/* ── 2. SelectorDefinition — a class name as defined in CSS ───────────── */

export interface SelectorDefinition {
  key: string;                       // normalized class name — THE JOIN KEY (B4)
  rawSelector: string;               // ".checkout .card:hover"
  nature: SelectorNature;            // from CSS AST alone (B10)
  scope: 'global' | 'css-module';    // B15
  loc: SourceLocation;
  stylesheet: string;                // repo-relative path
  ownership: Ownership;
  contentHash: string;               // B13
}

/* ── 3. Evidence — a place in source that references a class ──────────── */

export interface Evidence {
  key: string | null;      // null iff resolution === 'opaque'
  kind: EvidenceKind;      // WHERE it came from
  resolution: Resolution;  // HOW certain the value is
  loc: SourceLocation;
  snippet: string;         // literal source text, for the report
  extractor: string;       // which extractor produced it
  pattern?: string;        // required iff resolution === 'pattern', e.g. "button-*"
}

/* ── 4. Diagnostic — what we could not understand ─────────────────────── */

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;            // stable, greppable, documented
  message: string;
  loc?: SourceLocation;
}

/* ── 5. Finding — an assertion about the world ────────────────────────── */

export interface Finding {
  rule: string;            // "unreferenced-selector"
  key: string;
  operation: Operation;    // B7: risk is per-operation
  risk: Risk;
  reasonCode?: BlockReason;// REQUIRED when risk === 'BLOCKED' (B8)
  evidence: Evidence[];    // why we believe this — never empty
  caveats: string[];       // why we might be wrong — never empty (B11)
}

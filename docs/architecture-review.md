# Refactor-CSS — Architecture Review

Status: pre-implementation review
Date: 2026-08-24
Reviewer role: skeptical staff/principal engineer

---

## 1. Current repository state (verified, not assumed)

```
~/Desktop/Refactor-CSS          <- correct repo boundary, git root confirmed
├── .git/                       remote: https://github.com/anishcodes-0-9/Refactor-CSS.git
│                               1 commit: 560d82e "chore: initialize RefactorCSS workspace"
├── .gitignore                  0 bytes — EMPTY
├── README.md                   15 bytes — "a TOOL FOR ALL"
├── package.json                262 bytes — unmodified `npm init` output
├── pnpm-workspace.yaml         0 bytes — EMPTY
├── tsconfig.json               0 bytes — EMPTY
├── fixtures/                   empty
├── tests/                      empty
└── packages/
    ├── analyzer/  classifier/  cli/  core/  graph/  parser/  transformer/   all empty
```

Tracked files: `.gitignore`, `README.md`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`.
The seven `packages/*` directories, `fixtures/`, and `tests/` are untracked and empty — git does not track empty directories, so they exist only on this machine.

**Nothing described in the vision document has been implemented.** There is no source code, no lockfile, no `node_modules`, no dependencies, no build, no tests. The Desktop-level git mistake is confirmed fixed: the only git root is the project directory.

Concrete defects in the existing bootstrap:

| File | Problem |
| --- | --- |
| `package.json` | `"name": "Refactor-CSS"` is **not a publishable npm name** (uppercase is rejected for new packages). Must be `refactor-css`. |
| `package.json` | Missing `"private": true` on the workspace root, missing `"type": "module"`, `"main": "index.js"` points at nothing, `"license": "ISC"` is the npm default rather than a decision. |
| `pnpm-workspace.yaml` | Empty. pnpm will not treat `packages/*` as workspace members. |
| `tsconfig.json` | Empty — invalid JSON; `tsc` will error. |
| `.gitignore` | Empty. `node_modules/` is not ignored. First `pnpm install` will offer ~40k files to git. |
| `packages/*` | Seven package boundaries declared before a single line of code exists. See §3. |

Environment: Node v26.7.0, pnpm 10.29.2. Note that Node 26 is far ahead of what OSS users will run; `engines` should target `>=20.19` or `>=22` and CI should test 20/22/24, not 26.

---

## 2. What is strong about the current proposal

I want to be clear about what should survive review unchanged, because most of it should.

1. **"Positive evidence can establish usage; absence of evidence cannot establish non-usage."** This is the correct core invariant and it is the entire product. Every existing tool in this space (PurgeCSS, UnCSS, `coverage` in DevTools) violates it, which is why nobody trusts them enough to actually delete. Hold this line.
2. **Evidence with provenance as a first-class output.** The differentiator is not the verdict, it is the citation. A developer who can click through to `Hero.tsx:18` believes the tool. One who sees `.hero: used` does not.
3. **Separating facts from inference from risk from recommendation.** Correct, and rare. Most analysis tools collapse these into one field and become unarguable.
4. **Refusing to lead with AI.** Correct. AI-generated facts are unfalsifiable and would destroy (1) and (2).
5. **Analysis before transformation; plan as the contract between them.** Correct, and it is the only sequencing that produces a trustworthy transformer.
6. **Skepticism toward numeric confidence.** Your instinct is right. See §10.
7. **AST over regex.** Non-negotiable and correctly identified.
8. **Refusing to claim CWV causality.** Correct, and unusually disciplined for a tool that originated from a Lighthouse warning.

The philosophy is genuinely good. The problems are all in the *architecture*, which is roughly 5–10x larger than the problem currently justifies.

---

## 3. Problems and over-engineering risks

### 3.1 Seven empty packages is the single biggest risk in the repo

`core`, `parser`, `analyzer`, `graph`, `classifier`, `transformer`, `cli` were created before any of these boundaries were tested against real code. Package boundaries are the most expensive kind of boundary in a TypeScript monorepo: each one needs a `package.json`, a `tsconfig`, build ordering, a version, and cross-package imports that resist refactoring. You will discover in week two that `analyzer` and `classifier` share a type that belongs in neither, and you will either create `packages/types` (eight packages) or put it in `core` and create an import cycle.

Boundaries should be *extracted* from working code, not *declared* before it. Recommendation in §5.

### 3.2 The "graph" package is premature and mis-named

What v0.1 needs is an **index**: `Map<className, Reference[]>`. That is a multimap. Calling it a graph invites building traversal, cycle detection, and path queries that nothing will query. A graph earns its place later, when you need *component → stylesheet → route* fan-out (route-level CSS payload, monorepo reuse counts). Not for selector-to-consumer, which is a flat join.

### 3.3 The 18-entity Repository IR is too heavy

`Repository, SourceFile, Component, Stylesheet, CSSRule, CSSSelector, CSSDeclaration, ClassReference, DynamicClassReference, JSReference, CMSBoundary, ExternalDependency, Route, DependencyEdge, Evidence, Classification, Risk, Transformation, Diagnostic` — that is a model of the *vision*, not of v0.1. Most of these are re-wrappings of PostCSS and TypeScript AST nodes that add a maintenance surface and lose fidelity. `CSSDeclaration` in particular: v0.1 makes no decision that depends on declarations, so wrapping them is pure cost.

See §8 for the minimum model, which is five types.

### 3.4 `INFERRED` as an evidence category is a correctness bug

Inference is what you do *to* evidence. Making it a *kind of* evidence lets a conclusion become an input to another conclusion, which produces unfalsifiable circular reasoning and makes the provenance chain a lie. Delete it.

### 3.5 Risk is modelled as a property of a selector; it is a property of (selector, operation)

`.hero` may be `BLOCKED` for deletion and `SAFE_WITH_VALIDATION` for colocation. One `risk` field per selector will be wrong the moment a second operation exists, and it will be wrong in the dangerous direction (a risk computed for "move" being read as clearance to "delete"). Fix this now — it costs nothing today and is expensive later.

### 3.6 CSS Modules are not addressed at all, and they are a live correctness landmine

If a repo already contains `Hero.module.scss` with `.hero`, and `globals.scss` also defines `.hero`, a string-keyed index merges two unrelated selectors. The tool then reports the global `.hero` as referenced because the module's `.hero` is used — a **false negative on the safe side**, but also a false *positive* in the other direction, and either way the report is garbage. Almost every target repository has module files. v0.1 must handle this explicitly (§13).

### 3.7 The generic-tool framing is a trap

> "The underlying problem may be broader than CSS: dependency discovery under uncertainty."

Intellectually true, architecturally corrosive. Generalizing before one domain works produces an abstraction shaped by imagination. The moat is not a generic engine — it is the accumulated corpus of CSS-specific edge cases. Build the CSS tool. Name things `CssSelector`, not `Symbol`. If a second domain appears, extract then; the refactor is an afternoon.

### 3.8 The horizontal milestone sequence delays all signal

Milestones 0→7 as proposed build layer by layer, so nothing runs end-to-end until milestone 6. You will make six milestones' worth of design decisions with zero feedback. Invert to vertical slices (§_Implementation plan_).

### 3.9 "Unused CSS bytes" as a headline number would contradict the thesis

The tool's central claim is that it cannot know what is unused. Reporting "you have 47 KB of unused CSS" is exactly that claim. Report bytes as raw facts; never aggregate a number whose name asserts something you have refused to assert.

---

## 4. Recommended MVP scope

### In scope for v0.1

```
Discovery      git-aware file discovery from repo root (whole repo, incl. all workspace packages)
Config         refactor-css.config.json — protected selectors, ignore globs, ownership overrides
CSS            .css / .scss via PostCSS; selector parsing via postcss-selector-parser
               SCSS nesting resolution (& substitution); interpolation -> diagnostic
TS/JS          .ts .tsx .js .jsx via TypeScript's syntactic parser (no type checker)
References     className / class JSX attributes: string literals, ternaries, template literals,
               clsx/classnames/cn call arguments
               DOM APIs (fixed list): querySelector(All), closest, matches,
               classList.{add,remove,toggle,contains,replace}, getElementsByClassName
Sinks          opaque + pattern class sinks recorded repo-wide (§_Dynamic usage_)
Boundaries     dangerouslySetInnerHTML / .innerHTML= registered as opaque sinks
Output         deterministic JSON (schemaVersion 1) + human-readable terminal report
Findings       exactly two rules: unreferenced-selector, single-consumer-selector
Diagnostics    first-class; every unparseable file, every unresolvable construct
Coverage       files scanned / skipped / failed, sink counts, duration
```

### Cut from the proposed v0.1

| Proposed | Verdict | Why |
| --- | --- | --- |
| Specificity computation | **Cut** | No v0.1 output depends on it. Record selector *shape* (simple vs contextual) — that is syntax, not specificity math. Add when the transformer needs it. |
| CSS variables | **Cut** | Parse and ignore. No v0.1 finding depends on them, and their dependency model (`var()` → `--x` definitions) is a separate index with separate rules. |
| Media / container queries | **Cut** | Irrelevant to every v0.1 finding. |
| Cascade analysis | **Cut** | Transformation concern. Parse capability ≠ transformation capability — your own principle. |
| CSS import discovery | **Keep, minimal** | Only `@import` in CSS and `import './x.css'` in TS. Needed for ownership and for the colocation finding. |
| Naming heuristics (`.cms-*`) | **Cut from core** | Optional, off by default, config-driven, and may only ever *raise* risk (§_CMS strategy_). |

### Added to v0.1 (missing from the proposal)

- **Diagnostics and coverage as first-class outputs.** Without them, "no consumer found" is unreadable. A report that says "we found 143 unreferenced selectors" and does not say "we also failed to parse 12 files and found 4 opaque class sinks" is actively misleading.
- **CSS Modules handling** (§13.4) — a correctness requirement, not a feature.
- **Config file with protected selectors** — the escape hatch that makes the tool adoptable on day one instead of after the first false positive.
- **Deterministic, versioned JSON output** — costs ~20 lines, makes `--compare` a trivial later feature, and makes tests sane.

### Explicit v0.1 non-goals

Transformation of any kind · automatic deletion · AI · CMS adapters · runtime/browser analysis · Lighthouse · visual regression · `sx` / Tailwind / CSS-in-JS · Vue/Svelte/Angular · Sass compilation · `@extend` / mixin-generated selectors · route-level payload · baseline compare · GitHub App · SaaS.

---

## 5. Recommended architecture

### Verdict: one package, not seven

```
Refactor-CSS/
├── package.json                 root, private, workspace
├── pnpm-workspace.yaml          packages/*      <- keep the file, one member
├── tsconfig.base.json
├── docs/
│   └── architecture-review.md
├── fixtures/                    plain directories, NOT workspace members
│   ├── 01-static-class/
│   ├── 02-conditional/
│   └── ...
└── packages/
    └── refactor-css/            THE package. Publishes the library AND the bin.
        ├── package.json         exports: "." (lib), "./package.json"; bin: refactor-css
        ├── src/
        │   ├── domain/          types only, zero runtime deps, zero imports from siblings
        │   ├── config/          load + validate refactor-css.config.json
        │   ├── discovery/       git ls-files / glob -> classified file list
        │   ├── css/             PostCSS + selector parser -> SelectorDefinition[]
        │   ├── source/          ts.createSourceFile -> Evidence[] + Sink[]
        │   ├── index/           the join: Map<key, SelectorRecord>
        │   ├── rules/           findings; pure functions over the index
        │   ├── report/          JSON serializer + terminal renderer
        │   └── cli.ts           thin: parse argv -> run() -> render
        └── test/
```

**Delete `packages/{analyzer,classifier,cli,core,graph,parser,transformer}` now.** They are empty and untracked; removal costs nothing and prevents the structure from calcifying.

### Why one package rather than the "engine + cli" two-package alternative

A library/CLI split *sounds* like a real boundary but is not one you have to pay for at publish time: modern `exports` maps give you `refactor-css` (library) and a `bin` from the same package. Publishing one package means one version, one changelog, one README on npm, one `pnpm build`. For an OSS tool seeking adoption, that is materially better DX than telling contributors to reason about `@refactor-css/engine@0.1.3` vs `@refactor-css/cli@0.1.1`.

**Keep `pnpm-workspace.yaml`** (with `packages/*`) even at one member — the file costs nothing and lets you add realistic fixture apps with their own `package.json` later without restructuring.

### Trigger conditions for splitting later — write these down

Split out a package only when one of these is *actually true*:

1. A second consumer exists that must not carry CLI dependencies (a VS Code extension, an ESLint plugin, a Vite plugin).
2. The transformer ships on a different release cadence or risk profile than the analyzer — this one is likely, and `@refactor-css/transform` is the first legitimate split.
3. A third-party wants to publish an adapter against a stable, versioned interface.

"It feels cleaner" is not on this list.

### Dependency direction — enforce it mechanically

```
domain  <-  everything      (domain imports nothing internal, has no runtime deps)
config  <-  discovery, rules
discovery -> css, source                    (produces the file list they consume)
css, source -> index                        (produce definitions/evidence)
index -> rules                              (rules are pure fns: index -> Finding[])
rules -> report
cli -> everything (and nothing imports cli)
```

Strictly one direction, no cycles. Enforce with `eslint-plugin-import` `no-restricted-paths` or `dependency-cruiser` in CI — a lint rule is worth more than seven package boundaries, and costs three lines of config.

`domain/` having zero internal imports and zero runtime dependencies is the one rule that matters most: it means types can be published, shared, and reasoned about independently of any parser choice.

---

## 6. Module responsibilities

| Module | Owns | Explicitly does not |
| --- | --- | --- |
| `domain` | Types, enums, `SourceLocation`, key normalization, schema version | Any logic, any dependency |
| `config` | Load/validate config, resolve protected-selector globs, ownership overrides | Apply policy (rules do that) |
| `discovery` | Enumerate + classify files, honor `.gitignore`, exclude generated/vendor | Read file contents |
| `css` | PostCSS parse, `&` resolution, selector tokenization, `SelectorDefinition[]` | Decide usage, decide risk |
| `source` | TS syntactic parse, JSX/DOM/utility extraction, `Evidence[]` + `Sink[]` | Know that CSS exists |
| `index` | The string join; sink attenuation; `SelectorRecord[]` | Emit findings |
| `rules` | Pure `(index, config) => Finding[]`; each rule cites its evidence | Mutate anything |
| `report` | Serialize JSON (deterministic), render terminal | Compute anything |
| `cli` | argv, exit codes, stdout/stderr | Any analysis logic |

Note what `css` and `source` do **not** know: each other. They both produce records keyed by a normalized class-name string, and `index` performs the join. This is what makes a future Vue/Svelte extractor a drop-in — it just has to emit `Evidence`.

---

## 7. Data flow

```
   refactor-css.config.json ─────────┐
                                     │
  Repository root                    ▼
        │                    ┌──────────────┐
        └───────────────────►│  discovery   │  git ls-files --cached --others
                             │              │  --exclude-standard  (fallback: glob)
                             └──────┬───────┘
                                    │  FileRef[] { path, kind, ownership }
                    ┌───────────────┴────────────────┐
                    ▼                                ▼
            ┌───────────────┐               ┌────────────────┐
            │  css parser   │               │ source parser  │
            │ postcss(+scss)│               │ ts.createSource│
            │ selector-parse│               │ File (syntax)  │
            └───────┬───────┘               └────────┬───────┘
                    │ SelectorDefinition[]           │ Evidence[] (exact|pattern|opaque)
                    │                                │ Sink[]
                    └───────────────┬────────────────┘
                                    ▼
                          ┌───────────────────┐
                          │      index        │   join on normalized class name
                          │  Map<key,Record>  │   + pattern-sink matching
                          │                   │   + opaque-sink attenuation
                          └─────────┬─────────┘
                                    │ SelectorRecord[]
                                    ▼
                          ┌───────────────────┐
                          │      rules        │   pure fns; each Finding cites Evidence
                          │ unreferenced /    │
                          │ single-consumer   │
                          └─────────┬─────────┘
                                    │ Finding[]
                                    ▼
                          ┌───────────────────┐
                          │      report       │  Report { coverage, selectors,
                          │  json | terminal  │           findings, diagnostics }
                          └───────────────────┘

  Diagnostics ──────── accumulated as a side channel from EVERY stage above ──────►
  Coverage    ──────── counted at every stage; gates what rules may conclude ──────►
```

Two structural notes that differ from the proposed pipeline:

- **Diagnostics are a side channel, not a terminal stage.** Every stage can emit them, and they must reach the report even when a later stage throws.
- **Coverage gates rules.** `rules` receives the coverage summary and is *permitted* to weaken or suppress its own conclusions based on it. This is how "absence of evidence" is enforced mechanically rather than by convention.

---

## 8. Domain model / minimum IR

**Is a Repository IR necessary?** A *normalized join layer* is necessary — you cannot join PostCSS ASTs to TypeScript ASTs without a shared vocabulary. A *Repository IR* in the sense of mirroring the repository as an object graph is not. The difference: the former is five types, the latter is eighteen.

The stable domain concepts — the ones I am confident will survive to v1.0 — are five:

```ts
// domain/index.ts — no imports, no runtime deps

export type SchemaVersion = 1;

/** The backbone. Everything the user can click on has one. */
export interface SourceLocation {
  file: string;      // repo-relative, POSIX separators, always
  line: number;      // 1-based
  column: number;    // 1-based
  endLine?: number;
  endColumn?: number;
}

/** A class name as it appears in a CSS selector. */
export interface SelectorDefinition {
  key: string;              // normalized class name, e.g. "hero"  <- THE JOIN KEY
  rawSelector: string;      // ".checkout .card:hover"
  nature: SelectorNature;
  scope: 'global' | 'css-module';
  loc: SourceLocation;
  stylesheet: string;
  ownership: Ownership;
}

/** A place in source that references a class. */
export interface Evidence {
  key: string | null;       // null when resolution === 'opaque'
  kind: EvidenceKind;       // WHERE it came from
  resolution: Resolution;   // HOW certain the value is
  loc: SourceLocation;
  snippet: string;          // the literal source text, for the report
  extractor: string;        // which extractor produced it — for debugging & attribution
  pattern?: string;         // when resolution === 'pattern', e.g. "button-*"
}

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;             // stable, greppable, documented
  message: string;
  loc?: SourceLocation;
}

export interface Finding {
  rule: string;             // "unreferenced-selector"
  key: string;
  operation: Operation;     // risk is per-operation, never per-selector
  risk: Risk;
  evidence: Evidence[];     // why we believe this
  caveats: string[];        // why we might be wrong — always populated
}
```

Everything else in the proposed IR is either (a) an AST node that should stay in its parser's world, (b) a derived value that should be computed on demand, or (c) a future concern.

Specifically rejected for v0.1: `Repository`, `SourceFile`, `Component`, `CSSRule`, `CSSDeclaration`, `Route`, `DependencyEdge`, `CMSBoundary`, `ExternalDependency`, `Transformation`.

- `Component` — you cannot define it reliably (is a file with two exports two components?) and no v0.1 rule needs it. "Consumer file" is the honest unit.
- `DependencyEdge` — an `Evidence` *is* the edge. Modelling both is duplication.
- `CMSBoundary` — a boundary is just a `Sink` with a particular `kind`. Same shape, one fewer type.

### The join key, and its known limitation

The join key is **the normalized class-name string**. `.checkout .card:hover` contributes keys `checkout` and `card`. `className="card active"` contributes `card` and `active`.

This is the central simplification and it has one honest failure mode: **two unrelated stylesheets defining the same class name collapse into one record.** Do not hide this. Emit a `duplicate-selector-definition` diagnostic whenever a key has definitions in more than one stylesheet, and state in the report that findings for that key are less reliable. This falls out for free and is itself a useful finding.

---

## 9. Evidence model

The proposed eight categories (`STATIC_SOURCE, DYNAMIC, RUNTIME, CMS, THIRD_PARTY, DOCUMENTATION, CONFIGURATION, INFERRED`) conflate two independent axes into one enum, which is why `className={\`btn-${x}\`}` cannot be expressed — it is *both* STATIC_SOURCE and DYNAMIC.

**Replace one enum with two orthogonal axes.**

### Axis 1 — `kind`: where the evidence came from (mechanical, extractor-owned)

```
css-selector-definition     a rule in a stylesheet
jsx-class-attribute         className= / class= on a JSX element
class-utility-call          clsx() / classnames() / cn() argument
dom-api-call                querySelector, classList.add, closest, matches, ...
html-literal                a class= inside a template/string literal of HTML
html-injection              dangerouslySetInnerHTML / .innerHTML =
config-protected            declared in refactor-css.config.json
css-annotation              /* refactor-css-protect: reason */
```

Open, extensible union of string literals. A Vue extractor adds `vue-class-binding` without touching domain types.

### Axis 2 — `resolution`: how certain the value is

```
exact     we know the literal string.               className="hero"
pattern   we know the shape, not the value.         className={`btn-${v}`}   -> "btn-*"
opaque    a class flows here; value unknowable.     className={props.cls}
```

### What this buys you

- `DYNAMIC` is no longer a category — it is `resolution !== 'exact'`.
- `CMS` is no longer a category — CMS-ness is a property of the *file* the evidence sits in (ownership) plus an `html-injection` sink. Categorising it as evidence would have meant a CMS adapter has to fabricate `Evidence` records, which is exactly the coupling to avoid.
- `THIRD_PARTY` is no longer a category — it is `Ownership`, computed from path.
- `INFERRED` is deleted (§3.4).
- `DOCUMENTATION` is deleted — replaced by `config-protected` and `css-annotation`, which have grammars (§_CMS strategy_).
- `RUNTIME` becomes a future `kind` (`browser-coverage`) with `resolution: 'exact'`, slotting in with zero model change. That is the test that this model is right.

### The critical mechanism: sinks

`pattern` and `opaque` evidence do **not** attach to a selector — they cannot, because we do not know which selector they refer to. They are indexed repository-wide as **sinks**:

- **Pattern sink** (`btn-*`): during indexing, every selector key matching the pattern is upgraded from `UNREFERENCED` to `REFERENCED_DYNAMICALLY`, with the sink cited as evidence. Precise, targeted, mechanical.
- **Opaque sink** (`className={props.cls}`, `dangerouslySetInnerHTML`): could match *anything*. It must **not** suppress all findings — every real repository has at least one, and a tool that goes silent is useless. Instead:
  - every `unreferenced-selector` finding carries a caveat naming the sink count and locations,
  - risk for `DELETE` is **capped at `REVIEW`** repository-wide whenever any opaque sink exists,
  - the coverage summary reports the count prominently.

**This is the mechanical implementation of "absence of evidence is not evidence of absence."** It is the most important single design decision in this document, and it is why the evidence model must have a separate `resolution` axis. With one flat enum, this cannot be expressed.

---

## 10. Classification model

### Should classification be multi-dimensional? Yes — but three facets, not five.

The proposed `usage / ownership / consumer type / scope / externality` overlaps badly. `scope` and `externality` are near-duplicates; `consumer type` is lossy (a selector with both a React and a `querySelector` consumer has no single answer).

Keep exactly three, each independently derivable from a different input:

**1. `referenceStatus`** — derived purely from the evidence index.
```
REFERENCED               >=1 evidence with resolution 'exact'
REFERENCED_DYNAMICALLY   0 exact, but >=1 matching pattern sink
UNREFERENCED             0 exact, 0 matching pattern sink
```
Note there is no `UNUSED`. There never will be. This facet describes *our observations*, not the world.

**2. `nature`** — derived from the CSS AST alone, no cross-file information, 100% reliable.
```
CLASS                 .card
CLASS_CONTEXTUAL      .checkout .card       (part of a descendant/compound selector)
ELEMENT               h1, p, ul
GLOBAL_ROOT           html, body, :root, *
ID                    #main
ATTRIBUTE             [data-state="open"]
KEYFRAMES             @keyframes name
CUSTOM_PROPERTY       --brand-color
```
This is what mechanically prevents `body {}` from ever becoming a deletion candidate — and it is cheap, local, and needs no heuristics. It directly answers §15 of the brief: element selectors are excluded from `unreferenced-selector` findings **by construction**, not by a rule that someone might later relax.

**3. `ownership`** — derived from file path plus config.
```
APPLICATION  DESIGN_SYSTEM  THIRD_PARTY  GENERATED  UNKNOWN
```
`DESIGN_SYSTEM` = defined in a workspace package that other workspace packages import. Detectable cheaply from `pnpm-workspace.yaml` + import graph, and it is the one monorepo-aware signal worth having early.

### What was removed and where it went

- **`consumer type`** → derived on demand from the evidence list. Never stored (would force a lossy choice).
- **`scope` (component vs shared)** → a *predicate* used by the colocation rule: `distinctConsumerFiles === 1`. Not a stored classification.
- **`CMS_CONTROLLED`** → not a classification. It is an ownership value plus the presence of an `html-injection` sink.
- **`DYNAMIC`** → `referenceStatus === 'REFERENCED_DYNAMICALLY'`. Your own example — "something can be both COMPONENT_SCOPED and DYNAMIC" — is exactly the argument for facets, and it resolves cleanly here.

### Is `UNUSED_CANDIDATE` a classification? No. Definitively.

It is a **finding**, produced by a rule with explicit, auditable preconditions:

```
rule: unreferenced-selector
  requires  referenceStatus === UNREFERENCED
  requires  nature === CLASS  (never CLASS_CONTEXTUAL, ELEMENT, GLOBAL_ROOT, ...)
  requires  ownership === APPLICATION
  requires  scope !== 'css-module'
  requires  key not matched by config.protectedSelectors
  requires  no css-annotation protect on the rule
  emits     operation: DELETE
            risk: REVIEW                    (BLOCKED if repo has html-injection sinks)
            caveats: [ "<n> opaque class sinks exist in this repository: ...",
                       "runtime, CMS, and backend-template consumers are not analyzed" ]
```

Your instinct in §8 of the brief is correct, and the reason is sharper than "it feels like a recommendation": **classifications describe what we observed; findings assert something about the world.** Only the latter can be wrong in a way that costs a user their production styles, so only the latter gets preconditions and caveats.

### Numeric confidence: reject. Unambiguously.

1. **A number implies calibration you do not have.** "87%" is only meaningful if, of everything scored 87%, ~87% were truly unused. You will never have that dataset. It is a fabricated statistic.
2. **Numbers invite thresholding**, and thresholding is the exact mechanism of catastrophic failure: `--confidence 0.95 --delete` in someone's CI, running against a repo with a CMS.
3. **Numbers destroy arguability.** A user cannot dispute 87%. They can dispute "no reference found, but 4 files inject raw HTML" — and disputing it is how they learn to trust the tool.
4. **Evidence composes; scores do not.** Two evidence lists union cleanly. Combining two scores requires independence assumptions that are false here.

**The evidence list *is* the confidence.** Your proposed `Evidence + Classification + Risk` triple is correct — adopt it as specified.

One honest ordinal *does* belong, but at a different altitude: **analysis coverage** — a property of the scan, not of a selector. "12 files failed to parse, 4 opaque sinks, 3 unresolved SCSS interpolations." That is a real, measurable, non-fabricated statement about how much you were able to see, and it is what should attenuate every negative conclusion.

---

## 11. Risk / safety model

The four-level model is reasonable. Three changes.

### Change 1 — risk is `(selector, operation)`, not `selector`

```ts
type Operation = 'DELETE' | 'RENAME' | 'MOVE';
```
- `DELETE` — remove the rule.
- `RENAME` — change the class name. **CSS Modules migration is a RENAME.**
- `MOVE` — relocate the rule to another stylesheet, name unchanged.

### Change 2 — `SAFE` must be unreachable in v0.1

Static analysis alone cannot prove safety for any of these operations. If `SAFE` is in the emittable set and never emitted, it is an attractive nuisance — someone will eventually make a rule emit it. Keep it in the type for forward compatibility, but state and **test** the invariant: *v0.1 emits only `SAFE_WITH_VALIDATION`, `REVIEW`, `BLOCKED`.* `SAFE` becomes reachable only when a transformer exists that has *executed and passed* validation.

### Change 3 — `BLOCKED` must always carry a machine-readable reason code

An unfalsifiable block is worse than no block: users disable the tool wholesale rather than argue with it. `BLOCKED` without `reasonCode` should fail a type check or a test.

```
BLOCKED_THIRD_PARTY_OWNERSHIP
BLOCKED_GENERATED_SOURCE
BLOCKED_HTML_INJECTION_SINK
BLOCKED_PROTECTED_BY_CONFIG
BLOCKED_PROTECTED_BY_ANNOTATION
BLOCKED_GLOBAL_SELECTOR_NATURE
BLOCKED_DUPLICATE_DEFINITION
```

### A non-obvious correctness point: migration is not automatically safer than deletion

The brief treats CSS-Module migration as a natural first transformation and deletion as the dangerous one. **Migration is a rename, and a rename breaks an opaque consumer exactly as thoroughly as a delete does.** If `className={content.cssClass}` can produce `"hero"`, then rewriting `.hero` to `.Hero_hero_a1b2` breaks that page just as completely as deleting the rule.

Two asymmetries do favour migration, and they are worth stating precisely because they are the *real* reasons, not the assumed one:

1. It is recoverable — the declarations still exist and a revert restores behaviour.
2. It admits a mitigation deletion does not: emit `:global(.hero)` alongside the scoped class during migration, so the old name keeps working. That is a genuinely safe intermediate state and it should be the default transformer behaviour when any opaque sink exists.

### Reserved for the transformer era

`CASCADE_RISK`, `SPECIFICITY_CHANGE`, `STYLESHEET_ORDER_CHANGE`, `EXTERNAL_SELECTOR`. Do not model them in v0.1 — no v0.1 output depends on them, and modelling risks you cannot yet assess produces fields that are always `unknown`.

---

## 12. Parser strategy

### CSS: PostCSS + `postcss-scss` + **`postcss-selector-parser`** ✔ (with one addition)

`postcss-selector-parser` is **missing from the proposed stack and is required.** You cannot correctly extract class tokens from `.a:not(.b) > .c[data-x]` or `.card:has(> .icon)` by string manipulation, and getting this wrong produces false positives in the deletion direction. It also gives you selector structure for the `nature` facet.

Be explicit about what `postcss-scss` does *not* do — it parses SCSS syntax; it does not evaluate it:

| Construct | v0.1 behaviour |
| --- | --- |
| `&__title` nesting | **Resolve.** Walk `Rule.parent` chain, substitute `&`. Tractable and necessary — `&` is ubiquitous. |
| `#{$var}-title` interpolation | **Diagnostic + pattern sink.** Never guess the value. |
| `@extend`, `@mixin`-generated selectors | **Diagnostic.** Out of scope; selectors that exist only after compilation are invisible. |
| `@use` / `@import` partials | Discover and parse the partial; do not attempt module-scope resolution. |

State the limitation plainly in the README: **we analyze SCSS source, not compiled output.** The alternative — compiling with `sass` and analyzing the CSS via source maps — is a genuinely reasonable future option (it eliminates the whole class of interpolation/mixin blind spots) but requires resolving each project's Sass configuration, which is a per-project failure surface not worth taking on in v0.1.

### TS/TSX/JS/JSX: `typescript` compiler API, **syntactic only**. Reject ts-morph for v0.1.

| Option | Verdict |
| --- | --- |
| **`ts.createSourceFile`** (no Program, no checker) | **Recommended.** Roughly an order of magnitude faster than building a Program, zero tsconfig resolution, zero `node_modules` reads, no monorepo path-mapping failure modes. Parses `.js`/`.jsx` fine (JSX flag on). Everything v0.1 needs is syntactic: find JSX attributes named `className`, walk the expression. |
| `ts-morph` | **Reject for now.** ~30 MB, and its value is *code manipulation* (not doing) and *type-checked navigation* (requires a full Program + checker — slow, and needs correct tsconfig resolution across every workspace package). Buying that cost for syntactic traversal is a bad trade. |
| `@babel/parser` | Viable, fast, but you will already depend on `typescript` for the build, so TS's parser is free and is more robust on TSX. |

Revisit a full `ts.Program` only when a concrete feature needs types — e.g. resolving `variant: 'primary' | 'secondary'` into concrete class names. And when that day comes, use `ts.Program` directly; ts-morph still is not needed unless you are writing transforms, at which point re-evaluate honestly.

### Discovery: prefer git over glob

```bash
git ls-files --cached --others --exclude-standard
```

This is faster than globbing, honors `.gitignore` for free, excludes `node_modules` and build output automatically, and includes untracked-but-not-ignored files (new work in progress). Fall back to a glob when not in a git repo.

For the fallback, prefer **`tinyglobby`** over `fast-glob` — same API surface for our needs, dramatically smaller dependency tree. Either is defensible; `fast-glob` is not wrong.

### CLI and output

- **`cac`** for argv — ~7 KB, zero dependencies, good `--help` for free. `node:util.parseArgs` is genuinely sufficient for one command but the help output matters for OSS adoption. Commander is fine but heavier than one command justifies.
- **No `chalk`.** `node:util.styleText` is built in and handles `NO_COLOR`/TTY detection.
- **Vitest** ✔ — correct choice, no argument.
- **`tsdown`/`tsup`** or plain `tsc` for the build. Plain `tsc` with `"type": "module"` is the smallest thing that works.

### Total v0.1 dependency budget

```
runtime:  postcss  postcss-scss  postcss-selector-parser  typescript  cac  tinyglobby
dev:      vitest  @types/node  (tsc for build)
```

Six runtime dependencies. Every one is load-bearing. Defend this number in review; every addition should have to justify itself against it.

---

## 13. Selected sub-strategies

### 13.1 Dynamic usage

**Principle: resolve what is provably static; represent everything else as a sink; never let uncertainty become "unused."**

| Construct | v0.1 handling |
| --- | --- |
| `className="hero"` | `exact` |
| `className="a b"` | `exact` × 2 |
| `className={cond ? "a" : "b"}` | `exact` × 2 (walk both branches) |
| `className={cond && "a"}` | `exact` × 1 |
| `className={clsx("btn", isOn && "on")}` | `exact` × 2 — string-literal args only, callee name in `{clsx, classnames, cn, cx}` (configurable) |
| `` className={`btn-${v}`} `` | `pattern` sink `btn-*` |
| `` className={`btn ${v}`} `` | `exact` "btn" + `opaque` sink |
| `className={props.cls}` | `opaque` sink |
| `className={styles.hero}` | CSS-module reference — see 13.4 |
| `` className={styles[`size-${s}`]} `` | `pattern` sink, module-scoped |

**Explicitly not attempted in v0.1:** resolving `variant` through a union type, constant propagation, cross-module data flow, any interprocedural analysis. The brief already says "the MVP should not try to solve arbitrary program analysis" — agreed, and the sink model means declining to analyze costs correctness nothing. It only costs precision, which is the right trade.

### 13.2 DOM APIs

Fixed list, string-literal arguments only:
`querySelector` · `querySelectorAll` · `closest` · `matches` · `getElementsByClassName` · `classList.{add,remove,toggle,contains,replace}`

For `querySelector(".modal .close")`, run the argument through `postcss-selector-parser` — the same tokenizer as the CSS side, so `.a:not(.b)` behaves identically on both sides of the join. Non-literal arguments → `opaque` sink. Do not claim universal DOM analysis; the README should name the supported list.

### 13.3 CMS and external consumers

**Build no CMS adapters in v0.1.** One generic boundary detector is enough, and it is a special case of machinery you already have:

- `dangerouslySetInnerHTML={{ __html: x }}` → `html-injection` sink (opaque).
- `el.innerHTML = x` / `outerHTML` / `insertAdjacentHTML` → same.
- A string literal containing `class="..."` → parse it, emit `exact` evidence (`html-literal`). Cheap and catches real cases.

Any `html-injection` sink in the repo raises `DELETE` risk to `BLOCKED` and is named in the coverage summary. This covers Contentful, Sanity, WordPress, Strapi and every backend template — without knowing any of them exist. **This is the right level of abstraction: model the mechanism (arbitrary HTML enters the DOM), not the vendors.**

Contentful/Sanity/etc. adapters become future `kind` values on `Evidence` — no domain change required.

### 13.4 CSS Modules — a v0.1 correctness requirement

The brief does not mention this and it will produce garbage output on almost every real repository (§3.6).

v0.1 behaviour:
1. Files matching `*.module.{css,scss}` get `scope: 'css-module'` and **namespaced keys** (`path/to/Hero.module.scss::hero`), so they never collide with global selectors.
2. Module selectors are **excluded from all findings** in v0.1, with a count reported in coverage: *"14 CSS Module selectors were indexed but not analyzed."*
3. `:global(...)` inside a module file *does* contribute a global key — it is genuinely global.

Full module analysis (resolving `import styles from './x.module.css'` → `styles.hero` member access, plus `composes:`) is a well-defined milestone-8 feature. Doing it half-way in v0.1 is worse than declaring it out of scope.

### 13.5 Documentation and configuration as evidence

**Never parse prose.** Two deterministic mechanisms, both greppable:

```jsonc
// refactor-css.config.json
{
  "$schema": "https://refactor-css.dev/schema/v1.json",
  "protectedSelectors": [".cms-*", ".rich-text-*", ".prose *"],
  "ownership": { "src/vendor/**": "THIRD_PARTY" },
  "ignore": ["**/*.generated.css"],
  "classUtilities": ["clsx", "classnames", "cn", "cx"]
}
```

```css
/* refactor-css-protect: rendered by Contentful rich text */
.cms-table { ... }
```

Both produce real `Evidence` with a real `SourceLocation`, so a protected selector's report shows *where it was protected and why*. A README sentence cannot do that. Reject documentation-as-evidence entirely.

### 13.6 Naming heuristics

Not in v0.1 core. When added: config-driven, **off by default**, and constrained so that a matching name may only ever **raise** risk or add a caveat — never establish usage, never lower risk. A heuristic that can only move in the safe direction cannot cause the catastrophic failure; it can only cause noise, which is why it stays off by default.

### 13.7 Monorepos

Implement no workspace adapters. Enforce one constraint that makes them correct anyway:

> **The unit of analysis is the repository root. A selector is never declared unreferenced on the basis of a subtree.**

Discovery always walks from the git root and always includes every workspace package. That single rule preserves monorepo correctness with zero monorepo-specific code, and it is the thing that would be architecturally expensive to retrofit.

`DESIGN_SYSTEM` ownership (from `pnpm-workspace.yaml` + cross-package imports) is the one cheap monorepo signal worth having in v0.1, because it feeds the "shared vs component-scoped" judgement directly.

---

## 14. Transformation boundary (design now, build later)

Not built in v0.1. Recorded here so the analyzer does not foreclose it.

### The contract

```
Analysis  ──►  TransformationPlan  ──►  Transformer  ──►  Validation
                    (the contract)
```

The transformer must be **incapable** of deciding safety — enforce this at the type level: `applyPlan(plan: TransformationPlan): Diff` takes no index, no config, no evidence. It cannot re-derive a verdict because it cannot see the inputs. That is a stronger guarantee than a code-review convention.

### Closed boundary — a testable definition

A boundary for operation `O` on key `K` is **closed** iff:

1. Every `Evidence` for `K` has `resolution === 'exact'`.
2. No pattern sink matches `K`.
3. For `RENAME`: **no opaque sink exists repository-wide**, or the transformer emits a `:global(K)` compatibility alias (§11).
4. All consumers are within the target boundary (one component file + colocated files).
5. The defining stylesheet is imported only by files in that boundary, or the rule is being extracted.
6. No other rule anywhere uses `K` as part of a contextual selector not being moved (`.checkout .card`).
7. `ownership === APPLICATION` and `nature === CLASS`.
8. The build system supports the emitted import (Next.js/Vite CSS Modules detected from config).

Any unmet condition → not closed → no automatic transformation. No exceptions, no confidence threshold.

### The smallest transformation worth building first — and it is not module migration

**`MOVE` without rename**: extract a rule from a global stylesheet into a colocated `Hero.css` that `Hero.tsx` imports, class name unchanged.

- No consumer files are edited → conditions 3 and the entire opaque-sink problem do not apply.
- No rename risk at all → the highest-severity failure mode is structurally absent.
- Still delivers real value: ownership, code-splitting, route-level payload reduction.
- Exercises the full plan → diff → format → build → validate pipeline on the lowest-stakes operation available.

Residual risk is stylesheet *order* (cascade order changes when a rule moves between files) — real, but strictly smaller than rename risk, and detectable by checking for competing declarations on the same property.

Build `MOVE` first. `RENAME` (module migration) second, and only with the `:global` alias default. This inverts the brief's implied ordering, for a concrete reason.

---

## 15. Testing strategy

### Structure

Each fixture is a tiny repository directory plus an `expected.json` asserting *normalized facts*, not a full snapshot:

```
fixtures/03-template-literal/
├── src/Button.tsx
├── src/button.scss
└── expected.json     { selectors: [{key, referenceStatus, nature}],
                        findings: [{rule, key, risk}],
                        sinks:    [{resolution, pattern}],
                        diagnostics: [{code}] }
```

Assert on the fields that encode the contract. Do **not** snapshot the whole report — snapshot tests on a 200-field object teach reviewers to press `-u` and stop reading.

### First minimal test matrix (≈22 fixtures — build in this order)

| # | Fixture | Asserts |
| --- | --- | --- |
| 01 | static class + unreferenced class | the §37 demo; end-to-end baseline |
| 02 | multiple classes in one attribute | tokenization |
| 03 | ternary className | both branches → `exact` |
| 04 | `&&` conditional | single `exact` |
| 05 | template literal `btn-${v}` | `pattern` sink; matching selectors → `REFERENCED_DYNAMICALLY` |
| 06 | `className={props.x}` | `opaque` sink; findings capped at `REVIEW`; caveat present |
| 07 | `clsx("a", cond && "b")` | utility extraction |
| 08 | `classnames` / `cn` aliases | config-driven callee names |
| 09 | `classList.add("active")` | DOM API `exact` |
| 10 | `querySelector(".modal .close")` | compound selector arg → 2 keys |
| 11 | `closest` / `matches` | remaining DOM list |
| 12 | shared component, 2 consumers | `single-consumer-selector` does **not** fire |
| 13 | `body {} html {} :root {}` | `GLOBAL_ROOT`; **no finding emitted** |
| 14 | `h1 {} p {}` unreferenced | `ELEMENT`; **no finding emitted** |
| 15 | `.a:not(.b) > .c` | selector-parser correctness; `.b` counted |
| 16 | pseudo-elements `::before` | not treated as a class |
| 17 | SCSS `&__title` nesting | `&` resolution → key `card__title` |
| 18 | SCSS `#{$x}-title` | diagnostic + `pattern` sink; **no** unreferenced finding |
| 19 | `dangerouslySetInnerHTML` | `html-injection` sink; `DELETE` risk → `BLOCKED` |
| 20 | existing `*.module.scss` | namespaced key; excluded from findings; counted in coverage |
| 21 | same class in two stylesheets | `duplicate-selector-definition` diagnostic |
| 22 | third-party CSS under `vendor/` | `ownership: THIRD_PARTY`; no finding |

### Invariant tests — the safety contract, executable

These run across *every* fixture and are the most valuable tests in the suite:

```
I1  No finding with risk === 'SAFE' is ever emitted in v0.1.
I2  No selector with nature in {ELEMENT, GLOBAL_ROOT, ID, ATTRIBUTE, KEYFRAMES,
    CUSTOM_PROPERTY} ever produces an unreferenced-selector finding.
I3  If any opaque sink exists, no DELETE finding has risk better than REVIEW.
I4  If any html-injection sink exists, every DELETE finding is BLOCKED.
I5  Every BLOCKED finding has a reasonCode.
I6  Every finding's evidence[] is non-empty and every SourceLocation resolves
    to a real file, line, and column in the fixture.
I7  Every unreferenced-selector finding has at least one caveat.
I8  Running analyze twice produces byte-identical JSON (determinism).
I9  Zero exact-resolution evidence is ever synthesized for a construct the
    extractors do not explicitly support.
```

I2, I3, I4 and I7 are the tests that prevent the catastrophic failure. Write them before writing the rules.

### What not to build

No E2E tests against real open-source repositories in v0.1 — they are slow, they churn, and they assert nothing precise. Do keep one large real repo (e.g. a Next.js starter) as a **manual smoke + performance** check, not a CI assertion.

---

## 16. Performance strategy

Do not optimize now. Do avoid three architectural dead ends that are expensive to undo:

1. **Never hold all ASTs in memory simultaneously.** Parse file → extract records → discard AST. The index holds only `SelectorDefinition` and `Evidence` — small, flat, serializable. This one decision is what makes 100k-file repos viable later, and retrofitting it means rewriting every extractor.
2. **Every record carries a file path and a content hash.** Costs nothing now; makes incremental analysis and caching a later feature rather than a later rewrite.
3. **Extractors are pure `(path, content) => {records, diagnostics}`.** No shared mutable state, no I/O. This makes `worker_threads` parallelism a scheduling change rather than a redesign.

Everything else — parallel parsing, caching, incremental, lazy AST — waits for a measurement. Add a `--profile` flag early so the first measurement is cheap to take.

Realistic v0.1 target: a 2,000-file Next.js app in under 5 seconds single-threaded. If you miss that badly, the cause will be the TypeScript parser, and the fix will be workers — which decision 3 already permits.

---

## 17. Extension points

Designed for, not built:

| Extension | Mechanism | Domain change needed |
| --- | --- | --- |
| Vue / Svelte / Astro | New extractor emitting `Evidence` | None |
| CMS adapters (Contentful, Sanity, …) | New `EvidenceKind` values | None |
| Runtime / browser coverage | Extractor emitting `kind: 'browser-coverage'`, `resolution: 'exact'` | None |
| Backend templates (ERB, Blade, Twig) | New extractor | None |
| Transformer | New package (`@refactor-css/transform`) consuming `TransformationPlan` | Add `TransformationPlan` |
| Styling policy (`sx`, styled-components) | Config-driven rule module | Add `Recommendation` |
| Baseline / `--compare` | Diff two `Report` JSONs | None (needs determinism, already required) |
| AI explanation | `(report: Report) => string` — **cannot construct `Evidence`** | None |

That most of this column reads "None" is the test that the domain model (§8) is at the right level of abstraction. If adding runtime coverage required a new evidence *category*, the model would be wrong.

### AI boundary — enforce by type signature, not policy

Permitted: prose explanation of an existing evidence set; ranking/triaging findings; suggesting config entries for human approval.
Forbidden: constructing `Evidence`; changing a `risk`; gating a transformation.

Make the AI layer's only input `Report` and its only output `string`. Then the forbidden list is not a rule someone might forget — it is not expressible.

---

## 18. Answers to the twenty questions

1. **CSS tool or generic dependency tool?** CSS tool. The generic framing is true and useless right now (§3.7). The moat is CSS-specific edge cases, not a generic engine.
2. **Is a Repository IR necessary?** A join layer is; a repository object graph is not. Five types, not eighteen (§8).
3. **Over-splitting packages?** Yes, severely. One package. Delete the other seven directories today (§5).
4. **Minimum stable domain model?** `SourceLocation`, `SelectorDefinition`, `Evidence`, `Diagnostic`, `Finding`.
5. **Multi-dimensional classification?** Yes — three facets (`referenceStatus`, `nature`, `ownership`), not five (§10).
6. **Numeric confidence?** No. Fabricated calibration, invites thresholding, destroys arguability, does not compose (§10).
7. **How to represent uncertainty?** Two axes: `resolution` per evidence, plus repository-wide sinks and a coverage summary that gates conclusions (§9).
8. **Sufficient evidence for a recommendation?** Explicit rule preconditions plus mandatory caveats. Never a threshold.
9. **What is never sufficient for automatic deletion?** Absence of references. Full stop — that is the product thesis. Also never sufficient: naming heuristics, AI judgement, runtime absence, a confidence score.
10. **Unresolved dynamic behaviour?** Pattern sinks attenuate matching selectors precisely; opaque sinks cap risk repository-wide and attach caveats (§9).
11. **External consumers without pretending omniscience?** Model the *mechanism* (arbitrary HTML entering the DOM) rather than the vendors. One generic `html-injection` sink covers every CMS and backend template (§13.3).
12. **Closed transformation boundary?** Eight testable conditions; all must hold; no threshold, no exceptions (§14).
13. **Smallest transformation worth supporting?** `MOVE` without rename — not module migration. It has structurally zero rename risk and exercises the whole pipeline (§14).
14. **Avoiding catastrophic false positives?** Never emit delete instructions; `nature` excludes global/element selectors by construction; opaque sinks cap risk; protected-selector config; invariant tests I2/I3/I4/I7; never fail CI by default.
15. **Avoiding a slow analyzer?** Discard ASTs after extraction; pure extractors; hash every record. Do not optimize further until measured (§16).
16. **Where does framework-specific logic live?** In extractors, behind the `Evidence` interface. Never in `index`, `rules`, or `domain`.
17. **Deterministic vs AI-assisted?** All facts, classifications, risks and findings are deterministic. AI touches only prose, ranking, and suggestions — enforced by the `Report => string` signature (§17).
18. **The actual moat?** Three things, in order: (a) evidence/provenance UX that earns trust; (b) a documented, *tested* conservatism contract; (c) a compounding corpus of edge-case fixtures. The transformer is the payoff, not the moat.
19. **What becomes plugins later?** Extractors, CMS adapters, styling-policy rules, the transformer. Not the index, not the domain model.
20. **What to refuse in v0.1?** Everything in §4's non-goals — and specifically: any output that asserts a selector is unused.

---

## 19. Explicit non-goals for v0.1

Restated so they can be pointed at during scope arguments:

- Any file mutation. `analyze` opens no file for writing except the report.
- Any claim that a selector is unused.
- Any numeric confidence.
- AI in any form.
- Any CMS-specific, framework-specific-beyond-React, or backend-specific adapter.
- Browser or runtime analysis.
- Sass compilation, `@extend`, mixin-generated selectors.
- Cascade, specificity, or CSS-variable analysis.
- Full CSS Modules analysis (detect and exclude only).
- Route-level payload attribution.
- Baseline comparison, GitHub App, SaaS.

---

## 20. Key decisions and rationale

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | One package, not seven | Boundaries should be extracted from working code. Seven premature ones cost every refactor and buy nothing. |
| D2 | Index, not graph | The selector→consumer relation is a flat multimap. A graph invites unused infrastructure. |
| D3 | Five domain types | Eighteen models the vision; five models v0.1 and extends without change (§17). |
| D4 | Evidence = `kind` × `resolution` | One enum cannot express "in source *and* dynamic". Two axes can, and collapse 8 fuzzy categories to 2 clean ones. |
| D5 | Delete `INFERRED` evidence | Inference-as-evidence permits circular, unfalsifiable reasoning. |
| D6 | Sinks are repository-wide, not per-selector | This is the mechanical implementation of "absence of evidence ≠ non-usage" — the product's core invariant. |
| D7 | Opaque sinks cap risk; never suppress | Every real repo has one. Going silent makes the tool useless; capping keeps it honest and useful. |
| D8 | No numeric confidence | Fabricated calibration, invites `--delete` thresholding, unarguable, does not compose. |
| D9 | Three classification facets | Independently derivable, no lossy collapses, and each has a distinct input source. |
| D10 | `nature` from CSS AST alone | Makes "never delete `body {}`" structural rather than a rule that could be relaxed. |
| D11 | Risk is `(selector, operation)` | A single risk field will be read as clearance for the wrong operation. |
| D12 | `SAFE` unreachable in v0.1 | Static analysis cannot prove safety. An unemitted-but-emittable value is an attractive nuisance. |
| D13 | `BLOCKED` requires a reason code | Unfalsifiable blocks cause wholesale tool abandonment. |
| D14 | `ts.createSourceFile`, not ts-morph | Syntactic needs only; ~10x faster; no tsconfig/monorepo resolution failure modes; 30 MB lighter. |
| D15 | Add `postcss-selector-parser` | Correct class extraction from complex selectors is not optional; errors here are false positives toward deletion. |
| D16 | `git ls-files` for discovery | Faster than glob, free `.gitignore` handling, automatic `node_modules`/build exclusion. |
| D17 | Config + CSS annotations, never prose | Deterministic, greppable, and carries a real `SourceLocation` into the report. |
| D18 | CSS Modules detected and excluded | Silent key collisions with global selectors would corrupt output on most real repositories. |
| D19 | Analysis unit is the repo root | Makes monorepos correct with zero monorepo code; expensive to retrofit. |
| D20 | Deterministic versioned JSON | ~20 lines now; makes `--compare` trivial later and tests sane immediately. |
| D21 | Discard ASTs after extraction | The one performance decision that is a rewrite if deferred. |
| D22 | Build `MOVE` before `RENAME` | Rename is as dangerous as delete for opaque consumers; move is structurally not. |

---

## 21. Open questions and known limitations

### Limitations to state in the README, prominently

1. **SCSS is analyzed as source, not compiled output.** Selectors produced only by `@extend`, mixins, or interpolation are invisible. Diagnostics are emitted; they are not a substitute for the selector.
2. **The join key is a bare class-name string.** Identical names in unrelated stylesheets collapse into one record. Diagnosed, not solved.
3. **Only React/Next.js `className`/`class` JSX attributes are understood** in v0.1.
4. **Only a fixed list of DOM APIs** is understood.
5. **No type information is used.** `variant: 'a' | 'b'` is not resolved to concrete class names.
6. **CSS Module selectors are indexed but not analyzed.**
7. **Runtime, CMS-authored, backend-template, and third-party-injected consumers are structurally invisible** to static analysis. This is not a bug to be fixed; it is why nothing is ever reported as unused.

### Genuinely open questions

- **Q1 — Terminal report shape.** The §37 mock lists every selector. On a real repo that is thousands of lines. Should the default be findings-only with `--verbose` for the full list? *My recommendation: yes — default to findings + coverage summary; full selector table behind `--all` or in the JSON.*
- **Q2 — Element-selector reporting.** `h1 {}` never produces a finding (D10). Should it appear in the report at all, or is silence confusing? *Leaning: a one-line coverage note — "38 element/global selectors excluded from analysis by design" — with a doc link.*
- **Q3 — `single-consumer-selector` value.** Is a colocation candidate actually actionable before a transformer exists, or is it noise? Consider shipping v0.1 with `unreferenced-selector` only, and adding colocation with the `MOVE` transformer where it becomes actionable.
- **Q4 — Exit codes.** Findings must not fail CI by default. Should `--max-findings N` exist at all in v0.1, or does any CI-gating flag encourage exactly the threshold behaviour D8 rejects? *Leaning: omit entirely from v0.1.*
- **Q5 — Where does route-level CSS payload sit?** It is the feature most likely to make the tool *matter* to the audience that has the Lighthouse warning, but it needs Next.js route-graph analysis — real work, and framework-specific. It is my candidate for the highest-value thing *after* v0.1, ahead of the transformer. Worth a decision.
- **Q6 — Strategic risk.** The honest failure mode for this project is not incorrectness; it is a beautifully-evidenced report that nobody acts on, because "here are 143 selectors we cannot tell you about" is not a call to action. Q5 and the `MOVE` transformer are the two answers. Both should be on the roadmap explicitly, and the README should say what the tool is *for*, not only what it refuses to claim.

---

## 22. Implementation plan

Vertical slices. Every milestone ends in something that runs, is tested, and is demoable. **Reject the horizontal layer-by-layer sequence** — it defers all feedback to milestone 6.

### M0 — Repository hygiene (½ day)
- `rm -rf packages/{analyzer,classifier,cli,core,graph,parser,transformer}`
- Rename package to `refactor-css`; root `private: true`, `type: module`, `engines: {node: ">=20.19"}`; pick a license (MIT recommended for a dev tool seeking adoption).
- Fill `.gitignore` (`node_modules/`, `dist/`, `.DS_Store`, `*.tsbuildinfo`, `coverage/`).
- Fill `tsconfig.base.json` (`strict`, `NodeNext`, `noUncheckedIndexedAccess`).
- Fill `pnpm-workspace.yaml` → `packages: ['packages/*']`.
- Scaffold `packages/refactor-css` with `src/`, Vitest, a `tsc` build, and a `bin`.
- CI: Node 20/22/24 × lint + typecheck + test.
- **Exit:** `pnpm test` runs (zero tests), `pnpm build` produces a `dist`, `npx refactor-css --version` prints.

### M1 — Walking skeleton (2–3 days)
The §37 fixture, end to end, hardcoded-narrow but real.
- `domain/` types (§8). `discovery/` via `git ls-files`. CSS parse → `.hero`, `.unused`. TSX parse → `className="hero"` string literals only. String-keyed index. `unreferenced-selector` rule. JSON + terminal output.
- Fixture 01 + invariant tests I6, I8.
- **Exit:** `refactor-css analyze ./fixtures/01-static-class` prints the §37 output. **This is the first demo, and it exists in week one.**

### M2 — Reference extraction depth (3–4 days)
Ternaries, `&&`, multi-class, `clsx`/`classnames`/`cn`, template literals → pattern sinks, member/identifier expressions → opaque sinks. Sink attenuation in the index. Caveats on findings.
- Fixtures 02–08. Invariants I3, I7.
- **Exit:** a real component file produces correct evidence, and an opaque sink visibly caps risk in the output.

### M3 — CSS depth (2–3 days)
`postcss-selector-parser` integration; `nature` facet; SCSS `&` resolution; interpolation → diagnostic + pattern sink; CSS Module detection and namespacing; `@import`/`import './x.css'` discovery.
- Fixtures 13–18, 20, 21. Invariants I2, I9.
- **Exit:** `body {}` and `h1 {}` are structurally incapable of producing a finding.

### M4 — DOM APIs and HTML injection (2 days)
The fixed DOM API list; `html-literal` parsing; `html-injection` sinks; `BLOCKED` + reason codes.
- Fixtures 09–11, 19. Invariants I1, I4, I5.
- **Exit:** a repo with `dangerouslySetInnerHTML` produces `BLOCKED` deletion risk with a citable reason.

### M5 — Config, ownership, diagnostics, coverage (2 days)
`refactor-css.config.json` + schema; `/* refactor-css-protect */`; ownership from paths and `pnpm-workspace.yaml`; coverage summary; the full diagnostic catalogue with documented codes.
- Fixture 22. Invariant I5 extended.
- **Exit:** a user can protect a selector and see *where and why* it was protected in the report.

### M6 — Report UX and determinism (2 days)
Terminal renderer (Q1 default), stable sort ordering, `schemaVersion`, `--json`, `--all`, `--profile`, `NO_COLOR`. Golden-file test for the human report.
- **Exit:** output is byte-identical across runs; the human report is something a developer would paste into a PR.

### M7 — Hardening and release (3–4 days)
Run against 3–5 real open-source Next.js repos; fix what breaks; measure performance; write README with the limitations from §21 stated prominently; publish `0.1.0`.
- **Exit:** `npx refactor-css analyze` works on a stranger's repository without crashing and without a single false "unused" claim.

**Total: roughly 3 weeks of focused work to a defensible 0.1.0.** The proposed architecture would not have reached its first end-to-end run in that time.

### After 0.1.0, in priority order

1. **Route-level CSS attribution** (Q5) — most likely to make the tool matter.
2. **Full CSS Modules analysis** — removes the largest v0.1 blind spot.
3. **`MOVE` transformer** with plan → diff → validate (§14).
4. Incremental caching and worker parallelism, *after* measurement.
5. `RENAME` / module migration, with `:global` alias by default.
6. Browser coverage as an evidence provider.

---

## Summary

The philosophy is right and unusually disciplined; keep all of it. The architecture is roughly 5–10x too large for what has been built (nothing) and should be cut to one package, five domain types, an index instead of a graph, and two findings.

The three changes that matter most for correctness, in order:

1. **Split evidence into `kind` × `resolution`, and make unresolved references repository-wide *sinks*.** This is what turns "absence of evidence is not evidence of absence" from a slogan into a mechanism.
2. **Make risk a function of `(selector, operation)` and make `SAFE` unreachable in v0.1.** Deferring this produces a field that will eventually be read as clearance for an operation it was never computed for.
3. **Handle CSS Modules in v0.1.** It is not a feature; it is the difference between correct output and garbage on most real repositories.

Then build the walking skeleton in week one and let real repositories tell you where the boundaries actually are.

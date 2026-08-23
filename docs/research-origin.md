# Research Origin

Status: background — informs `docs/adr-001-v0.1-architecture.md`; not itself binding.

This document summarizes lessons from historical, hands-on CSS-audit and migration work that motivated Refactor-CSS. The original source material — internal audit reports and a component migration plan for a specific production codebase — is **not included in this repository**. It contains project-specific metrics, internal file paths, and business-identifying detail that have no place in an open-source repo and no relevance to Refactor-CSS's users. What follows is generalized: the failure modes and lessons, stripped of any detail that could identify the source project.

The scale, for context only: a legacy global stylesheet in the multiple-thousands of lines, several hundred class selectors, audited by hand against several hundred source files in a Next.js + MUI application, followed by a component-by-component migration effort. Nothing below depends on those specific numbers.

---

## Real-world failure modes that motivated Refactor-CSS

**1. Token-based "unused CSS" extraction is untrustworthy in both directions.** A production PurgeCSS setup, run over full file content, systematically *over-kept* generic-word class names (single common words survive token matching whether they're used or not) and *under-scanned* — a directory of data/constants files sat outside its configured content globs, meaning a class referenced only from a constants file could be silently stripped in production with zero warning. Neither failure is a PurgeCSS bug; both are inherent to token-matching without source-aware, AST-based analysis.

**2. Documentation drifts and cannot be trusted as a source of truth.** A project's own contributor guidelines named a "protected" utility class and a required reference document; neither existed in the repository. Protection that depends on a human keeping prose in sync with code degrades silently and without warning.

**3. Comma-separated CSS selector lists are a proven, repeated risk.** A dead selector was comma-grouped with a live selector in the same rule, across several declarations. A rule-level ("delete this whole block") deletion strategy would have silently destroyed the live selector's styling. This had to be independently re-verified by hand in two separate passes of the same project's cleanup work, and a separate automated entanglement-detection pass over-flagged unrelated components on the same class of mistake (proximity-based matching instead of exact selector-list parsing).

**4. SCSS `@extend` and `:global()` are invisible to className-string search.** A selector with zero JSX usage was the live target of an `@extend` from two selectors that *were* used — deleting it would have silently stripped properties from live rules at compile time via Sass's inheritance mechanism. Static className search cannot see this reachability path at all.

**5. "Referenced in source" is not the same claim as "reachable at runtime."** A meaningful number of components had live-looking JSX (`className="x"` right there in the file) but the component itself was never imported anywhere in the application — dead code whose CSS a naive usage-based audit cannot distinguish from genuinely live CSS, and which a build-time purger cannot strip either, because the dead file still "references" the class.

**6. UI-library-generated runtime class names are a systematic, invisible false-positive category.** A production stylesheet contained selectors written specifically to override classes that a component library (MUI, in the source material) generates at render time — these class names never appear as an authored `className=` string anywhere in the codebase, by design. A tool that treats "no className match" as "no consumer" would confidently recommend deleting real, load-bearing CSS. **This is the single most consequential finding** and is the direct motivation for ADR-001's B16.

**7. CMS/backend-rendered HTML is fundamentally not statically greppable.** A batch of selectors existed purely to style HTML injected via a parser library (the `dangerouslySetInnerHTML`-equivalent pattern) from a CMS. These required a manually maintained allowlist and were explicitly flagged, in the original audit, as capable of producing false "dead" results if that list were ever incomplete.

**8. Migration/relocation decisions need information usage-classification alone can't supply.** A proposed flat migration rule ("every component-owned style moves to the same destination") would have silently regressed a previously-measured performance characteristic of the application, because it ignored blast-radius (how many routes render a component) and runtime cost (some destinations add JS execution cost per render). A second, independent review caught this before it shipped. Ownership and migration-destination are different decisions, answerable from different evidence.

**9. Ad hoc audit tooling has real bugs.** Line numbers reported by one-off analysis tooling had a blank-line offset bug, caught only by manual re-derivation against the live file. Source-location provenance is not free — it must be verified, not assumed.

---

## Reusable lessons

- Prefer AST-based selector extraction over any form of token/string matching; token matching fails in both directions (over-keeps generic names, under-scans unconfigured paths).
- Deterministic configuration/annotations, never prose documentation, as a protection mechanism — docs drift silently.
- Comma-separated selector lists must be treated at branch granularity, both for classification and for any future automated transformation; a whole-rule-block operation is never safe to assume.
- `@extend`/`:global()` are known, named reachability gaps — worth disclosing explicitly in any finding's caveats rather than pretending the analysis is complete.
- "Has a static consumer" and "that consumer is ever rendered" are different claims; import/reachability-graph analysis is a distinct, harder problem from usage-evidence extraction and should not be silently assumed by either.
- Any tool that classifies usage purely from authored source text will systematically misclassify selectors whose real consumer is a library or runtime generating class names dynamically — this needs an explicit, generic (not vendor-specific) protection mechanism.
- CMS/backend-rendered content needs a generic "opaque HTML injection" boundary, not a list of named CMS integrations — the mechanism (arbitrary HTML entering the DOM) is what matters, not which vendor produced it.
- Ownership (who owns this style) and destination (where should it move) are separable decisions; collapsing them into one rule risks re-opening decisions that were made deliberately for reasons the usage data alone doesn't capture.
- Any location/line-number claim a tool makes needs a correctness test — an off-by-N bug in something this "simple" was real and shipped.
- A two-phase transformation pattern — a provably risk-free step (e.g. value substitution with no relocation) committed separately from the actually risky step (relocation/renaming) — makes regressions bisectable and is worth carrying into any future automated transformer design.

---

## Validated safety requirements

These are requirements the historical material provides direct evidence for, each already reflected in `docs/adr-001-v0.1-architecture.md`:

- Discovery must cover the entire repository with no implicit content-glob-style exclusions (ADR B14) — directly motivated by the constants-file blind spot in finding 1.
- Every reported location must be independently verifiable against the real file (ADR invariant I6) — directly motivated by finding 9.
- A selector's join key may resolve to multiple definitions; they must never be silently collapsed into one (ADR B4) — reinforced by the comma-list risk in finding 3.
- A known/configured runtime-generated namespace match must never fabricate usage evidence, and must cap destructive-recommendation risk rather than suppress or escalate it unpredictably (ADR B16) — directly motivated by finding 6.
- A CMS/runtime HTML-injection boundary must exist as a generic, vendor-agnostic mechanism that caps deletion risk repository-wide (ADR B6, the opaque-sink model) — directly motivated by finding 7.
- Ownership and destination must remain independently computed, never collapsed into a single flat rule (reflected in ADR B7 — risk is per-operation, and in the deferred, configuration-driven styling-policy layer) — directly motivated by finding 8.

---

## Fixture ideas derived from observed failures

Recorded as backlog (see ADR §8.2), not yet implemented:

1. **Vendor/runtime-generated class override** — application-owned selector, zero JSX evidence, matches a configured protected/runtime namespace. Expected result: no positive usage claimed, but risk capped and caveated (not an optimistic delete). *(Already added to the ADR backlog as high-priority — this is finding 6.)*
2. **Comma-list with one dead branch, one live branch, same rule** — verifies independent per-branch classification and guards against any future whole-block transformation.
3. **`@extend` target with zero JSX usage** — verifies the standing caveat (ADR §5.1) is present rather than the selector being confidently classified as dead.
4. **HTML-injection/CMS boundary** — a parser-rendered content boundary with selectors reachable only through it; verifies the opaque-sink cap and caveat.
5. **Generic single-word class name** — verifies low-confidence handling; a common English word used as a class name should never reach a confident delete recommendation from token ambiguity alone.
6. **Enumerated/numbered class family that looks dynamic but isn't** — distinguishes "name suggests a template" from "a template literal actually exists in source producing a pattern sink."
7. **Orphaned-component limitation fixture** — a component with real, statically-resolvable className evidence that is itself never imported anywhere; documents, as an explicit accepted v0.1 limitation, that Refactor-CSS reports this as referenced and does not attempt import-graph reachability analysis.
8. **Source-location correctness under blank lines/comments** — regression guard for invariant I6, directly modeling the historical line-offset bug.

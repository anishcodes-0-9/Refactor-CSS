// Derived, versioned wire format (ADR-001 §3) — not a domain concept.
import type { SCHEMA_VERSION, Diagnostic, Finding } from '../domain/index.js';
import type { SelectorRecord } from '../index/types.js';

export interface Coverage {
  filesScanned: number;
  filesByKind: Record<string, number>;
  filesFailed: number;
  cssModuleSelectorsExcluded: number;
  globalOrElementSelectorsExcluded: number;
  duplicateDefinitionKeys: number;
  opaqueSinks: number;
  patternSinks: number;
}

// Timing is telemetry, not analysis output: it must never enter Report,
// so analyze() stays fully deterministic (I8) with no normalization or
// field exclusion required to prove it. Callers that want elapsed time
// (e.g. the CLI's terminal Coverage line) measure it themselves around
// the analyze() call — see src/cli.ts.

export interface Report {
  schemaVersion: typeof SCHEMA_VERSION;
  tool: { name: string; version: string };
  root: string;
  coverage: Coverage;
  selectors: SelectorRecord[];
  findings: Finding[];
  diagnostics: Diagnostic[];
}

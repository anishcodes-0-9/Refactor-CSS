// Derived, module-local container type (ADR-001 §3) — not a domain concept.
import type { Evidence, ReferenceStatus, SelectorDefinition } from '../domain/index.js';

export interface SelectorRecord {
  key: string;
  /** B4: ALL definition sites, never collapsed. */
  definitions: SelectorDefinition[];
  /** resolution === 'exact' usage evidence only — never the definitions themselves. */
  references: Evidence[];
  referenceStatus: ReferenceStatus;
}

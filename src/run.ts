import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractStylesheet } from './css/index.js';
import { discoverFiles } from './discovery/index.js';
import { buildIndex } from './index/index.js';
import { applyRules } from './rules/index.js';
import { buildReport } from './report/index.js';
import type { Report } from './report/types.js';
import { extractSource } from './source/index.js';
import type { Diagnostic, Evidence, SelectorDefinition } from './domain/index.js';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The library entry point (ADR-001 §2). Orchestrates: discovery -> css +
 * source extraction -> index -> rules -> report. Not itself a pure
 * function (it reads the filesystem), but every stage it calls is.
 * Deterministic: no wall-clock or other non-reproducible value is ever
 * written into the returned Report (see report/types.ts).
 *
 * Per-file failure isolation: a file that fails to read or parse is
 * caught individually, recorded as a Diagnostic + a Coverage.filesFailed
 * count, and does not stop the rest of the analysis. This is a plain
 * try/catch around each loop body — not generic recovery machinery (no
 * retries, no partial-file recovery, no error taxonomy beyond the two
 * diagnostic codes below).
 */
export function analyze(root: string): Report {
  const { styleFiles, sourceFiles } = discoverFiles(root);

  const definitions: SelectorDefinition[] = [];
  const diagnostics: Diagnostic[] = [];
  let globalOrElementSelectorsExcluded = 0;
  let filesFailed = 0;

  for (const file of styleFiles) {
    try {
      const content = readFileSync(path.join(root, file), 'utf8');
      const extraction = extractStylesheet(file, content);
      definitions.push(...extraction.definitions);
      globalOrElementSelectorsExcluded += extraction.excludedNonClassSelectorCount;
    } catch (error) {
      filesFailed += 1;
      diagnostics.push({
        severity: 'error',
        code: 'stylesheet-parse-failed',
        message: describeError(error),
        loc: { file, line: 1, column: 1 },
      });
    }
  }

  const evidence: Evidence[] = [];
  for (const file of sourceFiles) {
    try {
      const content = readFileSync(path.join(root, file), 'utf8');
      evidence.push(...extractSource(file, content));
    } catch (error) {
      filesFailed += 1;
      diagnostics.push({
        severity: 'error',
        code: 'source-parse-failed',
        message: describeError(error),
        loc: { file, line: 1, column: 1 },
      });
    }
  }

  diagnostics.sort((a, b) => {
    const fileCompare = (a.loc?.file ?? '').localeCompare(b.loc?.file ?? '');
    if (fileCompare !== 0) return fileCompare;
    const lineCompare = (a.loc?.line ?? 0) - (b.loc?.line ?? 0);
    if (lineCompare !== 0) return lineCompare;
    return a.code.localeCompare(b.code);
  });

  const records = buildIndex(definitions, evidence);
  const findings = applyRules(records);

  const filesByKind: Record<string, number> = {};
  for (const file of [...styleFiles, ...sourceFiles]) {
    const ext = path.extname(file).slice(1);
    filesByKind[ext] = (filesByKind[ext] ?? 0) + 1;
  }

  const duplicateDefinitionKeys = records.filter((r) => r.definitions.length > 1).length;
  const cssModuleSelectorsExcluded = definitions.filter((d) => d.scope === 'css-module').length;

  return buildReport(
    root,
    records,
    findings,
    {
      filesScanned: styleFiles.length + sourceFiles.length,
      filesByKind,
      filesFailed,
      cssModuleSelectorsExcluded,
      globalOrElementSelectorsExcluded,
      duplicateDefinitionKeys,
      opaqueSinks: 0,
      patternSinks: 0,
    },
    diagnostics,
  );
}

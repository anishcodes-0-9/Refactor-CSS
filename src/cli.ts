#!/usr/bin/env node

// cli.ts: argv only, no analysis logic (ADR-001 §2). All real work happens
// in run.ts / report/.
import { analyze } from './run.js';
import { renderTerminal } from './report/index.js';
import { VERSION } from './version.js';

const HELP = `Usage: refactor-css <command> [options]

Refactor-css is a conservative, evidence-based CSS usage analyzer.

Commands:
  analyze <path>  Analyze a repository/fixture root and print findings

Options:
  -v, --version   Print the version number
  -h, --help      Print this help message
`;

function main(argv: string[]): void {
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (argv[0] === 'analyze') {
    const root = argv[1];
    if (!root) {
      process.stderr.write('refactor-css analyze: missing <path>\n');
      process.exitCode = 1;
      return;
    }
    const start = performance.now();
    const report = analyze(root);
    const durationMs = Math.round(performance.now() - start);
    process.stdout.write(renderTerminal(report, { durationMs }));
    return;
  }

  process.stdout.write(HELP);
}

main(process.argv.slice(2));

#!/usr/bin/env node

// M0 scaffold only — no analysis logic. See docs/adr-001-v0.1-architecture.md §7.
// The version string is a literal, not read from package.json, to avoid an
// import that reaches outside `rootDir` (src/); keep it in sync with the
// "version" field in package.json until a real build-time injection exists.
const VERSION = '0.0.0';

const HELP = `Usage: refactor-css [options]

Refactor-CSS is a conservative, evidence-based CSS usage analyzer.
This is a pre-release scaffold — no commands are implemented yet.

Options:
  -v, --version   Print the version number
  -h, --help      Print this help message
`;

function main(argv: string[]): void {
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  process.stdout.write(HELP);
}

main(process.argv.slice(2));

// Single source of truth for the two runtime consumers that need the
// package version (cli.ts's --version, report/'s Report.tool.version).
// A literal, not read from package.json, to avoid an import that reaches
// outside `rootDir` (src/) — see tsconfig.json. Keep in sync with
// package.json's "version" field; test/cli-version.test.ts guards drift.
export const VERSION = '0.0.0';

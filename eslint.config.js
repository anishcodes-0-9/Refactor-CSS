// Import-boundary rules enforce the dependency direction in
// docs/adr-001-v0.1-architecture.md §2. Only the two constraints that are
// unambiguous *and* currently meaningful are encoded here:
//   - src/domain/** imports nothing internal, and nothing outside itself (B2).
//   - nothing may import src/cli.ts ("cli -> run -> everything; nothing imports cli").
// The fuller module graph (config/discovery/css/source/index/rules/report) is
// intentionally not encoded yet — none of those directories exist in M0, and
// pre-writing rules for modules that don't exist is exactly the kind of
// placeholder architecture the ADR warns against. Add zones as each module
// lands.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'fixtures/**'],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    // B2: "src/domain/ imports nothing internal and has zero runtime dependencies."
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'src/domain must not import anything outside itself (ADR-001 B2).',
            },
          ],
        },
      ],
    },
  },
  {
    // "cli -> run -> everything; nothing imports cli" (§2).
    files: ['src/**/*.ts'],
    ignores: ['src/cli.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: './cli.js',
              message: 'Nothing may import src/cli.ts (ADR-001 §2) — the CLI depends on the library, never the reverse.',
            },
          ],
        },
      ],
    },
  },
);

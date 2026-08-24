import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// cli.ts hardcodes its VERSION literal rather than importing package.json
// (see the comment in src/cli.ts for why). This test is the guard against
// that literal drifting from package.json's real version: it runs the
// actual *built* CLI as a subprocess — exactly how a real user invokes it —
// and compares its output to package.json directly, without either one
// importing the other.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('cli --version', () => {
  it('matches the version in package.json', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      version: string;
    };

    const output = execFileSync('node', [path.join(repoRoot, 'dist/cli.js'), '--version'], {
      encoding: 'utf8',
    });

    expect(output.trim()).toBe(pkg.version);
  });
});

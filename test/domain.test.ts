import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../src/index.js';

describe('domain', () => {
  it('exports the current schema version', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

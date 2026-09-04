import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { ProvenanceResult } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { makeConfig } from '../../test/fixtures/wizardFixtures';
import { createTestCodegenService } from './testCodegenService';

const PROVENANCE: ProvenanceResult = {
  files: { 'README.md': { entries: [{ kind: 'file', paths: ['token.name'] }] } },
};

describe('createTestCodegenService provenance (INV-6)', () => {
  it.each([
    ['not asked, not configured', undefined, false, false],
    ['asked, not configured', undefined, true, false],
    ['not asked, configured', PROVENANCE, false, false],
    ['asked, configured', PROVENANCE, true, true],
  ] as const)('%s → present: %s', async (_label, provenance, asked, present) => {
    const service = createTestCodegenService(provenance ? { provenance } : undefined);
    const artifact = await service.generateFileTree(makeConfig(), {
      recordProvenance: asked,
    });
    expect(Object.prototype.hasOwnProperty.call(artifact, 'provenance')).toBe(present);
    if (present) expect(artifact.provenance).toBe(PROVENANCE);
  });

  it('function form receives the exact config generateFileTree was given, once per call', async () => {
    const provenance = vi.fn<(config: RWAConfig) => ProvenanceResult>(() => PROVENANCE);
    const service = createTestCodegenService({ provenance });
    const config = makeConfig();
    await service.generateFileTree(config, { recordProvenance: true });
    expect(provenance).toHaveBeenCalledTimes(1);
    expect(provenance.mock.calls[0]?.[0]).toBe(config);
  });

  it('function form is not invoked when not asked', async () => {
    const provenance = vi.fn(() => PROVENANCE);
    await createTestCodegenService({ provenance }).generateFileTree(makeConfig());
    expect(provenance).not.toHaveBeenCalled();
  });

  it('ships no chain vocabulary (INV-27)', () => {
    const text = readFileSync(resolve(__dirname, 'testCodegenService.ts'), 'utf8');
    expect(text).not.toMatch(/\.rs\b|Cargo|stellar|soroban/i);
  });
});

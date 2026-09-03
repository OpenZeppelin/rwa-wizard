import { describe, expect, it } from 'vitest';

import { computeConfigHash } from '@openzeppelin/codegen-core';
import { generate, generateWithIdentitySupport } from '@openzeppelin/codegen-rwa-stellar';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { stellarPreviewCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { diffChangedPaths } from './diffChangedPaths';
import { listChangedPaths } from './listChangedPaths';
import { createStepFileTreeSnapshot } from './stepFileTreeSnapshot';
import { toPreviewConfig } from './toPreviewConfig';

/**
 * Same key shape `useCodePreview.computeGenerateKey` builds: every input of
 * `generateFileTree`, not just the config.
 */
function generateKey(config: RWAConfig, includeIdentitySupport = false): string {
  return `${computeConfigHash(config)}|identity:${includeIdentitySupport ? 1 : 0}|service:stellar`;
}

describe('listChangedPaths with real config hashes (INV-6, INV-17)', () => {
  it('returns [] when preview config is unchanged across generates', () => {
    const { config } = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const entry = generate(config);
    const snapshot = createStepFileTreeSnapshot(entry.files, generateKey(config));
    const later = generate(config);

    expect(computeConfigHash(config), 'INV-17: hash input matches generator metadata').toBe(
      entry.metadata.configHash
    );
    expect(
      listChangedPaths(snapshot, later.files, generateKey(config)),
      'INV-6: same logical config → empty marks'
    ).toEqual([]);
  });

  it('returns exactly diffChangedPaths when preview config changes', () => {
    const entryPreview = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const entry = generate(entryPreview.config);
    const snapshot = createStepFileTreeSnapshot(entry.files, generateKey(entryPreview.config));

    const laterPreview = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const laterConfig = {
      ...laterPreview.config,
      token: { ...laterPreview.config.token, name: 'Renamed preview token' },
    };
    const later = generate(laterConfig);

    expect(generateKey(laterConfig)).not.toBe(snapshot.generateKey);

    const changed = listChangedPaths(snapshot, later.files, generateKey(laterConfig));
    const diff = diffChangedPaths(snapshot.files, later.files);

    expect(changed, 'INV-6: differing key must match byte diff').toEqual(diff);
    expect(changed.length).toBeGreaterThan(0);
  });

  /**
   * Varies only the identity-support generate option against real codegen. The
   * config — and therefore `computeConfigHash` — is byte-identical across the
   * two generates, so a key built from the config alone reported no change
   * while the tree gained the whole identity scaffolding.
   */
  it('marks the identity scaffolding when only includeIdentitySupport changes', () => {
    const { config } = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const withoutIdentity = generate(config);
    const withIdentity = generateWithIdentitySupport(config);

    const snapshot = createStepFileTreeSnapshot(withoutIdentity.files, generateKey(config, false));

    expect(
      computeConfigHash(config),
      'the config is unchanged — only a generate option moved'
    ).toBe(computeConfigHash(config));

    const changed = listChangedPaths(snapshot, withIdentity.files, generateKey(config, true));

    expect(changed, 'a generate-option change must still produce marks').not.toEqual([]);
    expect(changed).toEqual(diffChangedPaths(snapshot.files, withIdentity.files));
  });

  it('token name change marks config/readme subset, not contract.rs (INV-2 blast radius)', () => {
    const entryPreview = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const snapshot = createStepFileTreeSnapshot(
      generate(entryPreview.config).files,
      generateKey(entryPreview.config)
    );

    const laterConfig = {
      ...entryPreview.config,
      token: { ...entryPreview.config.token, name: 'Different Name' },
    };
    const laterFiles = generate(laterConfig).files;
    const changed = listChangedPaths(snapshot, laterFiles, generateKey(laterConfig));
    const diff = diffChangedPaths(snapshot.files, laterFiles);

    expect(changed, 'INV-6: key-differ path must match diff').toEqual(diff);
    expect(changed).toContain('config.json');
    expect(changed).toContain('README.md');
    expect(changed.length).toBeGreaterThan(0);
    expect(
      changed.some((path) => path.includes('contract.rs')),
      'INV-2: token name blast radius must not touch contract.rs'
    ).toBe(false);
  });
});

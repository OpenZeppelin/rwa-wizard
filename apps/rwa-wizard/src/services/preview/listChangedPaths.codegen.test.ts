import { describe, expect, it } from 'vitest';

import { computeConfigHash } from '@openzeppelin/codegen-core';
import { generate } from '@openzeppelin/codegen-rwa-stellar';

import { stellarPreviewCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { diffChangedPaths } from './diffChangedPaths';
import { listChangedPaths } from './listChangedPaths';
import { createStepFileTreeSnapshot } from './stepFileTreeSnapshot';
import { toPreviewConfig } from './toPreviewConfig';

describe('listChangedPaths with real config hashes (INV-6, INV-17)', () => {
  it('returns [] when preview config is unchanged across generates', () => {
    const { config } = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const entry = generate(config);
    const snapshot = createStepFileTreeSnapshot(entry.files, config);
    const later = generate(config);
    const currentHash = computeConfigHash(config);

    expect(currentHash, 'INV-17: hash input matches generator metadata').toBe(
      entry.metadata.configHash
    );
    expect(
      listChangedPaths(snapshot, later.files, currentHash),
      'INV-6: same logical config → empty marks'
    ).toEqual([]);
  });

  it('returns exactly diffChangedPaths when preview config changes', () => {
    const entryPreview = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const entry = generate(entryPreview.config);
    const snapshot = createStepFileTreeSnapshot(entry.files, entryPreview.config);

    const laterPreview = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const laterConfig = {
      ...laterPreview.config,
      token: { ...laterPreview.config.token, name: 'Renamed preview token' },
    };
    const later = generate(laterConfig);
    const laterHash = computeConfigHash(laterConfig);

    expect(laterHash).not.toBe(snapshot.configHash);

    const changed = listChangedPaths(snapshot, later.files, laterHash);
    const diff = diffChangedPaths(snapshot.files, later.files);

    expect(changed, 'INV-6: differing hash must match byte diff').toEqual(diff);
    expect(changed.length).toBeGreaterThan(0);
  });

  it('token name change marks config/readme subset, not contract.rs (INV-2 blast radius)', () => {
    const entryPreview = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const snapshot = createStepFileTreeSnapshot(
      generate(entryPreview.config).files,
      entryPreview.config
    );

    const laterConfig = {
      ...entryPreview.config,
      token: { ...entryPreview.config.token, name: 'Different Name' },
    };
    const laterFiles = generate(laterConfig).files;
    const changed = listChangedPaths(snapshot, laterFiles, computeConfigHash(laterConfig));
    const diff = diffChangedPaths(snapshot.files, laterFiles);

    expect(changed, 'INV-6: hash-differ path must match diff').toEqual(diff);
    expect(changed).toContain('config.json');
    expect(changed).toContain('README.md');
    expect(changed.length).toBeGreaterThan(0);
    expect(
      changed.some((path) => path.includes('contract.rs')),
      'INV-2: token name blast radius must not touch contract.rs'
    ).toBe(false);
  });
});

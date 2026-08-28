import { describe, expect, it, vi } from 'vitest';

import {
  FIXTURE_REV_A,
  gitModeRevision,
  SAMPLE_IMPORT_LINKS,
} from '../../../test/helpers/importLinkFixtures';
import { buildImportTargetUrl } from './buildImportTargetUrl';
import { matchImportIdentifiers } from './matchImportIdentifiers';

const TARGET = SAMPLE_IMPORT_LINKS.targets[0];
const IDENTIFIERS = SAMPLE_IMPORT_LINKS.targets.map((target) => target.identifier);

describe('importLinks purity (INV-9, INV-17)', () => {
  it('pure helpers return equal results on repeated invocation (INV-9)', () => {
    const revision = gitModeRevision(FIXTURE_REV_A);

    expect(buildImportTargetUrl(revision, TARGET)).toBe(buildImportTargetUrl(revision, TARGET));
    expect(matchImportIdentifiers(TARGET.identifier, 0, IDENTIFIERS)).toEqual(
      matchImportIdentifiers(TARGET.identifier, 0, IDENTIFIERS)
    );
  });

  it('does not log or fetch during match or URL build (INV-17)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('forbidden')));

    buildImportTargetUrl(gitModeRevision(FIXTURE_REV_A), TARGET);
    matchImportIdentifiers(TARGET.identifier, 0, IDENTIFIERS);

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
    fetchSpy.mockRestore();
  });
});

describe('services/preview barrel exports (INV-21)', () => {
  it('re-exports the synchronous importLinks helpers from the preview barrel', async () => {
    const preview = await import('../index');

    expect(typeof preview.buildImportTargetUrl).toBe('function');
    expect(typeof preview.matchImportIdentifiers).toBe('function');
    expect(typeof preview.createImportLinkDecorator).toBe('function');
  });

  it('no longer exports a tree parser: the revision comes from the codegen service', async () => {
    const preview = await import('../index');

    expect(
      'resolveStellarSourceRevision' in preview,
      'constitution §I: the UI must not parse chain-specific generated files'
    ).toBe(false);
  });

  it('no longer exports a crate map: link targets come from the codegen service', async () => {
    const preview = await import('../index');

    expect(
      Object.keys(preview).filter((name) => /stellar/i.test(name)),
      'constitution §I: chain-specific knowledge belongs to the codegen package'
    ).toEqual([]);
  });
});

import { describe, expect, it, vi } from 'vitest';

import { FIXTURE_REV_A, gitModeTree } from '../../../test/helpers/stellarImportFixtures';
import { buildStellarCrateUrl } from './buildStellarCrateUrl';
import { matchStellarCratesInText } from './matchStellarCratesInText';
import { resolveStellarSourceRevision } from './parseStellarSourceRevision';

describe('stellarImports purity (INV-9, INV-17)', () => {
  it('pure helpers return equal results on repeated invocation (INV-9)', () => {
    const files = gitModeTree(FIXTURE_REV_A);
    const revision = resolveStellarSourceRevision(files)!;
    expect(buildStellarCrateUrl(revision, 'stellar_tokens')).toBe(
      buildStellarCrateUrl(revision, 'stellar_tokens')
    );
    expect(matchStellarCratesInText('stellar_access', 0)).toEqual(
      matchStellarCratesInText('stellar_access', 0)
    );
  });

  it('does not log or fetch during parse, match, or URL build (INV-17)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('forbidden')));

    const revision = resolveStellarSourceRevision(gitModeTree(FIXTURE_REV_A))!;
    buildStellarCrateUrl(revision, 'stellar_access');
    matchStellarCratesInText('stellar_macros', 0);

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
    fetchSpy.mockRestore();
  });
});

describe('services/preview barrel exports (INV-21)', () => {
  it('re-exports synchronous stellarImports helpers from the preview barrel', async () => {
    const preview = await import('../index');
    expect(typeof preview.resolveStellarSourceRevision).toBe('function');
    expect(typeof preview.buildStellarCrateUrl).toBe('function');
    expect(typeof preview.matchStellarCratesInText).toBe('function');
    expect(typeof preview.createStellarImportDecorator).toBe('function');
    expect(preview.STELLAR_CRATE_REPO_PATHS.stellar_access).toBe('packages/access');
  });
});

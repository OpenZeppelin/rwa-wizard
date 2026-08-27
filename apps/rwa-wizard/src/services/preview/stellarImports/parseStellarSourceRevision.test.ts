import { describe, expect, it } from 'vitest';

import {
  bundledReadme,
  CODEGEN_PACKAGE_PIN,
  conflictingRevManifest,
  FIXTURE_REV_A,
  FIXTURE_REV_B,
  gitModeManifestWithoutRev,
  gitModeTree,
  localCheckoutReadme,
  localPathManifest,
  localPathTree,
  previewTree,
  README_ONLY_COMMIT,
  README_PROSE_COMMIT,
} from '../../../test/helpers/stellarImportFixtures';
import { resolveStellarSourceRevision } from './parseStellarSourceRevision';

describe('resolveStellarSourceRevision request/response (INV-1, INV-3, INV-4)', () => {
  it('reads rev from the preview tree manifest, not the codegen package pin (INV-1)', () => {
    const revision = resolveStellarSourceRevision(gitModeTree(FIXTURE_REV_A));
    expect(revision?.commitHash, 'INV-1: parsed hash must match manifest rev on screen').toBe(
      FIXTURE_REV_A
    );
    expect(
      revision?.commitHash,
      'INV-1: tree-sourced revision must not silently equal the installed codegen pin unless the manifest says so'
    ).not.toBe(CODEGEN_PACKAGE_PIN);
  });

  it('returns null when Cargo.toml is missing (INV-7)', () => {
    expect(resolveStellarSourceRevision({ 'README.md': bundledReadme() })).toBeNull();
  });

  it('returns null when stellar workspace lines disagree on rev (INV-4)', () => {
    expect(
      resolveStellarSourceRevision(previewTree(conflictingRevManifest())),
      'INV-4: conflicting rev lines must fail closed with null'
    ).toBeNull();
  });

  it('local-path mode keeps commitHash null even when README names a checkout commit (INV-3)', () => {
    const revision = resolveStellarSourceRevision(
      localPathTree(localCheckoutReadme(README_PROSE_COMMIT))
    );
    expect(revision?.mode, 'INV-3: path dependencies force local-path mode').toBe('local-path');
    expect(
      revision?.commitHash,
      'INV-3: README checkout prose must not become a link revision in local-path mode'
    ).toBeNull();
  });

  it('does not substitute README hash when any stellar line uses path = (INV-3)', () => {
    const revision = resolveStellarSourceRevision(
      previewTree(localPathManifest(), bundledReadme(README_ONLY_COMMIT))
    );
    expect(revision?.commitHash).toBeNull();
    expect(revision?.provenance).toBe('cargo-manifest');
  });

  it('falls back to README commit only in git mode without manifest rev (INV-1, INV-3 guard)', () => {
    const revision = resolveStellarSourceRevision(
      previewTree(gitModeManifestWithoutRev(), bundledReadme(README_ONLY_COMMIT))
    );
    expect(revision?.mode).toBe('git-revision');
    expect(revision?.commitHash).toBe(README_ONLY_COMMIT.slice(0, 7));
    expect(revision?.provenance).toBe('readme-prose');
  });

  it('is a pure function of the FileTree argument (INV-9)', () => {
    const files = gitModeTree(FIXTURE_REV_B);
    const first = resolveStellarSourceRevision(files);
    const second = resolveStellarSourceRevision(files);
    expect(second).toEqual(first);
  });
});

describe('resolveStellarSourceRevision fail-soft parsing (INV-7)', () => {
  it('does not throw for garbage manifest content', () => {
    expect(() =>
      resolveStellarSourceRevision(previewTree('not valid toml at all\nstellar-tokens = ???'))
    ).not.toThrow();
    expect(resolveStellarSourceRevision(previewTree(''))).toBeNull();
  });
});

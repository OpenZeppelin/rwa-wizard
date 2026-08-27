import { describe, expect, it } from 'vitest';

import {
  anchorCountFromDecorator,
  FIXTURE_REV_A,
  FIXTURE_REV_B,
  FORBIDDEN_COMMIT_PINNED_URL_PATTERNS,
  gitModeTree,
  hrefFromDecorator,
  localCheckoutReadme,
  localPathTree,
  memoizedPreviewLinks,
  README_PROSE_COMMIT,
  STELLAR_REPO_URL,
} from '../../../test/helpers/stellarImportFixtures';
import { buildStellarCrateUrl } from './buildStellarCrateUrl';
import { createStellarImportDecorator } from './createStellarImportDecorator';
import { resolveStellarSourceRevision } from './parseStellarSourceRevision';

describe('revision-link alignment (INV-2, INV-10)', () => {
  it('builds distinct tree URLs for two revision snapshots (INV-10)', () => {
    const revisionA = resolveStellarSourceRevision(gitModeTree(FIXTURE_REV_A))!;
    const revisionB = resolveStellarSourceRevision(gitModeTree(FIXTURE_REV_B))!;
    const urlA = buildStellarCrateUrl(revisionA, 'stellar_access');
    const urlB = buildStellarCrateUrl(revisionB, 'stellar_access');

    expect(urlA).toContain(`/tree/${FIXTURE_REV_A}/`);
    expect(urlB).toContain(`/tree/${FIXTURE_REV_B}/`);
    expect(urlA).not.toContain(FIXTURE_REV_B);
    expect(urlB).not.toContain(FIXTURE_REV_A);
  });

  it('decorators closed over different revisions emit different href commit segments (INV-2, INV-10)', () => {
    const decoratorA = createStellarImportDecorator(
      resolveStellarSourceRevision(gitModeTree(FIXTURE_REV_A))
    );
    const decoratorB = createStellarImportDecorator(
      resolveStellarSourceRevision(gitModeTree(FIXTURE_REV_B))
    );

    const hrefA = hrefFromDecorator(decoratorA);
    const hrefB = hrefFromDecorator(decoratorB);

    expect(hrefA).toContain(`/tree/${FIXTURE_REV_A}/`);
    expect(hrefB).toContain(`/tree/${FIXTURE_REV_B}/`);
    expect(hrefA).not.toContain(FIXTURE_REV_B);
    expect(hrefB).not.toContain(FIXTURE_REV_A);
  });

  it('updates href commit segments after regenerate when memo keys track files then revision (INV-2, INV-10)', () => {
    const firstGeneration = memoizedPreviewLinks(gitModeTree(FIXTURE_REV_A));
    const firstHref = hrefFromDecorator(firstGeneration.decorator);
    expect(firstHref).toContain(`/tree/${FIXTURE_REV_A}/`);

    const secondGeneration = memoizedPreviewLinks(gitModeTree(FIXTURE_REV_B));
    const secondHref = hrefFromDecorator(secondGeneration.decorator);

    expect(
      secondHref,
      'INV-10: regenerated tree must move links to the new manifest rev'
    ).toContain(`/tree/${FIXTURE_REV_B}/`);
    expect(secondHref).not.toContain(FIXTURE_REV_A);
    expect(secondGeneration.revision?.commitHash).toBe(FIXTURE_REV_B);
  });

  it('stale decorator snapshot cannot track a new on-screen manifest rev (INV-2, INV-10)', () => {
    const onScreenFiles = gitModeTree(FIXTURE_REV_B);
    const onScreenRevision = resolveStellarSourceRevision(onScreenFiles)!;

    const staleDecorator = createStellarImportDecorator(
      resolveStellarSourceRevision(gitModeTree(FIXTURE_REV_A))
    );
    const freshDecorator = createStellarImportDecorator(onScreenRevision);

    const staleHref = hrefFromDecorator(staleDecorator);
    const freshHref = hrefFromDecorator(freshDecorator);

    expect(
      staleHref,
      'INV-10: stale memo must not silently match the on-screen revision'
    ).toContain(`/tree/${FIXTURE_REV_A}/`);
    expect(freshHref).toContain(`/tree/${onScreenRevision.commitHash}/`);
    expect(staleHref).not.toBe(freshHref);
  });
});

describe('no revision means no commit-pinned URL (INV-3)', () => {
  it('local-path revision keeps commitHash null despite README checkout prose (INV-3)', () => {
    const revision = resolveStellarSourceRevision(
      localPathTree(localCheckoutReadme(README_PROSE_COMMIT))
    );
    expect(revision?.commitHash).toBeNull();
  });

  it.each(FORBIDDEN_COMMIT_PINNED_URL_PATTERNS)(
    'repo-root degrade href avoids $name (INV-3)',
    ({ pattern }) => {
      const { decorator } = memoizedPreviewLinks(
        localPathTree(localCheckoutReadme(README_PROSE_COMMIT))
      );
      const href = hrefFromDecorator(decorator);
      expect(href, 'INV-3: degraded href must stay at repo root').toBe(STELLAR_REPO_URL);
      expect(href, `INV-3: forbidden commit-pinned pattern ${pattern}`).not.toMatch(pattern);
    }
  );

  it('does not embed README prose commit in buildStellarCrateUrl output (INV-3)', () => {
    const revision = resolveStellarSourceRevision(
      localPathTree(localCheckoutReadme(README_PROSE_COMMIT))
    )!;
    const url = buildStellarCrateUrl(revision, 'stellar_access')!;
    expect(url).toBe(STELLAR_REPO_URL);
    expect(url).not.toContain(README_PROSE_COMMIT);
    expect(url).not.toContain(README_PROSE_COMMIT.slice(0, 7));
  });

  it('plain-text degrade emits zero anchors for local-path revision (INV-3)', () => {
    const revision = resolveStellarSourceRevision(localPathTree());
    const decorator = createStellarImportDecorator(revision, { degradeMode: 'plain-text' });
    expect(anchorCountFromDecorator(decorator)).toBe(0);
  });
});

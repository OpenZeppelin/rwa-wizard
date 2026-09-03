import { describe, expect, it } from 'vitest';

import {
  anchorCountFromDecorator,
  FIXTURE_REV_A,
  FIXTURE_REV_B,
  FORBIDDEN_COMMIT_PINNED_URL_PATTERNS,
  gitModeRevision,
  hrefFromDecorator,
  localPathRevision,
  memoizedPreviewLinks,
  SAMPLE_IMPORT_LINKS,
  STELLAR_REPO_URL,
} from '../../../test/helpers/importLinkFixtures';
import { buildImportTargetUrl } from './buildImportTargetUrl';
import { createImportLinkDecorator } from './createImportLinkDecorator';

const ACCESS_TARGET = SAMPLE_IMPORT_LINKS.targets[0];

describe('revision-link alignment (INV-2, INV-10)', () => {
  it('builds distinct tree URLs for two revision snapshots (INV-10)', () => {
    const urlA = buildImportTargetUrl(gitModeRevision(FIXTURE_REV_A), ACCESS_TARGET);
    const urlB = buildImportTargetUrl(gitModeRevision(FIXTURE_REV_B), ACCESS_TARGET);

    expect(urlA).toContain(`/tree/${FIXTURE_REV_A}/`);
    expect(urlB).toContain(`/tree/${FIXTURE_REV_B}/`);
    expect(urlA).not.toContain(FIXTURE_REV_B);
    expect(urlB).not.toContain(FIXTURE_REV_A);
  });

  it('decorators closed over different revisions emit different href commit segments (INV-2, INV-10)', () => {
    const hrefA = hrefFromDecorator(
      createImportLinkDecorator(gitModeRevision(FIXTURE_REV_A), SAMPLE_IMPORT_LINKS)
    );
    const hrefB = hrefFromDecorator(
      createImportLinkDecorator(gitModeRevision(FIXTURE_REV_B), SAMPLE_IMPORT_LINKS)
    );

    expect(hrefA).toContain(`/tree/${FIXTURE_REV_A}/`);
    expect(hrefB).toContain(`/tree/${FIXTURE_REV_B}/`);
    expect(hrefA).not.toContain(FIXTURE_REV_B);
    expect(hrefB).not.toContain(FIXTURE_REV_A);
  });

  it('updates href commit segments when the memo key tracks the reported revision (INV-2, INV-10)', () => {
    const first = memoizedPreviewLinks(gitModeRevision(FIXTURE_REV_A));
    expect(hrefFromDecorator(first.decorator)).toContain(`/tree/${FIXTURE_REV_A}/`);

    const second = memoizedPreviewLinks(gitModeRevision(FIXTURE_REV_B));
    const secondHref = hrefFromDecorator(second.decorator);

    expect(secondHref, 'INV-10: a new reported revision must move the links').toContain(
      `/tree/${FIXTURE_REV_B}/`
    );
    expect(secondHref).not.toContain(FIXTURE_REV_A);
    expect(second.revision?.commitHash).toBe(FIXTURE_REV_B);
  });

  it('stale decorator snapshot cannot track a newer reported revision (INV-2, INV-10)', () => {
    const current = gitModeRevision(FIXTURE_REV_B);
    const staleHref = hrefFromDecorator(
      createImportLinkDecorator(gitModeRevision(FIXTURE_REV_A), SAMPLE_IMPORT_LINKS)
    );
    const freshHref = hrefFromDecorator(createImportLinkDecorator(current, SAMPLE_IMPORT_LINKS));

    expect(staleHref, 'INV-10: stale memo must not silently match the current revision').toContain(
      `/tree/${FIXTURE_REV_A}/`
    );
    expect(freshHref).toContain(`/tree/${current.commitHash!}/`);
    expect(staleHref).not.toBe(freshHref);
  });
});

describe('no revision means no commit-pinned URL (INV-3)', () => {
  it.each(FORBIDDEN_COMMIT_PINNED_URL_PATTERNS)(
    'repo-root degrade href avoids $name (INV-3)',
    ({ pattern }) => {
      const { decorator } = memoizedPreviewLinks(localPathRevision());
      const href = hrefFromDecorator(decorator);
      expect(href, 'INV-3: degraded href must stay at repo root').toBe(STELLAR_REPO_URL);
      expect(href, `INV-3: forbidden commit-pinned pattern ${pattern}`).not.toMatch(pattern);
    }
  );

  it('builds only the repo root when the revision pins no commit (INV-3)', () => {
    expect(buildImportTargetUrl(localPathRevision(), ACCESS_TARGET)).toBe(STELLAR_REPO_URL);
  });

  it('plain-text degrade emits zero anchors for an unpinned revision (INV-3)', () => {
    const decorator = createImportLinkDecorator(localPathRevision(), SAMPLE_IMPORT_LINKS, {
      degradeMode: 'plain-text',
    });
    expect(anchorCountFromDecorator(decorator)).toBe(0);
  });

  it('emits no anchors at all when the target reports no revision', () => {
    expect(anchorCountFromDecorator(createImportLinkDecorator(null, SAMPLE_IMPORT_LINKS))).toBe(0);
  });

  it('emits no anchors when the target reports no import links', () => {
    expect(
      anchorCountFromDecorator(createImportLinkDecorator(gitModeRevision(FIXTURE_REV_A), null)),
      'the decorator exists only where the active package supplies targets'
    ).toBe(0);
  });
});

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Fragment, type ReactElement } from 'react';

import {
  FIXTURE_REV_A,
  gitModeRevision,
  hrefFromDecorator,
  localPathRevision,
  SAMPLE_IMPORT_LINKS,
  SAMPLE_LANGUAGE,
  SAMPLE_USE_LEAF,
  SAMPLE_USE_LEAF_OFFSET,
  SAMPLE_USE_SOURCE,
  STELLAR_REPO_URL,
} from '../../../test/helpers/importLinkFixtures';
import { createImportLinkDecorator } from './createImportLinkDecorator';

/**
 * The factory returns `null` when there is nothing to link, so a case about how
 * a decorator treats a token has to assert one exists before asking.
 */
function decoratorFor(
  ...args: Parameters<typeof createImportLinkDecorator>
): NonNullable<ReturnType<typeof createImportLinkDecorator>> {
  const decorator = createImportLinkDecorator(...args);
  if (decorator === null) {
    throw new Error('expected these links to produce a decorator');
  }
  return decorator;
}

describe('createImportLinkDecorator request/response (INV-8, INV-16)', () => {
  it('returns undefined for a language the links do not describe (INV-8)', () => {
    const decorator = decoratorFor(gitModeRevision(FIXTURE_REV_A), SAMPLE_IMPORT_LINKS);

    expect(
      decorator({
        source: SAMPLE_USE_SOURCE,
        language: 'toml',
        token: { text: SAMPLE_USE_LEAF, offset: SAMPLE_USE_LEAF_OFFSET },
      })
    ).toBeUndefined();
  });

  it('produces no decorator when revision is null (INV-8)', () => {
    expect(createImportLinkDecorator(null, SAMPLE_IMPORT_LINKS)).toBeNull();
  });

  /**
   * A target whose codegen package reports no import links gets no decorator at
   * all, which is what stops the preview from linking one ecosystem's
   * identifiers in another ecosystem's generated code — and what keeps CodeView
   * from calling a decorator per leaf on a file that has nothing to link.
   */
  it('produces no decorator when the package reports no import links (INV-8)', () => {
    expect(createImportLinkDecorator(gitModeRevision(FIXTURE_REV_A), null)).toBeNull();
    expect(
      createImportLinkDecorator(gitModeRevision(FIXTURE_REV_A), {
        ...SAMPLE_IMPORT_LINKS,
        targets: [],
      })
    ).toBeNull();
  });

  it('skips identifier-like text outside an import line (INV-16)', () => {
    const decorator = decoratorFor(gitModeRevision(FIXTURE_REV_A), SAMPLE_IMPORT_LINKS);
    const commentSource = '// stellar_access is mentioned here\n';

    expect(
      decorator({
        source: commentSource,
        language: SAMPLE_LANGUAGE,
        token: { text: 'stellar_access', offset: commentSource.indexOf('stellar_access') },
      }),
      'INV-16: the import prefix is the package\u2019s, but the gate still has to hold'
    ).toBeUndefined();
  });

  it('links reported identifiers on an import line when revision is present (INV-16)', () => {
    const decorator = decoratorFor(gitModeRevision(FIXTURE_REV_A), SAMPLE_IMPORT_LINKS);

    expect(
      hrefFromDecorator(decorator),
      'INV-16: import-line gate must allow links when revision exists'
    ).toContain(`/tree/${FIXTURE_REV_A}/packages/access`);
  });

  it('applies whatever import syntax the package reports, not a fixed one', () => {
    const source = 'require pkg_thing;\nuse pkg_thing;\n';
    const decorator = decoratorFor(gitModeRevision(FIXTURE_REV_A), {
      language: SAMPLE_LANGUAGE,
      importLinePrefix: 'require ',
      targets: [{ identifier: 'pkg_thing', path: 'src/thing' }],
    });

    const onRequireLine = decorator({
      source,
      language: SAMPLE_LANGUAGE,
      token: { text: 'pkg_thing', offset: source.indexOf('pkg_thing') },
    });
    const onUseLine = decorator({
      source,
      language: SAMPLE_LANGUAGE,
      token: { text: 'pkg_thing', offset: source.lastIndexOf('pkg_thing') },
    });

    expect(onRequireLine).toBeDefined();
    expect(onUseLine, 'the wizard has no import syntax of its own to fall back on').toBeUndefined();
  });
});

describe('createImportLinkDecorator degrade modes (INV-3, INV-8)', () => {
  it('plain-text degrade produces no decorator for a local-path revision (INV-3, INV-8)', () => {
    expect(
      createImportLinkDecorator(localPathRevision(), SAMPLE_IMPORT_LINKS, {
        degradeMode: 'plain-text',
      })
    ).toBeNull();
  });

  it('repo-root degrade links to normalized repoUrl without /tree/ (INV-3)', () => {
    const decorator = decoratorFor(localPathRevision(), SAMPLE_IMPORT_LINKS);
    const href = hrefFromDecorator(decorator);

    expect(href, 'INV-3: local-path degrade must not invent a commit-pinned URL').toBe(
      STELLAR_REPO_URL
    );
    expect(href).not.toMatch(/\/tree\//);
  });
});

describe('createImportLinkDecorator source fidelity (INV-15)', () => {
  it('preserves the full leaf text when splitting into fragments (INV-15)', () => {
    const decorator = decoratorFor(gitModeRevision(FIXTURE_REV_A), SAMPLE_IMPORT_LINKS);

    const node = decorator({
      source: SAMPLE_USE_SOURCE,
      language: SAMPLE_LANGUAGE,
      token: { text: SAMPLE_USE_LEAF, offset: SAMPLE_USE_LEAF_OFFSET },
    });

    expect(node).toBeDefined();
    const { container } = render(<Fragment>{node as ReactElement}</Fragment>);
    expect(container.textContent).toBe(SAMPLE_USE_LEAF);
  });
});

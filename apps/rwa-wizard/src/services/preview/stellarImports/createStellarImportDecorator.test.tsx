import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Fragment, type ReactElement } from 'react';

import {
  FIXTURE_REV_A,
  gitModeRevision,
  hrefFromDecorator,
  localPathRevision,
  SAMPLE_USE_LEAF,
  SAMPLE_USE_LEAF_OFFSET,
  SAMPLE_USE_SOURCE,
  STELLAR_REPO_URL,
} from '../../../test/helpers/stellarImportFixtures';
import { createStellarImportDecorator } from './createStellarImportDecorator';

describe('createStellarImportDecorator request/response (INV-8, INV-16)', () => {
  it('returns undefined for non-rust languages (INV-8)', () => {
    const revision = gitModeRevision(FIXTURE_REV_A);
    const decorator = createStellarImportDecorator(revision);
    expect(
      decorator({
        source: SAMPLE_USE_SOURCE,
        language: 'toml',
        token: { text: SAMPLE_USE_LEAF, offset: SAMPLE_USE_LEAF_OFFSET },
      })
    ).toBeUndefined();
  });

  it('returns undefined when revision is null (INV-8)', () => {
    const decorator = createStellarImportDecorator(null);
    expect(
      decorator({
        source: SAMPLE_USE_SOURCE,
        language: 'rust',
        token: { text: SAMPLE_USE_LEAF, offset: SAMPLE_USE_LEAF_OFFSET },
      })
    ).toBeUndefined();
  });

  it('skips crate-like text outside a use line (INV-16)', () => {
    const revision = gitModeRevision(FIXTURE_REV_A);
    const decorator = createStellarImportDecorator(revision);
    const commentSource = '// stellar_access is mentioned here\n';
    expect(
      decorator({
        source: commentSource,
        language: 'rust',
        token: { text: 'stellar_access', offset: commentSource.indexOf('stellar_access') },
      })
    ).toBeUndefined();
  });

  it('decorates mapped crates on a use line when revision is present (INV-16)', () => {
    const revision = gitModeRevision(FIXTURE_REV_A);
    const decorator = createStellarImportDecorator(revision);
    const href = hrefFromDecorator(decorator);
    expect(href, 'INV-16: use-line gate must allow links when revision exists').toContain(
      `/tree/${FIXTURE_REV_A}/packages/access`
    );
  });
});

describe('createStellarImportDecorator degrade modes (INV-3, INV-8)', () => {
  it('plain-text degrade emits no anchor elements for local-path revision (INV-3, INV-8)', () => {
    const revision = localPathRevision();
    const decorator = createStellarImportDecorator(revision, { degradeMode: 'plain-text' });
    expect(
      decorator({
        source: SAMPLE_USE_SOURCE,
        language: 'rust',
        token: { text: SAMPLE_USE_LEAF, offset: SAMPLE_USE_LEAF_OFFSET },
      })
    ).toBeUndefined();
  });

  it('repo-root degrade links to normalized repoUrl without /tree/ (INV-3)', () => {
    const revision = localPathRevision();
    const decorator = createStellarImportDecorator(revision);
    const href = hrefFromDecorator(decorator);
    expect(href, 'INV-3: local-path degrade must not invent a commit-pinned URL').toBe(
      STELLAR_REPO_URL
    );
    expect(href).not.toMatch(/\/tree\//);
  });
});

describe('createStellarImportDecorator source fidelity (INV-15)', () => {
  it('preserves the full leaf text when splitting into fragments (INV-15)', () => {
    const revision = gitModeRevision(FIXTURE_REV_A);
    const decorator = createStellarImportDecorator(revision);
    const node = decorator({
      source: SAMPLE_USE_SOURCE,
      language: 'rust',
      token: { text: SAMPLE_USE_LEAF, offset: SAMPLE_USE_LEAF_OFFSET },
    });
    expect(node).toBeDefined();
    const { container } = render(<Fragment>{node as ReactElement}</Fragment>);
    expect(container.textContent).toBe(SAMPLE_USE_LEAF);
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as previewServices from '../../../services/preview';
import {
  FIXTURE_REV_A,
  FIXTURE_REV_B,
  gitModeRevision,
  SAMPLE_IMPORT_LINKS,
  SAMPLE_USE_SOURCE,
} from '../../../test/helpers/importLinkFixtures';
import * as languageModule from '../languageForPath';
import { PreviewCodePane } from './PreviewCodePane';

const CONTRACT_PATH = 'rwa-token/src/contract.rs';
const OTHER_PATH = 'README.md';

function files(): Record<string, string> {
  return { [CONTRACT_PATH]: SAMPLE_USE_SOURCE, [OTHER_PATH]: '# readme' };
}

describe('PreviewCodePane revision memo wiring (INV-8)', () => {
  it('rebuilds the decorator when the reported revision changes', () => {
    const decoratorSpy = vi.spyOn(previewServices, 'createImportLinkDecorator');
    const revisionA = gitModeRevision(FIXTURE_REV_A);
    const revisionB = gitModeRevision(FIXTURE_REV_B);
    const tree = files();

    const { rerender } = render(
      <PreviewCodePane
        files={tree}
        selectedPath={CONTRACT_PATH}
        sourceRevision={revisionA}
        importLinks={SAMPLE_IMPORT_LINKS}
      />
    );

    expect(decoratorSpy).toHaveBeenCalledWith(revisionA, SAMPLE_IMPORT_LINKS);
    const callsAfterA = decoratorSpy.mock.calls.length;

    rerender(
      <PreviewCodePane
        files={tree}
        selectedPath={CONTRACT_PATH}
        sourceRevision={revisionB}
        importLinks={SAMPLE_IMPORT_LINKS}
      />
    );

    expect(decoratorSpy).toHaveBeenLastCalledWith(revisionB, SAMPLE_IMPORT_LINKS);
    expect(
      decoratorSpy.mock.calls.length,
      'INV-8: decorator memo must rebuild when the revision changes'
    ).toBeGreaterThan(callsAfterA);

    decoratorSpy.mockRestore();
  });

  /**
   * The pane re-rendered on every drag `pointermove` even though none of its
   * props moved, re-reconciling the whole file through the per-leaf decorator.
   *
   * Counted through `languageForPath`, which the pane calls unmemoized in its
   * JSX, so the count is renders of the pane itself. Counting decorator builds
   * instead would prove nothing: that call was already inside a `useMemo` keyed
   * on the revision before the pane was memoized, so it stayed flat either way.
   */
  it('does not re-render when the parent re-renders with identical props', () => {
    const renderProbe = vi.spyOn(languageModule, 'languageForPath');
    const revision = gitModeRevision(FIXTURE_REV_A);
    const tree = files();

    const { rerender } = render(
      <PreviewCodePane
        files={tree}
        selectedPath={CONTRACT_PATH}
        sourceRevision={revision}
        importLinks={SAMPLE_IMPORT_LINKS}
      />
    );
    const rendersAfterMount = renderProbe.mock.calls.length;
    expect(rendersAfterMount, 'probe must observe the mount render').toBeGreaterThan(0);

    rerender(
      <PreviewCodePane
        files={tree}
        selectedPath={CONTRACT_PATH}
        sourceRevision={revision}
        importLinks={SAMPLE_IMPORT_LINKS}
      />
    );

    expect(renderProbe.mock.calls.length, 'memoised pane must skip identical renders').toBe(
      rendersAfterMount
    );

    rerender(
      <PreviewCodePane
        files={tree}
        selectedPath={OTHER_PATH}
        sourceRevision={revision}
        importLinks={SAMPLE_IMPORT_LINKS}
      />
    );

    expect(
      renderProbe.mock.calls.length,
      'and must still render when a prop actually changes'
    ).toBeGreaterThan(rendersAfterMount);

    renderProbe.mockRestore();
  });

  it('renders source from the selected path on the provided files object (INV-8, INV-1)', () => {
    render(
      <PreviewCodePane
        files={files()}
        selectedPath={CONTRACT_PATH}
        sourceRevision={gitModeRevision(FIXTURE_REV_A)}
        importLinks={SAMPLE_IMPORT_LINKS}
      />
    );

    const pane = screen.getByLabelText(`${CONTRACT_PATH} source code`);
    expect(pane.textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'use stellar_access::access_control'
    );
  });
});

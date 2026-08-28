import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as previewServices from '../../../services/preview';
import {
  FIXTURE_REV_A,
  FIXTURE_REV_B,
  gitModeRevision,
  SAMPLE_USE_SOURCE,
} from '../../../test/helpers/stellarImportFixtures';
import { PreviewCodePane } from './PreviewCodePane';

const CONTRACT_PATH = 'rwa-token/src/contract.rs';

function files(): Record<string, string> {
  return { [CONTRACT_PATH]: SAMPLE_USE_SOURCE };
}

describe('PreviewCodePane revision memo wiring (INV-8)', () => {
  it('rebuilds the decorator when the reported revision changes', () => {
    const decoratorSpy = vi.spyOn(previewServices, 'createStellarImportDecorator');
    const revisionA = gitModeRevision(FIXTURE_REV_A);
    const revisionB = gitModeRevision(FIXTURE_REV_B);
    const tree = files();

    const { rerender } = render(
      <PreviewCodePane files={tree} selectedPath={CONTRACT_PATH} sourceRevision={revisionA} />
    );

    expect(decoratorSpy).toHaveBeenCalledWith(revisionA);
    const callsAfterA = decoratorSpy.mock.calls.length;

    rerender(
      <PreviewCodePane files={tree} selectedPath={CONTRACT_PATH} sourceRevision={revisionB} />
    );

    expect(decoratorSpy).toHaveBeenLastCalledWith(revisionB);
    expect(
      decoratorSpy.mock.calls.length,
      'INV-8: decorator memo must rebuild when the revision changes'
    ).toBeGreaterThan(callsAfterA);

    decoratorSpy.mockRestore();
  });

  /**
   * The pane re-rendered on every drag `pointermove` even though none of its
   * props moved, re-reconciling the whole file through the per-leaf decorator.
   */
  it('does not re-render when the parent re-renders with identical props', () => {
    const decoratorSpy = vi.spyOn(previewServices, 'createStellarImportDecorator');
    const revision = gitModeRevision(FIXTURE_REV_A);
    const tree = files();

    const { rerender } = render(
      <PreviewCodePane files={tree} selectedPath={CONTRACT_PATH} sourceRevision={revision} />
    );
    const callsAfterMount = decoratorSpy.mock.calls.length;

    rerender(
      <PreviewCodePane files={tree} selectedPath={CONTRACT_PATH} sourceRevision={revision} />
    );

    expect(decoratorSpy.mock.calls.length, 'memoised pane must skip identical renders').toBe(
      callsAfterMount
    );

    decoratorSpy.mockRestore();
  });

  it('renders source from the selected path on the provided files object (INV-8, INV-1)', () => {
    render(
      <PreviewCodePane
        files={files()}
        selectedPath={CONTRACT_PATH}
        sourceRevision={gitModeRevision(FIXTURE_REV_A)}
      />
    );

    const pane = screen.getByLabelText(`${CONTRACT_PATH} source code`);
    expect(pane.textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'use stellar_access::access_control'
    );
  });
});

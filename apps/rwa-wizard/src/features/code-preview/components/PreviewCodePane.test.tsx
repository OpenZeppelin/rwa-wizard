import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as previewServices from '../../../services/preview';
import {
  FIXTURE_REV_A,
  FIXTURE_REV_B,
  gitModeTree,
  SAMPLE_USE_SOURCE,
} from '../../../test/helpers/stellarImportFixtures';
import { PreviewCodePane } from './PreviewCodePane';

describe('PreviewCodePane revision memo wiring (INV-8)', () => {
  it('re-resolves revision and decorator when the files prop changes', () => {
    const revisionSpy = vi.spyOn(previewServices, 'resolveStellarSourceRevision');
    const decoratorSpy = vi.spyOn(previewServices, 'createStellarImportDecorator');

    const filesA = gitModeTree(FIXTURE_REV_A);
    const filesB = gitModeTree(FIXTURE_REV_B);

    const { rerender } = render(
      <PreviewCodePane files={filesA} selectedPath="rwa-token/src/contract.rs" />
    );

    expect(revisionSpy).toHaveBeenCalledWith(filesA);
    const decoratorCallsAfterA = decoratorSpy.mock.calls.length;

    rerender(<PreviewCodePane files={filesB} selectedPath="rwa-token/src/contract.rs" />);

    expect(revisionSpy).toHaveBeenLastCalledWith(filesB);
    expect(
      decoratorSpy.mock.calls.length,
      'INV-8: decorator memo must rebuild when files-derived revision changes'
    ).toBeGreaterThan(decoratorCallsAfterA);
  });

  it('renders source from the selected path on the provided files object (INV-8, INV-1)', () => {
    const contractPath = 'rwa-token/src/contract.rs';
    const files = gitModeTree(FIXTURE_REV_A);
    files[contractPath] = SAMPLE_USE_SOURCE;

    render(<PreviewCodePane files={files} selectedPath={contractPath} />);

    const pane = screen.getByLabelText(`${contractPath} source code`);
    expect(pane.textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'use stellar_access::access_control'
    );
  });
});

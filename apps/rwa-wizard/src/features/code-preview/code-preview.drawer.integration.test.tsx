import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';

import { coreCopy } from '@openzeppelin/rwa-wizard-copy';

import { CodePreviewDrawer } from './components/CodePreviewDrawer';
import { CodePreviewTrigger } from './components/CodePreviewTrigger';
import { PreviewDrawerBody } from './components/PreviewDrawerBody';
import type { UseCodePreviewOptions } from './hooks/useCodePreview';
import { useCodePreview } from './hooks/useCodePreview';

import { createTestCodegenService } from '../../services/codegen/testCodegenService';
import type { RwaCodegenService } from '../../services/codegen/types';
import { makeConfig } from '../../test/fixtures/wizardFixtures';
import {
  defaultPreviewHookOptions,
  waitForPreviewReady,
} from '../../test/helpers/codePreviewHarness';

const { mockThrowingCodePane } = vi.hoisted(() => ({
  mockThrowingCodePane: vi.fn(() => <div data-testid="code-pane-stub" />),
}));

vi.mock('./components/PreviewCodePane', () => ({
  PreviewCodePane: () => mockThrowingCodePane(),
}));

describe('code-preview drawer composition', () => {
  beforeEach(() => {
    mockThrowingCodePane.mockClear();
    mockThrowingCodePane.mockImplementation(() => <div data-testid="code-pane-stub" />);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('names every substituted key in the drawer on the default draft (INV-2)', async () => {
    const service = createTestCodegenService();
    const base = defaultPreviewHookOptions({ codegenService: service, debounceMs: 0 });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    const ready = await waitForPreviewReady(() => result.current);

    render(
      <CodePreviewDrawer
        open
        onOpenChange={() => {}}
        dockPosition="bottom"
        size={480}
        maxSize={900}
        onSizeChange={() => {}}
        sheetId={result.current.sheetId}
        phase={ready}
        selectedPath={result.current.selectedPath}
        onSelectedPathChange={() => {}}
        files={ready.files}
        changedPaths={ready.changedPaths}
        substitutedKeys={ready.substitutedKeys}
        errorMessages={undefined}
        sourceRevision={null}
        importLinks={null}
        config={makeConfig()}
        provenance={null}
        onReveal={null}
      />
    );

    expect(screen.getByText(/Preview placeholders \(not in your draft\):/i)).toBeInTheDocument();
    expect(ready.substitutedKeys).toEqual([
      'token.name',
      'token.symbol',
      'accessControl.ownership.ownerAddress',
    ]);
  });

  it('keeps substitutions visible when generate fails after fill (INV-2)', async () => {
    const service = createTestCodegenService({ failGenerateFileTree: true });
    const base = defaultPreviewHookOptions({ codegenService: service, debounceMs: 0 });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    await waitFor(() => {
      expect(result.current.phase.kind).toBe('error');
    });

    if (result.current.phase.kind !== 'error') {
      throw new Error('expected error phase');
    }

    render(
      <CodePreviewDrawer
        open
        onOpenChange={() => {}}
        dockPosition="bottom"
        size={480}
        maxSize={900}
        onSizeChange={() => {}}
        sheetId={result.current.sheetId}
        phase={result.current.phase}
        selectedPath={null}
        onSelectedPathChange={() => {}}
        files={null}
        changedPaths={undefined}
        substitutedKeys={result.current.phase.substitutedKeys}
        errorMessages={result.current.phase.messages}
        sourceRevision={null}
        importLinks={null}
        config={makeConfig()}
        provenance={null}
        onReveal={null}
      />
    );

    // The notice lives in the sheet's real header slot, outside the scrolling
    // body. Queried by the attribute the kit actually renders: the assertion
    // used to name a `data-testid` only the local stand-in emitted, so it
    // described the stand-in rather than the sheet the wizard ships.
    const header = document.querySelector('[data-slot="bottom-sheet-header"]');
    expect(header).toHaveTextContent(/accessControl\.ownership\.ownerAddress/);
    expect(screen.getByText(/accessControl\.ownership\.ownerAddress/)).toBeInTheDocument();
    expect(screen.getByText(/Invalid configuration/i)).toBeInTheDocument();
  });

  it('passes the full generated path list to FileTree (INV-3)', async () => {
    const files = {
      'README.md': '# readme',
      'Cargo.toml': '[workspace]',
      'contracts/rwa-token/Cargo.toml': '[package]',
      'contracts/rwa-token/src/contract.rs': 'fn main() {}',
      'scripts/deploy.sh': '#!/bin/sh',
    };
    const service: RwaCodegenService = {
      ...createTestCodegenService(),
      generateFileTree: async () => ({ files }),
    };
    const base = defaultPreviewHookOptions({ codegenService: service, debounceMs: 0 });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    const ready = await waitForPreviewReady(() => result.current);

    const { container } = render(
      <PreviewDrawerBody
        phase={ready}
        selectedPath="README.md"
        onSelectedPathChange={() => {}}
        files={ready.files}
        changedPaths={ready.changedPaths}
        errorMessages={undefined}
        boundaryResetKey="ready"
        sourceRevision={null}
        importLinks={null}
        config={makeConfig()}
        provenance={null}
        onReveal={null}
        drawerOpen
        dockPosition="bottom"
      />
    );

    // Asserted against the real kit tree rather than a stand-in, so a path the
    // wizard drops on the way in cannot be papered over by a local double.
    const rows = await waitFor(() => {
      const host = container.querySelector('file-tree-container');
      const root = host instanceof HTMLElement ? host.shadowRoot : null;
      const found = [...(root?.querySelectorAll('[data-item-path]') ?? [])].map((node) =>
        node.getAttribute('data-item-path')
      );
      expect(found.length).toBeGreaterThan(0);
      return new Set(found);
    });

    for (const path of Object.keys(files)) {
      expect(rows, `every generated path must reach the tree: ${path}`).toContain(path);
    }
  });

  it('renders no trigger when show is false (INV-4)', () => {
    render(
      <CodePreviewTrigger
        show={false}
        triggerProps={{
          'aria-expanded': false,
          'aria-controls': undefined,
          onClick: () => {},
          ref: createRef<HTMLButtonElement>(),
        }}
      />
    );

    expect(screen.queryByRole('button', { name: /view generated code/i })).not.toBeInTheDocument();
  });

  it('isolates preview content throws behind the drawer boundary (INV-16)', () => {
    mockThrowingCodePane.mockImplementation(() => {
      throw new Error('CodeView render exploded');
    });

    render(
      <div>
        <input data-testid="wizard-input" defaultValue="" />
        <PreviewDrawerBody
          phase={{
            kind: 'ready',
            files: { 'README.md': '# hello' },
            configHash: 'hash',
            substitutedKeys: [],
            changedPaths: [],
            generateKey: 'hash|identity:0|service:test',
          }}
          selectedPath="README.md"
          onSelectedPathChange={() => {}}
          files={{ 'README.md': '# hello' }}
          changedPaths={[]}
          errorMessages={undefined}
          boundaryResetKey="throw-case"
          sourceRevision={null}
          importLinks={null}
          config={makeConfig()}
          provenance={null}
          onReveal={null}
          drawerOpen
          dockPosition="bottom"
        />
      </div>
    );

    expect(
      screen.getByText(coreCopy.notice('code-preview.render-failed').description)
    ).toBeInTheDocument();
    const field = screen.getByTestId('wizard-input');
    field.focus();
    expect(document.activeElement).toBe(field);
  });
});

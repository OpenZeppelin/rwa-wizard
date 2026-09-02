import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useState, type ReactElement } from 'react';

import { coreCopy } from '@openzeppelin/rwa-wizard-copy';

import { CodePreviewDrawer } from './components/CodePreviewDrawer';
import { CodePreviewTrigger } from './components/CodePreviewTrigger';
import { useCodePreview } from './hooks/useCodePreview';

import { createTestCodegenService } from '../../services/codegen/testCodegenService';
import { defaultPreviewHookOptions } from '../../test/helpers/codePreviewHarness';
import { WIZARD_DOCK_MENU_POSITIONS } from './dockPosition';

const CLOSE_LABEL = coreCopy.notice('code-preview.close').description;
const TRIGGER_LABEL = coreCopy.notice('code-preview.trigger-show').description;

/** The trigger and the sheet wired together the way `WizardPage` wires them. */
function PreviewHost(): ReactElement {
  // Built once: fresh option objects on every render would re-key the preview
  // effects and spin.
  const [options] = useState(() =>
    defaultPreviewHookOptions({ codegenService: createTestCodegenService(), debounceMs: 0 })
  );
  const preview = useCodePreview(options);

  return (
    <>
      <CodePreviewTrigger show={preview.showTrigger} triggerProps={preview.triggerProps} />
      <CodePreviewDrawer
        open={preview.persistence.open}
        onOpenChange={preview.setOpen}
        dockPosition={preview.persistence.dockPosition}
        size={preview.persistence.size}
        maxSize={preview.persistence.maxSize}
        onSizeChange={preview.setSize}
        sheetId={preview.sheetId}
        phase={preview.phase}
        selectedPath={preview.selectedPath}
        onSelectedPathChange={preview.setSelectedPath}
        files={preview.phase.kind === 'ready' ? preview.phase.files : null}
        changedPaths={preview.phase.kind === 'ready' ? preview.phase.changedPaths : undefined}
        substitutedKeys={
          preview.phase.kind === 'ready' || preview.phase.kind === 'error'
            ? preview.phase.substitutedKeys
            : []
        }
        errorMessages={preview.phase.kind === 'error' ? preview.phase.messages : undefined}
        sourceRevision={preview.sourceRevision}
        importLinks={preview.importLinks}
        tools={{
          ...preview.layout,
          dockMenuPositions: WIZARD_DOCK_MENU_POSITIONS,
        }}
        config={options.draftConfig}
        provenance={preview.showTrigger ? preview.provenance : null}
        onReveal={preview.showTrigger ? preview.revealInPreview : null}
      />
    </>
  );
}

async function openSheet(): Promise<HTMLElement> {
  const trigger = screen.getByRole('button', { name: TRIGGER_LABEL });
  fireEvent.click(trigger);
  return waitFor(() => screen.getByRole('button', { name: CLOSE_LABEL }));
}

/** Focuses a file row inside the tree's shadow root and returns it. */
function focusedFileTreeRow(region: HTMLElement): Element {
  const host = Array.from(region.querySelectorAll('*')).find((el) => el.shadowRoot !== null);
  if (host === undefined) {
    throw new Error('expected the file tree to mount a shadow root inside the sheet');
  }

  const row = host.shadowRoot?.querySelector('[role="treeitem"]');
  if (!(row instanceof HTMLElement)) {
    throw new Error('expected a focusable row inside the file tree');
  }

  act(() => row.focus());
  return row;
}

/**
 * INV-14. The guard that restores focus used to ask "is focus on `<body>`",
 * a question that is only true after the kit's 200ms exit transition has
 * unmounted the region. At the moment the effect runs, a close from the sheet's
 * own Close button or from Escape leaves focus on an element *inside the
 * closing sheet*, which the old guard read as "something else legitimately
 * holds focus" — so it returned, and focus dropped to `<body>` unassisted.
 *
 * The dimension it could not see is where the focused element lives. These
 * cases vary exactly that: focus inside the sheet at close time (restore), and
 * focus on an unrelated field at close time (leave alone). Neither blurs
 * anything by hand, because the real close paths never do.
 */
describe('code preview focus restoration (INV-14)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns focus to the trigger when the sheet Close button closes it', async () => {
    render(<PreviewHost />);

    const closeButton = await openSheet();
    act(() => closeButton.focus());
    expect(document.activeElement).toBe(closeButton);

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: TRIGGER_LABEL }));
    });
  });

  it('returns focus to the trigger when Escape closes it from inside', async () => {
    render(<PreviewHost />);

    const closeButton = await openSheet();
    const region = closeButton.closest('[data-slot="bottom-sheet"]');
    if (!(region instanceof HTMLElement)) {
      throw new Error('expected the sheet region to be mounted');
    }

    act(() => closeButton.focus());
    fireEvent.keyDown(region, { key: 'Escape' });

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: TRIGGER_LABEL }));
    });
  });

  it('returns focus to the trigger when Escape closes it from inside the file tree', async () => {
    render(<PreviewHost />);

    const closeButton = await openSheet();
    const region = closeButton.closest('[data-slot="bottom-sheet"]');
    if (!(region instanceof HTMLElement)) {
      throw new Error('expected the sheet region to be mounted');
    }

    // The file tree renders its rows behind an open shadow root, so this is the
    // one place in the sheet where the focused node is not a light-DOM
    // descendant of the region. Focus a row the way arrowing into the tree
    // does, then close with Escape as the kit's region handler receives it.
    const row = focusedFileTreeRow(region);
    expect(row.getRootNode(), 'the row must be inside a shadow root').toBeInstanceOf(ShadowRoot);

    fireEvent.keyDown(region, { key: 'Escape' });

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: TRIGGER_LABEL }));
    });
  });

  it('leaves focus alone when it is already outside the closing sheet', async () => {
    render(
      <>
        <input data-testid="wizard-field" defaultValue="" />
        <PreviewHost />
      </>
    );

    const closeButton = await openSheet();
    const field = screen.getByTestId('wizard-field');
    act(() => field.focus());

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: CLOSE_LABEL })).not.toBeInTheDocument();
    });
    expect(
      document.activeElement,
      'focus moved there deliberately; stealing it back is worse than the drop'
    ).toBe(field);
  });
});

/**
 * INV-13. The preview sheet is non-modal: the whole reason it is a region and
 * not a dialog is that the user keeps editing the form underneath it while it
 * is open. Only the real sheet can answer this, since what would break it —
 * a focus trap, an inert background, a mount-time focus move — are behaviours
 * a stand-in does not have and therefore cannot lose.
 */
describe('code preview non-modality (INV-13)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('never takes focus from the wizard form while the sheet is open', async () => {
    render(
      <>
        <input data-testid="wizard-field" defaultValue="" />
        <PreviewHost />
      </>
    );

    const field = screen.getByTestId('wizard-field');
    act(() => field.focus());

    await openSheet();

    // Opening must not pull focus into the sheet, and focusing the form back
    // must not be undone by anything watching for focus leaving the sheet.
    expect(document.activeElement, 'opening the sheet moved focus').toBe(field);

    act(() => field.focus());
    fireEvent.change(field, { target: { value: 'typed' } });

    expect(document.activeElement).toBe(field);
    expect(field).toHaveValue('typed');
    expect(screen.getByRole('button', { name: CLOSE_LABEL })).toBeInTheDocument();
  });
});

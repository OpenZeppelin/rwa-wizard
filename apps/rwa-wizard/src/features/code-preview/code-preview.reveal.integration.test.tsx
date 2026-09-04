import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';

import type { FileTree } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';
import { coreCopy } from '@openzeppelin/rwa-wizard-copy';
import type { CodeViewReveal } from '@openzeppelin/ui-components/code-view';

import { CodePreviewDrawer } from './components/CodePreviewDrawer';
import { CodePreviewTrigger } from './components/CodePreviewTrigger';
import { useCodePreview, type UseCodePreviewOptions } from './hooks/useCodePreview';

import { createTestCodegenService } from '../../services/codegen/testCodegenService';
import type { RwaCodegenService } from '../../services/codegen/types';
import {
  createSlowCodegenService,
  defaultPreviewHookOptions,
  flushPreviewDebounce,
} from '../../test/helpers/codePreviewHarness';
import { completeDraft } from '../../test/helpers/previewConfig';
import { CodePreviewRevealProvider } from './CodePreviewRevealProvider';
import { WIZARD_DOCK_MENU_POSITIONS } from './dockPosition';
import { useCodePreviewReveal } from './useCodePreviewReveal';

const README = 'README.md';
const DEPLOY = 'deploy.ts';
const TRIGGER_LABEL = coreCopy.notice('code-preview.trigger-show').description;

interface PaneCommit {
  readonly files: FileTree | null;
  readonly selectedPath: string | null;
  readonly reveal: CodeViewReveal | undefined;
}

/** Every render of the code pane, as the drawer body handed it its props. */
const { paneCommits } = vi.hoisted(() => ({ paneCommits: [] as PaneCommit[] }));

vi.mock('./components/PreviewCodePane', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./components/PreviewCodePane')>();
  const Real = mod.PreviewCodePane;
  return {
    PreviewCodePane: (props: Parameters<typeof Real>[0]): ReactElement => {
      paneCommits.push({
        files: props.files,
        selectedPath: props.selectedPath,
        reveal: props.reveal,
      });
      return createElement(Real, props);
    },
  };
});

function twoFileService(): RwaCodegenService {
  const base = createTestCodegenService();
  return {
    ...base,
    async generateFileTree(config: RWAConfig, generateOptions) {
      const artifact = await base.generateFileTree(config, generateOptions);
      return {
        files: {
          ...artifact.files,
          [README]: `# ${config.token.name}\nline two\nline three\nline four\n`,
          [DEPLOY]: `// deploy ${config.token.name}\nexport {};\n`,
        },
      };
    },
  };
}

/**
 * A step-level consumer, the way a wizard-side caller reads the seam. Two sites
 * in the same file, because such a list stays open across activations and the user
 * clicks one row after another.
 */
function RevealConsumer(): ReactElement {
  const revealInPreview = useCodePreviewReveal();
  return (
    <>
      <button
        type="button"
        data-testid="consumer"
        data-can-reveal={revealInPreview === null ? 'no' : 'yes'}
        disabled={revealInPreview === null}
        onClick={() => revealInPreview?.({ path: README, range: { startLine: 2, endLine: 3 } })}
      >
        reveal
      </button>
      <button
        type="button"
        data-testid="consumer-second-site"
        disabled={revealInPreview === null}
        onClick={() => revealInPreview?.({ path: README, range: { startLine: 4, endLine: 4 } })}
      >
        reveal the next site
      </button>
    </>
  );
}

/** Hook, provider, trigger and drawer wired the way `WizardPage` wires them. */
function PreviewHost(props: { readonly options: UseCodePreviewOptions }): ReactElement {
  const preview = useCodePreview(props.options);
  return (
    <>
      <CodePreviewRevealProvider
        revealInPreview={preview.showTrigger ? preview.revealInPreview : null}
      >
        <RevealConsumer />
        <CodePreviewTrigger show={preview.showTrigger} triggerProps={preview.triggerProps} />
      </CodePreviewRevealProvider>
      <span data-testid="selected">{preview.selectedPath ?? ''}</span>
      <span data-testid="phase">{preview.phase.kind}</span>
      <button
        type="button"
        data-testid="select-deploy"
        onClick={() => preview.setSelectedPath(DEPLOY)}
      >
        select deploy
      </button>
      {preview.showTrigger ? (
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
          reveal={preview.reveal}
          config={props.options.draftConfig}
          provenance={preview.showTrigger ? preview.provenance : null}
          onReveal={preview.showTrigger ? preview.revealInPreview : null}
        />
      ) : null}
    </>
  );
}

function options(overrides: Partial<UseCodePreviewOptions> = {}): UseCodePreviewOptions {
  return defaultPreviewHookOptions({
    codegenService: twoFileService(),
    draftConfig: completeDraft(),
    debounceMs: 0,
    ...overrides,
  });
}

async function waitForReadyTree(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('phase')).toHaveTextContent('ready');
  });
}

/** The reveal the pane was last rendered with, or `undefined` if it has none. */
function lastReveal(): CodeViewReveal | undefined {
  const marked = paneCommits.filter((commit) => commit.reveal !== undefined);
  return marked.length === 0 ? undefined : marked[marked.length - 1]?.reveal;
}

function kitMarks(): NodeListOf<Element> {
  return document.querySelectorAll('[data-code-view-reveal]');
}

beforeEach(() => {
  paneCommits.length = 0;
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reveal through the seam into the real drawer (INV-1, INV-3, INV-12, INV-14)', () => {
  it('AS-1: closed drawer → consumer reveals README lines 2–3 → drawer opens, file selected, kit mark painted', async () => {
    const opts = options();
    render(<PreviewHost options={opts} />);
    await waitFor(() => {
      expect(screen.getByTestId('consumer')).toHaveAttribute('data-can-reveal', 'yes');
    });
    await waitForReadyTree();
    expect(kitMarks()).toHaveLength(0);

    fireEvent.click(screen.getByTestId('consumer'));

    await waitFor(() => {
      expect(kitMarks().length).toBeGreaterThan(0);
    });
    expect(screen.getByTestId('selected')).toHaveTextContent(README);
    const marked = paneCommits.filter((c) => c.reveal !== undefined);
    expect(marked.length).toBeGreaterThan(0);
    for (const commit of marked) {
      expect(commit.selectedPath, 'INV-1: a range is only ever paired with its own file').toBe(
        README
      );
    }
  });

  it('INV-10: a second reveal moves the mark and carries a new retrigger token', async () => {
    render(<PreviewHost options={options()} />);
    await waitFor(() => {
      expect(screen.getByTestId('consumer')).toHaveAttribute('data-can-reveal', 'yes');
    });
    await waitForReadyTree();

    fireEvent.click(screen.getByTestId('consumer'));
    await waitFor(() => {
      expect(lastReveal()?.startLine).toBe(2);
    });
    const first = lastReveal();

    fireEvent.click(screen.getByTestId('consumer-second-site'));
    await waitFor(() => {
      expect(lastReveal()?.startLine).toBe(4);
    });

    // The token is what makes the second jump a jump: the kit re-runs its
    // scroll and mark on a new `id`, where two equal ranges would read as one
    // unchanged prop and leave the user looking at the first site.
    expect(lastReveal()).toEqual({ startLine: 4, endLine: 4, id: expect.any(Number) });
    expect(lastReveal()?.id).not.toBe(first?.id);
  });

  it('INV-10: re-revealing the same range is not a no-op — the token still advances', async () => {
    render(<PreviewHost options={options()} />);
    await waitFor(() => {
      expect(screen.getByTestId('consumer')).toHaveAttribute('data-can-reveal', 'yes');
    });
    await waitForReadyTree();

    fireEvent.click(screen.getByTestId('consumer'));
    await waitFor(() => {
      expect(lastReveal()?.startLine).toBe(2);
    });
    const first = lastReveal();

    fireEvent.click(screen.getByTestId('consumer'));
    await waitFor(() => {
      expect(lastReveal()?.id).not.toBe(first?.id);
    });
    expect(lastReveal()?.startLine).toBe(2);
  });

  it('AS-2 / INV-1: revealing README then selecting deploy.ts never commits deploy.ts with a range', async () => {
    const opts = options();
    render(<PreviewHost options={opts} />);
    await waitFor(() => {
      expect(screen.getByTestId('consumer')).toHaveAttribute('data-can-reveal', 'yes');
    });
    await waitForReadyTree();

    fireEvent.click(screen.getByTestId('consumer'));
    await waitFor(() => {
      expect(kitMarks().length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByTestId('select-deploy'));

    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent(DEPLOY);
    });
    expect(kitMarks(), 'the mark leaves with the file it belonged to').toHaveLength(0);
    for (const commit of paneCommits) {
      if (commit.selectedPath === DEPLOY) {
        expect(
          commit.reveal,
          'INV-1: no committed render pairs deploy.ts with README’s range'
        ).toBeUndefined();
      }
    }
  });

  it('INV-14: across a regenerate with a pending reveal, no commit pairs the new tree with the old mark', async () => {
    const slow = createSlowCodegenService(twoFileService(), 30);
    const draft = completeDraft();
    const opts = options({ codegenService: slow, draftConfig: draft });
    const { rerender } = render(<PreviewHost options={opts} />);
    await waitFor(() => {
      expect(screen.getByTestId('consumer')).toHaveAttribute('data-can-reveal', 'yes');
    });
    await waitForReadyTree();

    // The sheet mounts its body only while open, so the first pane commit is
    // the reveal's own: it carries the tree the range was stamped against.
    fireEvent.click(screen.getByTestId('consumer'));
    await waitFor(() => {
      expect(kitMarks().length).toBeGreaterThan(0);
    });
    const oldFiles = paneCommits[paneCommits.length - 1]!.files;
    expect(oldFiles).not.toBeNull();

    rerender(
      <PreviewHost
        options={{
          ...opts,
          draftConfig: { ...draft, token: { ...draft.token, name: 'Renamed Token' } },
        }}
      />
    );
    await flushPreviewDebounce();
    await waitFor(() => {
      expect(paneCommits[paneCommits.length - 1]?.files?.[README]).toContain('Renamed Token');
    });

    const violations = paneCommits.filter((c) => c.files !== oldFiles && c.reveal !== undefined);
    expect(
      violations,
      'INV-14: tree and reveal decision commit together — no one-frame wrong jump'
    ).toEqual([]);
    expect(kitMarks()).toHaveLength(0);
  });

  it('INV-12: a target with no codegen service hands consumers null and renders no trigger', async () => {
    const opts = options({ codegenService: null, isCodegenServiceLoading: false });
    render(<PreviewHost options={opts} />);

    const consumer = screen.getByTestId('consumer');
    expect(consumer).toHaveAttribute('data-can-reveal', 'no');
    expect(consumer).toBeDisabled();
    expect(screen.queryByRole('button', { name: TRIGGER_LABEL })).toBeNull();
  });

  it('INV-12: the callback identity is stable across provider re-renders while showTrigger is unchanged', async () => {
    const seen: Array<ReturnType<typeof useCodePreviewReveal>> = [];
    function IdentityProbe(): ReactElement {
      seen.push(useCodePreviewReveal());
      return <span />;
    }
    function Host(props: {
      readonly options: UseCodePreviewOptions;
      readonly tick: number;
    }): ReactElement {
      const preview = useCodePreview(props.options);
      return (
        <CodePreviewRevealProvider
          revealInPreview={preview.showTrigger ? preview.revealInPreview : null}
        >
          <IdentityProbe />
          <span>{props.tick}</span>
        </CodePreviewRevealProvider>
      );
    }
    const opts = options();
    const { rerender } = render(<Host options={opts} tick={0} />);
    await waitFor(() => {
      expect(seen[seen.length - 1]).not.toBeNull();
    });
    const stable = seen[seen.length - 1];

    rerender(<Host options={opts} tick={1} />);
    rerender(<Host options={opts} tick={2} />);

    expect(
      seen[seen.length - 1],
      'INV-12: consumer rows must not re-render on every keystroke'
    ).toBe(stable);
  });

  it('INV-12 → INV-7(c): switching to a service-less target after a reveal closes the drawer and disables the consumer', async () => {
    const opts = options();
    const { rerender } = render(<PreviewHost options={opts} />);
    await waitFor(() => {
      expect(screen.getByTestId('consumer')).toHaveAttribute('data-can-reveal', 'yes');
    });
    await waitForReadyTree();
    fireEvent.click(screen.getByTestId('consumer'));
    await waitFor(() => {
      expect(kitMarks().length).toBeGreaterThan(0);
    });

    rerender(
      <PreviewHost options={{ ...opts, codegenService: null, isCodegenServiceLoading: false }} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('consumer')).toHaveAttribute('data-can-reveal', 'no');
    });
    expect(kitMarks()).toHaveLength(0);
    // The consumer's click handler narrows on null the way the contract asks;
    // clicking the disabled control is inert and nothing throws.
    expect(() => {
      act(() => {
        fireEvent.click(screen.getByTestId('consumer'));
      });
    }).not.toThrow();
  });
});

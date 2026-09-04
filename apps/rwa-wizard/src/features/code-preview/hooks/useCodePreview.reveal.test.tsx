import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';
import { logger } from '@openzeppelin/ui-utils';

import { createTestCodegenService } from '../../../services/codegen';
import type { RwaCodegenService } from '../../../services/codegen/types';
import {
  createSlowCodegenService,
  defaultPreviewHookOptions,
  flushPreviewDebounce,
  waitForPreviewReady,
} from '../../../test/helpers/codePreviewHarness';
import { completeDraft } from '../../../test/helpers/previewConfig';
import * as defaultSelectedPathModule from '../defaultSelectedPath';
import { CODE_PREVIEW_OPEN_STORAGE_KEY } from '../previewPersistence';
import type { PreviewLineRange } from '../reveal';
import type { UseCodePreviewOptions, UseCodePreviewResult } from './useCodePreview';
import { useCodePreview } from './useCodePreview';

const README = 'README.md';
const DEPLOY = 'deploy.ts';
const RANGE: PreviewLineRange = { startLine: 2, endLine: 3 };

/**
 * A two-file tree so a test can move the selection off the revealed file.
 * Ignores `includeIdentitySupport` and produces the same bytes per instance,
 * so any test that varies only the option or only the service instance proves
 * the reveal is dropped by the generate *key*, not by a tree that happened to
 * change with it.
 */
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

interface Mounted {
  readonly result: { readonly current: UseCodePreviewResult };
  readonly rerender: (props: UseCodePreviewOptions) => void;
  readonly base: UseCodePreviewOptions;
  readonly draft: RWAConfig;
  readonly renders: () => number;
}

function mount(overrides: Partial<UseCodePreviewOptions> = {}): Mounted {
  const draft = completeDraft();
  const base = defaultPreviewHookOptions({
    codegenService: twoFileService(),
    draftConfig: draft,
    currentStepId: 'asset',
    draftEpoch: 0,
    ...overrides,
  });
  let renderCount = 0;
  const { result, rerender } = renderHook(
    (props: UseCodePreviewOptions) => {
      renderCount += 1;
      return useCodePreview(props);
    },
    { initialProps: base }
  );
  return { result, rerender, base, draft, renders: () => renderCount };
}

function reveal(
  result: { readonly current: UseCodePreviewResult },
  path = README,
  range: PreviewLineRange | null = RANGE
): void {
  act(() => {
    result.current.revealInPreview({ path, range });
  });
}

function renamed(draft: RWAConfig, name: string): RWAConfig {
  return { ...draft, token: { ...draft.token, name } };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCodePreview.revealInPreview guard — one test per input (INV-7, INV-9)', () => {
  it('(a) no tree on screen yet: no selection, no open, no dispatch', async () => {
    const { result } = mount({
      codegenService: createSlowCodegenService(twoFileService(), 40),
    });
    expect(result.current.phase.kind).not.toBe('ready');

    reveal(result);

    expect(result.current.persistence.open, 'INV-7: nothing to point at, drawer stays shut').toBe(
      false
    );
    expect(result.current.selectedPath).toBeNull();
    expect(result.current.reveal).toBeUndefined();

    // The tree that arrives afterwards selects its own default, not the
    // rejected target's range.
    await waitForPreviewReady(() => result.current);
    expect(result.current.selectedPath).toBe(README);
    expect(result.current.reveal).toBeUndefined();
    expect(result.current.persistence.open).toBe(false);
  });

  it('(b) path not in the tree: no-op, open unchanged', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);

    reveal(result, 'missing/file.rs');

    expect(result.current.persistence.open).toBe(false);
    expect(result.current.selectedPath).toBe(README);
    expect(result.current.reveal).toBeUndefined();
  });

  it('(c) service settled to null with a stale cached tree: no-op', async () => {
    const { result, rerender, base } = mount();
    await waitForPreviewReady(() => result.current);

    rerender({ ...base, codegenService: null, isCodegenServiceLoading: false });
    await waitFor(() => {
      expect(result.current.showTrigger).toBe(false);
    });

    // `cachedFilesRef` and `lastGenerateKeyRef` still hold the previous target's
    // tree; the service guard is what has to say no.
    reveal(result);

    expect(
      result.current.persistence.open,
      'INV-7: a target without a service cannot be driven'
    ).toBe(false);
    expect(result.current.reveal).toBeUndefined();
  });

  it('(d) path in tree, no range: selects the file and opens, marks nothing', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);

    reveal(result, DEPLOY, null);

    expect(result.current.selectedPath).toBe(DEPLOY);
    expect(result.current.reveal).toBeUndefined();
    expect(result.current.persistence.open).toBe(true);
  });

  it('(d′) `range` omitted behaves like `range: null`', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.revealInPreview({ path: DEPLOY });
    });

    expect(result.current.selectedPath).toBe(DEPLOY);
    expect(result.current.reveal).toBeUndefined();
    expect(result.current.persistence.open).toBe(true);
  });

  it('(e) path in tree with a range: selects, marks, opens — one commit', async () => {
    const { result, renders } = mount();
    await waitForPreviewReady(() => result.current);
    const before = renders();

    reveal(result);

    expect(result.current.selectedPath).toBe(README);
    expect(result.current.reveal).toStrictEqual({ startLine: 2, endLine: 3, id: 1 });
    expect(result.current.persistence.open).toBe(true);
    expect(renders() - before, 'INV-7: dispatch and open are batched into a single commit').toBe(1);
  });

  it('never starts a generate', async () => {
    const service = twoFileService();
    const generateSpy = vi.spyOn(service, 'generateFileTree');
    const { result } = mount({ codegenService: service });
    await waitForPreviewReady(() => result.current);
    const callsBefore = generateSpy.mock.calls.length;

    reveal(result);
    reveal(result, DEPLOY, null);
    reveal(result, 'nope.rs');

    expect(
      generateSpy.mock.calls.length,
      'INV-7: revealInPreview reads the tree, never builds one'
    ).toBe(callsBefore);
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'INV-9: prototype name %s is not a file in the tree',
    async (path) => {
      const { result } = mount();
      await waitForPreviewReady(() => result.current);

      reveal(result, path);

      expect(result.current.persistence.open).toBe(false);
      expect(result.current.selectedPath).toBe(README);
      expect(result.current.reveal).toBeUndefined();
    }
  );
});

describe('reveal stamp covers every generate input and only those (INV-8)', () => {
  it('(1) config edit → different hash → reveal dropped, path kept', async () => {
    const { result, rerender, base, draft } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    expect(result.current.reveal).toBeDefined();

    rerender({ ...base, draftConfig: renamed(draft, 'Renamed Token') });
    await flushPreviewDebounce();

    await waitFor(() => {
      expect(result.current.phase.kind === 'ready' && result.current.phase.files[README]).toContain(
        'Renamed Token'
      );
    });
    expect(
      result.current.reveal,
      'INV-8(1): a range measured against the old tree dies with it'
    ).toBeUndefined();
    expect(result.current.selectedPath).toBe(README);
    expect(result.current.persistence.open).toBe(true);
  });

  it('(2) includeIdentitySupport toggle with identical config and identical tree → reveal dropped', async () => {
    const { result, rerender, base } = mount({ includeIdentitySupport: false });
    const before = await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;
    expect(pending).toBeDefined();

    rerender({ ...base, includeIdentitySupport: true });
    await flushPreviewDebounce();

    await waitFor(() => {
      expect(
        result.current.reveal,
        'INV-8(2): the option is a key dimension even when the hash is not'
      ).toBeUndefined();
    });
    // The double ignores the option, so the tree is byte-identical: the drop
    // came from the key alone. This is the dimension a hash-only stamp forgets.
    const after = await waitForPreviewReady(() => result.current);
    expect(after.files).toEqual(before.files);
    expect(result.current.selectedPath).toBe(README);
  });

  it('(3) codegen service instance swap with identical config and option → reveal dropped', async () => {
    const { result, rerender, base } = mount();
    const before = await waitForPreviewReady(() => result.current);
    reveal(result);
    expect(result.current.reveal).toBeDefined();

    rerender({ ...base, codegenService: twoFileService() });
    await flushPreviewDebounce();

    await waitFor(() => {
      expect(
        result.current.reveal,
        'INV-8(3): another generator, another tree, same bytes or not'
      ).toBeUndefined();
    });
    const after = await waitForPreviewReady(() => result.current);
    expect(after.files).toEqual(before.files);
  });

  it('(0) duplicate tick with the same key (cache hit) → reveal kept with the same identity', async () => {
    const service = twoFileService();
    const generateSpy = vi.spyOn(service, 'generateFileTree');
    const { result, rerender, base, draft } = mount({ codegenService: service });
    const before = await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;
    const generateCalls = generateSpy.mock.calls.length;

    // A structurally equal config object: same hash, same key, so the cache
    // answers and `tree-ready` is dispatched with the stamped key.
    rerender({ ...base, draftConfig: { ...draft } });
    await flushPreviewDebounce();

    await waitFor(() => {
      expect(
        result.current.phase,
        'the tick must have landed for this test to prove anything'
      ).not.toBe(before);
    });
    expect(generateSpy.mock.calls.length, 'same key → cache hit, no generate').toBe(generateCalls);
    expect(result.current.reveal, 'INV-8(0): same tree, same mark').toBe(pending);
  });

  it('negative: currentStepId change with everything else equal → reveal kept', async () => {
    const { result, rerender, base, draft } = mount({ currentStepId: 'asset' });
    await waitForPreviewReady(() => result.current);

    // Earn a mark so the step change has something to reset — otherwise the
    // "kept" assertion cannot be told from "never had one".
    const edited = renamed(draft, 'Renamed Token');
    rerender({ ...base, draftConfig: edited });
    await flushPreviewDebounce();
    await waitFor(() => {
      expect(result.current.phase.kind === 'ready' && result.current.phase.changedPaths).toContain(
        README
      );
    });

    reveal(result);
    const pending = result.current.reveal;

    rerender({ ...base, draftConfig: edited, currentStepId: 'identity' });
    await waitFor(() => {
      expect(result.current.phase.kind === 'ready' && result.current.phase.changedPaths).toEqual(
        []
      );
    });

    expect(
      result.current.reveal,
      'INV-8: step id is not a generate input; the tree is the same tree'
    ).toBe(pending);
    expect(result.current.selectedPath).toBe(README);
  });

  it('negative: draftEpoch bump with identical config → reveal kept', async () => {
    const { result, rerender, base } = mount({ draftEpoch: 0 });
    const before = await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;

    rerender({ ...base, draftEpoch: 1 });
    await flushPreviewDebounce();
    await waitFor(() => {
      expect(result.current.phase).not.toBe(before);
    });

    expect(result.current.reveal, 'INV-8: the baseline epoch is not a generate input').toBe(
      pending
    );
  });

  it('interleaving: a reveal issued between a generate start and its tree-ready for a different key is dropped; the in-flight tree still lands (INV-8, INV-10, INV-16)', async () => {
    const slow = createSlowCodegenService(twoFileService(), 40);
    const { result, rerender, base, draft } = mount({ codegenService: slow });
    await waitForPreviewReady(() => result.current);

    rerender({ ...base, draftConfig: renamed(draft, 'Renamed Token') });
    await flushPreviewDebounce(); // the generate for the new key is now in flight
    expect(
      result.current.phase.kind === 'ready' && result.current.phase.files[README]
    ).not.toContain('Renamed Token');

    // Stamped with `lastGenerateKeyRef` — still the previous key, because the
    // ref is written only when a tick succeeds.
    reveal(result);
    expect(result.current.reveal).toBeDefined();
    expect(result.current.persistence.open).toBe(true);

    await waitFor(() => {
      expect(result.current.phase.kind === 'ready' && result.current.phase.files[README]).toContain(
        'Renamed Token'
      );
    });
    // The tree arriving proves the reveal did not touch the generate counter
    // (INV-10): a bumped `requestIdRef` would have discarded this result.
    expect(
      result.current.reveal,
      'INV-8: stamped against the old key, dropped by the new tree'
    ).toBeUndefined();
    expect(result.current.selectedPath).toBe(README);
  });
});

describe('requestId is monotonic per hook instance (INV-10)', () => {
  it('re-requesting the same range yields a new id with the same lines', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);

    reveal(result);
    const first = result.current.reveal;
    reveal(result);
    const second = result.current.reveal;

    expect(first?.startLine).toBe(second?.startLine);
    expect(first?.endLine).toBe(second?.endLine);
    expect(
      Number(second?.id),
      'INV-10: the kit retriggers on Object.is, so the id must move'
    ).toBeGreaterThan(Number(first?.id));
    expect(second).not.toBe(first);
  });

  it('a guarded no-op between two accepted reveals does not consume an id', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);

    reveal(result);
    const first = Number(result.current.reveal?.id);
    reveal(result, 'not/here.rs');
    reveal(result, 'constructor');
    reveal(result);

    expect(result.current.reveal?.id).toBe(first + 1);
  });

  it('is not reset by close or by a tree change', async () => {
    const { result, rerender, base, draft } = mount();
    await waitForPreviewReady(() => result.current);

    reveal(result);
    const first = Number(result.current.reveal?.id);

    act(() => {
      result.current.setOpen(false);
    });
    rerender({ ...base, draftConfig: renamed(draft, 'Other') });
    await flushPreviewDebounce();
    await waitFor(() => {
      expect(result.current.phase.kind === 'ready' && result.current.phase.files[README]).toContain(
        'Other'
      );
    });

    reveal(result);
    expect(result.current.reveal?.id, 'INV-10: the counter only increments').toBe(first + 1);
  });
});

describe('drawer close clears the reveal on the true→false transition only (INV-11)', () => {
  it('reveal → close → reopen: reveal gone, path kept, still gone after reopen', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);

    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.reveal).toBeUndefined();
    expect(result.current.selectedPath, 'INV-5/INV-11: the file survives close').toBe(README);

    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.reveal, 'INV-11: a reopen shows the file unmarked').toBeUndefined();
    expect(result.current.selectedPath).toBe(README);
  });

  it('a reveal into an already-open drawer is not cleared by its own setOpen(true)', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    act(() => {
      result.current.setOpen(true);
    });

    reveal(result);

    expect(result.current.reveal).toBeDefined();
    expect(result.current.persistence.open).toBe(true);
  });

  it('mount with persisted open:true fires no clearing on mount or on true→true re-renders', async () => {
    localStorage.setItem(CODE_PREVIEW_OPEN_STORAGE_KEY, 'true');
    const { result, rerender, base } = mount();
    await waitForPreviewReady(() => result.current);
    expect(result.current.persistence.open).toBe(true);

    reveal(result);
    const pending = result.current.reveal;
    rerender({ ...base });
    rerender({ ...base });

    expect(result.current.reveal).toBe(pending);
    localStorage.removeItem(CODE_PREVIEW_OPEN_STORAGE_KEY);
  });

  it('a settled null service closes the drawer and clears the reveal through the same path', async () => {
    const { result, rerender, base } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);

    rerender({ ...base, codegenService: null, isCodegenServiceLoading: false });

    await waitFor(() => {
      expect(result.current.persistence.open).toBe(false);
      expect(result.current.reveal).toBeUndefined();
    });
    expect(result.current.selectedPath).toBe(README);
  });
});

describe('selectedPath and reveal are two projections of one state (INV-1, INV-5)', () => {
  it('reveal A then setSelectedPath(B): B is selected and no reveal remains', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);

    act(() => {
      result.current.setSelectedPath(DEPLOY);
    });

    expect(result.current.selectedPath).toBe(DEPLOY);
    expect(
      result.current.reveal,
      'INV-1: no render pairs deploy.ts with README.md’s range'
    ).toBeUndefined();
  });

  it('a tree-ready fallback comes from defaultSelectedPath and nothing else (INV-5)', async () => {
    const spy = vi.spyOn(defaultSelectedPathModule, 'defaultSelectedPath');
    const { result, rerender, base, draft } = mount();
    const ready = await waitForPreviewReady(() => result.current);
    expect(spy).toHaveBeenCalledWith(ready.files);

    // Select a file that the next tree will not contain.
    act(() => {
      result.current.setSelectedPath(DEPLOY);
    });
    const service: RwaCodegenService = {
      ...base.codegenService!,
      async generateFileTree(config: RWAConfig, generateOptions) {
        const artifact = await base.codegenService!.generateFileTree(config, generateOptions);
        const { [DEPLOY]: _dropped, ...rest } = artifact.files;
        return { files: rest };
      },
    };
    rerender({ ...base, codegenService: service, draftConfig: renamed(draft, 'No Deploy') });
    await flushPreviewDebounce();

    await waitFor(() => {
      expect(
        result.current.phase.kind === 'ready' && result.current.phase.files
      ).not.toHaveProperty(DEPLOY);
    });
    expect(result.current.selectedPath).toBe(spy.mock.results[spy.mock.results.length - 1]?.value);
    expect(result.current.selectedPath).toBe(README);
  });

  it('useCodePreview.ts no longer holds a selected path in useState', () => {
    // Vitest runs with the package as cwd, both directly and under root `pnpm test`.
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/code-preview/hooks/useCodePreview.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/useState<string \| null>/);
    expect(source).toMatch(/useReducer\(\s*reducePreviewSelection/);
  });
});

describe('reveal identity — one test per memo input and per non-input (INV-13)', () => {
  it('input: selected path change → undefined', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    act(() => {
      result.current.setSelectedPath(DEPLOY);
    });
    expect(result.current.reveal).toBeUndefined();
  });

  it('input: different startLine → new value', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    const first = result.current.reveal;
    reveal(result, README, { startLine: 1, endLine: 3 });
    expect(result.current.reveal).not.toBe(first);
    expect(result.current.reveal?.startLine).toBe(1);
  });

  it('input: different endLine → new value', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    const first = result.current.reveal;
    reveal(result, README, { startLine: 2, endLine: 4 });
    expect(result.current.reveal).not.toBe(first);
    expect(result.current.reveal?.endLine).toBe(4);
  });

  it('input: same range re-requested → new value with a new id', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    const first = result.current.reveal;
    reveal(result);
    expect(result.current.reveal).not.toBe(first);
    expect(result.current.reveal?.id).not.toBe(first?.id);
  });

  it('input: setOpen(false) → undefined', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.reveal).toBeUndefined();
  });

  it('non-input: setHeight → same identity', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;
    act(() => {
      result.current.setSize(360);
    });
    expect(result.current.persistence.size).toBe(360);
    expect(result.current.reveal).toBe(pending);
  });

  it('non-input: onToggleMaximize → same identity', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;
    act(() => {
      result.current.layout.onToggleMaximize();
    });
    expect(result.current.layout.maximized).toBe(true);
    expect(result.current.reveal).toBe(pending);
  });

  it('non-input: onToggleTree → same identity', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;
    const visible = result.current.layout.treeVisible;
    act(() => {
      result.current.layout.onToggleTree();
    });
    expect(result.current.layout.treeVisible).toBe(!visible);
    expect(result.current.reveal).toBe(pending);
    localStorage.removeItem('rwa-wizard:code-preview:tree');
  });

  it('non-input: duplicate-key tree-ready → same identity (proves the `[selection]` dep is exact)', async () => {
    // The code draft keys the memo on `selection`, not `selection.reveal`. This
    // is the transition that would expose the difference: the reducer receives
    // an action and must hand back the very same state object, or the memo
    // recomputes and hands the pane a fresh `{startLine, endLine, id}`.
    const { result, rerender, base, draft } = mount();
    const before = await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;

    rerender({ ...base, draftConfig: { ...draft } });
    await flushPreviewDebounce();
    await waitFor(() => {
      expect(result.current.phase).not.toBe(before);
    });

    expect(result.current.reveal).toBe(pending);
  });

  it('non-input: unrelated hook re-render with identical props → same identity', async () => {
    const { result, rerender, base } = mount();
    await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;
    rerender({ ...base });
    expect(result.current.reveal).toBe(pending);
  });

  it('non-input: a select(p) that changes `selection` while reveal stays absent leaves `reveal` undefined→undefined', async () => {
    // Rows 1 and 5 move `selection` without a reveal in play. With `[selection]`
    // as the dep the memo recomputes, but `undefined` is identity-equal, so the
    // memoised pane is unaffected either way.
    const { result } = mount();
    await waitForPreviewReady(() => result.current);
    expect(result.current.reveal).toBeUndefined();
    act(() => {
      result.current.setSelectedPath(DEPLOY);
    });
    expect(result.current.reveal).toBeUndefined();
  });
});

describe('a reveal is inert, not lost, across error and loading phases (INV-16)', () => {
  function flakyService(): { service: RwaCodegenService; setFail: (fail: boolean) => void } {
    let shouldFail = false;
    const base = twoFileService();
    return {
      setFail: (fail) => {
        shouldFail = fail;
      },
      service: {
        ...base,
        async generateFileTree(config: RWAConfig, generateOptions) {
          if (shouldFail) {
            throw new Error('generate failed');
          }
          return base.generateFileTree(config, generateOptions);
        },
      },
    };
  }

  it('reveal → generate error → still pending → config restored to the stamped key → same reveal', async () => {
    const { service, setFail } = flakyService();
    const { result, rerender, base, draft } = mount({ codegenService: service });
    await waitForPreviewReady(() => result.current);
    reveal(result);
    const pending = result.current.reveal;

    setFail(true);
    rerender({ ...base, draftConfig: renamed(draft, 'Broken') });
    await flushPreviewDebounce();
    await waitFor(() => {
      expect(result.current.phase.kind).toBe('error');
    });
    expect(
      result.current.reveal,
      'INV-16: an error dispatches no tree-ready; the reveal is untouched'
    ).toBe(pending);

    setFail(false);
    rerender({ ...base, draftConfig: draft });
    await flushPreviewDebounce();
    await waitForPreviewReady(() => result.current);
    expect(result.current.reveal, 'INV-16: same key → row 3 → same mark, same identity').toBe(
      pending
    );
    expect(result.current.selectedPath).toBe(README);
  });

  it('reveal → generate error → different valid config → dropped on arrival', async () => {
    const { service, setFail } = flakyService();
    const { result, rerender, base, draft } = mount({ codegenService: service });
    await waitForPreviewReady(() => result.current);
    reveal(result);

    setFail(true);
    rerender({ ...base, draftConfig: renamed(draft, 'Broken') });
    await flushPreviewDebounce();
    await waitFor(() => {
      expect(result.current.phase.kind).toBe('error');
    });
    expect(result.current.reveal).toBeDefined();

    setFail(false);
    rerender({ ...base, draftConfig: renamed(draft, 'Fixed') });
    await flushPreviewDebounce();
    await waitFor(() => {
      expect(result.current.phase.kind === 'ready' && result.current.phase.files[README]).toContain(
        'Fixed'
      );
    });
    expect(result.current.reveal).toBeUndefined();
  });
});

describe('reveal state holds only primitives and leaves nothing behind (INV-15)', () => {
  it('100 reveal/drop cycles end in a clean selection with a counter that only went up', async () => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);

    for (let i = 0; i < 100; i += 1) {
      reveal(result);
      act(() => {
        result.current.setSelectedPath(DEPLOY);
      });
    }

    expect(result.current.selectedPath).toBe(DEPLOY);
    expect(result.current.reveal).toBeUndefined();
    reveal(result);
    expect(
      result.current.reveal?.id,
      'INV-10/INV-15: 100 accepted reveals consumed exactly 100 ids'
    ).toBe(101);
  });
});

describe('never-throw at the seam (INV-17)', () => {
  it.each([
    ['NaN', { startLine: Number.NaN, endLine: 2 }],
    ['negative', { startLine: -1, endLine: 2 }],
    ['non-integer', { startLine: 1.5, endLine: 2 }],
    ['Infinity', { startLine: 1, endLine: Number.POSITIVE_INFINITY }],
    ['inverted', { startLine: 3, endLine: 1 }],
    ['zero', { startLine: 0, endLine: 0 }],
  ])('a %s range is accepted and passed through untouched', async (_label, range) => {
    const { result } = mount();
    await waitForPreviewReady(() => result.current);

    expect(() => reveal(result, README, range)).not.toThrow();
    expect(result.current.reveal).toStrictEqual({
      startLine: range.startLine,
      endLine: range.endLine,
      id: 1,
    });
  });

  it.each(['', '/', '../x', 'constructor', 'README.md/'])(
    'path %j that is not a file is a silent no-op with no logging',
    async (path) => {
      const warn = vi.spyOn(logger, 'warn');
      const error = vi.spyOn(logger, 'error');
      const info = vi.spyOn(logger, 'info');
      const { result } = mount();
      await waitForPreviewReady(() => result.current);

      expect(() => reveal(result, path)).not.toThrow();
      expect(result.current.persistence.open).toBe(false);
      expect(result.current.reveal).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
    }
  );

  it('calling before any tree exists does not throw', () => {
    const { result } = mount({
      codegenService: createSlowCodegenService(twoFileService(), 40),
    });
    expect(() => reveal(result)).not.toThrow();
    expect(() => reveal(result, '', null)).not.toThrow();
  });
});

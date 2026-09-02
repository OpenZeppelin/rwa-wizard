import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProvenanceResult } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';
import { logger } from '@openzeppelin/ui-utils';

import { createTestCodegenService } from '../../../services/codegen';
import type {
  GenerateArtifactOptions,
  GeneratedFileTreeArtifact,
  RwaCodegenService,
} from '../../../services/codegen/types';
import {
  defaultPreviewHookOptions,
  flushPreviewDebounce,
  waitForPreviewReady,
} from '../../../test/helpers/codePreviewHarness';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { resolveConfigPath, tokenPaths } from '../../wizard/config-path';
import type { UseCodePreviewOptions, UseCodePreviewResult } from './useCodePreview';
import { useCodePreview } from './useCodePreview';

const README = 'README.md';
const CONTRACT = 'contract.txt';

/**
 * A recording double: provenance is a fresh object per call that names the
 * config it was computed for, so a cache hit and a cache miss are told apart
 * by reference, and attribution can depend on the input.
 */
function recordingService(): RwaCodegenService {
  const base = createTestCodegenService({
    fileKinds: { [README]: 'provenance-and-docs', [CONTRACT]: 'contract' },
    provenance: (): ProvenanceResult => ({
      files: {
        [README]: { entries: [{ kind: 'file', paths: [tokenPaths.name] }] },
        [CONTRACT]: {
          entries: [
            { kind: 'file', paths: [tokenPaths.name, tokenPaths.initialSupply] },
            { kind: 'range', range: { start: 12, end: 12 }, paths: [tokenPaths.initialSupply] },
          ],
        },
      },
    }),
  });
  return {
    ...base,
    async generateFileTree(config, generateOptions) {
      const artifact = await base.generateFileTree(config, generateOptions);
      return {
        ...artifact,
        files: { ...artifact.files, [CONTRACT]: `// ${config.token.name}\n` },
      };
    },
  };
}

interface PendingGeneration {
  readonly config: RWAConfig;
  readonly options: GenerateArtifactOptions | undefined;
  readonly resolve: (artifact: GeneratedFileTreeArtifact) => void;
}

function deferredService(): {
  readonly service: RwaCodegenService;
  readonly pending: PendingGeneration[];
} {
  const base = createTestCodegenService();
  const pending: PendingGeneration[] = [];
  return {
    pending,
    service: {
      ...base,
      generateFileTree(config, options) {
        return new Promise<GeneratedFileTreeArtifact>((resolve) => {
          pending.push({ config, options, resolve });
        });
      },
    },
  };
}

interface Mounted {
  readonly result: { readonly current: UseCodePreviewResult };
  readonly rerender: (props: UseCodePreviewOptions) => void;
  readonly base: UseCodePreviewOptions;
}

function mount(overrides: Partial<UseCodePreviewOptions> = {}): Mounted {
  const base = defaultPreviewHookOptions({
    codegenService: recordingService(),
    draftConfig: createDefaultRwaConfig(),
    ...overrides,
  });
  const { result, rerender } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
    initialProps: base,
  });
  return { result, rerender, base };
}

function renamed(draft: RWAConfig, name: string): RWAConfig {
  return { ...draft, token: { ...draft.token, name } };
}

/** Ticks the first catalog module (a required `limit` field) with no config. */
function withTickedModule(draft: RWAConfig): RWAConfig {
  return {
    ...draft,
    compliance: { ...draft.compliance, modules: [{ moduleId: 'supply-limit', config: {} }] },
  };
}

function readyProvenance(result: {
  readonly current: UseCodePreviewResult;
}): ProvenanceResult | undefined {
  const phase = result.current.phase;
  return phase.kind === 'ready' ? phase.provenance : undefined;
}

async function settle(mounted: Mounted, next: UseCodePreviewOptions): Promise<void> {
  mounted.rerender(next);
  await flushPreviewDebounce();
  await waitFor(() => {
    const phase = mounted.result.current.phase;
    expect(
      phase.kind === 'ready' && phase.generateKey === mounted.result.current.provenance.liveIdentity
    ).toBe(true);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCodePreview provenance — state and staleness (INV-8, INV-11, INV-18, INV-19)', () => {
  it('the default double is unsupported and silent (AS-2)', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const info = vi.spyOn(logger, 'info');
    const debug = vi.spyOn(logger, 'debug');
    const error = vi.spyOn(logger, 'error');
    const { result } = mount({ codegenService: createTestCodegenService() });
    const phase = await waitForPreviewReady(() => result.current);
    expect('provenance' in phase).toBe(false);
    expect(result.current.provenance.state).toEqual({
      kind: 'unsupported',
      identity: phase.generateKey,
    });
    expect(warn).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('no service → none and liveIdentity null', () => {
    const { result } = mount({ codegenService: null, isCodegenServiceLoading: false });
    expect(result.current.provenance).toEqual({ state: { kind: 'none' }, liveIdentity: null });
  });

  it('answers an absent optional member from recorded paths (the acceptance case)', async () => {
    const draft = createDefaultRwaConfig();
    expect(resolveConfigPath(draft, tokenPaths.initialSupply).found).toBe(false);
    const { result } = mount({ draftConfig: draft });
    const phase = await waitForPreviewReady(() => result.current);
    const { state, liveIdentity } = result.current.provenance;
    expect(state.kind).toBe('available');
    if (state.kind !== 'available') return;
    expect(state.identity).toBe(phase.generateKey);
    expect(liveIdentity).toBe(phase.generateKey);
    const answer = state.lookup(tokenPaths.initialSupply);
    expect(answer.identity).toBe(phase.generateKey);
    expect(answer.groups).toEqual([
      {
        path: CONTRACT,
        kind: 'contract',
        // `significance: 'primary'` is not asserted by hand here — it is what the
        // real loader and the real seam produce for an entry that declares
        // nothing. SF-11 INV-2, at the consuming end of the seam.
        rows: [{ kind: 'range', range: { startLine: 12, endLine: 12 }, significance: 'primary' }],
      },
    ]);
    // README is hidden by its generator-reported kind, not its name.
    expect(state.lookup(tokenPaths.name).groups.map((g) => g.path)).toEqual([CONTRACT]);
  });

  it('liveIdentity moves on the keystroke render while the tree key lags; they re-agree after the tick', async () => {
    const mounted = mount({ debounceMs: 50 });
    const { result, rerender, base } = mounted;
    const phase = await waitForPreviewReady(() => result.current);
    const before = result.current.provenance.state;
    if (before.kind !== 'available') throw new Error('expected available');
    const r0 = before.lookup(tokenPaths.name);

    rerender({ ...base, draftConfig: renamed(base.draftConfig, 'Edited') });
    expect(result.current.provenance.liveIdentity).not.toBe(r0.identity);
    const lagging = result.current.phase;
    expect(lagging.kind === 'ready' && lagging.generateKey).toBe(phase.generateKey);

    await flushPreviewDebounce(60);
    await waitFor(() => {
      const p = result.current.phase;
      expect(p.kind === 'ready' && p.generateKey).toBe(result.current.provenance.liveIdentity);
    });
    const after = result.current.provenance.state;
    if (after.kind !== 'available') throw new Error('expected available');
    expect(after.lookup(tokenPaths.name).identity).toBe(result.current.provenance.liveIdentity);
  });
});

describe('useCodePreview provenance — commit ordering (INV-21)', () => {
  it('discards a superseded generation and commits files, provenance, and identity from one result', async () => {
    const deferred = deferredService();
    const mounted = mount({ codegenService: deferred.service });
    await waitFor(() => expect(deferred.pending).toHaveLength(1));

    const next = {
      ...mounted.base,
      draftConfig: renamed(mounted.base.draftConfig, 'newer'),
    };
    mounted.rerender(next);
    await flushPreviewDebounce();
    await waitFor(() => expect(deferred.pending).toHaveLength(2));

    const staleProvenance: ProvenanceResult = {
      files: { 'stale.txt': { entries: [{ kind: 'file', paths: [tokenPaths.name] }] } },
    };
    const freshProvenance: ProvenanceResult = {
      files: { 'fresh.txt': { entries: [{ kind: 'file', paths: [tokenPaths.name] }] } },
    };

    await act(async () => {
      deferred.pending[0]?.resolve({
        files: { 'stale.txt': 'stale' },
        provenance: staleProvenance,
      });
      await Promise.resolve();
    });
    expect(readyProvenance(mounted.result)).not.toBe(staleProvenance);

    await act(async () => {
      deferred.pending[1]?.resolve({
        files: { 'fresh.txt': 'fresh' },
        provenance: freshProvenance,
      });
      await Promise.resolve();
    });
    const phase = await waitForPreviewReady(() => mounted.result.current);
    expect(phase.files).toEqual({ 'fresh.txt': 'fresh' });
    expect(phase.provenance).toBe(freshProvenance);
    expect(phase.generateKey).toBe(mounted.result.current.provenance.liveIdentity);
    expect(mounted.result.current.provenance.state).toMatchObject({
      kind: 'available',
      identity: phase.generateKey,
    });
  });
});

describe('useCodePreview provenance — cache skip key, one test per input (INV-16, INV-17)', () => {
  async function ready(mounted: Mounted): Promise<ProvenanceResult> {
    await waitForPreviewReady(() => mounted.result.current);
    const provenance = readyProvenance(mounted.result);
    if (!provenance) throw new Error('expected provenance');
    return provenance;
  }

  it('(1) filled-config hash → new provenance object', async () => {
    const mounted = mount();
    const first = await ready(mounted);
    await settle(mounted, { ...mounted.base, draftConfig: renamed(mounted.base.draftConfig, 'B') });
    expect(readyProvenance(mounted.result)).not.toBe(first);
  });

  it('(2) module catalog → new provenance object', async () => {
    // A ticked module with a required field left empty: the fill adds a
    // sentinel only when the catalog knows the module, so the catalog alone
    // moves the filled hash.
    const mounted = mount({ draftConfig: withTickedModule(createDefaultRwaConfig()) });
    const first = await ready(mounted);
    await settle(mounted, { ...mounted.base, moduleCatalog: [] });
    expect(readyProvenance(mounted.result)).not.toBe(first);
  });

  it('(3) includeIdentitySupport → new provenance object', async () => {
    const mounted = mount();
    const first = await ready(mounted);
    await settle(mounted, { ...mounted.base, includeIdentitySupport: true });
    expect(readyProvenance(mounted.result)).not.toBe(first);
  });

  it('(4) service identity → new provenance object', async () => {
    const mounted = mount();
    const first = await ready(mounted);
    await settle(mounted, { ...mounted.base, codegenService: recordingService() });
    expect(readyProvenance(mounted.result)).not.toBe(first);
  });

  it('nothing varied → same object by reference, generateFileTree called once (cache pairing)', async () => {
    const service = recordingService();
    const spy = vi.spyOn(service, 'generateFileTree');
    const mounted = mount({ codegenService: service });
    const first = await ready(mounted);
    const files =
      mounted.result.current.phase.kind === 'ready' ? mounted.result.current.phase.files : null;
    await settle(mounted, { ...mounted.base, currentStepId: 'identity' });
    expect(readyProvenance(mounted.result)).toBe(first);
    expect(
      mounted.result.current.phase.kind === 'ready' && mounted.result.current.phase.files
    ).toBe(files);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('negative: recordProvenance is constant — every call receives exactly the two options', async () => {
    const service = recordingService();
    const spy = vi.spyOn(service, 'generateFileTree');
    const mounted = mount({ codegenService: service });
    await ready(mounted);
    await settle(mounted, { ...mounted.base, includeIdentitySupport: true });
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const [, options] of spy.mock.calls) {
      expect(Object.keys(options ?? {}).sort()).toEqual([
        'includeIdentitySupport',
        'recordProvenance',
      ]);
      expect(options?.recordProvenance).toBe(true);
    }
  });
});

describe('useCodePreview provenance — memo inputs and non-inputs (INV-17, INV-18)', () => {
  it('liveIdentity input (1): changing only the filled draft config changes the key', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    await settle(mounted, {
      ...mounted.base,
      draftConfig: renamed(mounted.base.draftConfig, 'Z'),
    });

    expect(mounted.result.current.provenance.liveIdentity).not.toBe(before);
  });

  it('liveIdentity input (2): changing only the module catalog changes the key', async () => {
    const mounted = mount({ draftConfig: withTickedModule(createDefaultRwaConfig()) });
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    await settle(mounted, { ...mounted.base, moduleCatalog: [] });

    expect(mounted.result.current.provenance.liveIdentity).not.toBe(before);
  });

  it('liveIdentity input (3): changing only includeIdentitySupport changes the key', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    await settle(mounted, { ...mounted.base, includeIdentitySupport: true });

    expect(mounted.result.current.provenance.liveIdentity).not.toBe(before);
  });

  it('liveIdentity input (4): changing only the service instance changes the key', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    await settle(mounted, { ...mounted.base, codegenService: recordingService() });

    expect(mounted.result.current.provenance.liveIdentity).not.toBe(before);
  });

  it('liveIdentity non-input: changing only currentStepId leaves the key unchanged', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    await settle(mounted, { ...mounted.base, currentStepId: 'identity' });

    expect(mounted.result.current.provenance.liveIdentity).toBe(before);
  });

  it('liveIdentity non-input: changing only draftEpoch leaves the key unchanged', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    await settle(mounted, { ...mounted.base, draftEpoch: 7 });

    expect(mounted.result.current.provenance.liveIdentity).toBe(before);
  });

  it('liveIdentity non-input: debounce progress leaves the live key unchanged', async () => {
    const mounted = mount({ debounceMs: 50 });
    await waitForPreviewReady(() => mounted.result.current);
    mounted.rerender({
      ...mounted.base,
      draftConfig: renamed(mounted.base.draftConfig, 'debouncing'),
    });
    const duringDebounce = mounted.result.current.provenance.liveIdentity;

    await flushPreviewDebounce(10);

    expect(mounted.result.current.provenance.liveIdentity).toBe(duringDebounce);
    await flushPreviewDebounce(50);
  });

  it('liveIdentity non-input: changing only drawer open state leaves the key unchanged', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    act(() => mounted.result.current.setOpen(true));

    expect(mounted.result.current.provenance.liveIdentity).toBe(before);
  });

  it('liveIdentity non-input: changing only drawer height leaves the key unchanged', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    act(() => mounted.result.current.setSize(640));

    expect(mounted.result.current.provenance.liveIdentity).toBe(before);
  });

  it('liveIdentity non-input: changing only drawer maximized state leaves the key unchanged', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    act(() => mounted.result.current.layout.onToggleMaximize());

    expect(mounted.result.current.provenance.liveIdentity).toBe(before);
  });

  it('liveIdentity non-input: changing only drawer tree visibility leaves the key unchanged', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance.liveIdentity;

    act(() => mounted.result.current.layout.onToggleTree());

    expect(mounted.result.current.provenance.liveIdentity).toBe(before);
  });

  it('identity non-input: querying a different field changes the path, not the stamped key', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const state = mounted.result.current.provenance.state;
    if (state.kind !== 'available') throw new Error('expected available provenance state');

    const name = state.lookup(tokenPaths.name);
    const supply = state.lookup(tokenPaths.initialSupply);

    expect(supply.path).not.toBe(name.path);
    expect(supply.identity).toBe(name.identity);
  });

  it('kindOf memo input: changing only service identity rebuilds provenanceState', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const beforePhase = mounted.result.current.phase;
    const beforeState = mounted.result.current.provenance.state;

    const next = { ...mounted.base, codegenService: recordingService() };
    mounted.rerender(next);

    expect(mounted.result.current.phase).toBe(beforePhase);
    expect(mounted.result.current.provenance.state).not.toBe(beforeState);
    await settle(mounted, next);
  });

  it('provenanceState memo input (1): changing only phase rebuilds the state', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const beforeState = mounted.result.current.provenance.state;
    mounted.rerender({
      ...mounted.base,
      draftConfig: renamed(mounted.base.draftConfig, 'new phase'),
    });
    const liveIdentity = mounted.result.current.provenance.liveIdentity;

    await settle(mounted, {
      ...mounted.base,
      draftConfig: renamed(mounted.base.draftConfig, 'new phase'),
    });

    expect(mounted.result.current.provenance.liveIdentity).toBe(liveIdentity);
    expect(mounted.result.current.provenance.state).not.toBe(beforeState);
  });

  it('provenanceState memo input (2): changing only kindOf rebuilds the state', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const beforePhase = mounted.result.current.phase;
    const beforeState = mounted.result.current.provenance.state;

    const next = { ...mounted.base, codegenService: recordingService() };
    mounted.rerender(next);

    expect(mounted.result.current.phase).toBe(beforePhase);
    expect(mounted.result.current.provenance.state).not.toBe(beforeState);
    await settle(mounted, next);
  });

  it('provenance memo input (1): changing only provenanceState rebuilds the value', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const next = {
      ...mounted.base,
      draftConfig: renamed(mounted.base.draftConfig, 'next tree'),
    };
    mounted.rerender(next);
    const before = mounted.result.current.provenance;

    await settle(mounted, next);

    expect(mounted.result.current.provenance.liveIdentity).toBe(before.liveIdentity);
    expect(mounted.result.current.provenance.state).not.toBe(before.state);
    expect(mounted.result.current.provenance).not.toBe(before);
  });

  it('provenance memo input (2): changing only liveIdentity rebuilds the value', async () => {
    const mounted = mount({ debounceMs: 50 });
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance;

    mounted.rerender({
      ...mounted.base,
      draftConfig: renamed(mounted.base.draftConfig, 'live only'),
    });

    expect(mounted.result.current.provenance.state).toBe(before.state);
    expect(mounted.result.current.provenance.liveIdentity).not.toBe(before.liveIdentity);
    expect(mounted.result.current.provenance).not.toBe(before);
  });

  it('all provenance memos ignore an unrelated re-render', async () => {
    const mounted = mount();
    await waitForPreviewReady(() => mounted.result.current);
    const before = mounted.result.current.provenance;

    mounted.rerender({ ...mounted.base });

    expect(mounted.result.current.provenance).toBe(before);
    expect(mounted.result.current.provenance.state).toBe(before.state);
  });

  it('cache and provenance are one pair written at one site (INV-16 static)', () => {
    const text = readFileSync(resolve(__dirname, 'useCodePreview.ts'), 'utf8');
    expect(text.match(/cachedTreeRef\.current =/g)).toHaveLength(1);
    expect(text).not.toMatch(/cachedFilesRef/);
  });
});

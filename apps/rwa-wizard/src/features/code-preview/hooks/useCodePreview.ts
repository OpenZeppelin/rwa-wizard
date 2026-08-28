import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';

import { computeConfigHash, type FileTree } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { useCopy } from '../../../app/providers/useCopy';
import { CodegenInvalidConfigError } from '../../../services/codegen/errors';
import type { RwaCodegenService } from '../../../services/codegen/types';
import {
  createStepFileTreeSnapshot,
  listChangedPaths,
  toPreviewConfig,
  type StepFileTreeSnapshot,
} from '../../../services/preview';
import type {
  ComplianceModuleOption,
  StructuralUpstreamImportLinks,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';
import { defaultSelectedPath } from '../defaultSelectedPath';
import { useCodePreviewPersistence } from './useCodePreviewPersistence';
import { useDebouncedValue } from './useDebouncedValue';

export type CodePreviewPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'ready';
      readonly files: FileTree;
      readonly configHash: string;
      readonly substitutedKeys: readonly string[];
      readonly changedPaths: readonly string[];
    }
  | {
      readonly kind: 'error';
      readonly substitutedKeys: readonly string[];
      readonly messages: readonly string[];
    };

export interface UseCodePreviewOptions {
  readonly codegenService: RwaCodegenService | null;
  /**
   * Whether the target runtime is still resolving `codegenService`. A `null`
   * service means two different things — "not loaded yet" and "this target
   * cannot generate" — and only the second should close and un-persist the
   * drawer. Conflating them wiped the stored open state on every page load.
   */
  readonly isCodegenServiceLoading?: boolean;
  readonly draftConfig: RWAConfig;
  readonly moduleCatalog: readonly ComplianceModuleOption[];
  readonly currentStepId: string;
  /**
   * Identity of the draft being edited. The step baseline means "the tree as
   * this draft entered this step", so it has to be discarded when the draft
   * underneath it is replaced — Cancel and hydrating a stored draft both swap
   * the config without changing the step or the service, and the marks were
   * then measured against a draft the user had already abandoned.
   *
   * Pass the page's `resetKey`: it is bumped on exactly those two events, and
   * deliberately not when autosave promotes an in-memory draft to a stored id,
   * which is the same draft and must not re-baseline mid-edit.
   */
  readonly draftEpoch?: string | number;
  readonly includeIdentitySupport: boolean;
  readonly debounceMs?: number;
}

export interface CodePreviewLayoutTools {
  /** File tree pane shown. Persisted. */
  readonly treeVisible: boolean;
  readonly onToggleTree: () => void;
  /** Sheet at full viewport height. Not persisted; the stored height is kept for restore. */
  readonly maximized: boolean;
  readonly onToggleMaximize: () => void;
}

export interface UseCodePreviewResult {
  readonly persistence: {
    readonly open: boolean;
    /** Height to render: the viewport while maximized, else the stored height. */
    readonly height: number;
  };
  readonly setOpen: (open: boolean) => void;
  /** Height reported by the sheet (drag, keyboard, clamp). Dragging exits maximize. */
  readonly setHeight: (height: number) => void;
  readonly layout: CodePreviewLayoutTools;
  readonly phase: CodePreviewPhase;
  readonly selectedPath: string | null;
  readonly setSelectedPath: (path: string | null) => void;
  readonly triggerProps: {
    readonly 'aria-expanded': boolean;
    readonly 'aria-controls': string | undefined;
    readonly onClick: () => void;
    /**
     * Must be attached to the trigger element. Closing the sheet unmounts the
     * region that held focus; the kit leaves restoration to the host, so the
     * hook focuses this element to keep focus off `<body>`.
     */
    readonly ref: RefObject<HTMLButtonElement | null>;
  };
  readonly sheetId: string;
  readonly showTrigger: boolean;
  /**
   * Upstream source coordinates reported by the loaded codegen service, for
   * linking generated import paths. `null` when the target reports none.
   */
  readonly sourceRevision: StructuralUpstreamSourceRevision | null;
  /**
   * Import identifiers the loaded codegen service reports as linkable, with
   * where they live upstream. `null` when the target reports none, which is
   * what keeps the preview from decorating imports it knows nothing about.
   */
  readonly importLinks: StructuralUpstreamImportLinks | null;
}

/**
 * Stable per-instance identity for a codegen service, so the generate key can
 * cover "which generator produced this tree" without depending on render order.
 * A `WeakMap` keeps this from retaining services after a target switch.
 */
const serviceIdentities = new WeakMap<RwaCodegenService, string>();
let nextServiceIdentity = 0;

function serviceIdentity(service: RwaCodegenService | null): string {
  if (service === null) {
    return 'none';
  }

  let identity = serviceIdentities.get(service);
  if (identity === undefined) {
    identity = `svc-${(nextServiceIdentity += 1)}`;
    serviceIdentities.set(service, identity);
  }
  return identity;
}

function readViewportHeight(): number {
  return typeof window !== 'undefined' ? window.innerHeight : 0;
}

interface PreviewTickSuccess {
  readonly kind: 'success';
  readonly files: FileTree;
  readonly configHash: string;
  readonly substitutedKeys: readonly string[];
  readonly changedPaths: readonly string[];
}

interface PreviewTickFailure {
  readonly kind: 'error';
  readonly substitutedKeys: readonly string[];
  readonly messages: readonly string[];
}

type PreviewTickResult = PreviewTickSuccess | PreviewTickFailure;

/**
 * Codegen validation errors are already user-facing prose from the package;
 * anything else collapses to `genericMessage`, which the caller reads from
 * `@openzeppelin/rwa-wizard-copy`.
 */
function mapGenerateError(
  err: unknown,
  substitutedKeys: readonly string[],
  genericMessage: string
): PreviewTickFailure {
  if (err instanceof CodegenInvalidConfigError) {
    return {
      kind: 'error',
      substitutedKeys,
      messages: err.errors.map((entry) => entry.message),
    };
  }

  return {
    kind: 'error',
    substitutedKeys,
    messages: [genericMessage],
  };
}

export function useCodePreview(options: UseCodePreviewOptions): UseCodePreviewResult {
  const {
    codegenService,
    isCodegenServiceLoading = false,
    draftConfig,
    moduleCatalog,
    currentStepId,
    draftEpoch = 0,
    includeIdentitySupport,
    debounceMs = 150,
  } = options;

  const sheetId = useId();
  const showTrigger = codegenService !== null;
  const genericGenerateError = useCopy().notice('code-preview.generate-failed').description;

  // Structural metadata from the generator, not scraped out of its output:
  // stable for the life of the service, so it is memoised on service identity.
  const sourceRevision = useMemo(
    () => codegenService?.getUpstreamSourceRevision?.() ?? null,
    [codegenService]
  );
  const importLinks = useMemo(
    () => codegenService?.getUpstreamImportLinks?.() ?? null,
    [codegenService]
  );

  const {
    open,
    height: storedHeight,
    treeVisible,
    setOpen,
    setHeight: setStoredHeight,
    setTreeVisible,
  } = useCodePreviewPersistence();
  const [maximized, setMaximized] = useState(false);

  const [viewportHeight, setViewportHeight] = useState(readViewportHeight);

  // Maximized means "as tall as the window", so the height has to track the
  // window rather than the value captured when maximize was pressed. The kit
  // only clamps on resize, and a taller window leaves the old value legal, so
  // without this the sheet stayed short while still claiming to be maximized
  // and the inset variable held a stale value.
  useEffect(() => {
    if (!maximized || typeof window === 'undefined') {
      return;
    }

    const syncViewport = (): void => setViewportHeight(readViewportHeight());
    syncViewport(); // the window may have changed size before maximize
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, [maximized]);

  const height = maximized ? viewportHeight : storedHeight;

  const setHeight = useCallback(
    (next: number) => {
      // A user-driven resize below the viewport ends maximize; the stored height then
      // tracks the drag as usual. A clamp report equal to the viewport keeps it.
      // Read the window here rather than the state above: a clamp report and the
      // resize listener answer the same event, in no guaranteed order.
      if (maximized) {
        if (next >= readViewportHeight()) {
          return;
        }
        setMaximized(false);
      }
      setStoredHeight(next);
    },
    [maximized, setStoredHeight]
  );

  const onToggleMaximize = useCallback(() => {
    setMaximized((prev) => !prev);
  }, []);

  const onToggleTree = useCallback(() => {
    setTreeVisible(!treeVisible);
  }, [setTreeVisible, treeVisible]);
  const debouncedConfig = useDebouncedValue(draftConfig, debounceMs);

  const [phase, setPhase] = useState<CodePreviewPhase>({ kind: 'idle' });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  /**
   * Identity of what a step baseline describes: "the tree as *this draft*
   * entered *this step*, generated by *this service*". Those three dimensions
   * are the whole validity condition, so they are named once, here, and every
   * user of the baseline derives from this value instead of re-deriving a
   * subset. Baselines used to be invalidated by hand at each site that knew
   * about one dimension — the step-entry effect nulled them on a step change, a
   * render-phase service comparison nulled them on a target change, and nothing
   * at all knew about the draft, so Cancel and hydrating a stored draft left an
   * abandoned draft's baseline in place and marked every file that differed
   * from the discarded one.
   */
  const baselineEpoch = `draft:${draftEpoch}|step:${currentStepId}|service:${serviceIdentity(codegenService)}`;

  const stepSnapshotRef = useRef<{
    readonly epoch: string;
    readonly snapshot: StepFileTreeSnapshot;
  } | null>(null);
  /**
   * Cache key for `cachedFilesRef`. Must cover every input of
   * `generateFileTree` — the preview config, the generate options, and the
   * service that runs them:
   *
   * - preview config hash — `computeConfigHash` covers this dimension only;
   * - `includeIdentitySupport` — a generate option, absent from the config, so
   *   keyed on the hash alone a toggle returned the previous tree;
   * - service identity — the same config generates a different tree per target,
   *   so a target switch would otherwise serve the previous target's files.
   */
  const lastGenerateKeyRef = useRef<string | null>(null);
  const cachedFilesRef = useRef<FileTree | null>(null);
  const requestIdRef = useRef(0);
  /**
   * Generate key the step-entry effect has just handled. The live-tick effect
   * skips only when its own key matches, so a duplicate tick right after step
   * entry is dropped while a tick caused by a changed generate input (which
   * yields a different key) still runs. A bare boolean could not tell the two
   * apart and swallowed the identity-support toggle.
   */
  const stepEntryHandledKeyRef = useRef<string | null>(null);
  const draftConfigRef = useRef(draftConfig);
  draftConfigRef.current = draftConfig;

  /** Key covering every generate input: config hash + generate options + service. */
  const computeGenerateKey = useCallback(
    (config: RWAConfig): string => {
      const previewInput = toPreviewConfig(config, moduleCatalog);
      const configHash = computeConfigHash(previewInput.config);
      return `${configHash}|identity:${includeIdentitySupport ? 1 : 0}|service:${serviceIdentity(codegenService)}`;
    },
    [codegenService, includeIdentitySupport, moduleCatalog]
  );

  const runPreviewTick = useCallback(
    async (config: RWAConfig, requestId: number): Promise<PreviewTickResult> => {
      if (!codegenService) {
        return {
          kind: 'error',
          substitutedKeys: [],
          messages: [genericGenerateError],
        };
      }

      const previewInput = toPreviewConfig(config, moduleCatalog); // INV-6
      const configHash = computeConfigHash(previewInput.config);
      const generateKey = computeGenerateKey(config);
      let files = cachedFilesRef.current;

      if (generateKey !== lastGenerateKeyRef.current || !files) {
        try {
          const artifact = await codegenService.generateFileTree(previewInput.config, {
            includeIdentitySupport, // INV-1
          });
          files = artifact.files;
        } catch (err) {
          if (requestId !== requestIdRef.current) {
            return {
              kind: 'error',
              substitutedKeys: previewInput.substitutedKeys,
              messages: [],
            };
          }

          return mapGenerateError(err, previewInput.substitutedKeys, genericGenerateError);
        }
      }

      if (requestId !== requestIdRef.current) {
        return {
          kind: 'error',
          substitutedKeys: previewInput.substitutedKeys,
          messages: [],
        };
      }

      if (!files) {
        return {
          kind: 'error',
          substitutedKeys: previewInput.substitutedKeys,
          messages: [genericGenerateError],
        };
      }

      lastGenerateKeyRef.current = generateKey;
      cachedFilesRef.current = files;

      // The first success of an epoch is that epoch's baseline, whichever
      // effect produced it, and it stands until the epoch changes. One rule
      // covers what used to need two: a baseline written only by the step-entry
      // path left the step with none for its whole lifetime whenever that
      // generate errored or was discarded, and a baseline invalidated only
      // where someone remembered to null it outlived the draft it described.
      // INV-7
      if (stepSnapshotRef.current?.epoch !== baselineEpoch) {
        stepSnapshotRef.current = {
          epoch: baselineEpoch,
          snapshot: createStepFileTreeSnapshot(files, generateKey),
        };
      }

      const changedPaths = listChangedPaths(stepSnapshotRef.current.snapshot, files, generateKey); // INV-10

      return {
        kind: 'success',
        files,
        configHash,
        substitutedKeys: previewInput.substitutedKeys,
        changedPaths,
      };
    },
    [
      baselineEpoch,
      codegenService,
      computeGenerateKey,
      genericGenerateError,
      includeIdentitySupport,
      moduleCatalog,
    ]
  );

  const applyReadyResult = useCallback((result: PreviewTickSuccess) => {
    setSelectedPath((prev) => {
      if (prev !== null && prev in result.files) {
        return prev;
      }
      return defaultSelectedPath(result.files);
    });

    setPhase({
      kind: 'ready',
      files: result.files,
      configHash: result.configHash,
      substitutedKeys: result.substitutedKeys,
      changedPaths: result.changedPaths,
    });
  }, []);

  // A tick can be requested from an effect whose deps deliberately exclude the
  // generate inputs, so it reads the current callbacks through refs rather than
  // listing them as dependencies.
  const computeGenerateKeyRef = useRef(computeGenerateKey);
  computeGenerateKeyRef.current = computeGenerateKey;
  const runPreviewTickRef = useRef(runPreviewTick);
  runPreviewTickRef.current = runPreviewTick;

  useEffect(() => {
    // Only a settled `null` means "this target cannot generate". While the
    // runtime is still resolving, `codegenService` is also `null`, and closing
    // the drawer here persisted `open: false` on every page load — which made
    // the stored open state unrestorable and the storage key dead.
    if (codegenService === null && !isCodegenServiceLoading) {
      setOpen(false);
      setPhase({ kind: 'idle' });
    }
  }, [codegenService, isCodegenServiceLoading, setOpen]);

  useEffect(() => {
    if (!codegenService) {
      return;
    }

    const requestId = ++requestIdRef.current;
    stepEntryHandledKeyRef.current = computeGenerateKeyRef.current(draftConfigRef.current);

    setPhase((prev) => (prev.kind === 'ready' ? prev : { kind: 'loading' }));

    void (async () => {
      const result = await runPreviewTickRef.current(draftConfigRef.current, requestId);

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (result.kind === 'error') {
        if (result.messages.length > 0) {
          setPhase({
            kind: 'error',
            substitutedKeys: result.substitutedKeys,
            messages: result.messages,
          });
        }
        return;
      }

      applyReadyResult(result);
    })();

    return () => {
      requestIdRef.current += 1; // INV-9
    };
    // INV-7: this effect fires exactly when what the baseline describes changes,
    // so it keys on `baselineEpoch` itself rather than on a hand-picked subset
    // of its dimensions — the two cannot drift apart. Deliberately not keyed on
    // the generate inputs: depending on `computeGenerateKey` / `runPreviewTick`
    // dragged them all in through their closures, so toggling identity support
    // re-entered the step and re-baselined against the post-toggle tree,
    // discarding the very marks the toggle was supposed to produce.
  }, [applyReadyResult, baselineEpoch, codegenService]);

  useEffect(() => {
    if (!codegenService) {
      return;
    }

    if (stepEntryHandledKeyRef.current !== null) {
      const handledKey = stepEntryHandledKeyRef.current;
      stepEntryHandledKeyRef.current = null;
      if (computeGenerateKey(debouncedConfig) === handledKey) {
        return; // duplicate of the step-entry generation — same inputs, same output
      }
    }

    const requestId = ++requestIdRef.current;

    setPhase((prev) => {
      if (prev.kind === 'ready') {
        return prev;
      }
      return { kind: 'loading' };
    });

    void (async () => {
      const result = await runPreviewTickRef.current(debouncedConfig, requestId);

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (result.kind === 'error') {
        if (result.messages.length > 0) {
          setPhase({
            kind: 'error',
            substitutedKeys: result.substitutedKeys,
            messages: result.messages,
          });
        }
        return;
      }

      applyReadyResult(result);
    })();

    return () => {
      requestIdRef.current += 1; // INV-9
    };
    // The generate inputs are the trigger: the settled config, the key that
    // fronts the rest of them, and the service. `runPreviewTick`'s identity is
    // not an input — it also changes with the baseline epoch, and re-running
    // here on that would start a generate for a config the debounce has already
    // superseded, whose request id then discards the fresh one. Both effects
    // read the tick through the same ref for that reason.
  }, [applyReadyResult, codegenService, computeGenerateKey, debouncedConfig]);

  const handleTriggerClick = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (!wasOpen || open) {
      return;
    }

    // The kit keeps the region mounted through its exit transition and never
    // moves focus, so on the two closes that matter for keyboard users — the
    // sheet's own Close button and Escape from inside — focus is still on an
    // element within the sheet at this point, and only lands on `<body>` a
    // couple of hundred milliseconds later when the region unmounts.
    //
    // So the question is not "is focus on `<body>`" but "is the focused element
    // about to disappear". Focus inside the closing sheet, or already dropped
    // to `<body>`, means restore to the trigger; focus anywhere else was moved
    // there deliberately and stealing it back would be worse than the drop.
    const active = document.activeElement;
    const sheet = document.getElementById(sheetId);
    const focusIsDoomed =
      active === null || active === document.body || (sheet?.contains(active) ?? false);

    if (!focusIsDoomed) {
      return;
    }

    triggerRef.current?.focus();
  }, [open, sheetId]);

  return {
    persistence: { open, height },
    setOpen,
    setHeight,
    layout: { treeVisible, onToggleTree, maximized, onToggleMaximize },
    phase,
    selectedPath,
    setSelectedPath,
    triggerProps: {
      'aria-expanded': open,
      'aria-controls': open ? sheetId : undefined, // INV-14
      onClick: handleTriggerClick,
      ref: triggerRef,
    },
    sheetId,
    showTrigger,
    sourceRevision,
    importLinks,
  };
}

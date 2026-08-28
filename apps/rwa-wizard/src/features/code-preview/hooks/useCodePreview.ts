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

  const {
    open,
    height: storedHeight,
    treeVisible,
    setOpen,
    setHeight: setStoredHeight,
    setTreeVisible,
  } = useCodePreviewPersistence();
  const [maximized, setMaximized] = useState(false);

  const viewportHeight = (): number => (typeof window !== 'undefined' ? window.innerHeight : 0);
  const height = maximized ? viewportHeight() : storedHeight;

  const setHeight = useCallback(
    (next: number) => {
      // A user-driven resize below the viewport ends maximize; the stored height then
      // tracks the drag as usual. A clamp report equal to the viewport keeps it.
      if (maximized) {
        if (next >= viewportHeight()) {
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

  const stepSnapshotRef = useRef<StepFileTreeSnapshot | null>(null);
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

  /**
   * A different service generates a different tree from the same config, so its
   * arrival invalidates the cached tree and the step baseline alike. Clearing
   * only when the service became `null` left the previous target's files cached
   * behind a key that no longer described them.
   */
  const lastServiceRef = useRef<RwaCodegenService | null>(codegenService);
  if (lastServiceRef.current !== codegenService) {
    lastServiceRef.current = codegenService;
    stepSnapshotRef.current = null;
    lastGenerateKeyRef.current = null;
    cachedFilesRef.current = null;
  }

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

      // The first success on a step is the baseline, whichever effect produced
      // it. Writing it only from the step-entry path left the step with no
      // baseline for its whole lifetime whenever the entry generate errored or
      // was discarded by a concurrent tick — and a null baseline reports no
      // marks at all. INV-7
      stepSnapshotRef.current ??= createStepFileTreeSnapshot(files, generateKey);

      const changedPaths = listChangedPaths(stepSnapshotRef.current, files, generateKey); // INV-10

      return {
        kind: 'success',
        files,
        configHash,
        substitutedKeys: previewInput.substitutedKeys,
        changedPaths,
      };
    },
    [
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
    stepSnapshotRef.current = null;

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
    // INV-7: step entry is step identity and service identity only. Depending on
    // `computeGenerateKey` / `runPreviewTick` put every generate input in here
    // through their closures, so toggling identity support re-ran step entry,
    // which clears the snapshot and re-baselines against the post-toggle tree,
    // discarding the change marks the toggle was supposed to produce.
  }, [applyReadyResult, codegenService, currentStepId]);

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
      const result = await runPreviewTick(debouncedConfig, requestId);

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
  }, [applyReadyResult, codegenService, computeGenerateKey, debouncedConfig, runPreviewTick]);

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

    // The sheet unmounts on close — via the trigger, the header button, or
    // Escape — and the kit deliberately does not move focus, leaving it on
    // `<body>`. Restore it to the trigger, which owns `aria-controls`.
    // Skip when something else already holds focus: the close may have come
    // from an interaction that legitimately moved focus elsewhere, and stealing
    // it back would be worse than the drop.
    const active = document.activeElement;
    if (active !== null && active !== document.body) {
      return;
    }

    triggerRef.current?.focus();
  }, [open]);

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
  };
}

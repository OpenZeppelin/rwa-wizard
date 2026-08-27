import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { computeConfigHash, type FileTree } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { CodegenInvalidConfigError } from '../../../services/codegen/errors';
import type { RwaCodegenService } from '../../../services/codegen/types';
import {
  createStepFileTreeSnapshot,
  listChangedPaths,
  toPreviewConfig,
  type PreviewModuleCatalog,
  type StepFileTreeSnapshot,
} from '../../../services/preview';
import type { ComplianceModuleOption } from '../../../types/wizard';
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
  };
  readonly sheetId: string;
  readonly showTrigger: boolean;
}

const GENERIC_GENERATE_ERROR = 'Preview generation failed. Check your configuration and try again.';

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

function mapGenerateError(err: unknown, substitutedKeys: readonly string[]): PreviewTickFailure {
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
    messages: [GENERIC_GENERATE_ERROR],
  };
}

export function useCodePreview(options: UseCodePreviewOptions): UseCodePreviewResult {
  const {
    codegenService,
    draftConfig,
    moduleCatalog,
    currentStepId,
    includeIdentitySupport,
    debounceMs = 150,
  } = options;

  const sheetId = useId();
  const showTrigger = codegenService !== null;

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
   * Cache key for `cachedFilesRef`. Must cover every input that changes generate
   * output — `computeConfigHash` hashes the config only, so generate options
   * (`includeIdentitySupport`) are appended. Keyed on config alone, toggling
   * identity support returned the previous tree and the preview silently
   * disagreed with the archive.
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

  /** Key covering every generate input: preview config hash + generate options. */
  const computeGenerateKey = useCallback(
    (config: RWAConfig): string => {
      const previewInput = toPreviewConfig(
        config,
        moduleCatalog as unknown as PreviewModuleCatalog
      );
      const configHash = computeConfigHash(previewInput.config);
      return `${configHash}|identity:${includeIdentitySupport ? 1 : 0}`;
    },
    [includeIdentitySupport, moduleCatalog]
  );

  const runPreviewTick = useCallback(
    async (
      config: RWAConfig,
      requestId: number,
      options: { isStepEntry: boolean }
    ): Promise<PreviewTickResult> => {
      if (!codegenService) {
        return {
          kind: 'error',
          substitutedKeys: [],
          messages: [GENERIC_GENERATE_ERROR],
        };
      }

      const previewInput = toPreviewConfig(
        config,
        moduleCatalog as unknown as PreviewModuleCatalog
      ); // INV-6 — shim reads id + configFields only; enriched catalog is compatible at runtime
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

          return mapGenerateError(err, previewInput.substitutedKeys);
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
          messages: [GENERIC_GENERATE_ERROR],
        };
      }

      lastGenerateKeyRef.current = generateKey;
      cachedFilesRef.current = files;

      if (options.isStepEntry) {
        stepSnapshotRef.current = createStepFileTreeSnapshot(files, previewInput.config); // INV-7
      }

      const changedPaths = listChangedPaths(stepSnapshotRef.current, files, configHash); // INV-10

      return {
        kind: 'success',
        files,
        configHash,
        substitutedKeys: previewInput.substitutedKeys,
        changedPaths,
      };
    },
    [codegenService, computeGenerateKey, includeIdentitySupport, moduleCatalog]
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

  useEffect(() => {
    if (!codegenService) {
      setOpen(false);
      setPhase({ kind: 'idle' });
      stepSnapshotRef.current = null;
      lastGenerateKeyRef.current = null;
      cachedFilesRef.current = null;
      return;
    }
  }, [codegenService, setOpen]);

  useEffect(() => {
    if (!codegenService) {
      return;
    }

    const requestId = ++requestIdRef.current;
    stepEntryHandledKeyRef.current = computeGenerateKey(draftConfigRef.current);
    stepSnapshotRef.current = null;

    setPhase((prev) => (prev.kind === 'ready' ? prev : { kind: 'loading' }));

    void (async () => {
      const result = await runPreviewTick(draftConfigRef.current, requestId, { isStepEntry: true });

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
  }, [applyReadyResult, codegenService, computeGenerateKey, currentStepId, runPreviewTick]); // INV-7: step id only — not draftConfig

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
      const result = await runPreviewTick(debouncedConfig, requestId, { isStepEntry: false });

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
    },
    sheetId,
    showTrigger,
  };
}

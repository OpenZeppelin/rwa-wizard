import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from 'react';

import {
  computeConfigHash,
  type FileTree,
  type ProvenanceResult,
} from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';
import type { CodeViewReveal } from '@openzeppelin/ui-components/code-view';

import { useCopy } from '../../../app/providers/useCopy';
import { CodegenInvalidConfigError } from '../../../services/codegen/errors';
import type { RwaCodegenService } from '../../../services/codegen/types';
import {
  createStepFileTreeSnapshot,
  listChangedPaths,
  toPreviewConfig,
  type PreviewGenerateKey,
  type StepFileTreeSnapshot,
} from '../../../services/preview';
import type {
  ComplianceModuleOption,
  StructuralGeneratedFileKind,
  StructuralUpstreamImportLinks,
  StructuralUpstreamSourceRevision,
} from '../../../types/wizard';
import { defaultSelectedPath } from '../defaultSelectedPath';
import { dockAxisMaxSize, resolveDockSheetLayout } from '../dockLayout';
import { isHorizontalDock, nextDockPosition, type CodePreviewDockPosition } from '../dockPosition';
import { toPreviewProvenanceState, type CodePreviewProvenance } from '../provenanceState';
import {
  EMPTY_PREVIEW_SELECTION,
  reducePreviewSelection,
  toCodeViewReveal,
  type CodePreviewRevealTarget,
} from '../reveal';
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
      /** From the same generate result as `files`. Absent = the generator did not record. SF-5 INV-1. */
      readonly provenance?: ProvenanceResult;
      /** Generate key of this tree, so every consumer stamps against one name. SF-5 INV-17. */
      readonly generateKey: PreviewGenerateKey;
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
  /** Sheet at full dock-axis viewport span. Not persisted; the stored size is kept for restore. */
  readonly maximized: boolean;
  readonly onToggleMaximize: () => void;
  /** Current dock edge. Persisted. INV-1 */
  readonly dockPosition: CodePreviewDockPosition;
  /** Set dock edge directly (dropdown / host). Persists. */
  readonly onDockPositionChange: (position: CodePreviewDockPosition) => void;
  /** Advance to `nextDockPosition(dockPosition)`. Persists. INV-3, INV-17 */
  readonly onCycleDock: () => void;
  /**
   * Positions listed in the dock dropdown. Defaults to all four when omitted
   * (`ALL_DOCK_MENU_POSITIONS`). Wizard passes `WIZARD_DOCK_MENU_POSITIONS`.
   */
  readonly dockMenuPositions?: readonly CodePreviewDockPosition[];
}

export interface UseCodePreviewResult {
  readonly persistence: {
    readonly open: boolean;
    /**
     * Size to render on the dock axis (maximize applied).
     * Vertical dock → height; horizontal → width. Design D-5.
     */
    readonly size: number;
    /**
     * Axis clamp ceiling for the current dock/layout (`dockAxisMaxSize`).
     * Passed through as BottomSheet `maxHeight` so the drawer never diverges
     * from the size the hook applies when maximized.
     */
    readonly maxSize: number;
    readonly dockPosition: CodePreviewDockPosition;
  };
  readonly setOpen: (open: boolean) => void;
  /**
   * Sheet reports a new perpendicular size (drag / keyboard / clamp).
   * Routes to height or width storage by current dock. Dragging exits maximize.
   */
  readonly setSize: (size: number) => void;
  readonly layout: CodePreviewLayoutTools;
  readonly phase: CodePreviewPhase;
  readonly selectedPath: string | null;
  readonly setSelectedPath: (path: string | null) => void;
  /**
   * Open the drawer on `target.path` and, when `target.range` is given, mark
   * and scroll to it. One state update; the pane never receives a range for a
   * different file. No-op (no open, no selection change) when the path is not
   * in the tree currently on screen, no tree is on screen, or the target has
   * no codegen service.
   */
  readonly revealInPreview: (target: CodePreviewRevealTarget) => void;
  /** Value for `CodeView.reveal`. `undefined` when nothing is pending. Stable identity while unchanged. */
  readonly reveal: CodeViewReveal | undefined;
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
  /**
   * Provenance for the tree on screen plus the live generate key of the
   * undebounced draft. Consumers show a lookup result only while
   * `result.identity === provenance.liveIdentity`. SF-5 INV-17 / INV-18.
   */
  readonly provenance: CodePreviewProvenance;
}

/** Cached pair from one successful tick: never re-paired with another tick's members. SF-5 INV-16. */
interface CachedTree {
  readonly files: FileTree;
  readonly provenance?: ProvenanceResult;
}

/** `kindOf` for a service without `getGeneratedFileKind`: a missing method is `unknown`, never a guess. */
const UNKNOWN_KIND = (): StructuralGeneratedFileKind => 'unknown';

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

function readViewportWidth(): number {
  return typeof window !== 'undefined' ? window.innerWidth : 0;
}

function readAxisMax(
  dockPosition: CodePreviewDockPosition,
  viewportWidth: number,
  viewportHeight: number
): number {
  const layout = resolveDockSheetLayout(dockPosition, viewportWidth, viewportHeight);
  return dockAxisMaxSize(dockPosition, layout, viewportWidth, viewportHeight);
}

/**
 * Whether `node` is inside `container` in the composed tree — the tree the user
 * sees — rather than in the light-DOM tree that `Node.contains` walks.
 *
 * `contains` stops at every shadow boundary, and the kit's file tree renders
 * its rows inside an open shadow root, so a focused row is inside the sheet by
 * every meaning a user has and outside it by `contains`. That gap is currently
 * closed for us by someone else: `document.activeElement` is specified to
 * retarget to the outermost host in the document tree, so the value this hook
 * passes in has already been lifted out of the shadow tree. The walk is here so
 * that the guard answers the question it means to ask instead of resting on a
 * retargeting rule enforced elsewhere — the same question stays correct for a
 * node taken from `shadowRoot.activeElement` or a `composedPath()`, where no
 * retargeting applies.
 *
 * Closed shadow roots are deliberately unreachable from outside: `getRootNode`
 * yields a root whose `host` is null, the walk ends, and "not inside" is the
 * only answer available.
 */
function containsComposed(container: Element | null, node: Node | null): boolean {
  if (container === null) {
    return false;
  }

  let current: Node | null = node;
  while (current !== null) {
    if (container.contains(current)) {
      return true;
    }
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }

  return false;
}

interface PreviewTickSuccess {
  readonly kind: 'success';
  readonly files: FileTree;
  /** From the same artifact as `files`. SF-5 INV-16. */
  readonly provenance?: ProvenanceResult;
  readonly configHash: string;
  /**
   * The generate key this tree was produced under — the same string a pending
   * reveal was stamped with, so the reducer compares like with like. SF-9 INV-8.
   */
  readonly generateKey: string;
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
    width: storedWidth,
    treeVisible,
    dockPosition,
    setOpen,
    setHeight: setStoredHeight,
    setWidth: setStoredWidth,
    setTreeVisible,
    setDockPosition,
  } = useCodePreviewPersistence();
  const [maximized, setMaximized] = useState(false);

  const [viewportHeight, setViewportHeight] = useState(readViewportHeight);
  const [viewportWidth, setViewportWidth] = useState(readViewportWidth);

  // Maximized means "as large as the dock-axis viewport span", so size tracks the
  // window rather than the value captured when maximize was pressed. INV-8
  // Layout effect: first maximized paint must already use a fresh axis span so
  // BottomSheet never clamps the jump against a stale ceiling.
  useLayoutEffect(() => {
    if (!maximized || typeof window === 'undefined') {
      return;
    }

    const syncViewport = (): void => {
      setViewportHeight(readViewportHeight());
      setViewportWidth(readViewportWidth());
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, [maximized]);

  const axisMax = readAxisMax(dockPosition, viewportWidth, viewportHeight);
  const storedSize = isHorizontalDock(dockPosition) ? storedWidth : storedHeight;
  const size = maximized ? axisMax : storedSize;

  const setSize = useCallback(
    (next: number) => {
      const vw = readViewportWidth();
      const vh = readViewportHeight();
      const max = readAxisMax(dockPosition, vw, vh);
      const stored = isHorizontalDock(dockPosition) ? storedWidth : storedHeight;
      // A user-driven resize below the axis max ends maximize. INV-8
      if (maximized) {
        if (next >= max) {
          return;
        }
        // Kit `onHeightChange` often re-reports the pre-maximize stored size when
        // the host jumps to axis max (clamp / correction echo). Swallow that so
        // we neither clear maximize nor rewrite the restore size with the ~50%
        // default width/height.
        if (next === stored) {
          return;
        }
        setMaximized(false);
      }
      if (isHorizontalDock(dockPosition)) {
        setStoredWidth(next);
      } else {
        setStoredHeight(next);
      }
    },
    [dockPosition, maximized, setStoredHeight, setStoredWidth, storedHeight, storedWidth]
  );

  const onToggleMaximize = useCallback(() => {
    setMaximized((prev) => !prev);
  }, []);

  const onToggleTree = useCallback(() => {
    setTreeVisible(!treeVisible);
  }, [setTreeVisible, treeVisible]);

  // INV-16 / INV-17: set/cycle always persists; maximize stays on. INV-22: sheetId unchanged.
  const onDockPositionChange = useCallback(
    (position: CodePreviewDockPosition) => {
      setDockPosition(position);
    },
    [setDockPosition]
  );
  const onCycleDock = useCallback(() => {
    setDockPosition(nextDockPosition(dockPosition));
  }, [dockPosition, setDockPosition]);
  const debouncedConfig = useDebouncedValue(draftConfig, debounceMs);

  const [phase, setPhase] = useState<CodePreviewPhase>({ kind: 'idle' });
  // Path and pending reveal live in one reducer state so no render can pair a
  // range with another file's source. SF-9 INV-1.
  const [selection, dispatchSelection] = useReducer(
    reducePreviewSelection,
    EMPTY_PREVIEW_SELECTION
  );
  const selectedPath = selection.path;
  const setSelectedPath = useCallback((path: string | null) => {
    dispatchSelection({ type: 'select', path }); // SF-9 INV-5
  }, []);
  // Keyed on the whole selection: the reducer returns the same reference on
  // every no-op, and no transition yields a new object carrying the previous
  // reveal, so this identity moves exactly when the pending reveal does. SF-9 INV-13.
  const reveal = useMemo(() => toCodeViewReveal(selection), [selection]);
  /** Kit retrigger token. Distinct from `requestIdRef`, the generate staleness counter. SF-9 INV-10. */
  const revealRequestIdRef = useRef(0);

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
   * Cache key for `cachedTreeRef`. Must cover every input of
   * `generateFileTree` — the preview config, the generate options, and the
   * service that runs them:
   *
   * - preview config hash — `computeConfigHash` covers this dimension only; the
   *   module catalog is carried through it, via the preview fill;
   * - `includeIdentitySupport` — a generate option, absent from the config, so
   *   keyed on the hash alone a toggle returned the previous tree;
   * - service identity — the same config generates a different tree per target,
   *   so a target switch would otherwise serve the previous target's files.
   *
   * Not an input: `recordProvenance`, constant `true` on this path and, by the
   * SF-1 contract, never a change to bytes or hash. SF-5 INV-17.
   */
  const lastGenerateKeyRef = useRef<string | null>(null);
  const cachedTreeRef = useRef<CachedTree | null>(null);
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
      let tree = cachedTreeRef.current;

      if (generateKey !== lastGenerateKeyRef.current || !tree) {
        try {
          const artifact = await codegenService.generateFileTree(previewInput.config, {
            includeIdentitySupport, // INV-1
            recordProvenance: true, // SF-5: always on for the tree on screen; not a key input
          });
          // SF-5 INV-16: one pair from one artifact; a key-absent `provenance` stays absent.
          tree =
            artifact.provenance === undefined
              ? { files: artifact.files }
              : { files: artifact.files, provenance: artifact.provenance };
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

      if (!tree) {
        return {
          kind: 'error',
          substitutedKeys: previewInput.substitutedKeys,
          messages: [genericGenerateError],
        };
      }

      const { files } = tree;
      lastGenerateKeyRef.current = generateKey;
      cachedTreeRef.current = tree; // SF-5 INV-16: the one write site

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
        ...(tree.provenance === undefined ? {} : { provenance: tree.provenance }),
        configHash,
        generateKey,
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
    // Dispatched in the same synchronous frame as `setPhase`, so the new tree
    // and the reveal decision for it commit together. SF-9 INV-14. `paths` is built
    // from own keys so a prototype name never counts as present. SF-9 INV-9.
    dispatchSelection({
      type: 'tree-ready',
      paths: new Set(Object.keys(result.files)),
      treeKey: result.generateKey,
      fallbackPath: defaultSelectedPath(result.files),
    });

    // SF-5 INV-21: files, provenance and identity commit in this one call from
    // one tick; absence stays key-absence so `'provenance' in phase` is honest.
    setPhase({
      kind: 'ready',
      files: result.files,
      ...(result.provenance === undefined ? {} : { provenance: result.provenance }),
      generateKey: result.generateKey,
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

  /**
   * Hiding is by generator-reported kind only; a service that does not classify
   * hides nothing. Memoised on service identity so `provenanceState` below has
   * exactly two inputs. SF-5 INV-13.
   */
  const kindOf = useMemo(
    () => codegenService?.getGeneratedFileKind ?? UNKNOWN_KIND,
    [codegenService]
  );
  // SF-5 INV-19: derived from the committed phase, so no render can pair a
  // state identity with another tick's files or provenance.
  const provenanceState = useMemo(() => toPreviewProvenanceState(phase, kindOf), [phase, kindOf]);
  /**
   * The generate key of the draft as it is *now*, not as debounced. An edit
   * therefore invalidates a held result on the keystroke's own render, 150 ms
   * before the tree catches up. Computed unconditionally — a focus or drawer
   * gate would add a state input to enumerate. SF-5 INV-18.
   */
  const liveIdentity = useMemo(
    () => (codegenService === null ? null : computeGenerateKey(draftConfig)),
    [codegenService, computeGenerateKey, draftConfig]
  );
  const provenance = useMemo<CodePreviewProvenance>(
    () => ({ state: provenanceState, liveIdentity }),
    [provenanceState, liveIdentity]
  );

  const revealInPreview = useCallback(
    (target: CodePreviewRevealTarget) => {
      const files = cachedTreeRef.current?.files ?? null;
      const treeKey = lastGenerateKeyRef.current;
      // SF-9 INV-7: nothing to point at — no tree on screen, no service, or the path
      // is not in the tree. SF-9 INV-9: own-key membership; `in` would admit
      // `"constructor"` on an empty record. (`Object.hasOwn` is ES2022; `lib`
      // is ES2020.)
      if (
        codegenService === null ||
        files === null ||
        treeKey === null ||
        !Object.prototype.hasOwnProperty.call(files, target.path)
      ) {
        return;
      }

      if (target.range == null) {
        dispatchSelection({ type: 'select', path: target.path });
      } else {
        dispatchSelection({
          type: 'reveal',
          path: target.path,
          range: target.range,
          requestId: (revealRequestIdRef.current += 1), // SF-9 INV-10: only an accepted reveal consumes an id
          treeKey,
        });
      }
      setOpen(true);
    },
    [codegenService, setOpen]
  );

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

    // A mark is a pointer to "what you just clicked"; it has no meaning on
    // reopen. Fires on the true→false transition only. SF-9 INV-11.
    dispatchSelection({ type: 'closed' });

    // The kit keeps the region mounted through its exit transition and never
    // moves focus, so at this point focus is still on whatever element inside
    // the sheet the user closed from, and only lands on `<body>` a couple of
    // hundred milliseconds later when the region unmounts.
    //
    // The question is therefore not "is focus on `<body>`" but "is the focused
    // element about to disappear" — and that has to be asked of the composed
    // tree, the one the user sees, rather than of the light DOM. Focus doomed
    // by the close means restore to the trigger; focus anywhere else was moved
    // there deliberately and stealing it back would be worse than the drop.
    const active = document.activeElement;
    const sheet = document.getElementById(sheetId);
    const focusIsDoomed =
      active === null || active === document.body || containsComposed(sheet, active);

    if (!focusIsDoomed) {
      return;
    }

    triggerRef.current?.focus();
  }, [open, sheetId]);

  return {
    persistence: { open, size, maxSize: axisMax, dockPosition },
    setOpen,
    setSize,
    layout: {
      treeVisible,
      onToggleTree,
      maximized,
      onToggleMaximize,
      dockPosition,
      onDockPositionChange,
      onCycleDock,
    },
    phase,
    selectedPath,
    setSelectedPath,
    revealInPreview,
    reveal,
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
    provenance,
  };
}

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ConfigPath } from '../../features/wizard/config-path';
import type { ConfigAnchorKey } from '../../features/wizard/focused-path';
import { useInspectedConfigPath, useIsInspected } from '../../features/wizard/inspected-anchor';

/**
 * The two probe components for SF-14's inspected-anchor suites.
 *
 * They live in their own module because this one exports **only** components,
 * which is what the Fast Refresh rule asks of a `.tsx` file; the harness that
 * mounts them (`inspectedAnchorHarness.tsx`) exports only helpers. Splitting is
 * the honest fix — the alternative was disabling the rule for a file, and this
 * initiative has spent SF-15 on the principle that widening a guard to fit new
 * code is the move to refuse.
 *
 * Both probes read the subject through the **public** hooks, which is how the
 * app reads it. The raw subject key is deliberately not exported from
 * `inspected-anchor/` — a caller that could store a key would re-introduce the
 * staleness the anchor removes — so a probe that reached past `useIsInspected`
 * would also be a probe that could pass while the hook every component actually
 * calls was broken.
 */

export interface ProbeState {
  path: ConfigPath | null;
  inspected: ConfigAnchorKey | null;
  /** Committed renders of the path reader, for the update-cascade assertions. */
  pathRenders: number;
  /** Committed renders per candidate, keyed by anchor. */
  readonly candidateRenders: Map<ConfigAnchorKey, number>;
}

/** `useInspectedConfigPath`, in its real call shape: one reader, one config. */
export function PathProbe({ state, config }: { state: ProbeState; config: RWAConfig }): null {
  state.pathRenders += 1;
  state.path = useInspectedConfigPath(config);
  return null;
}

/**
 * One `useIsInspected` per candidate anchor — the hook's real call shape, one
 * item asking about itself.
 *
 * A separate component per candidate rather than one component looping over a
 * list, so the render counter is **per item**. That is the whole point of
 * INV-26: a subject change must re-render only the items whose answer flipped,
 * and a single component asking about fifteen anchors would re-render for all
 * fifteen and report nothing.
 */
export function CandidateProbe({
  state,
  anchor,
}: {
  state: ProbeState;
  anchor: ConfigAnchorKey;
}): null {
  const inspected = useIsInspected(anchor);
  state.candidateRenders.set(anchor, (state.candidateRenders.get(anchor) ?? 0) + 1);
  if (inspected) state.inspected = anchor;
  else if (state.inspected === anchor) state.inspected = null;
  return null;
}

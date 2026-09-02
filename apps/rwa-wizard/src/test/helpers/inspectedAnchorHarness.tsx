import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ConfigPath } from '../../features/wizard/config-path';
import type { ConfigAnchorKey } from '../../features/wizard/focused-path';
import { InspectedAnchorProvider } from '../../features/wizard/inspected-anchor';
import { makeConfig } from '../fixtures/wizardFixtures';
import { CandidateProbe, PathProbe, type ProbeState } from './inspectedAnchorProbes';

/**
 * Shared harness for SF-14's inspected-anchor suites: a real
 * `InspectedAnchorProvider` with the two probes from `inspectedAnchorProbes.tsx`
 * mounted beside whatever markup a test supplies.
 */

function createProbeState(): ProbeState {
  return { path: null, inspected: null, pathRenders: 0, candidateRenders: new Map() };
}

export interface SubjectProbe {
  /** `useInspectedConfigPath(config)` as of the latest render. */
  readonly path: () => ConfigPath | null;
  /** Which candidate anchor is the subject, or `null` if none of them is. */
  readonly inspected: () => ConfigAnchorKey | null;
  /** Committed renders of the path reader since the last `reset`. */
  readonly pathRenders: () => number;
  /** Committed renders of one candidate's reader since the last `reset`. */
  readonly rendersOf: (anchor: ConfigAnchorKey) => number;
  readonly reset: () => void;
}

export interface ProviderHarness extends RenderResult {
  readonly probe: SubjectProbe;
  readonly setProps: (next: { scopeToken?: string; config?: RWAConfig }) => void;
}

export interface MountProviderOptions {
  readonly config?: RWAConfig;
  readonly scopeToken?: string;
  /** Anchors the probe asks `useIsInspected` about. */
  readonly candidates?: readonly ConfigAnchorKey[];
  readonly children?: ReactNode;
}

/**
 * Mount `children` under a real `InspectedAnchorProvider`, with the probes
 * beside them.
 *
 * `modules` comes from the caller's config, which is what the app does: the
 * provider needs the selected modules so the key walk can split a module-config
 * field's own id, and passing an empty array here would silently coarsen every
 * module-config click to its enclosing panel — the regression the `modules` prop
 * was added to prevent.
 */
export function mountProvider(options: MountProviderOptions = {}): ProviderHarness {
  const candidates = options.candidates ?? [];
  const state = createProbeState();
  let current = {
    config: options.config ?? makeConfig(),
    scopeToken: options.scopeToken ?? 'scope',
  };

  const tree = (value: typeof current): ReactElement => (
    <InspectedAnchorProvider
      scopeToken={value.scopeToken}
      modules={value.config.compliance.modules}
    >
      <PathProbe state={state} config={value.config} />
      {candidates.map((anchor) => (
        <CandidateProbe key={anchor} state={state} anchor={anchor} />
      ))}
      {options.children}
    </InspectedAnchorProvider>
  );

  const result = render(tree(current));

  return {
    ...result,
    probe: {
      path: () => state.path,
      inspected: () => state.inspected,
      pathRenders: () => state.pathRenders,
      rendersOf: (anchor) => state.candidateRenders.get(anchor) ?? 0,
      reset: () => {
        state.pathRenders = 0;
        state.candidateRenders.clear();
      },
    },
    setProps: (next) => {
      current = { ...current, ...next };
      result.rerender(tree(current));
    },
  };
}

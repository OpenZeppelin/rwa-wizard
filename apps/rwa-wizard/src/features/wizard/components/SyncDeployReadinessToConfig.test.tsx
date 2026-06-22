import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEffect, useRef } from 'react';

import type { DeployGuidanceDTO } from '../../../services/codegen/types';
import { DeployReadinessProvider } from '../context/DeployReadinessProvider';
import { useDeployReadiness } from '../context/useDeployReadiness';
import { SyncDeployReadinessToConfig } from './SyncDeployReadinessToConfig';

const testnetGuidance: DeployGuidanceDTO = {
  adminAddress: 'GATJOHDT66JL2NL6D2RRWIHUX2YTT6PDH45Q7B4YSPWESY4TFWM',
  managerAddress: 'GMGR',
  adminEqualsManager: false,
  networkDisplayName: 'Stellar Testnet',
  networkIsTestnet: true,
  demoAutoMintEligible: true,
  demoMintComplianceIssues: [],
};

const publicGuidance: DeployGuidanceDTO = {
  ...testnetGuidance,
  adminAddress: 'GBBO4ZDDZTSM2GKN4J6773ZUKAJIOV645YGHKKK6K2M6B6LV2SF',
  networkDisplayName: 'Stellar Public',
  networkIsTestnet: false,
};

function ReadinessProbe() {
  const { signerAcknowledged, includeIdentitySupport } = useDeployReadiness();

  return (
    <>
      <span data-testid="signer-ack">{String(signerAcknowledged)}</span>
      <span data-testid="identity-support">{String(includeIdentitySupport)}</span>
    </>
  );
}

function Harness({
  guidance,
  primeAcknowledged = false,
  primeIdentitySupport = false,
}: {
  guidance: DeployGuidanceDTO;
  primeAcknowledged?: boolean;
  primeIdentitySupport?: boolean;
}) {
  const { setSignerAcknowledged, setIncludeIdentitySupport } = useDeployReadiness();
  const primedRef = useRef(false);

  useEffect(() => {
    if (primedRef.current) {
      return;
    }
    primedRef.current = true;
    setSignerAcknowledged(primeAcknowledged);
    setIncludeIdentitySupport(primeIdentitySupport);
  }, [primeAcknowledged, primeIdentitySupport, setSignerAcknowledged, setIncludeIdentitySupport]);

  return (
    <>
      <SyncDeployReadinessToConfig guidance={guidance} />
      <ReadinessProbe />
    </>
  );
}

function renderHarness(
  guidance: DeployGuidanceDTO,
  options?: { primeAcknowledged?: boolean; primeIdentitySupport?: boolean }
) {
  return render(
    <DeployReadinessProvider>
      <Harness guidance={guidance} {...options} />
    </DeployReadinessProvider>
  );
}

describe('SyncDeployReadinessToConfig', () => {
  it('clears signer acknowledgment when the configured Admin address changes', () => {
    const { rerender } = renderHarness(testnetGuidance, { primeAcknowledged: true });
    expect(screen.getByTestId('signer-ack')).toHaveTextContent('true');

    rerender(
      <DeployReadinessProvider>
        <Harness guidance={publicGuidance} />
      </DeployReadinessProvider>
    );

    expect(screen.getByTestId('signer-ack')).toHaveTextContent('false');
  });

  it('clears identity scaffolding when deployment target leaves testnet', () => {
    const { rerender } = renderHarness(testnetGuidance, { primeIdentitySupport: true });
    expect(screen.getByTestId('identity-support')).toHaveTextContent('true');

    rerender(
      <DeployReadinessProvider>
        <Harness guidance={publicGuidance} />
      </DeployReadinessProvider>
    );

    expect(screen.getByTestId('identity-support')).toHaveTextContent('false');
  });
});

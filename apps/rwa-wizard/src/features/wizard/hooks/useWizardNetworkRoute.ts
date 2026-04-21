import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { PresetDeploymentTarget } from '@openzeppelin/rwa-config';

import { DEFAULT_WIZARD_NETWORK_ID, wizardPath } from '../../../app/routes/wizardPaths';
import { getNetworkById } from '../../../services/runtime/ecosystemManager';
import type { WizardDraftStateApi } from '../state/useWizardDraftState';

/**
 * Keeps the wizard URL (`/wizard/:networkId`) aligned with deployment preset metadata:
 *
 * - **No active draft**: the URL is authoritative — we validate `networkId` against
 *   adapter network config and write the matching preset deployment target.
 * - **Active draft**: URL is set by navigation (e.g. sidebar); we do not overwrite
 *   deployment from the URL here — `useWizardSession` hydrates config from storage.
 *
 * When there is no draft, if the in-memory preset drifts from the URL (future UI),
 * we normalize the URL to the preset.
 */
export function useWizardNetworkRoute(
  draftState: WizardDraftStateApi,
  activeDraftId: string | null
): void {
  const { networkId: routeNetworkId } = useParams<{ networkId: string }>();
  const navigate = useNavigate();
  const { updateDeployment } = draftState;

  useEffect(() => {
    if (!routeNetworkId || activeDraftId !== null) {
      return;
    }

    let cancelled = false;

    void getNetworkById(routeNetworkId).then((net) => {
      if (cancelled) return;
      if (!net) {
        navigate(wizardPath(DEFAULT_WIZARD_NETWORK_ID), { replace: true });
        return;
      }
      updateDeployment({
        target: {
          kind: 'preset',
          ecosystem: net.ecosystem as PresetDeploymentTarget['ecosystem'],
          networkId: net.id,
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [routeNetworkId, activeDraftId, updateDeployment, navigate]);

  const presetNetworkId =
    draftState.config.deployment.target.kind === 'preset'
      ? draftState.config.deployment.target.networkId
      : null;

  useEffect(() => {
    if (activeDraftId !== null || !presetNetworkId || !routeNetworkId) {
      return;
    }
    if (presetNetworkId === routeNetworkId) {
      return;
    }
    navigate(wizardPath(presetNetworkId), { replace: true });
  }, [activeDraftId, presetNetworkId, routeNetworkId, navigate]);
}

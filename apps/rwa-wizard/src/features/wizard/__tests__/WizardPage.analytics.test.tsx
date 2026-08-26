/**
 * WizardPage analytics call sites: each user action / generation outcome
 * fires exactly once and carries the active network dimensions.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { DeploymentTarget } from '@openzeppelin/rwa-config';

import { WizardPage } from '../WizardPage';

const mockTrackWizardStep = vi.fn();
const mockTrackConfigExported = vi.fn();
const mockTrackProjectGenerated = vi.fn();
const mockTrackGenerationFailed = vi.fn();
const mockTrackWizardCancelled = vi.fn();
const mockTrackZipDownloadClicked = vi.fn();
const mockExportDraft = vi.fn(() => Promise.resolve());
const mockDownload = vi.fn();
const mockResetSession = vi.fn();

interface SessionOverrides {
  deploymentTarget?: DeploymentTarget;
  jobState?: Record<string, unknown>;
  activeDraftId?: string | null;
}

const session = { current: buildSession() };

function buildSession(overrides: SessionOverrides = {}) {
  return {
    activeDraftId: 'activeDraftId' in overrides ? overrides.activeDraftId : 'draft-1',
    currentStep: 'asset',
    selectedTargetId: 'stellar',
    draftState: {
      config: {
        deployment: {
          target: overrides.deploymentTarget ?? {
            kind: 'preset',
            ecosystem: 'stellar',
            networkId: 'stellar-testnet',
          },
        },
      },
    },
    runtime: {
      targetSnapshot: null,
      adapterCaps: null,
      codegenService: null,
      targetLoadError: null,
      clearTargetLoadError: vi.fn(),
    },
    generation: {
      generate: vi.fn(),
      isGenerating: false,
      jobState: overrides.jobState ?? { phase: 'idle' },
      download: mockDownload,
      reset: vi.fn(),
    },
    persistError: null,
    clearPersistError: vi.fn(),
    resetKey: 0,
    resetSession: mockResetSession,
  };
}

vi.mock('../hooks/useWizardSession', () => ({
  useWizardSession: () => session.current,
}));
vi.mock('../hooks/useWizardSteps', () => ({
  useWizardSteps: () => ({ steps: [], orderedStepIds: ['asset', 'identity', 'review'] }),
}));
vi.mock('../hooks/useWizardNetworkRoute', () => ({ useWizardNetworkRoute: () => {} }));
vi.mock('../components/SyncDeployReadinessToConfig', () => ({
  SyncDeployReadinessToConfig: () => null,
}));
vi.mock('../../generation/components/GenerationDialog', () => ({
  GenerationDialog: ({ onDownload }: { onDownload: () => void }) => (
    <button type="button" data-testid="download" onClick={onDownload}>
      download
    </button>
  ),
}));
vi.mock('@openzeppelin/ui-components', () => ({
  WizardLayout: ({
    onStepChange,
    onCancel,
    onLastStepSecondary,
  }: {
    onStepChange: (i: number) => void;
    onCancel: () => void;
    onLastStepSecondary: () => void;
  }) => (
    <>
      <button type="button" data-testid="next" onClick={() => onStepChange(1)}>
        next
      </button>
      <button type="button" data-testid="cancel" onClick={onCancel}>
        cancel
      </button>
      <button type="button" data-testid="export" onClick={onLastStepSecondary}>
        export
      </button>
    </>
  ),
}));
vi.mock('../../../app/providers/CopyProvider', () => ({
  CopyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../services/runtime', () => ({
  AdapterCapabilitiesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../components/shared', () => ({ ErrorBannerStack: () => null }));
vi.mock('../../../services/codegen/deployReadiness', () => ({
  getDeployGuidanceFromService: () => null,
}));
vi.mock('../../../services/download/exportDraftAsJson', () => ({
  exportDraftAsJson: () => mockExportDraft(),
}));
vi.mock('../../../storage', () => ({ useWizardDraftStorage: () => ({}) }));
vi.mock('../../../hooks/useAllNetworks', () => ({
  useAllNetworks: () => ({
    networks: [
      { id: 'stellar-testnet', ecosystem: 'stellar' },
      { id: 'ethereum-sepolia', ecosystem: 'evm' },
    ],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('../../../hooks/useRwaWizardAnalytics', () => ({
  useRwaWizardAnalytics: () => ({
    trackWizardStep: mockTrackWizardStep,
    trackConfigExported: mockTrackConfigExported,
    trackProjectGenerated: mockTrackProjectGenerated,
    trackGenerationFailed: mockTrackGenerationFailed,
    trackWizardCancelled: mockTrackWizardCancelled,
    trackZipDownloadClicked: mockTrackZipDownloadClicked,
  }),
}));

const STELLAR = { networkId: 'stellar-testnet', ecosystem: 'stellar' };

function renderPage(path = '/wizard/stellar-testnet') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/wizard/:networkId" element={<WizardPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('WizardPage analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.current = buildSession();
  });

  it('fires wizard_step once per step change with the preset network', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('next'));

    expect(mockTrackWizardStep).toHaveBeenCalledTimes(1);
    expect(mockTrackWizardStep).toHaveBeenCalledWith(2, 'identity', STELLAR);
  });

  it('fires wizard_cancelled once and resets the session', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('cancel'));

    expect(mockTrackWizardCancelled).toHaveBeenCalledTimes(1);
    expect(mockTrackWizardCancelled).toHaveBeenCalledWith('stellar', STELLAR);
    expect(mockResetSession).toHaveBeenCalledTimes(1);
  });

  it('fires config_exported(single_draft) once per export click', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('export'));

    expect(mockTrackConfigExported).toHaveBeenCalledTimes(1);
    expect(mockTrackConfigExported).toHaveBeenCalledWith('single_draft', STELLAR);
  });

  it('does not fire config_exported without an active draft', () => {
    session.current = buildSession({ activeDraftId: null });
    renderPage();
    fireEvent.click(screen.getByTestId('export'));

    expect(mockTrackConfigExported).not.toHaveBeenCalled();
    expect(mockExportDraft).not.toHaveBeenCalled();
  });

  it('fires zip_download_clicked once per download click', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('download'));

    expect(mockTrackZipDownloadClicked).toHaveBeenCalledTimes(1);
    expect(mockTrackZipDownloadClicked).toHaveBeenCalledWith('stellar', STELLAR);
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it('fires project_generated exactly once per completed job, even across re-renders', () => {
    const completedAt = new Date('2026-08-26T10:00:00Z');
    session.current = buildSession({
      jobState: { phase: 'success', draftId: 'draft-1', completedAt, zipFileName: 'asset.zip' },
    });
    const { rerender } = renderPage();

    expect(mockTrackProjectGenerated).toHaveBeenCalledTimes(1);
    expect(mockTrackProjectGenerated).toHaveBeenCalledWith('stellar', 'asset.zip', STELLAR);

    rerender(
      <MemoryRouter initialEntries={['/wizard/stellar-testnet']}>
        <Routes>
          <Route path="/wizard/:networkId" element={<WizardPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(mockTrackProjectGenerated).toHaveBeenCalledTimes(1);
  });

  it('fires generation_failed once with the error message and network', () => {
    session.current = buildSession({
      jobState: {
        phase: 'error',
        draftId: 'draft-1',
        completedAt: new Date('2026-08-26T10:00:00Z'),
        errorMessage: 'boom',
      },
    });
    renderPage();

    expect(mockTrackGenerationFailed).toHaveBeenCalledTimes(1);
    expect(mockTrackGenerationFailed).toHaveBeenCalledWith('stellar', 'boom', STELLAR);
  });

  it('falls back to the route network when the deployment target is custom', () => {
    session.current = buildSession({
      deploymentTarget: { kind: 'custom' } as unknown as DeploymentTarget,
    });
    renderPage('/wizard/ethereum-sepolia');
    fireEvent.click(screen.getByTestId('next'));

    expect(mockTrackWizardStep).toHaveBeenCalledWith(2, 'identity', {
      networkId: 'ethereum-sepolia',
      ecosystem: 'evm',
    });
  });
});

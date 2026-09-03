/**
 * AppSidebar analytics call sites: each user action fires exactly one event,
 * and every event carries the `network_id` / `ecosystem` dimensions.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { wizardStore } from '../../state/wizardStore';
import { AppSidebar } from '../AppSidebar';

const mockTrackTargetSelected = vi.fn();
const mockTrackDraftOpened = vi.fn();
const mockTrackConfigExported = vi.fn();
const mockExportAllDrafts = vi.fn(() => Promise.resolve());
const mockStorageGet = vi.fn(() => Promise.resolve(undefined));

vi.mock('../../../assets/icons/contracts-wizard-icon.svg', () => ({ default: 'icon.svg' }));

vi.mock('@openzeppelin/ui-components', () => ({
  SidebarLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/AddressBook/AddressBookDialog', () => ({
  AddressBookDialog: () => null,
}));
vi.mock('../../../features/draft-management/components/DraftImportDialog', () => ({
  DraftImportDialog: () => null,
}));
vi.mock('../../../features/draft-management/components/DraftList', () => ({
  DraftList: ({ onLoadDraft }: { onLoadDraft: (id: string) => void }) => (
    <button type="button" data-testid="load-draft" onClick={() => onLoadDraft('draft-1')}>
      draft
    </button>
  ),
}));
vi.mock('../../../features/target-catalog/components/TargetSelectorSidebar', () => ({
  TargetSelectorSidebar: ({
    targets,
    onCreateForTarget,
  }: {
    targets: { id: string }[];
    onCreateForTarget: (id: string) => void;
  }) => (
    <>
      {targets.map((t) => (
        <button
          type="button"
          key={t.id}
          data-testid={`create-${t.id}`}
          onClick={() => onCreateForTarget(t.id)}
        >
          {t.id}
        </button>
      ))}
    </>
  ),
}));
vi.mock('../../../registry/targets', () => ({
  listTargets: () => [{ id: 'stellar', showInUI: true }],
}));
vi.mock('../../../services/download/exportDraftAsJson', () => ({
  exportAllDraftsAsJson: () => mockExportAllDrafts(),
}));
vi.mock('../../../storage', () => ({
  useDraftList: () => ({
    items: [{ id: 'draft-1' }],
    refresh: vi.fn(),
    isLoading: false,
    error: null,
  }),
  useWizardDraftStorage: () => ({ get: mockStorageGet }),
}));
vi.mock('../../../hooks/useAllNetworks', () => ({
  useAllNetworks: () => ({
    networks: [{ id: 'stellar-testnet', ecosystem: 'stellar' }],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('../../../hooks/useRwaWizardAnalytics', () => ({
  useRwaWizardAnalytics: () => ({
    trackTargetSelected: mockTrackTargetSelected,
    trackDraftOpened: mockTrackDraftOpened,
    trackConfigExported: mockTrackConfigExported,
  }),
}));

function renderSidebar(path = '/wizard/stellar-testnet') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar mobileOpen={false} onMobileOpenChange={() => {}} />
    </MemoryRouter>
  );
}

describe('AppSidebar analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wizardStore.reset();
  });

  it('fires target_selected once with the destination network', () => {
    renderSidebar();
    fireEvent.click(screen.getByTestId('create-stellar'));

    expect(mockTrackTargetSelected).toHaveBeenCalledTimes(1);
    expect(mockTrackTargetSelected).toHaveBeenCalledWith('stellar', {
      networkId: 'stellar-testnet',
      ecosystem: 'stellar',
    });
  });

  it('fires config_exported(all_drafts) once with the active wizard network', async () => {
    wizardStore.setActiveNetworkId('stellar-testnet');
    renderSidebar();

    await act(async () => {
      fireEvent.click(screen.getByText('Export'));
    });

    expect(mockTrackConfigExported).toHaveBeenCalledTimes(1);
    expect(mockTrackConfigExported).toHaveBeenCalledWith('all_drafts', {
      networkId: 'stellar-testnet',
      ecosystem: 'stellar',
    });
    expect(mockExportAllDrafts).toHaveBeenCalledTimes(1);
  });

  it('reports an unresolved network for exports outside the wizard route', async () => {
    renderSidebar('/somewhere-else');

    await act(async () => {
      fireEvent.click(screen.getByText('Export'));
    });

    expect(mockTrackConfigExported).toHaveBeenCalledWith('all_drafts', {
      networkId: null,
      ecosystem: null,
    });
  });

  it('fires draft_opened once per recent-draft click', async () => {
    renderSidebar();

    await act(async () => {
      fireEvent.click(screen.getByTestId('load-draft'));
    });

    expect(mockTrackDraftOpened).toHaveBeenCalledTimes(1);
    expect(mockTrackDraftOpened).toHaveBeenCalledWith('sidebar_recent');
  });
});

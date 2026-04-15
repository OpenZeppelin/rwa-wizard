import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { useWizardDraftState } from './useWizardDraftState';

describe('useWizardDraftState', () => {
  it('initializes with the default config when no initial config is provided', () => {
    const { result } = renderHook(() => useWizardDraftState());
    expect(result.current.config).toEqual(createDefaultRwaConfig());
  });

  it('uses a preset deployment target in the default config', () => {
    expect(createDefaultRwaConfig().deployment).toEqual({
      target: {
        kind: 'preset',
        ecosystem: 'stellar',
        networkId: 'stellar-testnet',
      },
    });
  });

  it('initializes with a provided config', () => {
    const custom = createDefaultRwaConfig();
    custom.token.name = 'Test Token';
    const { result } = renderHook(() => useWizardDraftState(custom));
    expect(result.current.config.token.name).toBe('Test Token');
  });

  it('updates token fields', () => {
    const { result } = renderHook(() => useWizardDraftState());
    act(() => {
      result.current.updateToken({ name: 'Updated' });
    });
    expect(result.current.config.token.name).toBe('Updated');
  });

  it('updates identity verification fields', () => {
    const { result } = renderHook(() => useWizardDraftState());
    act(() => {
      result.current.updateIdentity({
        claimTopics: [{ id: 1, name: 'KYC' }],
      });
    });
    expect(result.current.config.identityVerification.claimTopics).toHaveLength(1);
  });

  it('updates compliance fields', () => {
    const { result } = renderHook(() => useWizardDraftState());
    act(() => {
      result.current.updateCompliance({
        modules: [{ moduleId: 'supply-limit' }],
      });
    });
    expect(result.current.config.compliance.modules).toHaveLength(1);
  });

  it('updates access control fields', () => {
    const { result } = renderHook(() => useWizardDraftState());
    act(() => {
      result.current.updateAccessControl({
        ownership: { type: 'single-owner', ownerAddress: '0xABC' },
      });
    });
    expect(result.current.config.accessControl.ownership).toEqual({
      type: 'single-owner',
      ownerAddress: '0xABC',
    });
  });

  it('resets config back to default', () => {
    const { result } = renderHook(() => useWizardDraftState());
    act(() => {
      result.current.updateToken({ name: 'Modified' });
    });
    act(() => {
      result.current.resetConfig();
    });
    expect(result.current.config.token.name).toBe('');
  });

  it('replaces the entire config', () => {
    const replacement = createDefaultRwaConfig();
    replacement.token.name = 'Replaced';
    const { result } = renderHook(() => useWizardDraftState());
    act(() => {
      result.current.setConfig(replacement);
    });
    expect(result.current.config.token.name).toBe('Replaced');
  });
});

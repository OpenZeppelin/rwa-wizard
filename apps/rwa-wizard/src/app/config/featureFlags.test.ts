import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FEATURE_FLAGS, isFeatureEnabled } from './featureFlags';

const mockIsFeatureEnabled = vi.fn().mockReturnValue(false);

vi.mock('@openzeppelin/ui-utils', () => ({
  appConfigService: {
    isFeatureEnabled: (...args: unknown[]) => mockIsFeatureEnabled(...args),
  },
}));

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(false);
});

afterEach(() => {
  mockIsFeatureEnabled.mockReset();
  mockIsFeatureEnabled.mockReturnValue(false);
});

describe('featureFlags', () => {
  it('defines a DEPLOYMENT_STEP flag', () => {
    expect(FEATURE_FLAGS.DEPLOYMENT_STEP).toBeDefined();
    expect(typeof FEATURE_FLAGS.DEPLOYMENT_STEP).toBe('string');
  });

  it('returns false for deployment step by default', () => {
    expect(isFeatureEnabled('DEPLOYMENT_STEP')).toBe(false);
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(FEATURE_FLAGS.DEPLOYMENT_STEP);
  });

  it('returns true when the flag is enabled in AppConfigService', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    expect(isFeatureEnabled('DEPLOYMENT_STEP')).toBe(true);
  });

  it('returns false for unknown flag names', () => {
    expect(isFeatureEnabled('NONEXISTENT_FLAG' as keyof typeof FEATURE_FLAGS)).toBe(false);
  });
});

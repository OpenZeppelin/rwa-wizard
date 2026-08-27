// Re-export shared analytics from ui-react for convenience (same pattern as UI Builder).
export {
  useAnalytics,
  AnalyticsProvider,
  type AnalyticsProviderProps,
  type AnalyticsContextValue,
} from '@openzeppelin/ui-react';

export { useRwaWizardAnalytics } from './useRwaWizardAnalytics';
export {
  useAnalyticsNetworkContext,
  useAnalyticsNetworkResolver,
  type AnalyticsNetworkResolver,
} from './useAnalyticsNetworkContext';
export {
  toNetworkParams,
  orUnknown,
  UNKNOWN_ANALYTICS_VALUE,
  type AnalyticsNetworkContext,
} from './useRwaWizardAnalytics';

import { createContext } from 'react';

export interface DeployReadinessContextValue {
  signerAcknowledged: boolean;
  setSignerAcknowledged: (value: boolean) => void;
  includeIdentitySupport: boolean;
  setIncludeIdentitySupport: (value: boolean) => void;
}

export const DeployReadinessContext = createContext<DeployReadinessContextValue | null>(null);

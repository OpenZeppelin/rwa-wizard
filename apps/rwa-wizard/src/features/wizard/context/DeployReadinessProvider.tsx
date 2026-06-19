import { useMemo, useState, type ReactNode } from 'react';

import { DeployReadinessContext } from './deployReadinessContext';

interface DeployReadinessProviderProps {
  children: ReactNode;
}

export function DeployReadinessProvider({ children }: DeployReadinessProviderProps) {
  const [signerAcknowledged, setSignerAcknowledged] = useState(false);
  const [includeIdentitySupport, setIncludeIdentitySupport] = useState(false);

  const value = useMemo(
    () => ({
      signerAcknowledged,
      setSignerAcknowledged,
      includeIdentitySupport,
      setIncludeIdentitySupport,
    }),
    [signerAcknowledged, includeIdentitySupport]
  );

  return (
    <DeployReadinessContext.Provider value={value}>{children}</DeployReadinessContext.Provider>
  );
}

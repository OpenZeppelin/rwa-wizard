import { AlertTriangle } from 'lucide-react';

import { Banner } from '@openzeppelin/ui-components';

import { useCopy } from '../../../../app/providers/useCopy';

export function IdentityPrivacyNotice() {
  const notice = useCopy().notice('identity.privacy');

  return (
    <Banner
      variant="warning"
      title={notice.title}
      dismissible={false}
      icon={<AlertTriangle className="size-4" aria-hidden />}
    >
      {notice.description}
    </Banner>
  );
}

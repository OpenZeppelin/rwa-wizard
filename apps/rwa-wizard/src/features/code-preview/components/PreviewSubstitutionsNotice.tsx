import { Info } from 'lucide-react';
import type { ReactElement } from 'react';

import { useCopy } from '../../../app/providers/useCopy';
import { ErrorBanner } from '../../../components/shared/ErrorBanner';
import { errorBannerIconClassName } from '../../../components/shared/errorBannerTone';

/**
 * Lists every substituted key verbatim. INV-2
 *
 * A real notice — icon, tinted surface, readable body — because it warns that values in
 * the code being read were invented rather than typed. Compact padding keeps it to one
 * row in the sheet header while leaving room to wrap when several keys are substituted.
 */
export function PreviewSubstitutionsNotice(props: {
  substitutedKeys: readonly string[];
}): ReactElement | null {
  const { substitutedKeys } = props;
  const copy = useCopy();

  if (substitutedKeys.length === 0) {
    return null;
  }

  return (
    <ErrorBanner
      tone="info"
      className="min-w-0 flex-1 px-3 py-1.5"
      icon={<Info className={`size-4 ${errorBannerIconClassName('info')}`} aria-hidden />}
      message={
        <>
          <span className="font-medium">
            {copy.notice('code-preview.substitutions').description}
          </span>{' '}
          {substitutedKeys.join(', ')}
        </>
      }
    />
  );
}

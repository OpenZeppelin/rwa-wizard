import { Info } from 'lucide-react';
import type { ReactElement } from 'react';

import { ErrorBanner } from '../../../components/shared/ErrorBanner';

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

  if (substitutedKeys.length === 0) {
    return null;
  }

  return (
    <ErrorBanner
      tone="info"
      className="min-w-0 flex-1 px-3 py-1.5"
      icon={<Info className="size-4 text-blue-600" aria-hidden />}
      message={
        <>
          <span className="font-medium">Preview placeholders (not in your draft):</span>{' '}
          {substitutedKeys.join(', ')}
        </>
      }
    />
  );
}

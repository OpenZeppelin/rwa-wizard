import { Info } from 'lucide-react';

import { useCopy } from '../../../app/providers/useCopy';
import { renderInlineCopy } from '../../../components/shared/renderInlineCopy';

export function GenerationNextSteps() {
  const copy = useCopy();
  const notice = copy.notice('generation.post-download');

  return (
    <section className="min-w-0 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex gap-2">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{notice.title ?? 'After download'}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {renderInlineCopy(notice.description ?? '')}
          </p>
        </div>
      </div>
    </section>
  );
}

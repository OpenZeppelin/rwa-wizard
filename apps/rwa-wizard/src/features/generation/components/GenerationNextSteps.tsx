import { useCopy } from '../../../app/providers/useCopy';
import { InfoNoticeBanner } from '../../../components/shared/InfoNoticeBanner';
import { renderInlineCopy } from '../../../components/shared/renderInlineCopy';

export function GenerationNextSteps() {
  const copy = useCopy();
  const notice = copy.notice('generation.post-download');

  return (
    <InfoNoticeBanner title={notice.title ?? 'After download'}>
      {renderInlineCopy(notice.description ?? '')}
    </InfoNoticeBanner>
  );
}

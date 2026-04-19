import type { ReactElement } from 'react';

import { useCopy } from '../providers/useCopy';

const ERC_3643_LINK_TEXT = 'ERC-3643 / T-REX';
const ERC_3643_URL = 'https://eips.ethereum.org/EIPS/eip-3643';

/**
 * Landing page shown at `/`. Renders the intro copy with an inline link to
 * the ERC-3643 spec. Kept as its own module so the router file stays thin
 * and this copy can evolve independently of navigation plumbing.
 */
export function DashboardPage(): ReactElement {
  const copy = useCopy();
  const intro = copy.notice('dashboard.intro').description;
  const subIntro = copy.notice('dashboard.sub-intro').description;

  const linkIndex = intro.indexOf(ERC_3643_LINK_TEXT);
  const introBefore = linkIndex >= 0 ? intro.slice(0, linkIndex) : intro;
  const introAfter = linkIndex >= 0 ? intro.slice(linkIndex + ERC_3643_LINK_TEXT.length) : '';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">RWA Wizard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {introBefore}
          {linkIndex >= 0 && (
            <a
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
              href={ERC_3643_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ERC_3643_LINK_TEXT}
            </a>
          )}
          {introAfter}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{subIntro}</p>
      </div>
    </div>
  );
}

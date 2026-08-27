import { SiGithub, SiX } from '@icons-pack/react-simple-icons';

import { cn } from '@openzeppelin/ui-utils';

export const RWA_WIZARD_GITHUB_URL = 'https://github.com/OpenZeppelin/rwa-wizard';
export const OPENZEPPELIN_X_URL = 'https://x.com/OpenZeppelin';

interface SidebarNavIconsProps {
  className?: string;
}

/**
 * Compact GitHub / X icon links shown at the bottom of the sidebar.
 * Mirrors the UI Builder sidebar so the OpenZeppelin tools stay consistent.
 */
export function SidebarNavIcons({ className }: SidebarNavIconsProps) {
  return (
    <nav
      aria-label="External links"
      className={cn('flex items-center gap-4 text-primary', className)}
    >
      <a
        href={RWA_WIZARD_GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-600 transition-colors"
        title="View on GitHub"
        aria-label="View on GitHub"
      >
        <SiGithub size={20} />
      </a>
      <a
        href={OPENZEPPELIN_X_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-600 transition-colors"
        title="Follow on X"
        aria-label="Follow on X"
      >
        <SiX size={20} />
      </a>
    </nav>
  );
}

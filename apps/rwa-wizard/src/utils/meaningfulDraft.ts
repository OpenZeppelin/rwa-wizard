import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { WizardDraftRecord } from '../types/wizard';

/**
 * Checks whether an RWAConfig contains meaningful user-provided content.
 * Used to decide when to first persist an ephemeral draft and whether
 * to display a draft in the list (mirrors UI Builder's meaningfulContent pattern).
 */
export function hasMeaningfulContent(config: RWAConfig): boolean {
  return !!(
    config.token.name.trim() ||
    config.token.symbol.trim() ||
    config.identityVerification.claimTopics.length > 0 ||
    config.identityVerification.trustedIssuers.length > 0 ||
    config.compliance.modules.length > 0 ||
    config.accessControl.roles.length > 0
  );
}

/**
 * Checks whether a persisted draft record has meaningful content.
 * Manually renamed drafts are always considered meaningful.
 */
export function draftHasMeaningfulContent(record: WizardDraftRecord): boolean {
  if (record.metadata.isManuallyRenamed) return true;
  return hasMeaningfulContent(record.config);
}

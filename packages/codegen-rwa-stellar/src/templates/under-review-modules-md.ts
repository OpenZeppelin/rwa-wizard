import type { RWAConfig } from '@openzeppelin/rwa-config';

import { getModuleById } from '../modules/registry';

/**
 * Generates `UNDER_REVIEW_MODULES.md` listing all selected modules
 * that are in the `under-review` state. Returns `null` if no
 * under-review modules are selected, so the caller can skip the file.
 */
export function generateUnderReviewModulesMd(config: RWAConfig): string | null {
  const uniqueIds = [...new Set(config.compliance.modules.map((m) => m.moduleId))];
  const underReview = uniqueIds
    .map((id) => getModuleById(id))
    .filter((e) => e && e.review.state === 'under-review');

  if (underReview.length === 0) return null;

  const sections: string[] = [];

  sections.push('# Under-Review Compliance Modules');
  sections.push('');
  sections.push(
    '> **This project uses compliance modules whose upstream implementations are still under code review.**'
  );
  sections.push('> Do NOT deploy to production until all reviews listed below have been merged.');
  sections.push('');

  for (const entry of underReview) {
    sections.push(`## ${entry!.name} (\`${entry!.id}\`)`);
    sections.push('');
    sections.push(`- **Description:** ${entry!.description}`);
    sections.push(`- **Required hooks:** ${entry!.requiredHooks.join(', ')}`);
    if (entry!.review.prUrl) {
      sections.push(`- **Review PR:** ${entry!.review.prUrl}`);
    }
    sections.push(`- **Status:** Under review — not yet merged to \`main\``);
    sections.push('');
  }

  sections.push('---');
  sections.push('');
  sections.push('Once the upstream PRs have been merged, regenerate this project with updated');
  sections.push('dependencies to remove this warning and pin to a stable commit.');
  sections.push('');

  return sections.join('\n');
}

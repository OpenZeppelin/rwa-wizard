import type { WizardDraftStorageApi } from '../../storage/wizardDraftStorageContext';

/**
 * Exports a single draft as a JSON file and triggers a browser download.
 * Shared by ExportDraftButton and the review-step export action to avoid
 * duplicating the anchor-click download pattern.
 */
export async function exportDraftAsJson(
  draftId: string,
  storage: Pick<WizardDraftStorageApi, 'export'>
): Promise<void> {
  const json = await storage.export([draftId]);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `rwa-draft-${draftId.slice(0, 8)}.json`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

import type { WizardDraftStorageApi } from '../../storage/wizardDraftStorageContext';

function downloadJsonFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Exports a single draft as a JSON file and triggers a browser download.
 * Shared by ExportDraftButton and the review-step export action.
 */
export async function exportDraftAsJson(
  draftId: string,
  storage: Pick<WizardDraftStorageApi, 'export'>
): Promise<void> {
  const json = await storage.export([draftId]);
  downloadJsonFile(json, `rwa-draft-${draftId.slice(0, 8)}.json`);
}

/**
 * Exports every saved draft as one JSON file (same envelope as single-draft export).
 */
export async function exportAllDraftsAsJson(
  storage: Pick<WizardDraftStorageApi, 'export'>
): Promise<void> {
  const json = await storage.export();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadJsonFile(json, `rwa-drafts-${stamp}.json`);
}

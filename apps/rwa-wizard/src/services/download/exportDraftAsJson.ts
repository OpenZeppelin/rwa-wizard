import type { WizardDraftStorageApi } from '../../storage/wizardDraftStorageContext';
import { triggerBlobDownload } from './triggerBlobDownload';

/**
 * Best-effort slug derivation from a draft title/symbol for the filename.
 * Falls back to the draft id prefix when nothing useful is available.
 */
function draftSlug(
  title: string | undefined,
  symbol: string | undefined,
  fallbackId: string
): string {
  const candidate = (title || symbol || '').toLowerCase().trim();
  const normalized = candidate.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallbackId.slice(0, 8);
}

function downloadJsonFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  triggerBlobDownload(filename, blob);
}

/**
 * Exports a single draft as a JSON file and triggers a browser download.
 * Shared by ExportDraftButton and the review-step export action.
 */
export async function exportDraftAsJson(
  draftId: string,
  storage: Pick<WizardDraftStorageApi, 'export' | 'get'>
): Promise<void> {
  const json = await storage.export([draftId]);
  const record = await storage.get(draftId);
  const slug = draftSlug(record?.title, record?.config.token.symbol, draftId);
  downloadJsonFile(json, `rwa-draft-${slug}.json`);
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

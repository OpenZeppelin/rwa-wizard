import type { ConceptDictionary } from '../types';

/**
 * Chain target entries — copy that *is* chain-specific by nature (a target
 * is literally a chain). Lives in `core` only as an empty base; each chain
 * declares its own target entry in its `overrides/<chain>.ts` file.
 *
 * Centralising this in the copy package means the target catalog in the app
 * (see `registry/targets.ts`) is purely structural: id, icon, enabled flag.
 */
export const TARGETS_COPY: ConceptDictionary = {} as const;

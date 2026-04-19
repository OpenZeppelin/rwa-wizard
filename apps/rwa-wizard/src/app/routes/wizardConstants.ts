import type { TargetId } from '../../types/wizard';

/**
 * Default target id used when no explicit target has been selected yet, or
 * when a persisted/external value does not pass the `isTargetId` guard.
 *
 * Kept in its own module so every "shell" consumer (router, sidebar, wizard
 * page, session hook) imports the same constant — avoids drift if the
 * default ever needs to change.
 */
export const DEFAULT_TARGET_ID: TargetId = 'stellar';

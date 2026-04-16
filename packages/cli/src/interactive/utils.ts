import * as p from '@clack/prompts';

/** Centralized Ctrl+C / cancel handling for clack prompts across wizard steps. */
export function handleWizardCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Wizard cancelled.');
    process.exit(0);
  }
}

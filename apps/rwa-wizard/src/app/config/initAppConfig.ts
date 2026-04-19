import { appConfigService } from '@openzeppelin/ui-utils';

/**
 * Bootstraps `appConfigService` with Vite's environment variables so feature
 * flag lookups (`isFeatureEnabled`, etc.) never log `called before
 * initialization` warnings during the first render pass.
 *
 * `AppConfigService.initialize` is declared `async`, but — when we only pass
 * the `viteEnv` strategy — the body runs entirely synchronously (the vite
 * env is an already-resolved object). The async keyword only introduces a
 * microtask when a `json` or `localStorage` strategy is used. We therefore
 * intentionally do not await this call: by the time the first render runs,
 * `isInitialized` has already flipped to `true` inside the service.
 *
 * Keeping initialization in its own module (rather than inlining in
 * `main.tsx`) lets tests and Storybook-style hosts opt in explicitly and
 * keeps the composition root focused on React mounting.
 */
export function initAppConfig(): void {
  void appConfigService.initialize([{ type: 'viteEnv', env: import.meta.env }]);
}

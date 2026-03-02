import type { RWAConfig } from '@openzeppelin/rwa-config';

/**
 * Generates `build.sh` — a shell script that compiles all workspace contracts
 * using the Stellar CLI. Targets Unix-like environments.
 */
export function generateBuildSh(_config: RWAConfig): string {
  return `#!/bin/bash
set -e

echo "Building all workspace contracts..."
stellar contract build

echo "Build complete."
`;
}

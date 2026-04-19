import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { RWAConfig } from '@openzeppelin/rwa-config';

export function loadConfig(configPath: string): RWAConfig {
  const absolutePath = resolve(configPath);

  let raw: string;
  try {
    raw = readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(`Config file not found: ${absolutePath}`);
    }
    if (code === 'EACCES') {
      throw new Error(`Permission denied reading config: ${absolutePath}`);
    }
    throw new Error(`Failed to read config file: ${absolutePath}`);
  }

  try {
    return JSON.parse(raw) as RWAConfig;
  } catch {
    throw new Error(`Invalid JSON in config file: ${absolutePath}`);
  }
}

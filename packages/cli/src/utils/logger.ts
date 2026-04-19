import pc from 'picocolors';

export const logger = {
  info: (msg: string) => console.log(pc.cyan(msg)),
  success: (msg: string) => console.log(pc.green(msg)),
  warn: (msg: string) => console.log(pc.yellow(`Warning: ${msg}`)),
  error: (msg: string) => console.error(pc.red(`Error: ${msg}`)),
  dim: (msg: string) => console.log(pc.dim(msg)),
  plain: (msg: string) => console.log(msg),
  blank: () => console.log(''),

  header: (msg: string) => console.log(`\n  ${pc.bold(msg)}\n`),

  validationError: (field: string, code: string, message: string) =>
    console.error(pc.red(`  [${code}] ${field}: ${message}`)),

  validationWarning: (field: string, code: string, message: string) =>
    console.log(pc.yellow(`  [${code}] ${field}: ${message}`)),

  fileWritten: (path: string) => console.log(pc.dim(`  ${path}`)),

  moduleEntry: (id: string, name: string, description: string, hooks: string[]) => {
    console.log(`  ${pc.bold(pc.cyan(id))}`);
    console.log(`    ${name} — ${description}`);
    console.log(`    Hooks: ${hooks.join(', ')}`);
    console.log('');
  },

  summary: (entries: Array<[string, string | number]>) => {
    if (entries.length === 0) return;
    const maxKeyLen = entries.reduce((max, [k]) => Math.max(max, k.length), 0);
    for (const [key, value] of entries) {
      console.log(`  ${pc.bold(key.padEnd(maxKeyLen))}  ${value}`);
    }
  },
};

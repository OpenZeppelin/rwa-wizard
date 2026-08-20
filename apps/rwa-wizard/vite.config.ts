import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type PluginOption } from 'vite';

interface CodegenRuntimeBootstrap {
  targets?: Record<
    string,
    {
      contractsLibraryPath?: string;
      allowUnderReviewModules?: boolean;
    }
  >;
}

function normalizeStringEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function createCodegenRuntimeBootstrap(env: Record<string, string>): CodegenRuntimeBootstrap | undefined {
  const allowUnderReviewModules = parseBooleanEnv(env.RWA_WIZARD_STELLAR_ALLOW_UNDER_REVIEW_MODULES);
  const stellarRuntime = {
    contractsLibraryPath: normalizeStringEnv(env.RWA_WIZARD_STELLAR_CONTRACTS_LIBRARY_PATH),
    ...(allowUnderReviewModules !== undefined ? { allowUnderReviewModules } : {}),
  };

  if (!stellarRuntime.contractsLibraryPath && allowUnderReviewModules === undefined) {
    return undefined;
  }

  return {
    targets: {
      stellar: stellarRuntime,
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const codegenRuntime = createCodegenRuntimeBootstrap(env);

  return {
    plugins: [react(), tailwindcss()] as PluginOption[],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // WalletConnect was removed and its provider is stripped from the
        // install tree, but @wagmi/connectors still ships an unreachable
        // walletConnect module that dynamically imports it. Rollup resolves
        // dynamic imports even when unreachable, so point it at a stub.
        '@walletconnect/ethereum-provider': path.resolve(
          __dirname,
          './src/shims/walletconnect-removed.ts'
        ),
      },
    },
    // Polyfills for Node.js globals used by wallet SDKs (e.g., @hot-wallet/sdk, @near-js/crypto)
    // These libraries expect Node.js environment but run in browser.
    define: {
      'process.env': {},
      // Map Node's `global` to browser's `globalThis`.
      global: 'globalThis',
      __RWA_WIZARD_CODEGEN_RUNTIME__: codegenRuntime
        ? JSON.stringify(codegenRuntime)
        : 'undefined',
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});

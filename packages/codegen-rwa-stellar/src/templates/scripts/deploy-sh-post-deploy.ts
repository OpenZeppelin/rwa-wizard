import type { ConfigPath, LineSink } from '@openzeppelin/codegen-core';
import { getUniqueModuleSelections } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { serializeStellarComplianceHookForCli } from '../../ecosystem-metadata';
import { getModuleDescriptorById } from '../../modules/registry';
import {
  buildInvokeCommand,
  CLR,
  emitEcho,
  emitSubsection,
  moduleVarName,
  shellBacktickLiteral,
  shellEcho,
  shellEscape,
  shellSection,
  shellSubsection,
} from './deploy-sh-helpers';

/**
 * Build the post-deploy configuration section for wiring and bootstrap data.
 */
/**
 * The de-duplicated selection for one module, addressed by index.
 *
 * `getUniqueModuleSelections` keeps the FIRST occurrence of each id, so reading
 * `modules[firstIndex]` is the same selection it would return — and reads only
 * that module. Scanning the array to find it by id instead would read every
 * sibling's `moduleId`, which then lands on this module's invoke command and
 * makes module 0 look like a dependency of module 1's line (INV-34).
 *
 * Looked up at each use rather than hoisted, so the module's own `config` reads
 * attribute to the commands they shape (INV-24).
 */
function moduleSelectionAt(
  config: RWAConfig,
  firstIndex: number
): ReturnType<typeof getUniqueModuleSelections>[number] {
  const selection = config.compliance.modules[firstIndex];
  if (selection === undefined) {
    throw new Error(`no compliance module selection at index ${firstIndex}`);
  }
  return selection;
}

/** The claim topic at `index`; absence is a programming error, not a branch. */
function requireClaimTopic(
  config: RWAConfig,
  index: number
): RWAConfig['identityVerification']['claimTopics'][number] {
  const topic = config.identityVerification.claimTopics[index];
  if (topic === undefined) throw new Error(`no claim topic at index ${index}`);
  return topic;
}

/** The trusted issuer at `index`; absence is a programming error, not a branch. */
function requireIssuer(
  config: RWAConfig,
  index: number
): RWAConfig['identityVerification']['trustedIssuers'][number] {
  const issuer = config.identityVerification.trustedIssuers[index];
  if (issuer === undefined) throw new Error(`no trusted issuer at index ${index}`);
  return issuer;
}

/**
 * The topics `index`'s issuer is trusted for, narrowed to the ones the
 * projection emits.
 *
 * Read at the line it shapes, per call, exactly like the address beside it — the
 * echo also prints this list, and hoisting it would leave that echo with nothing
 * attributed. `filter` records the same path shape the previous `map`/`join`
 * did: the array, plus each element it touches. No new attribution surface.
 *
 * The empty result is not defended against here. An issuer whose every
 * referenced topic is unselected is a validation error
 * (`UNSELECTED_REFERENCE`), and `generate()` throws on an invalid config, so
 * `--claim_topics '[]'` cannot reach a generated file through this line. That
 * validation rule is the only thing standing between an all-unselected issuer
 * and a script that registers an issuer trusted for nothing, on a real network.
 */
function issuerSelectedTopics(
  config: RWAConfig,
  index: number,
  selectedIds: ReadonlySet<number>
): number[] {
  return requireIssuer(config, index).claimTopics.filter((id) => selectedIds.has(id));
}

/** One selected module: its id, where it was first selected, in emission order. */
export interface PostDeployModule {
  readonly moduleId: string;
  readonly firstIndex: number;
}

export interface PostDeployModuleAttribution {
  readonly modules: readonly PostDeployModule[];
  /** Paths for the heading: the module ids only, never their configs. */
  readonly headingPaths: readonly ConfigPath[];
  /**
   * Positions in `config.identityVerification.claimTopics` that are SELECTED,
   * ascending. Replaces the count this interface used to carry.
   *
   * A count cannot express this, and the reason is the whole point. The count
   * and the index space coincide only while every defined topic is selected;
   * under selection they diverge, and a loop bounded by the selected count reads
   * the FIRST n array positions instead of the n selected ones. On
   * `[1 (unselected), 2, 7]` that emits `add_claim_topic 1` and `2` where `2`
   * and `7` are correct — an unselected topic registered on-chain, a selected
   * one never registered, and nothing in the wizard showing it. A
   * `readonly number[]` is not a valid `<` operand, so that loop no longer
   * compiles.
   *
   * The heading number is `claimTopicIndices.length`; the loop iterates the
   * VALUES. Iterating a plain local array is safe in a way iterating a config
   * array is not: the iterator's final read happens after the last body emission
   * and would drain onto whatever comes next (INV-35, INV-37) — but this array
   * is not a recording view, so it records nothing at all.
   */
  readonly claimTopicIndices: readonly number[];
  readonly claimTopicPaths: readonly ConfigPath[];
  /**
   * The `id` of every selected topic, for the trusted-issuer topic filter.
   *
   * Carried through from the caller's single `observe` rather than rebuilt here,
   * so the filter adds no read of its own and the issuer lines keep exactly the
   * attribution they have today.
   */
  readonly selectedClaimTopicIds: ReadonlySet<number>;
  /**
   * Iterating the trusted-issuer array with `for...of` here would read it once
   * more when the iterator finishes — AFTER the last body emission — and that
   * trailing read lands on whatever comes next, which is the blank separator
   * line. A field whose impact list contains a blank line is precisely the
   * wrong-looking answer this initiative exists to remove (INV-35, INV-37).
   */
  readonly trustedIssuerCount: number;
  readonly trustedIssuerPaths: readonly ConfigPath[];
}

/**
 * Emit the post-deploy configuration directly into the parent builder.
 *
 * Previously this returned one joined string, which the builder pushed as a
 * single element — one range of ~140 lines carrying compliance modules, claim
 * topics AND trusted issuers together. Clicking any one of them highlighted all
 * three, which is exactly the widened range INV-34 exists to catch. Emitting per
 * site costs nothing in bytes (the builder joins with the same `'\n'`) and gives
 * each field the lines it actually shaped.
 */
export function emitPostDeployConfig(
  sink: LineSink,
  config: RWAConfig,
  networkFlag: string,
  networkPaths: readonly ConfigPath[],
  moduleAttribution: PostDeployModuleAttribution
): void {
  sink.lines(shellSubsection('Token Binding'));
  sink.line('echo ""');
  sink.line(shellEcho(`${CLR.bold}  Binding token on Compliance and IRS...${CLR.rst}`));
  sink.line(
    buildInvokeCommand(
      '$COMPLIANCE_ADDRESS',
      'bind_token',
      '--token "$RWA_TOKEN_ADDRESS" --operator "$MANAGER"',
      networkFlag
    ),
    networkPaths
  );
  sink.line(
    buildInvokeCommand(
      '$IRS_ADDRESS',
      'bind_token',
      '--token "$RWA_TOKEN_ADDRESS" --operator "$MANAGER"',
      networkFlag
    ),
    networkPaths
  );
  sink.line(shellEcho(`${CLR.green}  ✓ Token bound to Compliance and IRS${CLR.rst}`));

  // The module ids and their per-occurrence paths are resolved by the caller, so
  // the heading below reads no config and carries only the ids. Each module's
  // own `config` is read INSIDE its block, which is where those paths belong.
  const selectedModules = moduleAttribution.modules;
  if (selectedModules.length > 0) {
    emitSubsection(
      sink,
      `Compliance Module Wiring (${selectedModules.length} module${selectedModules.length > 1 ? 's' : ''})`,
      moduleAttribution.headingPaths
    );
    for (const { moduleId, firstIndex } of selectedModules) {
      const descriptor = getModuleDescriptorById(moduleId);
      if (!descriptor) continue;

      const modVar = `$${moduleVarName(moduleId)}`;
      const shellSafeDescriptorName = shellEscape(descriptor.name);
      sink.line('echo ""');
      sink.line(shellEcho(`${CLR.bold}  Configuring ${shellSafeDescriptorName}...${CLR.rst}`));

      if (descriptor.deployment.requiresIdentityRegistryStorage) {
        sink.line(
          buildInvokeCommand(
            modVar,
            'set_identity_registry_storage',
            '--token "$RWA_TOKEN_ADDRESS" --irs "$IRS_ADDRESS" --operator "$MANAGER"',
            networkFlag
          ),
          networkPaths
        );
      }

      // Resolved immediately before the emissions it shapes: this module's own
      // config is read here, so it attributes to this module's invoke commands
      // and not to the section heading above (INV-24).
      for (const invocation of descriptor.deployment.getConfigurationInvocations(
        moduleSelectionAt(config, firstIndex)
      )) {
        sink.line(
          buildInvokeCommand(
            modVar,
            invocation.functionName,
            invocation.args,
            networkFlag,
            'manager'
          ),
          networkPaths
        );
      }

      sink.line(
        buildInvokeCommand(
          modVar,
          'set_compliance_address',
          '--token "$RWA_TOKEN_ADDRESS" --compliance "$COMPLIANCE_ADDRESS" --operator "$ADMIN"',
          networkFlag,
          'admin'
        ),
        networkPaths
      );

      for (const hook of descriptor.requiredHooks) {
        sink.line(
          buildInvokeCommand(
            '$COMPLIANCE_ADDRESS',
            'add_module_to',
            `--hook "${serializeStellarComplianceHookForCli(hook)}" --module "${modVar}" --operator "$MANAGER"`,
            networkFlag,
            'manager'
          ),
          networkPaths
        );
      }

      for (const invocation of descriptor.deployment.getPostRegistrationInvocations?.(
        moduleSelectionAt(config, firstIndex)
      ) ?? []) {
        sink.line(
          buildInvokeCommand(
            modVar,
            invocation.functionName,
            invocation.args,
            networkFlag,
            'manager'
          ),
          networkPaths
        );
      }

      sink.line(
        shellEcho(
          `${CLR.green}  ✓ ${shellSafeDescriptorName} registered on hooks: ${descriptor.requiredHooks.map(serializeStellarComplianceHookForCli).join(', ')}${CLR.rst}`
        )
      );
    }
  }

  if (moduleAttribution.claimTopicIndices.length > 0) {
    emitSubsection(
      sink,
      `Claim Topics (${moduleAttribution.claimTopicIndices.length})`,
      moduleAttribution.claimTopicPaths
    );
    // Iterates the caller-observed SELECTED indices — the values, never a bound.
    // `for...of` is safe here where it is not over a config array: this is a
    // plain local, so the iterator's final read after the last body emission
    // reads no recording view and drains nothing onto the NEXT section's
    // heading (INV-24, INV-35). Each body line still re-reads the config at the
    // position it shapes, so per-line attribution survives the filter.
    for (const index of moduleAttribution.claimTopicIndices) {
      if (config.identityVerification.claimTopics[index] === undefined) continue;

      sink.line(
        buildInvokeCommand(
          '$CTI_ADDRESS',
          'add_claim_topic',
          `--claim_topic ${requireClaimTopic(config, index).id} --operator "$MANAGER"`,
          networkFlag
        ),
        networkPaths
      );
      emitEcho(
        sink,
        `${CLR.green}  ✓ Claim topic ${requireClaimTopic(config, index).id} (${shellEscape(requireClaimTopic(config, index).name)})${CLR.rst}`
      );
    }
  }

  if (moduleAttribution.trustedIssuerCount > 0) {
    emitSubsection(
      sink,
      `Trusted Issuers (${moduleAttribution.trustedIssuerCount})`,
      moduleAttribution.trustedIssuerPaths
    );
    for (let index = 0; index < moduleAttribution.trustedIssuerCount; index += 1) {
      if (config.identityVerification.trustedIssuers[index] === undefined) continue;

      // Each line re-reads the issuer immediately before emitting it. Hoisting
      // the address into a local would attribute it to the invoke command only,
      // leaving the confirmation echo — which also prints it — with nothing.
      sink.line(
        buildInvokeCommand(
          '$CTI_ADDRESS',
          'add_trusted_issuer',
          `--trusted_issuer "${shellEscape(requireIssuer(config, index).address)}" --claim_topics '[${issuerSelectedTopics(config, index, moduleAttribution.selectedClaimTopicIds).map(String).join(', ')}]' --operator "$MANAGER"`,
          networkFlag
        ),
        networkPaths
      );
      emitEcho(
        sink,
        `${CLR.green}  ✓ Issuer ${shellEscape(requireIssuer(config, index).address.slice(0, 8))}... → topics [${issuerSelectedTopics(config, index, moduleAttribution.selectedClaimTopicIds).join(', ')}]${CLR.rst}`
      );
    }
  }
}

export interface DeployScriptGenerationOptions {
  includeIdentitySupport?: boolean;
  includeDemoAutoMint?: boolean;
}

export function buildInitialSupplyGuidance(
  config: RWAConfig,
  options?: DeployScriptGenerationOptions
): string[] {
  if (config.token.initialSupply === undefined) return [];

  if (options?.includeDemoAutoMint) {
    return [
      ...shellSection('Initial Supply — Demo Auto-Mint Script Included'),
      shellEcho('  Status:    deploy.sh does not auto-mint (identity verification required).'),
      shellEcho(`  Requested: ${config.token.initialSupply} base units (from config)`),
      shellEcho(
        `  Decimals:  ${config.token.decimals} (1 whole token = 10^${config.token.decimals} base units)`
      ),
      shellEcho(''),
      shellEcho('  This testnet export includes scripts/bootstrap-demo-mint.sh — a demo-only'),
      shellEcho('  educational script (NOT production KYC) that will:'),
      shellEcho('    1. Deploy the example Claim Issuer and register it in CTI'),
      shellEcho('    2. Deploy an Identity contract for Admin and sign demo claims'),
      shellEcho('    3. Register Admin in IRS'),
      shellEcho(
        `    4. Run compliance preflight on the ${shellBacktickLiteral('created')} hook (see script output)`
      ),
      shellEcho(`    5. Mint ${config.token.initialSupply} base units to Admin`),
      shellEcho(''),
      shellEcho('  After ./scripts/deploy.sh completes:'),
      shellEcho('    chmod +x scripts/bootstrap-demo-mint.sh'),
      shellEcho('    ./scripts/bootstrap-demo-mint.sh --preflight   # optional compliance check'),
      shellEcho(
        '    ./scripts/bootstrap-demo-mint.sh               # full demo flow (run printed Manager invokes first if needed)'
      ),
    ];
  }

  const identityScaffoldLines = options?.includeIdentitySupport
    ? [
        shellEcho('  This export includes example claim-issuer and identity crates (see README),'),
        shellEcho('  but deploy.sh does not deploy or wire them automatically.'),
      ]
    : [
        shellEcho('  The current generator does not scaffold claim-issuer or per-holder'),
        shellEcho('  identity contracts.'),
      ];

  return [
    ...shellSection('Initial Supply — Manual Mint Required'),
    shellEcho('  Status:    Skipping automatic initial supply mint.'),
    shellEcho(`  Requested: ${config.token.initialSupply} base units (from config)`),
    shellEcho(
      `  Decimals:  ${config.token.decimals} (1 whole token = 10^${config.token.decimals} base units)`
    ),
    shellEcho(''),
    shellEcho('  Why: Stellar identity verification requires each mint recipient to have'),
    shellEcho('  a verified identity contract with valid claims registered in IRS/CTI.'),
    ...identityScaffoldLines,
    shellEcho('  The mint amount must use on-chain base units, not display units.'),
    shellEcho(''),
    shellEcho('  Next steps:'),
    shellEcho('    1. Deploy a Claim Issuer contract for your trusted issuer(s)'),
    shellEcho('    2. Deploy a per-holder Identity contract for each mint recipient'),
    shellEcho('    3. Register holder identities and country data in IRS'),
    shellEcho('    4. Issue required claims from the trusted issuer'),
    shellEcho('    5. Mint using:'),
    shellEcho(`       stellar contract invoke --id \\$RWA_TOKEN_ADDRESS -- mint \\\\`),
    shellEcho(`         --to <RECIPIENT> --amount ${config.token.initialSupply}  # base units`),
  ];
}

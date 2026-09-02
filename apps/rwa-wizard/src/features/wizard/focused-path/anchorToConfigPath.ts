import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ConfigPath } from '../config-path';
import {
  administrativeControlPath,
  claimTopicIndex,
  claimTopicPath,
  identityControlPath,
  moduleConfigFieldPath,
  moduleEntryPath,
  moduleIndex,
  nextTrustedIssuerIndex,
  ownershipAddressPath,
  ownershipTypePath,
  roleAddressesPath,
  roleIndex,
  tokenPaths,
  trustedIssuerClaimTopicsPath,
  trustedIssuerIndex,
  trustedIssuerPath,
} from '../config-path';
import type { ConfigAnchor } from './configAnchor';

/**
 * The current config location an anchor names. **The one place the draft is
 * read**, and every path comes from an SF-6 builder — no path is string-built
 * here.
 *
 * Total: every one of the thirteen anchor kinds yields a path for every
 * `RWAConfig`, and the function never throws. `pendingIndex` (SF-6 INV-8) never
 * returns `-1`, so an entry that does not exist yet resolves to the position it
 * *will* occupy — a path to `compliance.modules[2]` when two modules are
 * selected is the correct answer, not an error.
 *
 * **A consumer may well find provenance for such a path, and an earlier version
 * of this comment claimed the opposite.** Measured against real Stellar output:
 * a query for a pending trusted-issuer slot returns a *non-empty* group set —
 * the collection's section heading as a secondary row, the README's diagram
 * range, and `config.json` whole-file — because a range recorded against the
 * parent collection matches a query for an index that collection does not have.
 * So a pending path renders as a populated, confident answer rather than as an
 * obvious blank. Whether that should be narrowed belongs to the matching rule,
 * not to this function; what matters here is that a caller must not assume
 * emptiness. `anchorItemExists` below is how the inspected subject avoids
 * relying on it.
 *
 * Exactly five draft slices are read, and that enumeration is what the
 * one-input-at-a-time tests vary (INV-17): `accessControl.ownership`,
 * `accessControl.roles`, `compliance.modules`,
 * `identityVerification.claimTopics`, `identityVerification.trustedIssuers`.
 * The first four kinds below read none of them and must not (INV-18).
 *
 * The `switch` closes over `ConfigAnchor` with a `never` tail, so a fourteenth
 * anchor kind is a compile error here before it can be a runtime hole. INV-9.
 */
export function anchorToConfigPath(anchor: ConfigAnchor, config: RWAConfig): ConfigPath {
  switch (anchor.kind) {
    case 'token':
      return tokenPaths[anchor.field];
    case 'admin':
      return administrativeControlPath(anchor.controlId);
    case 'identityControl':
      return identityControlPath(anchor.controlId);
    case 'ownershipType':
      return ownershipTypePath;
    case 'ownershipAddress':
      // The same DOM element under all three variants; the path is not.
      return ownershipAddressPath(config.accessControl.ownership);
    case 'role':
      return roleAddressesPath(roleIndex(config.accessControl.roles, anchor.roleName));
    case 'module':
      return moduleEntryPath(moduleIndex(config.compliance.modules, anchor.moduleId));
    case 'moduleConfig':
      return moduleConfigFieldPath(
        moduleIndex(config.compliance.modules, anchor.moduleId),
        anchor.fieldKey
      );
    case 'claimTopic':
      return claimTopicPath(
        claimTopicIndex(config.identityVerification.claimTopics, anchor.topicId)
      );
    case 'claimTopicDraft':
      return claimTopicPath(config.identityVerification.claimTopics.length);
    case 'issuer':
      return trustedIssuerPath(
        trustedIssuerIndex(config.identityVerification.trustedIssuers, anchor.address)
      );
    case 'issuerTopics':
      return trustedIssuerClaimTopicsPath(
        trustedIssuerIndex(config.identityVerification.trustedIssuers, anchor.address)
      );
    case 'issuerDraft':
      return trustedIssuerPath(nextTrustedIssuerIndex(config.identityVerification.trustedIssuers));
    default: {
      const exhaustive: never = anchor;
      return exhaustive;
    }
  }
}

/**
 * Whether the item an anchor names is present in the live draft.
 *
 * The read-time half of the reconciliation rule, and the reason the inspected
 * subject can never describe something the user removed. Reads exactly the same
 * five draft slices `anchorToConfigPath` reads — `accessControl.ownership`,
 * `accessControl.roles`, `compliance.modules`,
 * `identityVerification.claimTopics`, `identityVerification.trustedIssuers` —
 * so the one-input-at-a-time enumeration is the same one (SF-12 INV-17).
 * INV-9.
 *
 * Existence is expressed through the very index helpers `anchorToConfigPath`
 * resolves with, so the two cannot disagree (INV-10). `pendingIndex` never
 * returns `-1`; it returns `entries.length` for an absent entry, so
 * `index < entries.length` *is* the presence test, spelled in the resolver's own
 * terms rather than in a second, parallel one that could drift from it.
 *
 * Why this matters more than it looks: without it, a removed claim topic's
 * anchor resolves cleanly to `claimTopics[length]` — a **different, later**
 * item's slot — and the column would describe topic *n+1*'s lines under topic
 * *n*'s name with no error anywhere. Measured against real Stellar output, a
 * pending slot returns a *non-empty* provenance group, so the wrong answer
 * renders as a populated, confident list rather than as an obvious blank.
 *
 * The five constant token-scope and control locations return `true`
 * unconditionally: they are not items and cannot be absent. The two draft
 * anchors return `false`, so this and `isInspectableAnchor` agree on them
 * without either calling the other.
 *
 * Total and never throws, for every anchor and every `RWAConfig` — a partner to
 * a function documented never to throw must not be the one that does.
 * Exhaustive `switch`, `never` tail.
 */
export function anchorItemExists(anchor: ConfigAnchor, config: RWAConfig): boolean {
  switch (anchor.kind) {
    // Not items. A token field, an administrative control, an identity control
    // and both ownership locations exist for every draft.
    case 'token':
    case 'admin':
    case 'identityControl':
    case 'ownershipType':
    case 'ownershipAddress':
      return true;
    case 'role': {
      const roles = config.accessControl.roles;
      return roleIndex(roles, anchor.roleName) < roles.length;
    }
    case 'module':
      return moduleExists(config, anchor.moduleId);
    // Keyed on the module's presence, never on its config record: a module
    // whose config is absent is still a module, and reading into the record
    // here is how this function learns to throw inside a render.
    case 'moduleConfig':
      return moduleExists(config, anchor.moduleId);
    case 'claimTopic': {
      const topics = config.identityVerification.claimTopics;
      return claimTopicIndex(topics, anchor.topicId) < topics.length;
    }
    case 'issuer':
      return issuerExists(config, anchor.address);
    case 'issuerTopics':
      return issuerExists(config, anchor.address);
    // The slot the next item will occupy is not an item.
    case 'claimTopicDraft':
    case 'issuerDraft':
      return false;
    default: {
      const exhaustive: never = anchor;
      return exhaustive;
    }
  }
}

function moduleExists(config: RWAConfig, moduleId: string): boolean {
  const modules = config.compliance.modules;
  return moduleIndex(modules, moduleId) < modules.length;
}

function issuerExists(config: RWAConfig, address: string): boolean {
  const issuers = config.identityVerification.trustedIssuers;
  return trustedIssuerIndex(issuers, address) < issuers.length;
}

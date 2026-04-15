# TODO: Verified Holder Bootstrap + Initial Allocations

**Status**: Deferred technical design  
**Last Updated**: 2026-04-13  
**Related Spec**: `specs/001-stellar-rwa-codegen/spec.md`

## Purpose

This document captures a future follow-up feature for the Stellar generator: a production-oriented way to bootstrap verified holders and optionally execute initial allocations without forcing users into the current `deploy.sh` hard failure path.

It is intentionally **not** part of spec `001-stellar-rwa-codegen` as currently corrected. Spec 001 now delivers deploy-ready infra generation and explicit deferred-mint guidance. This document describes the separate capability that would be required to go from "infra deployed" to "verified recipients onboarded and initial mint executed safely."

## Spec 001 State

After the spec correction, `001-stellar-rwa-codegen` should be understood as follows:

- It generates the 5 core Stellar RWA contracts plus selected compliance modules.
- It generates build/deploy scripts that deploy and wire the system safely.
- It registers claim topics, trusted issuers, and module wiring that can be derived directly from `RWAConfig`.
- It emits `config.json` as provenance only; the scripts do not depend on parsing it at runtime.
- If `token.initialSupply` is set, it does **not** auto-mint during `deploy.sh`.
- Instead, validation, generated README content, and deploy-time output explain that minting must happen later, after the recipient has been onboarded into the upstream identity system.

That boundary lets spec 001 ship a working, honest, deployable infra generator without pretending it can fully automate investor onboarding when the required data model does not yet exist.

## The Gap

The missing capability is not "a mint call." The missing capability is **verified recipient onboarding**.

Upstream Stellar RWA minting is guarded by identity verification. A recipient must satisfy the upstream identity flow before `mint` can succeed. At a high level that means:

1. Claim topics must exist in CTI.
2. Trusted issuers must be registered in CTI for those topics.
3. The recipient must be linked to a valid identity contract.
4. That identity must contain the required claims from a trusted claim issuer.
5. IRS must contain the holder/identity relationship and country data required by the verifier.

Current spec 001 and current `RWAConfig` do not model those requirements. In particular, the current system has no place to describe:

- Which wallets should receive an initial allocation.
- Which per-holder identity contracts should be used or created.
- Which claim issuer contracts exist, or whether they should be reused vs bootstrapped.
- Which claim payloads or signed attestations should back each holder's claims.
- Which country profile data should be registered for each holder.
- How initial allocation totals reconcile with `token.initialSupply`.

Without that information, auto-minting is necessarily guessy and unsafe. The current corrected behavior is therefore the right short-term product boundary.

## Goals

- Add a safe, explicit path to automate verified-holder onboarding and initial allocations on Stellar.
- Preserve the clean, chain-agnostic scope of `RWAConfig`.
- Support both production usage with existing external identity infrastructure and test/demo usage with generated bootstrap scaffolding.
- Keep generated scripts staged and understandable instead of hiding the whole process behind one opaque command.
- Make the Wizard and any future CLI clearly communicate whether a project is only `deploy-ready` or fully `auto-mint-ready`.

## Non-Goals

- Full long-term investor lifecycle management after initial issuance.
- KYC/KYB provider integrations.
- Secure storage or generation of production issuer private keys.
- A generic claims back office.
- Broad portfolio management across many tokens or issuers.

## User Stories

### User Story 1: Production Initial Allocation

As an operations engineer deploying a compliant Stellar RWA token, I want to provide existing claim-issuer references, holder onboarding data, and initial allocation amounts so the generated artifacts can onboard verified holders and mint the requested allocations without manual CLI surgery.

### User Story 2: Demo/Testnet Bootstrap

As a product engineer or solutions engineer, I want an opt-in development bootstrap mode that generates the extra identity-layer artifacts needed for a testnet demo so I can exercise an end-to-end deploy plus mint flow without building a production issuer stack first.

### User Story 3: Clear Readiness State

As a Wizard user, I want the product to tell me whether my configuration is only ready for infra deployment or fully ready for automated minting, so I know what will happen before I download or run anything.

## Proposed Product Boundary

The recommended boundary is:

- **Spec 001**: deploy-ready infra generation, safe wiring, and explicit deferred mint guidance.
- **This future feature**: verified-holder bootstrap plus optional automated initial allocations.
- **Later future feature**: broader holder lifecycle tooling (new investors, claim refresh, revocation, reallocations, redemptions, etc.).

This keeps spec 001 shippable while giving the mint/onboarding problem enough space to be designed correctly.

## Proposed Configuration Model

### Keep `RWAConfig` Focused

Do **not** force this new operational data into `@openzeppelin/rwa-config`.

`RWAConfig` should remain the chain-agnostic description of the token system itself:

- token metadata
- identity policy
- compliance module selection
- access-control design
- deployment target

The onboarding problem is different. It is:

- Stellar-specific
- operational rather than architectural
- holder-specific
- more security-sensitive
- likely to evolve separately from the shared config model

### Add a Separate Onboarding Manifest

The recommended shape is a second input document, tentatively named `stellar-onboarding.json`.

Illustrative schema:

```typescript
interface StellarOnboardingManifest {
  mode: 'externalRefs' | 'generatedDevBootstrap';
  claimIssuers: ClaimIssuerInput[];
  holders: VerifiedHolderInput[];
}

interface ClaimIssuerInput {
  id: string;
  claimTopicIds: number[];
  contract:
    | { mode: 'external'; address: string }
    | { mode: 'generate'; alias: string };
}

interface VerifiedHolderInput {
  id: string;
  walletAddress: string;
  countryCode: string;
  identity:
    | { mode: 'external'; contractAddress: string }
    | { mode: 'generate'; alias: string };
  claims: HolderClaimInput[];
  initialAllocation?: string;
}

interface HolderClaimInput {
  topicId: number;
  issuerId: string;
  source:
    | { mode: 'externalSignedClaim'; ref: string }
    | { mode: 'generateDevClaim' };
}
```

This should be treated as a starting point, not a final schema contract. The exact fields may change once the upstream identity-contract invocation requirements are mapped in more detail.

### Why a Separate Manifest Is Better

- It avoids contaminating the shared chain-agnostic config package with Stellar-only deployment data.
- It gives the future feature a clean opt-in boundary.
- It separates "design the token system" from "operate an issuance event."
- It makes security review easier because the sensitive operational inputs live in one obvious place.

## Supported Modes

### `externalRefs`

This should be the **default production-first mode**.

In this mode, the generator assumes the issuer already has some or all of the identity infrastructure:

- existing claim issuer contracts
- existing per-holder identity contracts
- precomputed claim artifacts or references
- known holder onboarding data

The generator's job is to:

- validate the manifest
- generate the right scripts
- wire the already-existing pieces together
- execute the minimum necessary contract calls in the correct order

### `generatedDevBootstrap`

This should be an explicit, heavily labeled **development/demo-only** mode.

In this mode, the generator may scaffold example claim-issuer and identity-support artifacts needed to demonstrate the flow on local/testnet environments.

Constraints for this mode:

- not the default
- clearly labeled non-production
- likely blocked on mainnet unless an explicit override is provided
- never marketed as a real production onboarding stack

## Generated Artifact Proposal

Instead of teaching one `deploy.sh` to do everything, generate staged scripts with clear responsibilities:

- `scripts/deploy-infra.sh`
- `scripts/onboard-holders.sh`
- `scripts/mint-initial-allocations.sh`
- `scripts/deploy-all.sh`

Recommended behavior:

### `deploy-infra.sh`

- Deploy the core contracts and compliance modules.
- Perform the same safe infra wiring that spec 001 already owns.
- Stop after deploy-ready infra is complete.

### `onboard-holders.sh`

- Read the onboarding manifest.
- Reuse or deploy claim issuers depending on mode.
- Reuse or create holder identity contracts depending on mode.
- Register holder identity/country data in IRS.
- Attach or verify holder claims as required by the upstream flow.
- Fail early if required CTI/IRS preconditions are missing.

### `mint-initial-allocations.sh`

- Verify that the holders referenced by allocations exist in the onboarding manifest.
- Confirm each recipient passed onboarding preconditions before invoking `mint`.
- Execute one mint per recipient allocation in a predictable order.
- Summarize total minted vs requested totals.

### `deploy-all.sh`

- Call the three stages in order.
- Only include the onboarding/mint stages when a valid onboarding manifest exists.
- Print a readiness summary up front so the user knows whether the run is infra-only or auto-mint-enabled.

## Validation Proposal

If an onboarding manifest is provided, add a dedicated validation layer before generation or execution.

Suggested rules:

- Every `holders[].walletAddress` must be unique.
- Every `holders[].id` must be unique.
- Every `claims[].topicId` must exist in `config.identityVerification.claimTopics`.
- Every `claims[].issuerId` must reference a declared claim issuer.
- Every claim issuer topic must be compatible with CTI registration planned from `RWAConfig`.
- Every allocation recipient must exist in `holders`.
- Every allocation amount must be a valid non-negative integer string.
- If any holder has `initialAllocation`, then `token.initialSupply` should also be set.
- If `token.initialSupply` is set and allocations are provided, the allocation total should reconcile exactly with `token.initialSupply`.
- `generatedDevBootstrap` should warn or fail on mainnet by default.
- Generation must not emit auto-mint scripts unless onboarding validation passes cleanly.

## CLI Proposal

If we expose this through a CLI later, keep the current spec 001 path simple and make onboarding an explicit second input.

Illustrative command set:

```bash
rwa generate stellar --config rwa-config.json
rwa generate stellar --config rwa-config.json --onboarding stellar-onboarding.json
rwa validate stellar --config rwa-config.json --onboarding stellar-onboarding.json
```

Expected UX:

- `rwa generate stellar --config ...`
Produces the current spec 001 output and prints `Deploy-ready infra generated. Initial mint remains deferred.`
- `rwa generate stellar --config ... --onboarding ...`
Produces the extra onboarding/mint artifacts and prints `Auto-mint-ready output generated.` if validation succeeds.
- `rwa validate ...`
Reports errors and warnings for both the base config and the onboarding manifest in one place.

Generated shell UX should stay aligned with the smooth source-account handling already added to spec 001, reusing the same `SOURCE_ACCOUNT` / `STELLAR_ACCOUNT` conventions.

## Wizard UX/UI Proposal

### Spec 001 UX

When a Stellar user sets `token.initialSupply`, show a non-blocking message in the current flow:

> Automatic mint on Stellar requires verified-holder onboarding. This project will deploy infra only and leave minting as a guided follow-up step.

That message should:

- not block download/generation
- explain why the mint is deferred
- avoid implying the system is broken
- point toward the future advanced onboarding flow

### Future Advanced Flow

Add a distinct advanced flow or expandable section rather than crowding the base wizard:

1. `Claim Issuers`
2. `Verified Holders`
3. `Initial Allocations`
4. `Review + Deployment Plan`

This should feel like a second layer on top of spec 001, not a new requirement for every user.

### Readiness States

The review step should clearly classify the project as one of:

- `Deploy-ready`
- `Deploy-ready, mint deferred`
- `Auto-mint-ready`

Those labels matter because they align user expectations before download.

### Suggested Summary Panel

Show a compact deployment plan summary:

- Infra deployment: yes
- Holder onboarding: manual or automated
- Initial allocations: none, manual, or automated
- Mode: external refs or dev bootstrap
- Blocking issues: any missing claim issuer, holder claim, or allocation mismatch

## Implementation Outline

### Package Boundaries

#### `@openzeppelin/rwa-config`

Prefer **no change** in the first iteration.

If shared types become useful later, they should still be introduced cautiously because most of this problem is ecosystem-specific.

#### `@openzeppelin/codegen-rwa-stellar`

This package would carry most of the work:

- onboarding manifest types
- onboarding validation
- staged script generation
- README/deployment-plan generation updates
- optional dev-bootstrap artifact generation

#### Wizard App

The Wizard would need:

- readiness messaging in the current flow
- advanced onboarding UI
- onboarding-manifest serialization
- review-step plan rendering

#### Future CLI Surface

If a first-party CLI is used, it should treat onboarding as a second explicit input file, not as hidden flags scattered across commands.

## Rollout Proposal

Recommended incremental delivery:

### Phase 1

- Define the onboarding manifest.
- Implement validation only.
- Update the Wizard to surface `Deploy-ready` vs `Auto-mint-ready`.

### Phase 2

- Generate staged onboarding and mint scripts in `externalRefs` mode.
- Add README/deployment-plan output describing the stages.

### Phase 3

- Add Wizard UI for authoring the onboarding manifest.
- Add CLI support for dual-file generation and validation.

### Phase 4

- Add opt-in `generatedDevBootstrap` mode for demos/testnet.
- Gate it with strong warnings and environment checks.

## Risks and Design Constraints

- The exact upstream identity-contract ABI may evolve, so the manifest must not overfit too early.
- Claim payload handling is security-sensitive and should avoid encouraging unsafe storage patterns.
- There is a real risk of overloading the base Wizard if this is not clearly separated from spec 001.
- Demo-mode scaffolding can easily be mistaken for production guidance if labeling is weak.

## Open Questions

- What exact claim artifact format should production mode accept: raw payloads, signed claims, or references to externally prepared artifacts?
- Should initial allocation reconciliation require exact equality with `token.initialSupply`, or should partial allocation plans be allowed?
- What is the minimal IRS country-data representation the manifest should own?
- How much idempotency/state tracking should the generated scripts guarantee across reruns?
- Should the generated output include a machine-readable deployment plan alongside shell scripts?

## Recommendation

Keep spec 001 exactly on its corrected boundary and treat this document as the entry point for the next spec when work resumes.

The key design principle is: **do not add "auto-mint" as a narrow patch. Add verified-holder bootstrap as a first-class, explicitly modeled capability.**
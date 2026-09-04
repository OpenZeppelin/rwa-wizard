#!/bin/bash
set -e

if [ -t 1 ]; then
  BOLD=$'\033[1m'    DIM=$'\033[2m'
  GREEN=$'\033[32m'  RED=$'\033[31m'  CYAN=$'\033[36m'  YELLOW=$'\033[33m'
  RST=$'\033[0m'
else
  BOLD='' DIM='' GREEN='' RED='' CYAN='' YELLOW='' RST=''
fi

COMPLIANCE_PREFLIGHT_ONLY=false
for __bootstrap_arg in "$@"; do
  case "$__bootstrap_arg" in
    --preflight)
      COMPLIANCE_PREFLIGHT_ONLY=true
      ;;
  esac
done
unset __bootstrap_arg

echo ""
echo ""
echo "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RST}"
echo "${BOLD}${CYAN}  Demo Auto-Mint Bootstrap (TESTNET ONLY — NOT PRODUCTION KYC)${RST}"
echo "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RST}"
echo ""
echo "  Educational Scope A: deploy example claim issuer, onboard Admin with demo claims, mint initialSupply."
echo "  Uses a hardcoded demo Ed25519 signing key — never use this flow in production."
echo "  Flag: --preflight (compliance check only — run after deploy.sh, before onboarding/mint)"
echo ""

DEMO_SIGNING_SECRET_HEX="0000000000000000000000000000000000000000000000000000000000000000"
DEMO_SIGNING_PUBLIC_KEY_HEX="3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29"
DEMO_COUNTRY_CODE=756
ED25519_SCHEME=101
INITIAL_SUPPLY="1000000000000000000000000"
MINT_RECIPIENT="GCDAO"
ADMIN="GCDAO"

SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-${STELLAR_ACCOUNT:-}}"
ADMIN_SOURCE_ACCOUNT="${ADMIN_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"
MANAGER_SOURCE_ACCOUNT="${MANAGER_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"

if [ -z "$SOURCE_ACCOUNT" ]; then
  echo "Missing Stellar source account."
  echo "Set SOURCE_ACCOUNT or STELLAR_ACCOUNT to a funded testnet CLI identity."
  exit 1
fi

load_manifest_field() {
  local key="$1"
  grep -o "\"${key}\": \"[^\"]*\"" deployment-manifest.json | head -1 | sed 's/.*: "\([^"]*\)"/\1/'
}

if [ ! -f deployment-manifest.json ]; then
  echo "Missing deployment-manifest.json — run ./scripts/deploy.sh first."
  exit 1
fi

MANIFEST_NETWORK="$(load_manifest_field network)"
CTI_ADDRESS="$(load_manifest_field CTI_ADDRESS)"
if [ -z "$CTI_ADDRESS" ]; then
  echo "deployment-manifest.json is missing contracts.CTI_ADDRESS"
  exit 1
fi
IRS_ADDRESS="$(load_manifest_field IRS_ADDRESS)"
if [ -z "$IRS_ADDRESS" ]; then
  echo "deployment-manifest.json is missing contracts.IRS_ADDRESS"
  exit 1
fi
RWA_TOKEN_ADDRESS="$(load_manifest_field RWA_TOKEN_ADDRESS)"
if [ -z "$RWA_TOKEN_ADDRESS" ]; then
  echo "deployment-manifest.json is missing contracts.RWA_TOKEN_ADDRESS"
  exit 1
fi
ADMIN="$(load_manifest_field admin)"
MANAGER="$(load_manifest_field manager)"
if [ -z "$ADMIN" ] || [ -z "$MANAGER" ]; then
  echo "deployment-manifest.json is missing admin or manager addresses."
  exit 1
fi

resolve_cli_identity_address() {
  local identity="$1"
  if [[ "$identity" =~ ^G[A-Z2-7]{55}$ ]]; then
    echo "$identity"
    return 0
  fi
  local resolved
  resolved="$(stellar keys address "$identity" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$resolved" =~ ^G[A-Z2-7]{55}$ ]]; then
    echo "$resolved"
    return 0
  fi
  return 1
}

verify_role_signer() {
  local role_label="$1"
  local expected_address="$2"
  local source_account="$3"
  local resolved
  if ! resolved="$(resolve_cli_identity_address "$source_account")"; then
    echo "${RED}  ✗ Could not resolve Stellar CLI identity for ${role_label}: ${source_account}${RST}"
    echo "    Ensure the identity exists (stellar keys generate <name> --fund ...) or pass a G-address directly."
    exit 1
  fi
  if [ "$resolved" != "$expected_address" ]; then
    echo "${RED}  ✗ ${role_label} signer mismatch${RST}"
    echo "    Expected on-chain address: $expected_address"
    echo "    CLI identity \"$source_account\" resolves to: $resolved"
    echo "    Set ADMIN_SOURCE_ACCOUNT / MANAGER_SOURCE_ACCOUNT to identities that control the configured addresses."
    exit 1
  fi
}

verify_role_signer "Admin" "$ADMIN" "$ADMIN_SOURCE_ACCOUNT"
verify_role_signer "Manager" "$MANAGER" "$MANAGER_SOURCE_ACCOUNT"

if ! echo "$MANIFEST_NETWORK" | grep -qi testnet; then
echo "${RED}  ✗ bootstrap-demo-mint.sh is testnet-only. Current manifest network: $MANIFEST_NETWORK${RST}"
  exit 1
fi

if [ ! -f target/wasm32v1-none/release/rwa_claim_issuer_example.wasm ] || [ ! -f target/wasm32v1-none/release/rwa_identity_example.wasm ]; then
  echo "Missing example WASM artifacts — run ./scripts/build.sh first."
  exit 1
fi

extract_numeric_cli_output() {
  echo "$1" | grep -Eo '[0-9]+' | tail -1
}

verify_compliance_for_demo_mint() {
  local failed=0
  echo ""
echo ""
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
echo "${BOLD}  Compliance preflight — \`created\` hook before mint${RST}"
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
echo "  Mint runs Compliance modules registered on \`created\` in the same transaction."
echo "  Demo mint amount: $INITIAL_SUPPLY base units · Demo IRS country: 756 (CH)"
echo "  This script never changes module limits — run the suggested Manager invokes yourself."
echo ""
echo "${GREEN}  ✓ Wizard config has no \`created\` conflicts for this demo mint.${RST}"
  return 0
}

if [ "$COMPLIANCE_PREFLIGHT_ONLY" = true ]; then
  verify_compliance_for_demo_mint
  exit $?
fi

echo ""
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
echo "${BOLD}  Deploy example claim issuer${RST}"
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
echo "${BOLD}  Deploying Example Claim Issuer ...${RST}"
CLAIM_ISSUER_ADDRESS=$(stellar contract deploy \
  --source-account "$SOURCE_ACCOUNT" \
  --wasm target/wasm32v1-none/release/rwa_claim_issuer_example.wasm \
  --network testnet \
  -- \
  --owner "$ADMIN")
if [ $? -ne 0 ] || [ -z "$CLAIM_ISSUER_ADDRESS" ]; then
  echo "${RED}  ✗ Failed to deploy Example Claim Issuer (rwa-claim-issuer-example)${RST}"
  exit 1
fi
echo "${GREEN}  ✓ Example Claim Issuer: ${CLAIM_ISSUER_ADDRESS}${RST}"

echo ""
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
echo "${BOLD}  Register demo issuer in CTI${RST}"
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
stellar contract invoke \
  --id $CTI_ADDRESS \
  --source-account "$MANAGER_SOURCE_ACCOUNT" \
  --network testnet \
  -- \
  add_trusted_issuer \
  --trusted_issuer "$CLAIM_ISSUER_ADDRESS" --claim_topics '[1, 2]' --operator "$MANAGER"
echo "${GREEN}  ✓ Registered demo issuer for claim topics [1, 2]${RST}"

stellar contract invoke \
  --id $CLAIM_ISSUER_ADDRESS \
  --source-account "$ADMIN_SOURCE_ACCOUNT" \
  --network testnet \
  -- \
  allow_key \
  --public_key 3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29 --registry "$CTI_ADDRESS" --claim_topic 1
echo "${GREEN}  ✓ Allowed demo signing key for topic 1 (KYC)${RST}"
stellar contract invoke \
  --id $CLAIM_ISSUER_ADDRESS \
  --source-account "$ADMIN_SOURCE_ACCOUNT" \
  --network testnet \
  -- \
  allow_key \
  --public_key 3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29 --registry "$CTI_ADDRESS" --claim_topic 2
echo "${GREEN}  ✓ Allowed demo signing key for topic 2 (AML)${RST}"

echo ""
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
echo "${BOLD}  Deploy identity for Admin and register in IRS${RST}"
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
echo "${BOLD}  Deploying Example Identity ...${RST}"
IDENTITY_ADDRESS=$(stellar contract deploy \
  --source-account "$SOURCE_ACCOUNT" \
  --wasm target/wasm32v1-none/release/rwa_identity_example.wasm \
  --network testnet \
  -- \
  --owner "$ADMIN")
if [ $? -ne 0 ] || [ -z "$IDENTITY_ADDRESS" ]; then
  echo "${RED}  ✗ Failed to deploy Example Identity (rwa-identity-example)${RST}"
  exit 1
fi
echo "${GREEN}  ✓ Example Identity: ${IDENTITY_ADDRESS}${RST}"

sign_demo_claim() {
  local topic="$1"
  cargo run --manifest-path tools/sign-claim/Cargo.toml --quiet -- \
    --secret-key "$DEMO_SIGNING_SECRET_HEX" \
    --claim-issuer "$CLAIM_ISSUER_ADDRESS" \
    --identity "$IDENTITY_ADDRESS" \
    --claim-topic "$topic" \
    --valid-for-days 7 \
    --network testnet
}

parse_signed_claim() {
  local output="$1"
  CLAIM_DATA=$(echo "$output" | awk '/--data/{print $2}')
  CLAIM_SIGNATURE=$(echo "$output" | awk '/--signature/{print $2}')
  if [ -z "$CLAIM_DATA" ] || [ -z "$CLAIM_SIGNATURE" ]; then
    echo "Could not parse signed claim output:"
    echo "$output"
    exit 1
  fi
}

for DEMO_TOPIC in 1 2; do
  echo ""
echo "${BOLD}  Signing demo claim for topic $DEMO_TOPIC...${RST}"
  SIGN_OUTPUT="$(sign_demo_claim "$DEMO_TOPIC")"
  parse_signed_claim "$SIGN_OUTPUT"
stellar contract invoke \
  --id $IDENTITY_ADDRESS \
  --source-account "$ADMIN_SOURCE_ACCOUNT" \
  --network testnet \
  -- \
  add_claim \
  --topic "$DEMO_TOPIC" --scheme "$ED25519_SCHEME" --issuer "$CLAIM_ISSUER_ADDRESS" --signature "$CLAIM_SIGNATURE" --data "$CLAIM_DATA" --uri "demo://admin/kyc"
echo "${GREEN}  ✓ Added demo claim for topic $DEMO_TOPIC${RST}"
done

stellar contract invoke \
  --id $IRS_ADDRESS \
  --source-account "$MANAGER_SOURCE_ACCOUNT" \
  --network testnet \
  -- \
  add_identity_country_data \
  --account "$MINT_RECIPIENT" --identity "$IDENTITY_ADDRESS" --initial_profiles '[{"country":{"Individual":{"Residence":756}},"metadata":null}]' --operator "$MANAGER"
echo "${GREEN}  ✓ Registered Admin in IRS with demo country profile${RST}"

verify_compliance_for_demo_mint || exit 1

echo ""
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
echo "${BOLD}  Mint configured initial supply to Admin${RST}"
echo "${BOLD}───────────────────────────────────────────────────────────────${RST}"
stellar contract invoke \
  --id $RWA_TOKEN_ADDRESS \
  --source-account "$ADMIN_SOURCE_ACCOUNT" \
  --network testnet \
  -- \
  mint \
  --to "$MINT_RECIPIENT" --amount "$INITIAL_SUPPLY" --operator "$ADMIN"
echo "${GREEN}  ✓ Minted $INITIAL_SUPPLY base units to Admin ($MINT_RECIPIENT)${RST}"

echo ""
echo ""
echo "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RST}"
echo "${BOLD}${CYAN}  Demo Auto-Mint Complete${RST}"
echo "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RST}"
echo ""
echo "  Recipient: $MINT_RECIPIENT"
echo "  Amount:    $INITIAL_SUPPLY base units"
echo "  Reminder: demo keys and example contracts — not production KYC."

---
'@openzeppelin/codegen-rwa-stellar': minor
---

Add `getUpstreamSourceRevision(options?)`, which reports the repository and
commit the generated crate imports resolve against — `{ repoUrl, commitHash,
mode }`, where `mode` is `'git-revision'` for the pinned default and
`'local-path'` (with a `null` commit) when `contractsLibraryPath` points the
manifest at a checkout.

Consumers that link generated `use stellar_*` paths to upstream source can now
read those coordinates directly instead of parsing them out of the generated
`Cargo.toml` or README, which coupled them to template wording.

Additive: no existing export or generated output changed.

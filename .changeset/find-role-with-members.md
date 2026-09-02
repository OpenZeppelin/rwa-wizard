---
'@openzeppelin/codegen-rwa-common': minor
---

Add `findRoleWithMembers` for targeted role resolution without normalizing every
role's member addresses. `getManagerAddress` now uses it so manager resolution
reads only the manager role (or falls back to admin) instead of every role in
the list.

Behaviour change vs the previous filter-then-find pattern: matching roles now
resolve their symbol (`resolveRoleSymbol`) before the member-address filter.
A symbol-less role that also has zero members — previously skipped quietly and
able to fall through to the admin address — now throws when no
`generateRoleSymbol` option is supplied. Callers that always pass
`generateRoleSymbol` (including every in-repo path) are unaffected.

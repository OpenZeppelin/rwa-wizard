---
'@openzeppelin/codegen-rwa-stellar': patch
---

Quieter Addresses provenance on role-guard scans: omit the
`accessControl.roles` list root from pause / method / document-manager guard
Observed reads via `omitExactConfigPath` (hazard 5). Generated contract bytes are
unchanged; only provenance path lists move. Whole-list emits
(`getAdditionalRoles`) keep the root.

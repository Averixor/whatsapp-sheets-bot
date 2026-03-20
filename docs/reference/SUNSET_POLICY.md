# Compatibility Sunset Policy

## Status model
Each wrapper or historical facade is classified as one of:
- `canonical`
- `compatibility-only`
- `historical`
- `deprecated`
- `sunset planned`
- `removable after migration`

## Source of truth
Use:
- `getDeprecatedRegistry_()`
- `getStage4CompatibilityMap_()`
- `getCompatibilitySunsetReport_()`
- `ProjectMetadata.gs` documentation / maintenance policy markers

## Interpretation
- `canonical` — active baseline layer
- `compatibility-only` — still allowed for live callers, but not a growth point
- `historical` — retained mainly for reference / old entrypoints
- `deprecated` — should be removed after safe migration
- `sunset planned` — removal path is defined, but migration is not complete yet
- `removable after migration` — ready to disappear once live dependency is gone

## Removal rule
A wrapper can be physically removed only after:
1. migration status is complete;
2. diagnostics no longer report live dependency on it;
3. smoke/regression checks remain green;
4. active docs no longer reference it as canonical.

#!/usr/bin/env python3
from pathlib import Path
import re

BASE = Path("refactor/access-control.runtime")
CORE = BASE / "AccessControl.Core.gs"
PUBLIC = BASE / "AccessControl.PublicApi.gs"

if not CORE.exists():
    raise SystemExit(f"Missing file: {CORE}")
if not PUBLIC.exists():
    raise SystemExit(f"Missing file: {PUBLIC}")

core_text = CORE.read_text(encoding="utf-8")
public_text = PUBLIC.read_text(encoding="utf-8")

opener = "const AccessControl_ = (function () {"
if opener not in core_text:
    raise SystemExit("IIFE opener not found in AccessControl.Core.gs")

core_text = core_text.replace(
    opener,
    "// IIFE opener removed during runtime modularization",
    1
)

# Remove only the LAST IIFE closer from PublicApi
closer = "\n})();"
closer_idx = public_text.rfind(closer)
if closer_idx == -1:
    raise SystemExit("IIFE closer not found in AccessControl.PublicApi.gs")

before_closer = public_text[:closer_idx]
after_closer = public_text[closer_idx + len(closer):]

# Find the LAST export-style return block before the closer
ret_idx = before_closer.rfind("\n  return {")
if ret_idx == -1:
    ret_idx = before_closer.rfind("\nreturn {")
if ret_idx == -1:
    raise SystemExit("Could not find final export return block in AccessControl.PublicApi.gs")

export_candidate = before_closer[ret_idx:]

# sanity checks: should look like export object
must_have = ["describe", "assertRoleAtLeast"]
for token in must_have:
    if token not in export_candidate:
        raise SystemExit(f"Export block sanity check failed: missing '{token}'")

# Capture from final return { ... }; to the closer
tail_block = public_text[ret_idx:closer_idx + len(closer)]

# Convert:
#   return { ... };
# })();
# into:
#   const AccessControl_ = Object.freeze({ ... });
m = re.search(r'return\s*\{(.*)\}\s*;\s*$', before_closer[ret_idx:], re.S)
if not m:
    raise SystemExit("Failed to parse export object body")

obj_body = m.group(1).rstrip()

new_facade = (
    "\n\nconst AccessControl_ = Object.freeze({"
    + obj_body +
    "\n});\n"
)

new_public = before_closer[:ret_idx].rstrip() + new_facade + after_closer

CORE.write_text(core_text, encoding="utf-8")
PUBLIC.write_text(new_public, encoding="utf-8")

print("DONE")
print(f"Updated: {CORE}")
print(f"Updated: {PUBLIC}")
print("\nChecks:")
print(f"- opener removed from Core: {opener not in CORE.read_text(encoding='utf-8')}")
print(f"- closer removed from PublicApi: {closer not in PUBLIC.read_text(encoding='utf-8')}")
print(f"- facade present: {'const AccessControl_ = Object.freeze({' in PUBLIC.read_text(encoding='utf-8')}")

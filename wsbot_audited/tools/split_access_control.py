#!/usr/bin/env python3
import re
from pathlib import Path

SRC = Path("AccessControl.gs")
CHUNKS_DIR = Path("refactor/access-control.chunks")
MODULES_DIR = Path("refactor/access-control.modules")
FINAL_DIR = Path("refactor/access-control.final")

if not SRC.exists():
    raise SystemExit("AccessControl.gs not found")

text = SRC.read_text(encoding="utf-8")

marker_re = re.compile(r'(?m)^  // ==================== (.+?) ====================\s*$')
matches = list(marker_re.finditer(text))

def slug(name: str) -> str:
    s = name.strip().lower().replace("/", " ")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "section"

sections = []
if matches:
    preamble = text[:matches[0].start()]
    sections.append(("00_preamble", preamble))
    for i, m in enumerate(matches, start=1):
        start = m.start()
        end = matches[i].start() if i < len(matches) else len(text)
        sections.append((f"{i:02d}_{slug(m.group(1))}", text[start:end]))
else:
    sections.append(("00_full_file", text))

CHUNKS_DIR.mkdir(parents=True, exist_ok=True)
for name, content in sections:
    (CHUNKS_DIR / f"{name}.part.gs").write_text(content, encoding="utf-8")

chunk_map = {name: content for name, content in sections}
def chunk(name): return chunk_map.get(name, "")

module_parts = {
    "AccessControl.Core.part.gs": "\n\n".join(filter(None, [
        chunk("00_preamble"),
        chunk("01_reason_codes"),
        chunk("02_utilities"),
        chunk("03_hashing"),
    ])),
    "AccessControl.SheetRepository.part.gs": "\n\n".join(filter(None, [
        chunk("04_sheet_operations_header_based_safe_reads_writes"),
    ])),
    "AccessControl.Lockout.part.gs": "\n\n".join(filter(None, [
        chunk("05_entry_status"),
        chunk("06_lockout_state"),
    ])),
    "AccessControl.Mutations.part.gs": "\n\n".join(filter(None, [
        chunk("07_unified_mutation_operations"),
    ])),
    "AccessControl.AuthResolver.part.gs": "\n\n".join(filter(None, [
        chunk("08_access_policy"),
        chunk("09_unified_user_resolver"),
    ])),
    "AccessControl.PublicApi.part.gs": "\n\n".join(filter(None, [
        chunk("10_main_describe_function"),
        chunk("11_assert_enforcement"),
        chunk("12_email_role_lists"),
        chunk("13_role_helpers"),
        chunk("14_validation_diagnostics"),
        chunk("15_sheet_ui"),
        chunk("16_tests"),
        chunk("17_exports"),
    ])),
}

MODULES_DIR.mkdir(parents=True, exist_ok=True)
for filename, content in module_parts.items():
    (MODULES_DIR / filename).write_text(content, encoding="utf-8")

FINAL_DIR.mkdir(parents=True, exist_ok=True)
for filename in [
    "AccessControl.Core.gs",
    "AccessControl.SheetRepository.gs",
    "AccessControl.Lockout.gs",
    "AccessControl.Mutations.gs",
    "AccessControl.AuthResolver.gs",
    "AccessControl.PublicApi.gs",
]:
    path = FINAL_DIR / filename
    if not path.exists():
        path.write_text(
            "/**\n"
            f" * {filename}\n"
            " * Scaffold file created by split_access_control.py\n"
            " */\n\n",
            encoding="utf-8"
        )

print("DONE")
for p in sorted(CHUNKS_DIR.glob("*.part.gs")):
    print("CHUNK ", p.as_posix())
for p in sorted(MODULES_DIR.glob("*.part.gs")):
    print("MODULE", p.as_posix())

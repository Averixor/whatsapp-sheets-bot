#!/usr/bin/env python3
from pathlib import Path
import re

SRC = Path("Diagnostics.gs")
CHUNKS_DIR = Path("refactor/diagnostics.chunks")
MODULES_DIR = Path("refactor/diagnostics.modules")
FINAL_DIR = Path("refactor/diagnostics.final")
RUNTIME_DIR = Path("refactor/diagnostics.runtime")

if not SRC.exists():
    raise SystemExit("Diagnostics.gs not found")

text = SRC.read_text(encoding="utf-8")

func_re = re.compile(r'(?m)^function\s+([A-Za-z0-9_]+)\s*\(')
matches = list(func_re.finditer(text))

if not matches:
    raise SystemExit("No function declarations found")

func_blocks = {}
header = text[:matches[0].start()]

for i, m in enumerate(matches):
    name = m.group(1)
    start = m.start()
    end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
    func_blocks[name] = text[start:end].rstrip() + "\n"

# keep top-level preamble (const DIAGNOSTICS etc.)
CHUNKS_DIR.mkdir(parents=True, exist_ok=True)
(CHUNKS_DIR / "00_preamble.part.gs").write_text(header, encoding="utf-8")

GROUPS = {
    "Diagnostics.Core.part.gs": [
        "_getSS_",
        "_global_",
        "_errMsg_",
        "_safeErr_",
        "_pushCheck_",
        "_makeReport_"
    ],
    "Diagnostics.Health.part.gs": [
        "_ensureSendPanelTechnicalSheet_",
        "_addHealthCheck_",
        "_runHealthCheckItem_",
        "healthCheck"
    ],
    "Diagnostics.BasicChecks.part.gs": [
        "checkSheets",
        "checkFiles",
        "checkDuplicates",
        "testFunctions",
        "runDiagnostics",
        "runAllDiagnostics",
        "runSheetsCheck",
        "runFilesCheck",
        "runDuplicatesCheck",
        "runTestsCheck",
        "runFullDiagnostics"
    ],
    "Diagnostics.Stage7.Core.part.gs": [
        "_stage7PushCheck_",
        "_projectBundleHas_",
        "_projectBundleMissing_",
        "_isProjectDocPath_",
        "_isArchivePath_",
        "_isReferencePath_",
        "_diagPushPathCheck_",
        "_diagGlobal_",
        "_diagResolvePath_",
        "_diagHasRouteApi_",
        "_diagResolveKnownSymbolStage7_",
        "_diagResolveSymbolStage7_",
        "_fnExists_",
        "_stage7ResolveSymbol_",
        "_stage7HasFn_",
        "_releaseStageLabel_",
        "_diagNormalizeStatus_",
        "_diagResolveSeverity_",
        "_diagIsPseudoLikeCheck_",
        "_diagResolveUiGroup_",
        "_diagNormalizeCheck_",
        "_diagNormalizeReportChecks_",
        "_diagMergeChecks_",
        "_diagBuildWarningsFromChecks_",
        "_diagBuildCounts_",
        "_diagBuildReport_",
        "_diagServiceSheetCheck_",
        "_diagBuildStage7CoreChecks_",
        "_diagAppendPendingRepairsCheck_",
        "_diagAppendCompatibilitySplitCheck_",
        "_diagAppendLifecyclePolicyCheck_"
    ],
    "Diagnostics.Stage7.Historical.part.gs": [
        "runStage41ProjectConsistencyCheck_",
        "runHistoricalStructuralDiagnosticsInternal_",
        "runHistoricalCompatibilityDiagnosticsInternal_",
        "runHistoricalQuickDiagnosticsInternal_",
        "runHistoricalFullDiagnosticsInternal_"
    ],
    "Diagnostics.Stage7.Baseline.part.gs": [
        "runStage3HealthCheck_",
        "runStage4HealthCheck_",
        "runStage5MetadataConsistencyCheck_",
        "runStage5QuickDiagnostics_",
        "runStage5StructuralDiagnostics_",
        "runStage5OperationalDiagnostics_",
        "runStage5SunsetDiagnostics_",
        "runStage6AHardeningDiagnostics_",
        "runStage5FullDiagnostics_",
        "runStage5FullVerboseDiagnostics_"
    ],
    "Diagnostics.Debug.part.gs": [
        "debugSendPanelNow",
        "debugSendPanelBridge_",
        "debugAccess"
    ]
}

used = set()

for filename, names in GROUPS.items():
    content_parts = []
    if filename == "Diagnostics.Core.part.gs":
        content_parts.append(header.rstrip() + "\n")
        # keep the DIAGNOSTICS top-level bits together with core
        for helper_name in ["setTestMode", "isTestMode"]:
            if helper_name in func_blocks:
                content_parts.append(func_blocks[helper_name])
                used.add(helper_name)

    for name in names:
        if name not in func_blocks:
            continue
        content_parts.append(func_blocks[name])
        used.add(name)

    out = "\n".join(part.rstrip() for part in content_parts if part.strip()) + "\n"
    (MODULES_DIR / filename).write_text(out, encoding="utf-8")

# write per-function chunks too
for name, block in func_blocks.items():
    slug = re.sub(r'[^A-Za-z0-9_]+', '_', name).strip('_')
    (CHUNKS_DIR / f"{slug}.part.gs").write_text(block, encoding="utf-8")

# catch leftovers
leftovers = sorted(set(func_blocks.keys()) - used)
leftover_text = ""
for name in leftovers:
    leftover_text += func_blocks[name] + "\n"
(CHUNKS_DIR / "zz_leftovers.part.gs").write_text(leftover_text, encoding="utf-8")

FINAL_DIR.mkdir(parents=True, exist_ok=True)
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

final_files = [
    "Diagnostics.Core.gs",
    "Diagnostics.Health.gs",
    "Diagnostics.BasicChecks.gs",
    "Diagnostics.Stage7.Core.gs",
    "Diagnostics.Stage7.Historical.gs",
    "Diagnostics.Stage7.Baseline.gs",
    "Diagnostics.Debug.gs",
]

for fname in final_files:
    module_name = fname.replace(".gs", ".part.gs")
    src = MODULES_DIR / module_name
    dst_final = FINAL_DIR / fname
    dst_runtime = RUNTIME_DIR / fname

    content = src.read_text(encoding="utf-8") if src.exists() else (
        f"/** {fname} */\n"
    )

    dst_final.write_text(content, encoding="utf-8")
    dst_runtime.write_text(content, encoding="utf-8")

print("DONE")
print("Chunks:")
for p in sorted(CHUNKS_DIR.glob("*.part.gs")):
    print(" -", p.as_posix())
print("\nModules:")
for p in sorted(MODULES_DIR.glob("*.part.gs")):
    print(" -", p.as_posix())
print("\nFinal:")
for p in sorted(FINAL_DIR.glob("*.gs")):
    print(" -", p.as_posix())
print("\nRuntime:")
for p in sorted(RUNTIME_DIR.glob("*.gs")):
    print(" -", p.as_posix())
print("\nLeftovers:")
for name in leftovers:
    print(" -", name)

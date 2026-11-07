#!/usr/bin/env python3
"""Prove popup CSS Phase 3D is an exact concatenation, without modifying selectors.

The two historic stylesheets were adjacent in the Frappe app_include_css list.
Git blob hashes lock every original byte and ensure the v4 correction's final
cascade order after the v3 popup rules.
"""
from __future__ import annotations

import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "saas_theme/public/css/global_popup_polish_v3.css"
OLD = ROOT / "saas_theme/public/css/compact_autocomplete_and_form_gap_v4.css"
HOOKS = ROOT / "saas_theme/hooks.py"
ORIGINAL_POPUP = "aee8195b5fe4235215bca72f52af2e71ad52289f"
ORIGINAL_COMPACT = "ceb450fdc34e12d8e3b5bcd08ea778d989a3b396"
BOUNDARY = b"\\n/*\\n * SaaS Theme \\xe2\\x80\\x94 Compact Autocomplete + Form Gap v4\\n"
ASSET = "/assets/saas_theme/css/global_popup_polish_v3.css?v=4"
OBSOLETE = "compact_autocomplete_and_form_gap_v4.css"


def blob_hash(content: bytes) -> str:
    prefix = b"blob " + str(len(content)).encode() + b"\\0"
    return hashlib.sha1(prefix + content).hexdigest()


def main() -> None:
    content = BUNDLE.read_bytes()
    if content.count(BOUNDARY) != 1:
        raise SystemExit("Phase 3D: CSS v4 boundary missing or duplicated")
    first, rest = content.split(BOUNDARY)
    second = BOUNDARY[1:] + rest
    if blob_hash(first) != ORIGINAL_POPUP:
        raise SystemExit("Phase 3D: original popup stylesheet changed")
    if blob_hash(second) != ORIGINAL_COMPACT:
        raise SystemExit("Phase 3D: original compact stylesheet changed")
    if OLD.exists():
        raise SystemExit("Phase 3D: old compact stylesheet is still present")
    hooks_source = HOOKS.read_text()
    hooks = ast.parse(hooks_source)
    assets = next(
        ast.literal_eval(statement.value)
        for statement in hooks.body
        if isinstance(statement, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "app_include_css"
                for target in statement.targets)
    )
    if assets.count(ASSET) != 1 or any(OBSOLETE in asset for asset in assets):
        raise SystemExit("Phase 3D: incorrect CSS hook list")
    preceding = "/assets/saas_theme/css/interaction_finish_v2.css?v=2"
    following = "/assets/saas_theme/css/ui_consolidation_v7.css?v=14"
    position = assets.index(ASSET)
    if not (assets[position - 1] == preceding and assets[position + 1] == following):
        raise SystemExit("Phase 3D: final cascade asset position changed")
    js_dir = ROOT / "saas_theme/public/js"
    for path in js_dir.glob("*.js"):
        if OBSOLETE in path.read_text():
            raise SystemExit(f"Phase 3D: old CSS dynamically referenced by {path.name}")
    print("Phase 3D parity passed: exact popup + compact CSS, intact order and no old references")


if __name__ == "__main__":
    main()

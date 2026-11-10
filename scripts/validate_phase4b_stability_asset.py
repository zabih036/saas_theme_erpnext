#!/usr/bin/env python3
"""Phase 4B: rename the already consolidated stability CSS with zero behavior change.

The original CSS Git blob and the full original loader source are immutable.
Only the stability CSS URL and the separately pinned Phase 4C child-table
asset URL renames may differ from the original loader.
"""
from __future__ import annotations

import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme/public"
CSS = PUBLIC / "css/desk_stability.css"
OLD_CSS = PUBLIC / "css/stability_refinement_v3.css"
LOADER = PUBLIC / "js/user_theme_menu.js"
HOOKS = ROOT / "saas_theme/hooks.py"

CSS_ORIGINAL_SHA = "939ab1fb162ab6ad772e81397ff556d191037fef"
LOADER_ORIGINAL_SHA = "683bd5a5e0ae6dadb5e6fddae7c04e3a66937a0d"
OLD_URL = "/assets/saas_theme/css/stability_refinement_v3.css?v=3"
NEW_URL = "/assets/saas_theme/css/desk_stability.css?v=1"
LOADER_HOOK = "/assets/saas_theme/js/user_theme_menu.js?v=8"


def git_blob_sha(contents: bytes) -> str:
    prefix = b"blob " + str(len(contents)).encode("ascii") + b"\x00"
    return hashlib.sha1(prefix + contents).hexdigest()


def main() -> None:
    if OLD_CSS.exists():
        raise SystemExit("Phase 4B: old versioned stability stylesheet still exists")
    if not CSS.is_file() or git_blob_sha(CSS.read_bytes()) != CSS_ORIGINAL_SHA:
        raise SystemExit("Phase 4B: original v3+v4 CSS bundle bytes were modified")
    source = LOADER.read_bytes()
    before = OLD_URL.encode("ascii")
    after = NEW_URL.encode("ascii")
    if source.count(after) != 1 or before in source:
        raise SystemExit("Phase 4B: unexpected stability CSS late-loader references")
    # Phase 4C only renames two other asset URLs. Reverse them here to
    # preserve the original complete-source Phase 4B parity assertion.
    replacements = (
        (b"/assets/saas_theme/css/child_table_ui.css?v=1",
         b"/assets/saas_theme/css/child_table_precision_v5.css?v=1"),
        (b"/assets/saas_theme/js/child_table_ui.js?v=1",
         b"/assets/saas_theme/js/child_table_precision_v5.js?v=1"),
    )
    restored_original = source.replace(after, before)
    # Reverse the separately validated v6 foundation rename (Phase 4D).
    foundation = (
        (b"/assets/saas_theme/css/control_search_report.css?v=1",
         b"/assets/saas_theme/css/ui_precision_v6.css?v=3"),
        (b"/assets/saas_theme/js/control_search_report.js?v=1",
         b"/assets/saas_theme/js/ui_precision_v6.js?v=2"),
    )
    for current, original in foundation:
        if restored_original.count(current) != 1 or original in restored_original:
            raise SystemExit("Phase 4B: unexpected Phase 4D foundation URL changes")
        restored_original = restored_original.replace(current, original)
    for current, original in replacements:
        if restored_original.count(current) != 1 or original in restored_original:
            raise SystemExit("Phase 4B: unexpected child-table Phase 4C URL changes")
        restored_original = restored_original.replace(current, original)
    # Phase 4E renames only the final v6.2 controller URL.
    current_final = b"/assets/saas_theme/js/search_report_refinements.js?v=1"
    original_final = b"/assets/saas_theme/js/ui_precision_v6_2.js?v=2"
    if restored_original.count(current_final) != 1 or original_final in restored_original:
        raise SystemExit("Phase 4B: Phase 4E override URL changed unexpectedly")
    restored_original = restored_original.replace(current_final, original_final)
    # Phase 4F is a separately pinned one-URL rename; retain historical full-loader parity.
    current_header = b"/assets/saas_theme/js/header_profile_repair.js?v=1"
    original_header = b"/assets/saas_theme/js/ui_precision_v4.js?v=1"
    if restored_original.count(current_header) != 1 or original_header in restored_original:
        raise SystemExit("Phase 4F: unexpected header/profile late-loader URL")
    restored_original = restored_original.replace(current_header, original_header)
    if git_blob_sha(restored_original) != LOADER_ORIGINAL_SHA:
        raise SystemExit("Phase 4B: loader changed beyond the independently guarded asset URL renames")
    hooks = ast.parse(HOOKS.read_text(encoding="utf-8"))
    assets = next(
        ast.literal_eval(node.value)
        for node in hooks.body if isinstance(node, ast.Assign)
        if any(isinstance(target, ast.Name) and target.id == "app_include_js"
               for target in node.targets)
    )
    if assets.count(LOADER_HOOK) != 1 or any(
        "user_theme_menu.js" in asset and asset != LOADER_HOOK for asset in assets
    ):
        raise SystemExit("Phase 4B: user theme menu hook not cache-bumped exactly once")
    print("Phase 4B integrity passed: identical CSS bytes, loader events and timing preserved")


if __name__ == "__main__":
    main()

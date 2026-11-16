#!/usr/bin/env python3
"""Phase 4C: child-table CSS/JS are exact renames with unchanged loader behavior.

No selector, event handler, timing, DOM ID, role or interaction code may change.
The only permitted byte differences in the loader are two asset URL literals.
"""
from __future__ import annotations

import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme" / "public"
LOADER = PUBLIC / "js/user_theme_menu.js"
HOOKS = ROOT / "saas_theme/hooks.py"

CSS_SHA = "f0e5e60d64ba06418c338b44cea43ae10a4ca6c7"
JS_SHA = "ad69b9f221e1b677316b1f76cbdf64747b492fed"
PRE_PHASE_LOADER_SHA = "fdc368d1e98986d7b6b45912b37281a6723db7d8"

RENAMED = (
    ("css", "child_table_ui.css", "child_table_precision_v5.css", CSS_SHA),
    ("js", "child_table_ui.js", "child_table_precision_v5.js", JS_SHA),
)


def blob_sha(content: bytes) -> str:
    return hashlib.sha1(
        b"blob " + str(len(content)).encode("ascii") + b"\x00" + content
    ).hexdigest()


def main() -> None:
    source = LOADER.read_bytes()
    restored = source
    positions = []
    for folder, new_name, old_name, expected in RENAMED:
        current = PUBLIC / folder / new_name
        old = PUBLIC / folder / old_name
        if old.exists():
            raise SystemExit(f"Phase 4C: legacy file returned: {old_name}")
        if not current.is_file() or blob_sha(current.read_bytes()) != expected:
            raise SystemExit(f"Phase 4C: runtime content changed: {new_name}")
        current_url = f"/assets/saas_theme/{folder}/{new_name}?v=1".encode()
        original_url = f"/assets/saas_theme/{folder}/{old_name}?v=1".encode()
        if restored.count(current_url) != 1 or original_url in restored:
            raise SystemExit(f"Phase 4C: unexpected child loader URL: {new_name}")
        positions.append(restored.index(current_url))
        restored = restored.replace(current_url, original_url)


    # Phase 4D only renames the adjacent v6 foundation CSS and JS URLs.
    # Undo those changes too before verifying the complete Phase 4C loader.
    for current, original in (
        (b"/assets/saas_theme/css/control_search_report.css?v=1",
         b"/assets/saas_theme/css/ui_precision_v6.css?v=3"),
        (b"/assets/saas_theme/js/control_search_report.js?v=1",
         b"/assets/saas_theme/js/ui_precision_v6.js?v=2"),
    ):
        if restored.count(current) != 1 or original in restored:
            raise SystemExit("Phase 4C: unexpected Phase 4D foundation URL changes")
        restored = restored.replace(current, original)
    if positions != sorted(positions):
        raise SystemExit("Phase 4C: CSS must load before JS in the original position")
    # Phase 4E only changes the name of the final v6.2 controller.
    override = b"/assets/saas_theme/js/search_report_refinements.js?v=1"
    original_override = b"/assets/saas_theme/js/ui_precision_v6_2.js?v=2"
    if restored.count(override) != 1 or original_override in restored:
        raise SystemExit("Phase 4C: Phase 4E override reference changed")
    restored = restored.replace(override, original_override)
    # Phase 4F is a separately pinned one-URL rename; retain historical full-loader parity.
    current_header = b"/assets/saas_theme/js/header_profile_repair.js?v=1"
    original_header = b"/assets/saas_theme/js/ui_precision_v4.js?v=1"
    if restored.count(current_header) != 1 or original_header in restored:
        raise SystemExit("Phase 4F: unexpected header/profile late-loader URL")
    restored = restored.replace(current_header, original_header)
    if blob_sha(restored) != PRE_PHASE_LOADER_SHA:
        raise SystemExit("Phase 4C: loader script changed beyond the exact two URLs")
    # Existing v5 tags, selectors, duplicate-init guard and event namespaces
    # are deliberately retained even though the *filenames* are modernized.
    for marker in (
        b'st-child-table-precision-v5-css',
        b'st-child-table-precision-v5-js',
        b'load_child_table_precision_v5_assets',
    ):
        if marker not in source:
            raise SystemExit("Phase 4C: original loader DOM contract was altered")

    tree = ast.parse(HOOKS.read_text(encoding="utf-8"))
    hooks = next(
        ast.literal_eval(node.value)
        for node in tree.body if isinstance(node, ast.Assign)
        if any(isinstance(target, ast.Name) and target.id == "app_include_js"
               for target in node.targets)
    )
    hook_url = "/assets/saas_theme/js/user_theme_menu.js?v=8"
    if hooks.count(hook_url) != 1:
        raise SystemExit("Phase 4C: user-theme loader hook/cache version changed")
    for folder, new_name, old_name, _ in RENAMED:
        for url in hooks:
            if new_name in url or old_name in url:
                raise SystemExit("Phase 4C: child assets must remain late-loaded")
        for file in (PUBLIC / "js").glob("*.js"):
            if file == LOADER:
                continue
            if f"/assets/saas_theme/{folder}/{old_name}" in file.read_text(encoding="utf-8"):
                raise SystemExit(f"Phase 4C: stale asset URL in {file.name}")
    print("Phase 4C passed: byte-identical CSS/JS and exact late-loader event/timing parity")


if __name__ == "__main__":
    main()

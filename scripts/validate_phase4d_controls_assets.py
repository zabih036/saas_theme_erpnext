#!/usr/bin/env python3
"""Phase 4D: verify the v6 control/search/report foundation was *renamed*, not rewritten.

v6.2 is deliberately unchanged: it owns the final inline-search and report
geometry overrides. This test also pins the full pre-migration user-menu
loader and ensures exactly two asset URL literals were updated.
"""
from __future__ import annotations

import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme/public"
LOADER = PUBLIC / "js/user_theme_menu.js"
HOOKS = ROOT / "saas_theme/hooks.py"

CSS_SHA = "d0ee21298e5bee2c819684c32cd73112a574fe5b"
JS_SHA = "af862e2b90581a3c8c488723a3aefcaa494514ae"
PRE_PHASE_LOADER_SHA = "291afc3ec1874d6546df6344b0ed2f4868a05a57"

RENAMED = (
    ("css", "control_search_report.css", "ui_precision_v6.css", 3, CSS_SHA),
    ("js", "control_search_report.js", "ui_precision_v6.js", 2, JS_SHA),
)


def git_blob_sha(content: bytes) -> str:
    return hashlib.sha1(
        b"blob " + str(len(content)).encode("ascii") + b"\x00" + content
    ).hexdigest()


def main() -> None:
    source = LOADER.read_bytes()
    restored = source
    positions = []
    for folder, new_name, old_name, old_version, expected in RENAMED:
        file = PUBLIC / folder / new_name
        obsolete = PUBLIC / folder / old_name
        if obsolete.exists():
            raise SystemExit(f"Phase 4D: obsolete versioned asset exists: {old_name}")
        if not file.is_file() or git_blob_sha(file.read_bytes()) != expected:
            raise SystemExit(f"Phase 4D: renamed asset content changed: {new_name}")
        current_url = f"/assets/saas_theme/{folder}/{new_name}?v=1".encode()
        original_url = f"/assets/saas_theme/{folder}/{old_name}?v={old_version}".encode()
        if restored.count(current_url) != 1 or original_url in restored:
            raise SystemExit(f"Phase 4D: loader URL replacement is not exact: {new_name}")
        positions.append(restored.index(current_url))
        restored = restored.replace(current_url, original_url)

    if positions != sorted(positions):
        raise SystemExit("Phase 4D: v6 CSS must still precede the v6 JS controller")
    if git_blob_sha(restored) != PRE_PHASE_LOADER_SHA:
        raise SystemExit("Phase 4D: user-theme loader changed beyond the two asset URLs")

    # Existing DOM IDs, controller initialization, async order and v6.2 loader
    # are unchanged. Renaming those IDs risks duplicating runtime controllers.
    for marker in (
        b"st-ui-precision-v6-css",
        b"st-ui-precision-v6-js",
        b"load_ui_precision_v6_assets",
        b"/assets/saas_theme/js/ui_precision_v6_2.js?v=2",
    ):
        if marker not in source:
            raise SystemExit("Phase 4D: original loader identity or v6.2 order changed")
    css_pos, js_pos = positions
    v62_pos = source.find(b"/assets/saas_theme/js/ui_precision_v6_2.js?v=2")
    if not (css_pos < js_pos < v62_pos):
        raise SystemExit("Phase 4D: the v6.2 final override no longer loads last")

    hooks = ast.parse(HOOKS.read_text(encoding="utf-8"))
    app_js = next(
        ast.literal_eval(node.value)
        for node in hooks.body if isinstance(node, ast.Assign)
        if any(isinstance(t, ast.Name) and t.id == "app_include_js"
               for t in node.targets)
    )
    loader_url = "/assets/saas_theme/js/user_theme_menu.js?v=6"
    if app_js.count(loader_url) != 1:
        raise SystemExit("Phase 4D: the user-theme loader hook/cache URL is incorrect")
    for folder, name, old, _, _ in RENAMED:
        if any(name in item or old in item for item in app_js):
            raise SystemExit("Phase 4D: late-loaded v6 files must not move into hooks")
        for script in (PUBLIC / "js").glob("*.js"):
            if script != LOADER and f"/assets/saas_theme/{folder}/{old}" in script.read_text():
                raise SystemExit(f"Phase 4D: stale v6 asset injection in {script.name}")

    print("Phase 4D passed: exact CSS/JS blobs, unchanged loader and v6 -> v6.2 order")


if __name__ == "__main__":
    main()

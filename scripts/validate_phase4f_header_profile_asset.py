#!/usr/bin/env python3
"""Phase 4F: exact rename-only migration for the late header/profile controller.

Protect the original JavaScript Git blob and the complete original late-loader
blob; only one versioned asset URL may change. Runtime IDs/event namespaces
must remain untouched so duplicate controller instances cannot appear.
"""
from __future__ import annotations

import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme/public"
NEW = PUBLIC / "js/header_profile_repair.js"
OLD = PUBLIC / "js/ui_precision_v4.js"
LOADER = PUBLIC / "js/user_theme_menu.js"
HOOKS = ROOT / "saas_theme/hooks.py"

ORIGINAL_JS_SHA = "65ad6b740bf1e0f998a08839f7e63230a27a08d5"
ORIGINAL_LOADER_SHA = "388d147d34ce5a73f3527e22121a4b8411499b69"
OLD_URL = "/assets/saas_theme/js/ui_precision_v4.js?v=1"
NEW_URL = "/assets/saas_theme/js/header_profile_repair.js?v=1"
LOADER_HOOK = "/assets/saas_theme/js/user_theme_menu.js?v=8"


def blob_sha(data: bytes) -> str:
    return hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\x00" + data
    ).hexdigest()


def main() -> None:
    if OLD.exists():
        raise SystemExit("Phase 4F: obsolete header/profile JS file returned")
    if not NEW.is_file() or blob_sha(NEW.read_bytes()) != ORIGINAL_JS_SHA:
        raise SystemExit("Phase 4F: original header/profile JavaScript changed")
    js = NEW.read_bytes()
    for marker in (
        b"__saas_theme_ui_precision_v4__",
        b"function ensure_profile($head)",
        b"function bind_profile_menu($profile, $button)",
        b"function setup_observer()",
        b'"page-change.saas_ui_precision_v4',
        b"setTimeout(repair_headers, 100)",
        b"setTimeout(repair_headers, 350)",
        b"frappe.app?.sidebar",
    ):
        if marker not in js:
            raise SystemExit(f"Phase 4F: original controller contract missing {marker!r}")

    loader = LOADER.read_bytes()
    old_url, new_url = OLD_URL.encode(), NEW_URL.encode()
    if loader.count(new_url) != 1 or old_url in loader:
        raise SystemExit("Phase 4F: expected one URL-only change in menu loader")
    if blob_sha(loader.replace(new_url, old_url)) != ORIGINAL_LOADER_SHA:
        raise SystemExit("Phase 4F: user-theme loader changed beyond the one URL")
    if b"st-ui-precision-v4-js" not in loader:
        raise SystemExit("Phase 4F: original DOM injection ID changed")
    stable_js = loader.find(b"/assets/saas_theme/js/stability_refinement_v3.js?v=2")
    header_js = loader.find(new_url)
    child_css = loader.find(b"/assets/saas_theme/css/child_table_ui.css?v=1")
    if not (0 <= stable_js < header_js < child_css):
        raise SystemExit("Phase 4F: original late-injection order changed")
    hooks = ast.parse(HOOKS.read_text(encoding="utf-8"))
    values = next(
        ast.literal_eval(node.value)
        for node in hooks.body if isinstance(node, ast.Assign)
        if any(isinstance(t, ast.Name) and t.id == "app_include_js"
               for t in node.targets)
    )
    if values.count(LOADER_HOOK) != 1 or any(
        "user_theme_menu.js" in url and url != LOADER_HOOK for url in values
    ):
        raise SystemExit("Phase 4F: loader cache key not updated exactly once")
    if any("header_profile_repair.js" in url or "ui_precision_v4.js" in url for url in values):
        raise SystemExit("Phase 4F: header repair must remain late loaded, not hook loaded")

    for other in (PUBLIC / "js").glob("*.js"):
        if other == LOADER:
            continue
        if OLD_URL in other.read_text(encoding="utf-8"):
            raise SystemExit(f"Phase 4F: stale old JS URL in {other.name}")
    print("Phase 4F passed: byte-identical controller, one URL-only loader change, original load order")


if __name__ == "__main__":
    main()

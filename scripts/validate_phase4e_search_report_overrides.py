#!/usr/bin/env python3
"""Phase 4E: final inline-search/Query Report corrections, exact filename migration.

The final v6.2 CSS is an identical rename. The JS must hash to the exact
original Git blob after reversing only its two self-loaded CSS URLs.
The user-theme loader must hash to the exact pre-Phase-4E Git blob after
reversing only the final override script URL. Runtime guards and order stay.
"""
from __future__ import annotations

import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme/public"
HOOKS = ROOT / "saas_theme/hooks.py"
LOADER = PUBLIC / "js/user_theme_menu.js"

CSS_SHA = "1df7506690a3216642dd4aa2029120a35043fa84"
JS_ORIGINAL_SHA = "2dcba7a93507de89a3189c71856940cf62dbee16"
LOADER_ORIGINAL_SHA = "9a1913ecc0dc61a7d53dd08360a5e32c7e7da452"

CSS_CURRENT = "/assets/saas_theme/css/search_report_refinements.css?v=1"
CSS_PREVIOUS = "/assets/saas_theme/css/ui_precision_v6_2.css?v=3"
JS_CURRENT = "/assets/saas_theme/js/search_report_refinements.js?v=1"
JS_PREVIOUS = "/assets/saas_theme/js/ui_precision_v6_2.js?v=2"
HOOK_URL = "/assets/saas_theme/js/user_theme_menu.js?v=7"


def blob_sha(data: bytes) -> str:
    return hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\x00" + data
    ).hexdigest()


def main() -> None:
    css_path = PUBLIC / "css/search_report_refinements.css"
    js_path = PUBLIC / "js/search_report_refinements.js"
    for filename in ("ui_precision_v6_2.css", "ui_precision_v6_2.js"):
        folder = "css" if filename.endswith(".css") else "js"
        if (PUBLIC / folder / filename).exists():
            raise SystemExit(f"Phase 4E: old filename still exists: {filename}")
    if not css_path.is_file() or blob_sha(css_path.read_bytes()) != CSS_SHA:
        raise SystemExit("Phase 4E: original final v6.2 stylesheet bytes changed")
    js = js_path.read_bytes()
    current_css, previous_css = CSS_CURRENT.encode(), CSS_PREVIOUS.encode()
    if js.count(current_css) != 2 or previous_css in js:
        raise SystemExit("Phase 4E: two v6.2 CSS loader branches were altered")
    original_js = js.replace(current_css, previous_css)
    if blob_sha(original_js) != JS_ORIGINAL_SHA:
        raise SystemExit("Phase 4E: JS changed beyond the two CSS URL literals")
    # The existing-link and newly-created-link branches must use the same
    # stable element ID to avoid two active copies of the v6.2 corrections.
    for marker in (
        b"st-ui-precision-v6-2-css",
        b"__saas_theme_ui_precision_v6_2_fix__",
        b"function restore_native_filter_geometry(",
        b"function load_css()",
    ):
        if marker not in js:
            raise SystemExit(f"Phase 4E: critical runtime contract missing: {marker!r}")
    source = LOADER.read_bytes()
    final_current, final_old = JS_CURRENT.encode(), JS_PREVIOUS.encode()
    if source.count(final_current) != 1 or final_old in source:
        raise SystemExit("Phase 4E: top-level late-loader URL changed unexpectedly")
    if blob_sha(source.replace(final_current, final_old)) != LOADER_ORIGINAL_SHA:
        raise SystemExit("Phase 4E: user theme loader changed beyond the JS URL literal")
    for marker in (b"st-ui-precision-v6-2-js", b"load_ui_precision_v6_2_assets"):
        if marker not in source:
            raise SystemExit("Phase 4E: original v6.2 loader IDs changed")
    foundation = source.find(b"/assets/saas_theme/js/control_search_report.js?v=1")
    override = source.find(final_current)
    if not (0 <= foundation < override):
        raise SystemExit("Phase 4E: final v6.2 override no longer follows v6 foundation")

    hooks = ast.parse(HOOKS.read_text(encoding="utf-8"))
    app_include_js = next(
        ast.literal_eval(node.value)
        for node in hooks.body if isinstance(node, ast.Assign)
        if any(isinstance(t, ast.Name) and t.id == "app_include_js"
               for t in node.targets)
    )
    if app_include_js.count(HOOK_URL) != 1 or any(
        JS_CURRENT in url or JS_PREVIOUS in url for url in app_include_js
    ):
        raise SystemExit("Phase 4E: final override must remain late-loaded")
    print("Phase 4E passed: CSS exact, JS 2-URL-only, loader 1-URL-only, v6->v6.2 order intact")


if __name__ == "__main__":
    main()

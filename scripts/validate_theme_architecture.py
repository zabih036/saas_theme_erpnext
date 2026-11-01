#!/usr/bin/env python3
"""Validate the SaaS theme runtime architecture without importing Frappe.

The validator protects the current working theme while allowing deliberate,
staged cleanup migrations. Asset order remains explicit because late precision
layers and compatibility controllers still affect runtime behavior.
"""

from __future__ import annotations

import ast
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
HOOKS = ROOT / "saas_theme" / "hooks.py"
PUBLIC = ROOT / "saas_theme" / "public"

EXPECTED_DESK_CSS = [
    "/assets/saas_theme/css/saas_theme.css?v=64",
    "/assets/saas_theme/css/professional_ui.css?v=1",
    "/assets/saas_theme/css/form_controls.css?v=1",
    "/assets/saas_theme/css/form_navigation.css?v=1",
    "/assets/saas_theme/css/list_view.css?v=1",
    "/assets/saas_theme/css/home.css?v=1",
    "/assets/saas_theme/css/brand_shell.css?v=1",
    "/assets/saas_theme/css/form_palette.css?v=1",
    "/assets/saas_theme/css/palette_refinement.css?v=1",
    "/assets/saas_theme/css/ui_finish.css?v=1",
    "/assets/saas_theme/css/interface_refinement.css?v=1",
    "/assets/saas_theme/css/mobile_shell.css?v=1",
    "/assets/saas_theme/css/workspace_shell_polish.css?v=1",
    "/assets/saas_theme/css/dark_mode_refinement.css?v=1",
    "/assets/saas_theme/css/dark_surface_fix.css?v=2",
    "/assets/saas_theme/css/desktop_navbar_refinement.css?v=1",
    "/assets/saas_theme/css/tree_view_refinement.css?v=1",
    "/assets/saas_theme/css/home_clarity_refinement.css?v=1",
    "/assets/saas_theme/css/control_precision_fix.css?v=1",
    "/assets/saas_theme/css/exact_ui_followup.css?v=1",
    "/assets/saas_theme/css/final_precision_v2.css?v=1",
    "/assets/saas_theme/css/form_experience_refinement.css?v=1",
    "/assets/saas_theme/css/professional_form_card_fix.css?v=1",
    "/assets/saas_theme/css/grid_and_action_alignment.css?v=1",
    "/assets/saas_theme/css/report_and_form_shell.css?v=1",
    "/assets/saas_theme/css/child_row_editor_finish.css?v=1",
    "/assets/saas_theme/css/overlay_stacking_fix.css?v=2",
    "/assets/saas_theme/css/overlay_stacking_v3.css?v=1",
    "/assets/saas_theme/css/interaction_finish_v2.css?v=2",
    "/assets/saas_theme/css/global_popup_polish_v3.css?v=3",
    "/assets/saas_theme/css/compact_autocomplete_and_form_gap_v4.css?v=4",
]

EXPECTED_DESK_JS = [
    "/assets/saas_theme/js/saas_theme.js?v=64",
    "/assets/saas_theme/js/professional_ui.js?v=1",
    "/assets/saas_theme/js/home_dashboard.js?v=1",
    "/assets/saas_theme/js/home_analytics.js?v=1",
    "/assets/saas_theme/js/brand_shell.js?v=1",
    "/assets/saas_theme/js/ui_finish.js?v=1",
    "/assets/saas_theme/js/route_loader.js?v=1",
    "/assets/saas_theme/js/mobile_shell.js?v=2",
    "/assets/saas_theme/js/workspace_shell_polish.js?v=1",
    "/assets/saas_theme/js/final_shell_cleanup.js?v=2",
    "/assets/saas_theme/js/user_theme_menu.js?v=1",
    "/assets/saas_theme/js/form_sidebar_persistence.js?v=2",
    "/assets/saas_theme/js/quick_access_preferences.js?v=1",
    "/assets/saas_theme/js/interaction_finish_v2.js?v=2",
]

EXPECTED_WEB_CSS = "/assets/saas_theme/css/login_refinement.css?v=3"
EXPECTED_WEB_JS = [
    "/assets/saas_theme/js/route_loader.js?v=2",
    "/assets/saas_theme/js/login_fix.js?v=2",
]

KNOWN_CSS_FILES = {
    "brand_shell.css",
    "child_row_editor_finish.css",
    "child_table_precision_v5.css",
    "compact_autocomplete_and_form_gap_v4.css",
    "control_precision_fix.css",
    "dark_mode_refinement.css",
    "dark_surface_fix.css",
    "desktop_navbar_refinement.css",
    "exact_ui_followup.css",
    "final_precision_v2.css",
    "form_controls.css",
    "form_experience_refinement.css",
    "form_navigation.css",
    "form_palette.css",
    "global_popup_polish_v3.css",
    "grid_and_action_alignment.css",
    "home.css",
    "home_clarity_refinement.css",
    "inline_grid_link_popup_anchor_v5.css",
    "interaction_finish_v2.css",
    "interface_refinement.css",
    "list_view.css",
    "login.css",
    "login_refinement.css",
    "mobile_shell.css",
    "overlay_stacking_fix.css",
    "overlay_stacking_v3.css",
    "palette_refinement.css",
    "professional_form_card_fix.css",
    "professional_ui.css",
    "report_and_form_shell.css",
    "saas_theme.css",
    "stability_refinement_v3.css",
    "tree_view_refinement.css",
    "ui_consolidation_v7.css",
    "ui_finish.css",
    "ui_precision_v4.css",
    "ui_precision_v6.css",
    "ui_precision_v6_2.css",
    "workspace_shell_polish.css",
}

KNOWN_JS_FILES = {
    "brand_shell.js",
    "child_table_precision_v5.js",
    "final_shell_cleanup.js",
    "form_sidebar_persistence.js",
    "home_analytics.js",
    "home_dashboard.js",
    "inline_grid_link_popup_anchor_v5.js",
    "interaction_finish_v2.js",
    "login_fix.js",
    "mobile_shell.js",
    "professional_ui.js",
    "quick_access_preferences.js",
    "route_loader.js",
    "saas_theme.js",
    "stability_refinement_v3.js",
    "ui_finish.js",
    "ui_precision_v4.js",
    "ui_precision_v6.js",
    "ui_precision_v6_2.js",
    "user_theme_menu.js",
    "workspace_shell_polish.js",
}

# Phase 1 cleanup: these were explicit no-op compatibility assets. They must not
# return through a new hook or runtime loader.
RETIRED_ASSETS = {
    "child_row_editor_refinement_v65.css",
    "child_row_editor_finish.js",
    "home_dashboard.css",
    "home_analytics.css",
}

EXPECTED_LATE_ASSET_TOKENS = {
    "user_theme_menu.js": [
        "/assets/saas_theme/css/stability_refinement_v3.css?v=2",
        "/assets/saas_theme/js/stability_refinement_v3.js?v=2",
        "/assets/saas_theme/css/ui_precision_v4.css?v=1",
        "/assets/saas_theme/js/ui_precision_v4.js?v=1",
        "/assets/saas_theme/css/child_table_precision_v5.css?v=1",
        "/assets/saas_theme/js/child_table_precision_v5.js?v=1",
        "/assets/saas_theme/css/ui_precision_v6.css?v=2",
        "/assets/saas_theme/js/ui_precision_v6.js?v=2",
        "/assets/saas_theme/js/ui_precision_v6_2.js?v=1",
    ],
    "form_sidebar_persistence.js": [
        "/assets/saas_theme/css/inline_grid_link_popup_anchor_v5.css?v=5",
        "/assets/saas_theme/js/inline_grid_link_popup_anchor_v5.js?v=5",
    ],
}

REQUIRED_RUNTIME_GUARDS = {
    "interaction_finish_v2.js": [
        "__saas_theme_ui_consolidation_v7__",
        'const GRID_EDITOR_CLASS = "st-v7-grid-editor"',
        'const GRID_POPUP_CLASS = "st-v7-inline-grid-popup"',
    ],
    "inline_grid_link_popup_anchor_v5.js": [
        "__saas_theme_inline_grid_popup_width_fix_v5__",
        "function runAfterCurrentEvent()",
        'window.addEventListener("scroll", runAfterCurrentEvent',
        "Math.max(180, Math.round(rect.width))",
    ],
    "overlay_stacking_v3.css": [
        "body > .form-in-grid.st-v7-grid-editor",
        "display: block !important",
        "visibility: visible !important",
        "pointer-events: auto !important",
    ],
    "ui_consolidation_v7.css": [
        "body>.form-in-grid.st-v7-grid-editor",
        "body>.st-v7-inline-grid-popup",
        "st-v7-awesomebar-backdrop",
    ],
}


def fail(message: str) -> None:
    raise SystemExit(f"ERROR: {message}")


def literal_assignments(path: Path) -> dict[str, object]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    values: dict[str, object] = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign) or len(node.targets) != 1:
            continue
        target = node.targets[0]
        if isinstance(target, ast.Name):
            try:
                values[target.id] = ast.literal_eval(node.value)
            except (ValueError, TypeError):
                pass
    return values


def asset_file(url: str) -> Path:
    path = urlsplit(url).path
    prefix = "/assets/saas_theme/"
    if not path.startswith(prefix):
        fail(f"unexpected asset URL: {url}")
    return PUBLIC / path[len(prefix) :]


def assert_exact(label: str, actual: object, expected: object) -> None:
    if actual != expected:
        fail(
            f"{label} changed. Preserve the current exact order/value unless "
            "a dedicated migration is intended."
        )


def assert_unique(label: str, values: list[str]) -> None:
    if len(values) != len(set(values)):
        fail(f"{label} contains duplicate entries")


def validate_hooks() -> None:
    values = literal_assignments(HOOKS)
    assert_exact("app_include_css", values.get("app_include_css"), EXPECTED_DESK_CSS)
    assert_exact("app_include_js", values.get("app_include_js"), EXPECTED_DESK_JS)
    assert_exact("web_include_css", values.get("web_include_css"), EXPECTED_WEB_CSS)
    assert_exact("web_include_js", values.get("web_include_js"), EXPECTED_WEB_JS)

    assert_unique("app_include_css", EXPECTED_DESK_CSS)
    assert_unique("app_include_js", EXPECTED_DESK_JS)
    assert_unique("web_include_js", EXPECTED_WEB_JS)

    for url in [*EXPECTED_DESK_CSS, *EXPECTED_DESK_JS, EXPECTED_WEB_CSS, *EXPECTED_WEB_JS]:
        path = asset_file(url)
        if not path.is_file():
            fail(f"referenced asset does not exist: {path.relative_to(ROOT)}")


def validate_public_asset_inventory() -> None:
    actual_css = {path.name for path in (PUBLIC / "css").glob("*.css")}
    actual_js = {path.name for path in (PUBLIC / "js").glob("*.js")}

    unexpected_css = actual_css - KNOWN_CSS_FILES
    missing_css = KNOWN_CSS_FILES - actual_css
    unexpected_js = actual_js - KNOWN_JS_FILES
    missing_js = KNOWN_JS_FILES - actual_js

    if unexpected_css:
        fail(f"new/unregistered CSS files found: {sorted(unexpected_css)}")
    if missing_css:
        fail(f"known CSS files are missing: {sorted(missing_css)}")
    if unexpected_js:
        fail(f"new/unregistered JS files found: {sorted(unexpected_js)}")
    if missing_js:
        fail(f"known JS files are missing: {sorted(missing_js)}")


def validate_retired_assets() -> None:
    hooks_text = HOOKS.read_text(encoding="utf-8")
    runtime_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in sorted((PUBLIC / "js").glob("*.js"))
    )

    for filename in RETIRED_ASSETS:
        css_path = PUBLIC / "css" / filename
        js_path = PUBLIC / "js" / filename
        if css_path.exists() or js_path.exists():
            fail(f"retired compatibility asset returned: {filename}")
        if filename in hooks_text or filename in runtime_text:
            fail(f"retired compatibility asset is still referenced: {filename}")


def validate_late_loaders() -> None:
    for filename, tokens in EXPECTED_LATE_ASSET_TOKENS.items():
        text = (PUBLIC / "js" / filename).read_text(encoding="utf-8")
        positions: list[int] = []
        for token in tokens:
            position = text.find(token)
            if position < 0:
                fail(f"{filename} no longer contains required late-loader asset {token}")
            positions.append(position)
        if positions != sorted(positions):
            fail(f"{filename} late-loader asset order changed")


def validate_runtime_guards() -> None:
    for filename, tokens in REQUIRED_RUNTIME_GUARDS.items():
        folder = "css" if filename.endswith(".css") else "js"
        text = (PUBLIC / folder / filename).read_text(encoding="utf-8")
        for token in tokens:
            if token not in text:
                fail(f"{filename} is missing protected runtime behavior: {token}")


def validate_maintenance_docs() -> None:
    maintenance = ROOT / "THEME_MAINTENANCE.md"
    if not maintenance.is_file():
        fail("THEME_MAINTENANCE.md is missing")


def main() -> None:
    validate_hooks()
    validate_public_asset_inventory()
    validate_retired_assets()
    validate_late_loaders()
    validate_runtime_guards()
    validate_maintenance_docs()
    print("Theme architecture validation passed.")
    print(f"  Desk CSS assets: {len(EXPECTED_DESK_CSS)}")
    print(f"  Desk JS assets:  {len(EXPECTED_DESK_JS)}")
    print(f"  Known CSS files:  {len(KNOWN_CSS_FILES)}")
    print(f"  Known JS files:   {len(KNOWN_JS_FILES)}")
    print(f"  Retired no-op assets removed: {len(RETIRED_ASSETS)}")
    print("  PR #53 child-row visibility and popup-scroll guards: preserved")


if __name__ == "__main__":
    main()

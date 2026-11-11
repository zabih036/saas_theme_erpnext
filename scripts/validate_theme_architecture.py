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
    "/assets/saas_theme/css/form.css?v=3",
    "/assets/saas_theme/css/list_view.css?v=1",
    "/assets/saas_theme/css/home.css?v=13",
    "/assets/saas_theme/css/brand_shell.css?v=4",
    "/assets/saas_theme/css/palette.css?v=1",
    "/assets/saas_theme/css/interface.css?v=1",
    "/assets/saas_theme/css/mobile_shell.css?v=1",
    "/assets/saas_theme/css/workspace_shell_polish.css?v=1",
    "/assets/saas_theme/css/workspace_dashboard.css?v=1",
    "/assets/saas_theme/css/dark.css?v=1",
    "/assets/saas_theme/css/desktop_navbar_refinement.css?v=2",
    "/assets/saas_theme/css/tree_view_refinement.css?v=1",
    "/assets/saas_theme/css/home_clarity_refinement.css?v=1",
    "/assets/saas_theme/css/precision.css?v=1",
    "/assets/saas_theme/css/form_surface.css?v=7",
    "/assets/saas_theme/css/grid_and_action_alignment.css?v=2",
    "/assets/saas_theme/css/report_and_form_shell.css?v=1",
    "/assets/saas_theme/css/child_row_editor_finish.css?v=1",
    "/assets/saas_theme/css/overlay_layers.css?v=1",
    "/assets/saas_theme/css/interaction_finish_v2.css?v=2",
    "/assets/saas_theme/css/popup_controls.css?v=1",
    "/assets/saas_theme/css/ui_consolidation_v7.css?v=14",
    "/assets/saas_theme/css/native_dashboard_view.css?v=1",
    "/assets/saas_theme/css/workspace_dashboard_design.css?v=4",
    "/assets/saas_theme/css/native_dashboard_view_design.css?v=4",
    "/assets/saas_theme/css/workspace_sidebar_design.css?v=3",
    "/assets/saas_theme/css/desk_header_finish.css?v=3",
]

EXPECTED_DESK_JS = [
    "/assets/saas_theme/js/saas_theme.js?v=64",
    "/assets/saas_theme/js/professional_ui.js?v=1",
    "/assets/saas_theme/js/list_view.js?v=5",
    "/assets/saas_theme/js/home_dashboard.js?v=4",
    "/assets/saas_theme/js/home_analytics.js?v=13",
    "/assets/saas_theme/js/brand_shell.js?v=2",
    "/assets/saas_theme/js/ui_finish.js?v=1",
    "/assets/saas_theme/js/route_loader.js?v=1",
    "/assets/saas_theme/js/mobile_shell.js?v=2",
    "/assets/saas_theme/js/workspace_shell_polish.js?v=1",
    "/assets/saas_theme/js/final_shell_cleanup.js?v=2",
    "/assets/saas_theme/js/user_theme_menu.js?v=8",
    "/assets/saas_theme/js/form_sidebar_persistence.js?v=2",
    "/assets/saas_theme/js/quick_access_preferences.js?v=3",
    "/assets/saas_theme/js/interaction_finish_v2.js?v=10",
    "/assets/saas_theme/js/workspace_dashboard.js?v=2",
    "/assets/saas_theme/js/native_dashboard_view.js?v=4",
    "/assets/saas_theme/js/workspace_sidebar_design.js?v=4",
]

EXPECTED_WEB_CSS = "/assets/saas_theme/css/login_refinement.css?v=3"
EXPECTED_WEB_JS = [
    "/assets/saas_theme/js/route_loader.js?v=2",
    "/assets/saas_theme/js/login_fix.js?v=2",
]

KNOWN_CSS_FILES = {
    "brand_shell.css",
    "child_row_editor_finish.css",
    "child_table_ui.css",
    "precision.css",
    "dark.css",
    "desktop_navbar_refinement.css",
    "form.css",
    "form_surface.css",
    "palette.css",
    "popup_controls.css",
    "grid_and_action_alignment.css",
    "home.css",
    "home_clarity_refinement.css",
    "inline_grid_link_popup_anchor_v5.css",
    "interaction_finish_v2.css",
    "interface.css",
    "list_view.css",
    "login.css",
    "login_refinement.css",
    "mobile_shell.css",
    "overlay_layers.css",
    "professional_ui.css",
    "report_and_form_shell.css",
    "saas_theme.css",
    "desk_stability.css",
    "tree_view_refinement.css",
    "ui_consolidation_v7.css",
    "control_search_report.css",
    "search_report_refinements.css",
    "workspace_shell_polish.css",
    "workspace_dashboard.css",
    "workspace_dashboard_design.css",
    "workspace_sidebar_design.css",
    "desk_header_finish.css",
    "native_dashboard_view_design.css",
    "native_dashboard_view.css",
}

KNOWN_JS_FILES = {
    "brand_shell.js",
    "child_table_ui.js",
    "final_shell_cleanup.js",
    "form_sidebar_persistence.js",
    "home_analytics.js",
    "home_dashboard.js",
    "inline_grid_link_popup_anchor_v5.js",
    "interaction_finish_v2.js",
    "login_fix.js",
    "list_view.js",
    "mobile_shell.js",
    "professional_ui.js",
    "quick_access_preferences.js",
    "route_loader.js",
    "saas_theme.js",
    "stability_refinement_v3.js",
    "ui_finish.js",
    "header_profile_repair.js",
    "control_search_report.js",
    "search_report_refinements.js",
    "user_theme_menu.js",
    "workspace_shell_polish.js",
    "workspace_dashboard.js",
    "workspace_sidebar_design.js",
    "native_dashboard_view.js",
}

# Retired filenames from proven no-op removals or completed bundle migrations.
# They must not return through a new hook or runtime loader.
RETIRED_ASSETS = {
    "ui_precision_v4.js",
    "ui_precision_v6_2.css",
    "ui_precision_v6_2.js",
    "ui_precision_v6.css",
    "ui_precision_v6.js",
    "child_table_precision_v5.css",
    "child_table_precision_v5.js",
    "stability_refinement_v3.css",
    "global_popup_polish_v3.css",
    "overlay_stacking_fix.css",
    "overlay_stacking_v3.css",
    "compact_autocomplete_and_form_gap_v4.css",
    "form_controls.css",
    "ui_precision_v4.css",
    "form_navigation.css",
    "ui_finish.css",
    "interface_refinement.css",
    "control_precision_fix.css",
    "exact_ui_followup.css",
    "final_precision_v2.css",
    "form_experience_refinement.css",
    "professional_form_card_fix.css",
    "form_palette.css",
    "palette_refinement.css",
    "child_row_editor_refinement_v65.css",
    "child_row_editor_finish.js",
    "home_dashboard.css",
    "home_analytics.css",
    "dark_mode_refinement.css",
    "dark_surface_fix.css",
}

PROTECTED_COMPATIBILITY_FILES = {
    "css/child_row_editor_finish.css",
    "css/overlay_layers.css",
    "css/interaction_finish_v2.css",
    "css/popup_controls.css",
    "css/desk_stability.css",
    "css/child_table_ui.css",
    "css/control_search_report.css",
    "css/search_report_refinements.css",
    "css/ui_consolidation_v7.css",
    "css/inline_grid_link_popup_anchor_v5.css",
    "js/stability_refinement_v3.js",
    "js/header_profile_repair.js",
    "js/child_table_ui.js",
    "js/control_search_report.js",
    "js/search_report_refinements.js",
    "js/interaction_finish_v2.js",
    "js/inline_grid_link_popup_anchor_v5.js",
}

EXPECTED_LATE_ASSET_TOKENS = {
    "user_theme_menu.js": [
        "/assets/saas_theme/css/desk_stability.css?v=1",
        "/assets/saas_theme/js/stability_refinement_v3.js?v=2",
        "/assets/saas_theme/js/header_profile_repair.js?v=1",
        "/assets/saas_theme/css/child_table_ui.css?v=1",
        "/assets/saas_theme/js/child_table_ui.js?v=1",
        "/assets/saas_theme/css/control_search_report.css?v=1",
        "/assets/saas_theme/js/control_search_report.js?v=1",
        "/assets/saas_theme/js/search_report_refinements.js?v=1",
    ],
    "form_sidebar_persistence.js": [
        "/assets/saas_theme/css/inline_grid_link_popup_anchor_v5.css?v=5",
        "/assets/saas_theme/js/inline_grid_link_popup_anchor_v5.js?v=5",
    ],
}

REQUIRED_RUNTIME_GUARDS = {
    "desk_stability.css": [
        "SaaS Theme — Stability Refinement v3",
        "SaaS Theme — UI Precision v4",
        ".form-layout.st-section-card-form",
    ],
    "native_dashboard_view.css": [
        ".dashboard-page .dashboard-view",
        ".widget.number-widget-box",
        ".widget.dashboard-widget-box",
        ".report-summary",
        ".summary-item",
        ".chart-legend",
        '[data-theme="dark"]',
        '@media (max-width: 767px)',
        '@media (prefers-reduced-motion: reduce)',
    ],
    "desk_header_finish.css": [
        ".page-head .st-page-utility-actions",
        ".desktop-navbar .search-widget-wrapper",
        "body #full-search-button",
        "position: sticky !important;",
        ".st-top-notification-button",
        ".st-top-profile-button",
        '.desktop-avatar',
        '@media (max-width: 767px)',
        '[data-theme="dark"]',
    ],
    "workspace_sidebar_design.css": [
        ".body-sidebar-container.st-sidebar-modern",
        ".st-sidebar-search-control",
        ".st-sidebar-search-dropdown",
        ".st-sidebar-search-option",
        "width: min(430px",
        ".sidebar-item-container.section-item",
        ".standard-sidebar-item.active-sidebar",
        "st-sidebar-search-available",
        '@media (max-width: 767px)',
        '[data-theme="dark"]',
    ],
    "workspace_sidebar_design.js": [
        "__st_sidebar_awesomebar_search_v4__",
        "plainLabel",
        "form-refresh.st_sidebar_modern",
        "state.sidebar !== sidebar",
        "get_frequent_links", "get_recent_pages", "get_executables",
        "stopImmediatePropagation",
        "makeSearch(panel)",
        "st-sidebar-search-dropdown",
        "get_global_results",
        "get_doctypes",
        "st-sidebar-search-available",
        "MutationObserver",
    ],
    "workspace_dashboard_design.css": [
        '[data-page-route="Workspaces"]',
        ".widget.number-widget-box.st-ws-kpi-v2",
        ".st-ws-kpi-featured",
        ".st-ws-kpi-wave",
        ".widget.shortcut-widget-box.st-ws-shortcut-v2",
        ".widget.dashboard-widget-box.st-ws-chart-v2",
        '@media (max-width: 767px)',
    ],
    "native_dashboard_view_design.css": [
        "#page-dashboard-view .dashboard",
        ".dashboard-graph > .widget-group:first-child",
        ".widget.number-widget-box.st-dv-kpi-v2",
        ".st-dv-kpi-featured",
        ".st-dv-kpi-wave",
        ".widget.dashboard-widget-box.st-dv-chart-v2",
        "> .report-summary",
        '@media (max-width: 767px)',
    ],
    "workspace_dashboard.js": [
        "__st_workspace_card_design_v2__",
        "function enhance()",
        "MutationObserver",
        "st-ws-kpi-featured",
        "st-ws-kpi-icon",
    ],
    "native_dashboard_view.js": [
        "__st_dashboard_view_design_v2__",
        'const ROOT = "#page-dashboard-view .dashboard";',
        'route[0] !== "dashboard-view"',
        "widget.dashboard-widget-box",
        "function enhance()",
        "MutationObserver",
        "st-dv-kpi-featured",
        "st-dv-kpi-icon",
    ],
    "workspace_dashboard.css": [
        '[data-page-route="Workspaces"]',
        '.widget.number-widget-box',
        '.widget.shortcut-widget-box',
        '.widget.dashboard-widget-box',
        '.widget.links-widget-box',
        '.widget.quick-list-widget-box',
        '[data-theme="dark"]',
        '@media (max-width: 767px)',
        '@media (prefers-reduced-motion: reduce)',
    ],
    "brand_shell.css": [
        "DESKTOP SIDEBAR HEADER — ALIGN WITH PAGE HEADER ACTION ROW",
        "@media (min-width: 768px)",
        "padding-top: 6px !important",
        "min-height: 44px !important",
        ".body-sidebar .sidebar-header .title-container",
    ],
    "popup_controls.css": [
        "SaaS Theme — Global Popup Polish v3",
        "SaaS Theme — Compact Autocomplete + Form Gap v4",
    ],
    "grid_and_action_alignment.css": [
        "PAGE-HEAD SURFACE + ACTION ALIGNMENT",
        "background: #FFFFFF !important",
        "0 4px 12px rgba(20, 33, 61, .045) !important",
        "[data-theme=\"dark\"] .page-head",
    ],
    "list_view.js": [
        "__saas_theme_list_filter_visibility_v5__",
        'const BUTTON_OWNER = "v5-native-page"',
        "const list = window.cur_list;",
        'String(list.doctype) !== String(route[1])',
        'list.page.add_action_icon(',
        '"filter",',
        'list.page.hide_form();',
        'list.page.show_form();',
        'list.page.page_form.hasClass("st-list-filters-collapsed")',
        '$button.insertAfter($reload)',
    ],
    "header_profile_repair.js": [
        "__saas_theme_ui_precision_v4__",
        "function ensure_profile($head)",
        "function bind_profile_menu($profile, $button)",
        "function setup_observer()",
        "setTimeout(repair_headers, 100);",
        "setTimeout(repair_headers, 350);",
        "page-change.saas_ui_precision_v4",
    ],
    "stability_refinement_v3.js": [
        "__saas_theme_stability_v3__",
        "function patch_sidebar_scroll_helpers()",
        "function release_stale_scroll_lock()",
        "function classify_form_layouts()",
        "function repair_page_header()",
        "function refresh_delayed_surfaces()",
        "setTimeout(refresh_delayed_surfaces, 90);",
        "setTimeout(refresh_delayed_surfaces, 320);",
        "saas_stability_v3",
    ],
    "interaction_finish_v2.js": [
        "__saas_theme_ui_consolidation_v7__",
        'const GRID_EDITOR_CLASS = "st-v7-grid-editor"',
        'const GRID_POPUP_CLASS = "st-v7-inline-grid-popup"',
        "/assets/saas_theme/css/ui_consolidation_v7.css?v=14",
        'href*="/assets/saas_theme/css/ui_consolidation_v7.css"',
    ],
    "inline_grid_link_popup_anchor_v5.js": [
        "__saas_theme_inline_grid_popup_width_fix_v5__",
        "function runAfterCurrentEvent()",
        'window.addEventListener("scroll", runAfterCurrentEvent',
        "Math.max(180, Math.round(rect.width))",
    ],
    "overlay_layers.css": [
        "SaaS Theme — Overlay / Stacking Context Fix v2",
        "SaaS Theme — Overlay / Stacking Context Fix v3",
        "body > .form-in-grid.st-v7-grid-editor",
        "display: block !important",
        "visibility: visible !important",
        "pointer-events: auto !important",
    ],
    "ui_consolidation_v7.css": [
        "body>.form-in-grid.st-v7-grid-editor",
        "body>.st-v7-inline-grid-popup",
        "st-v7-awesomebar-backdrop",
        "Expanded child-row Link actions: keep Frappe's native show/hide contract",
        "body > .form-in-grid:is(.st-v7-grid-editor, .st-grid-row-portal) .link-field .link-btn",
        ".link-btn:not([style*=\"display\"])",
        ".link-btn > a[style*=\"display: none\"]",
        "stroke: currentColor !important",

        "AUTHORITATIVE FINAL FORM TABS V13",
        "form-tabs::after",
        "min-height: 0 !important",
        "padding: 8px 18px 0 !important",
        "font-size: 14px",
        "border-bottom: 0 !important",
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


def validate_protected_compatibility_files() -> None:
    for relative in sorted(PROTECTED_COMPATIBILITY_FILES):
        path = PUBLIC / relative
        if not path.is_file():
            fail(f"protected compatibility file is missing: {relative}")


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
    validate_protected_compatibility_files()
    validate_runtime_guards()
    validate_maintenance_docs()
    print("Theme architecture validation passed.")
    print(f"  Desk CSS assets: {len(EXPECTED_DESK_CSS)}")
    print(f"  Desk JS assets:  {len(EXPECTED_DESK_JS)}")
    print(f"  Known CSS files:  {len(KNOWN_CSS_FILES)}")
    print(f"  Known JS files:   {len(KNOWN_JS_FILES)}")
    print(f"  Retired asset filenames blocked: {len(RETIRED_ASSETS)}")
    print(f"  Protected compatibility files: {len(PROTECTED_COMPATIBILITY_FILES)}")
    print("  Phase 2 safe mechanical cleanup: complete")
    print("  PR #53 child-row visibility and popup-scroll guards: preserved")


if __name__ == "__main__":
    main()

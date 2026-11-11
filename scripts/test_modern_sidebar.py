#!/usr/bin/env python3
"""Protect compact Workspace KPI sizing and modern Desk sidebar search.

This is static because the production navigation uses Frappe's native
Sidebar and SearchDialog; a companion Node VM smoke test checks lifecycle.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css/workspace_sidebar_design.css"
JS = ROOT / "saas_theme/public/js/workspace_sidebar_design.js"
WORKSPACE = ROOT / "saas_theme/public/css/workspace_dashboard_design.css"
HOOKS = ROOT / "saas_theme/hooks.py"
ARCH = ROOT / "scripts/validate_theme_architecture.py"
PREFIX = "/assets/saas_theme/"


def main() -> None:
    sidebar_css = CSS.read_text(encoding="utf-8")
    sidebar_js = JS.read_text(encoding="utf-8")
    workspace_css = WORKSPACE.read_text(encoding="utf-8")

    # Nav CSS intentionally never targets Form-sidebars, custom Home analytics,
    # or native Dashboard view charts.
    for marker in (
        ".body-sidebar-container.st-sidebar-modern",
        ".st-sidebar-search-control",
        ".sidebar-items > .sidebar-item-container",
        ".sidebar-item-container.section-item",
        ".section-break",
        ".standard-sidebar-item.active-sidebar",
        ".body-sidebar-bottom",
        "body.st-sidebar-search-available .desktop-navbar",
        '@media (min-width: 768px)',
        '@media (max-width: 767px)',
        '[data-theme="dark"]',
        '@media (prefers-reduced-motion: reduce)',
        ".st-sidebar-search-shortcut",
    ):
        assert marker in sidebar_css, "Missing sidebar owner: " + marker
    for forbidden in (
        ".form-sidebar", ".st-home-dashboard", "#page-dashboard-view",
        ".widget.dashboard-widget-box", ".widget.number-widget-box",
        ".chart-container", ".search-dialog",
    ):
        assert forbidden not in sidebar_css, "Sidebar CSS leaked into " + forbidden

    for marker in (
        "__st_modern_sidebar_v1__",
        'const ROOT = ".body-sidebar-container";',
        "searchdialog?.search",
        "open_global_search_dialog()",
        "ensureSearch(panel)",
        'sidebar.querySelector(":scope > .sidebar-header")',
        "standard-items-band",
        "st-sidebar-search-available",
        "sidebar-expand.st_sidebar_modern",
        "MutationObserver",
        "event.key !== \"/\"",
        "isContentEditable",
        "aria-label",
    ):
        assert marker in sidebar_js, "Sidebar lifecycle missing " + marker
    for forbidden in (
        "frappe.call(", "frappe.set_route(", "frappe.route_options",
        "localStorage.", "innerHTML = label(",
        "addEventListener(\"input\",",
        "replaceChild(", "removeChild(",
    ):
        assert forbidden not in sidebar_js, "Sidebar modified unrelated navigation: " + forbidden

    # Compact KPI controls must not affect chart heights or native Dashboard.
    assert re.search(
        r"\.widget\.number-widget-box\.st-ws-kpi-v2\s*\{[^}]*"
        r"min-height:\s*120px\s*!important;\s*height:\s*120px\s*!important;",
        workspace_css, flags=re.S
    ), "Workspace KPI is still oversized"
    assert "min-height: 60px !important;" in workspace_css
    assert "height: 60px !important;" in workspace_css
    assert "height: 120px !important;" in workspace_css
    assert '[data-page-route="Workspaces"]' in workspace_css
    assert ".st-ws-chart-v2" in workspace_css
    assert "#page-dashboard-view" not in workspace_css

    obj = ast.parse(HOOKS.read_text(encoding="utf-8"))
    hooks = {}
    for node in obj.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in (
                    "app_include_css", "app_include_js"
                ):
                    hooks[target.id] = ast.literal_eval(node.value)
    css_urls = hooks["app_include_css"]
    js_urls = hooks["app_include_js"]
    ws_url = PREFIX + "css/workspace_dashboard_design.css?v=4"
    nav_url = PREFIX + "css/workspace_sidebar_design.css?v=1"
    js_url = PREFIX + "js/workspace_sidebar_design.js?v=1"
    assert css_urls[-3:] == [
        ws_url,
        PREFIX + "css/native_dashboard_view_design.css?v=4",
        nav_url,
    ], "Sidebar CSS must follow older precision/navigation CSS"
    assert js_urls[-2:] == [
        PREFIX + "js/native_dashboard_view.js?v=4",
        js_url,
    ], "Sidebar JS must load after the existing shell owners"
    assert css_urls.count(nav_url) == 1 and js_urls.count(js_url) == 1
    assert css_urls.count(ws_url) == 1
    manifest = ARCH.read_text(encoding="utf-8")
    for filename in (
        "workspace_sidebar_design.css",
        "workspace_sidebar_design.js",
        "workspace_dashboard_design.css?v=4",
    ):
        assert filename in manifest, "Architecture manifest missing " + filename
    print("Modern sidebar passed: native search API, safe scoping, collapsed/mobile,"
          " dark/RTL support, compact Workspace cards and final asset priority.")


if __name__ == "__main__":
    main()

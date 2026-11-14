#!/usr/bin/env python3
"""Protect v2 inline Sidebar dropdown, final navbar and existing Workspaces."""
from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css/workspace_sidebar_design.css"
JS = ROOT / "saas_theme/public/js/workspace_sidebar_design.js"
HEADER = ROOT / "saas_theme/public/css/desk_header_finish.css"
WORKSPACE = ROOT / "saas_theme/public/css/workspace_dashboard_design.css"
HOOKS = ROOT / "saas_theme/hooks.py"
ARCH = ROOT / "scripts/validate_theme_architecture.py"
P = "/assets/saas_theme/"

def main() -> None:
    nav_css = CSS.read_text(encoding="utf-8")
    nav_js = JS.read_text(encoding="utf-8")
    header = HEADER.read_text(encoding="utf-8")
    workspace = WORKSPACE.read_text(encoding="utf-8")
    for marker in (
        ".body-sidebar-container.st-sidebar-modern",
        ".st-sidebar-search-control", ".st-sidebar-search-input",
        ".st-sidebar-search-dropdown", ".st-sidebar-search-list",
        ".st-sidebar-search-option", "[hidden]",
        ".st-sidebar-search-shortcut", ".sidebar-item-container.section-item",
        '[data-theme="dark"]', '@media (max-width: 767px)',
    ):
        assert marker in nav_css, f"Missing sidebar design: {marker}"
    for marker in (
        "__st_sidebar_awesomebar_search_v5__", "function makeSearch(panel)",
        "function plainLabel(value)",
        "form-refresh.st_sidebar_modern",
        "state.sidebar !== sidebar",
        "get_recent_pages", "get_frequent_links", "get_executables",
        "get_pages", "stopImmediatePropagation",
        "get_global_results", "get_doctypes", "get_reports",
        "get_workspaces", "get_dashboards",
        'input.setAttribute("role", "combobox")',
        'list.setAttribute("role", "listbox")',
        'row.setAttribute("role", "option")',
        'event.key === "ArrowDown"', 'event.key === "ArrowUp"',
        'event.key === "Escape"', 'event.key === "Enter"',
        "input.addEventListener(\"input\"",
        "token !== state.version", "render(state",
        "MutationObserver", "isContentEditable",
    ):
        assert marker in nav_js, f"Missing dropdown behavior: {marker}"
    for forbidden in (
        "open_global_search_dialog(", "init_search(", "frappe.call(",
        "new frappe.search.SearchDialog", ".search_dialog.show(",
        "window.location.assign(", "frappe.new_doc(",
        "localStorage.", ".innerHTML = item.label",
    ):
        assert forbidden not in nav_js, f"Modal or unsafe navigation: {forbidden}"
    for marker in (
        "page-head .st-page-utility-actions",
        "page-head .search-widget-wrapper",
        "desktop-navbar .search-widget-wrapper",
        "body #full-search-button",
        ".page-container > .page-head",
        "position: sticky !important;",
        ".st-top-notification-button", ".st-top-profile-button",
        ".desktop-avatar", "notification-count",
        "@media (min-width: 768px)", "@media (max-width: 767px)",
        '[data-theme="dark"]',
    ):
        assert marker in header, f"Missing header treatment: {marker}"
    assert ".modal" not in header
    assert "width: min(430px" in nav_css
    assert "plainLabel(item.value" in nav_js
    assert "plainLabel(item.label" in nav_js
    assert "node.classList?.contains(\"st-sidebar-search\")" in nav_js
    assert "get_frequent_links" in nav_js
    assert ".form-layout" not in header
    assert "#page-dashboard-view" not in header + nav_css
    assert "height: 120px !important;" in workspace
    assert "height: 60px !important;" in workspace

    parsed = ast.parse(HOOKS.read_text(encoding="utf-8"))
    vals = {
        key: next(ast.literal_eval(node.value) for node in parsed.body
                  if isinstance(node, ast.Assign) and any(
                      isinstance(t, ast.Name) and t.id == key for t in node.targets))
        for key in ("app_include_css", "app_include_js")
    }
    assert vals["app_include_css"][-9:-5] == [
        P + "css/workspace_dashboard_design.css?v=4",
        P + "css/native_dashboard_view_design.css?v=4",
        P + "css/workspace_sidebar_design.css?v=4",
        P + "css/desk_header_finish.css?v=4",
    ]
    assert vals["app_include_js"][-3:] == [
        P + "js/native_dashboard_view.js?v=4",
        P + "js/workspace_sidebar_design.js?v=5",
        P + "js/desk_header_search.js?v=1",
    ]
    assert len(vals["app_include_css"]) == len(set(vals["app_include_css"]))
    assert len(vals["app_include_js"]) == len(set(vals["app_include_js"]))
    manifest = ARCH.read_text(encoding="utf-8")
    for asset in ("desk_header_finish.css?v=4", "workspace_sidebar_design.css?v=4",
                  "workspace_sidebar_design.js?v=5", "desk_header_search.js?v=1"):
        assert asset in manifest, f"Architecture manifest missing {asset}"
    print("Inline Sidebar Search: results dropdown, native permissions, keyboard navigation,"
          " no modal, navbar actions, compact Workspaces, asset order validated.")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Desk header/global-search isolation regression (Frappe v16)."""

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css/desk_header_finish.css"
SIDEBAR = ROOT / "saas_theme/public/css/workspace_sidebar_design.css"
JS = ROOT / "saas_theme/public/js/desk_header_search.js"
SIDEBAR_JS = ROOT / "saas_theme/public/js/workspace_sidebar_design.js"
HOOKS = ROOT / "saas_theme/hooks.py"
ARCH = ROOT / "scripts/validate_theme_architecture.py"
P = "/assets/saas_theme/"


def no_home_suppression(style: str) -> None:
    # Regular CSS rules only (not at-rules): prevent reintroducing the
    # regression that hid Frappe's real Home search with a wide selector.
    for match in re.finditer(r"([^{}]+)\{([^{}]*)\}", style, re.S):
        selectors, declarations = match.groups()
        if not re.search(r"display\s*:\s*none\s*!important", declarations):
            continue
        assert not (
            ".desktop-navbar" in selectors
            and ("search-widget-wrapper" in selectors
                 or "st-home-search-relocated" in selectors
                 or "search-widget-button" in selectors)
        ), f"Home global search accidentally hidden by: {selectors[:180]}"


def main() -> None:
    header = CSS.read_text(encoding="utf-8")
    nav = SIDEBAR.read_text(encoding="utf-8")
    javascript = JS.read_text(encoding="utf-8")
    sidebar = SIDEBAR_JS.read_text(encoding="utf-8")

    no_home_suppression(header)
    no_home_suppression(nav)

    # The Home search remains in its native layout and can be used normally.
    assert re.search(
        r"body \.desktop-wrapper \.desktop-navbar \.search-widget-wrapper,\s*"
        r"body \.desktop-wrapper \.desktop-navbar \.st-home-search-relocated\s*"
        r"\{[^}]*display\s*:\s*flex\s*!important;",
        header, re.S,
    )
    assert 'body .desktop-wrapper .desktop-navbar .search-widget-button' in header
    assert 'document.querySelector?.(".desktop-wrapper .desktop-navbar")' in sidebar

    # Frappe v16 page.html/awesome_bar.js exact search button and the
    # screenshot's generic centered input get suppressed on Desk pages.
    for marker in (
        '"#full-search-button"',
        '"#small-search-button"',
        '"Search or type a command"',
        ".st-header-search-shell",
        ".st-header-search-slot",
        "function searchControl(el)",
        "const HEADER = \".page-container .page-head\";",
        "function suppress(el)",
        'el.style?.setProperty("display", "none", "important")',
        "page-change.st_desk_header_search",
        "form-refresh.st_desk_header_search",
        "toolbar_setup.st_desk_header_search",
        "MutationObserver",
        "if (!desktop())",
    ):
        assert marker in javascript, f"Missing Desk search isolation: {marker}"
    assert 'document.querySelectorAll(HEADER)' in javascript
    assert 'window.__st_desk_header_search_scope_v1__' in javascript
    assert 'search_modal.modal(' not in javascript
    assert 'frappe.searchdialog.search' not in javascript

    # The actual page-head from frappe/public/js/frappe/ui/page.html must
    # remain opaque white when selected theme is light, and stay sticky.
    for marker in (
        "body .page-head {",
        "position: sticky !important;",
        "background: #fff !important;",
        "background-color: #fff !important;",
        "background-image: none !important;",
        "backdrop-filter: none !important;",
        ".page-head .st-desk-command-search-hidden",
        '[data-theme="dark"] body .page-head',
        "@media print",
    ):
        assert marker in header, f"Missing white sticky header: {marker}"
    assert 'body .desktop-wrapper .desktop-navbar' in header

    root = ast.parse(HOOKS.read_text(encoding="utf-8"))
    assets = {}
    for node in root.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in (
                    "app_include_css", "app_include_js"
                ):
                    assets[target.id] = ast.literal_eval(node.value)
    assert assets["app_include_css"][-4:-2] == [
        P + "css/workspace_sidebar_design.css?v=4",
        P + "css/desk_header_finish.css?v=4",
    ]
    assert assets["app_include_js"][-2:] == [
        P + "js/workspace_sidebar_design.js?v=5",
        P + "js/desk_header_search.js?v=1",
    ]
    assert len(assets["app_include_css"]) == len(set(assets["app_include_css"]))
    assert len(assets["app_include_js"]) == len(set(assets["app_include_js"]))
    manifest = ARCH.read_text(encoding="utf-8")
    for marker in (
        "desk_header_finish.css?v=4",
        "workspace_sidebar_design.css?v=4",
        "workspace_sidebar_design.js?v=5",
        "desk_header_search.js?v=1",
    ):
        assert marker in manifest
    print("Desk header search scope passed: Home preserved, non-Home search suppressed,"
          " white sticky header, mobile restoration, isolated assets.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Regression contracts: Frappe native child-row selectors, mobile drawer, RTL menu."""
import ast
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CSS=ROOT/"saas_theme/public/css"
JS=ROOT/"saas_theme/public/js"
def read(path): return path.read_text(encoding="utf-8")
def has_rule(src, selector, value):
    stripped=re.sub(r"/\*.*?\*/","",src,flags=re.S)
    return any(selector in m.group(1) and value in m.group(2)
               for m in re.finditer(r"([^{}]+)\{([^{}]*)\}",stripped,re.S))
def main():
    grid=read(CSS/"grid_and_action_alignment.css")
    mobile=read(CSS/"mobile_shell.css")
    mjs=read(JS/"mobile_shell.js")
    brand=read(CSS/"brand_shell.css")
    bjs=read(JS/"brand_shell.js")
    late=read(JS/"user_theme_menu.js")
    for token in (
        "row-check:not(.search)", "input.grid-row-check:not(.invisible)",
        "flex: 0 0 31px !important;", "width: 31px !important;",
        "flex: 0 0 40px !important;", "left: 31px !important;",
        "right: 31px !important;", "left: auto !important;",
        "right: 0 !important;", "position: sticky !important;",
        "input.grid-row-check:disabled", ":checked",
        "visibility: visible !important;",
    ):
        assert token in grid, f"missing Frappe-native row selection: {token}"
    assert has_rule(grid,".row-check:not(.search)","flex: 0 0 31px !important;")
    assert has_rule(grid,"input.grid-row-check:not(.invisible)","visibility: visible !important;")
    assert "onclick" not in grid and "Delete {0} rows" not in grid
    assert 'child_table_ui.css?v=1' in late

    for token in (
        'function ensure_mobile_navigation_toggle()', 
        'function make_mobile_navigation_toggle()',
        'function sync_mobile_navigation_toggle()',
        'function is_mobile_layout()',
        'sidebar.open?.()', 'sidebar.close?.()',
        'sidebar.apply_page_visibility?.()',
        'sidebar.page_allows_sidebar?.() !== false',
        'event.stopPropagation()',
        '"aria-expanded": expanded ? "true" : "false"',
        '".page-head:visible .page-head-content"',
        '".desktop-navbar:visible"',
        '"st-mobile-navigation-drawer"',
        'ensure_mobile_navigation_toggle();',
    ):
        assert token in mjs, f"missing mobile native Sidebar behavior: {token}"
    for token in (
        '@media screen and (max-width: 767px)',
        '.st-mobile-navigation-toggle',
        'z-index: 1250 !important;',
        'right: 0 !important;',
        'transform: translateX(102%) !important;',
        'right: min(86vw, 300px) !important;',
        'body-sidebar .st-sidebar-persist-toggle',
    ):
        assert token in mobile, f"missing visible mobile navigation: {token}"
    assert 'display: none !important;' in mobile  # desktop-only trigger hidden
    assert 'display: inline-flex !important;' in mobile  # mobile-only visible
    assert 'frappe.set_route(' not in mjs
    assert 'get_global_results' not in mjs

    for token in (
        'const rtl = document.documentElement?.dir === "rtl"',
        '"chevron-right" : "chevron-left"',
        'if (!sidebar || !$bottom.length) return;',
        'frappe.app?.sidebar?.toggle_width?.()',
    ):
        assert token in bjs, f"lost persistent collapse handling: {token}"
    assert 'if (!sidebar || !$bottom.length || frappe.is_mobile()) return;' not in bjs
    for token in (
        '.body-sidebar .st-sidebar-persist-toggle-label',
        'direction: rtl !important;',
        'display: flex !important;',
        'visibility: visible !important;',
    ):
        assert token in brand

    hooks=ast.parse(read(ROOT/"saas_theme/hooks.py"))
    values={}
    for n in hooks.body:
        if isinstance(n,ast.Assign):
            for t in n.targets:
                if isinstance(t,ast.Name) and t.id in ("app_include_css","app_include_js"):
                    values[t.id]=ast.literal_eval(n.value)
    for href in (
        '/assets/saas_theme/css/brand_shell.css?v=6',
        '/assets/saas_theme/css/grid_and_action_alignment.css?v=3',
        '/assets/saas_theme/css/mobile_shell.css?v=2',
        '/assets/saas_theme/js/brand_shell.js?v=4',
        '/assets/saas_theme/js/mobile_shell.js?v=3',
        '/assets/saas_theme/js/user_theme_menu.js?v=8',
    ):
        arr=values["app_include_css"] if "/css/" in href else values["app_include_js"]
        assert arr.count(href)==1, href
    assert len(set(values["app_include_css"])) == len(values["app_include_css"])
    assert len(set(values["app_include_js"])) == len(values["app_include_js"])
    arch=read(ROOT/"scripts/validate_theme_architecture.py")
    for tok in ("child_table_ui.css?v=1", "brand_shell.css?v=6",
                "mobile_shell.css?v=2","brand_shell.js?v=4",
                "mobile_shell.js?v=3","user_theme_menu.js?v=8"):
        assert tok in arch, f"architecture missing asset {tok}"
    print("Native grid row selection, mobile Desk drawer and RTL persistent menu contracts passed")

if __name__=="__main__":
    main()

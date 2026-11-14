#!/usr/bin/env python3
"""Native Frappe Form Link autocomplete layering and RTL Home navbar contract.

Static, dependency-free integration guards for the two visual regressions:
one Link result visible because card overflow is hidden, and Pashto controls
remaining centered/right rather than grouped at the physical left.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORM = ROOT / "saas_theme/public/css/form_autocomplete_layer.css"
RTL = ROOT / "saas_theme/public/css/rtl_navbar_alignment.css"
CARD = ROOT / "saas_theme/public/css/desk_stability.css"
NAV = ROOT / "saas_theme/public/css/desktop_navbar_refinement.css"
SHELL = ROOT / "saas_theme/public/js/mobile_shell.js"
HOOKS = ROOT / "saas_theme/hooks.py"
MANIFEST = ROOT / "scripts/validate_theme_architecture.py"
PREFIX = "/assets/saas_theme/"


def has_rule(text: str, selector: str, declaration: str) -> bool:
    # A small block-level guard: catches accidental commenting out or moving
    # the required rule to an unrelated selector without requiring a CSS build.
    return any(
        selector in match.group(1) and declaration in match.group(2)
        for match in re.finditer(r"([^{}]+)\{([^{}]*)\}", text, re.S)
    )


def main() -> None:
    popup = FORM.read_text(encoding="utf-8")
    rtl = RTL.read_text(encoding="utf-8")
    cards = CARD.read_text(encoding="utf-8")
    nav = NAV.read_text(encoding="utf-8")
    shell = SHELL.read_text(encoding="utf-8")

    # Confirm root cause and that the patch targets the actual selector
    # rather than papering over it with an enormous z-index on the UL.
    root_selector = (
        ".form-layout.st-section-card-form > .form-page > "
        ".form-section:not(.hide-control):not(.empty-section)"
    )
    assert root_selector in cards, "The Form section-card owner has changed"
    assert has_rule(cards, root_selector, "overflow: hidden !important;"), (
        "Update this test if the upstream Form clipping rule changes"
    )
    assert has_rule(popup, root_selector, "overflow: visible !important;")
    assert has_rule(popup, root_selector, "z-index: 320 !important;")
    for marker in (
        ":has(.awesomplete:focus-within)",
        ":has(.awesomplete > ul:not([hidden]))",
        "body .form-page .form-column:has(.awesomplete:focus-within)",
        "body .form-page .form-section:has(.awesomplete:focus-within) > .section-body:not(.hide)",
        "body .form-layout .form-section .awesomplete > ul:not([hidden])",
        "overflow-y: auto !important;",
        "max-height: min(280px, 42vh) !important;",
        "body .form-layout .form-section .awesomplete > ul[hidden]",
        "display: none !important;",
    ):
        assert marker in popup, f"Missing active Link autocomplete layer: {marker}"
    assert popup.count("z-index: 320 !important;") == 2
    assert not re.search(r"\bbody\s+\.(?:form-grid|modal|navbar)\b", popup), (
        "Do not break separate Grid and Dialog stacking owners"
    )
    assert re.search(
        r"\.form-section:not\(\.hide-control\):not\(\.empty-section\)"
        r":is\(\s*:has\(\.awesomplete:focus-within\)",
        popup,
    ), "Card must be raised only while its autocomplete is active"

    # Exact Frappe Home markup is a navbar-home followed by a flex group;
    # mobile_shell.js relocates the native search into that group.
    assert '$right.addClass("st-desktop-top-actions")' in shell
    assert '$search.addClass("st-home-search-relocated")' in shell
    assert "margin-left: auto !important;" in nav
    for marker in (
        'html[dir="rtl"]', "html:dir(rtl)", 'html[lang^="ps"]',
        'html[lang^="fa"]', 'html[lang^="ar"]',
        ".desktop-wrapper .desktop-navbar > .navbar-home",
        ".desktop-wrapper .desktop-navbar > .st-desktop-top-actions",
        "margin-left: 0 !important;",
        "margin-right: auto !important;",
        "margin-inline-start: auto !important;",
        "flex-direction: row !important;",
        "justify-content: space-between !important;",
        ".st-home-search-relocated",
        ".st-home-language-button",
        ".desktop-notifications",
        ".desktop-avatar",
        ".page-head .standard-items-section > .st-page-utility-actions",
        "@media screen and (max-width: 767px)",
        "width: 36px !important;",
    ):
        assert marker in rtl, f"Missing RTL navbar alignment: {marker}"
    assert not re.search(r"(?m)^\s*:root\s*\{", rtl), "Do not change LTR app tokens"
    assert ".form-section" not in rtl
    assert ".desktop-navbar" not in popup

    source = ast.parse(HOOKS.read_text(encoding="utf-8"))
    hooks = {}
    for node in source.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in (
                    "app_include_css", "app_include_js"
                ):
                    hooks[target.id] = ast.literal_eval(node.value)
    css = hooks["app_include_css"]
    js = hooks["app_include_js"]
    assert css[-7:-3] == [
        PREFIX + "css/workspace_sidebar_design.css?v=4",
        PREFIX + "css/desk_header_finish.css?v=4",
        PREFIX + "css/form_autocomplete_layer.css?v=1",
        PREFIX + "css/rtl_navbar_alignment.css?v=1",
    ]
    assert js[-2:] == [
        PREFIX + "js/workspace_sidebar_design.js?v=5",
        PREFIX + "js/desk_header_search.js?v=1",
    ]
    assert len(css) == len(set(css))
    assert len(js) == len(set(js))
    manifest = MANIFEST.read_text(encoding="utf-8")
    for filename in (
        "form_autocomplete_layer.css",
        "rtl_navbar_alignment.css",
    ):
        assert filename in manifest, f"Asset missing from architecture: {filename}"
    print("Form autocomplete card clipping and RTL Navbar positioning passed:"
          " active-only stacking, bounded dropdown, native grouping, "
          "mobile and LTR isolation.")


if __name__ == "__main__":
    main()

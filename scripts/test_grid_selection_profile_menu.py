#!/usr/bin/env python3
"""Regression safety for native Frappe v16 grid row selection and profile menu identity.

No core patches, no duplicate deletions, no permission bypass and no
additional profile menu actions. The headless runtime JS test also exercises
the actual missing-checkbox fallback in a controlled grid fixture.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css"
JS = ROOT / "saas_theme/public/js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def assert_rule(css: str, selector: str, declaration: str) -> None:
    stripped = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    matches = re.findall(r"([^{}]+)\{([^{}]*)\}", stripped, flags=re.S)
    assert any(selector in sel and declaration in body for sel, body in matches), (
        f"Missing CSS rule: {selector} {declaration}"
    )


def main() -> None:
    css = read(CSS / "grid_row_selection.css")
    code = read(JS / "grid_row_selection_repair.js")
    brand = read(JS / "brand_shell.js")
    brand_css = read(CSS / "brand_shell.css")
    loader = read(JS / "user_theme_menu.js")
    original = read(CSS / "grid_and_action_alignment.css")

    # Native checkboxes and native click delegation; no bypass of Grid
    # permissions, read-only grids or new Delete-row handler.
    for clause in (
        'if (!grid || typeof grid.is_editable !== "function" || !grid.is_editable()) return null;',
        'if (grid.df?.cannot_delete_rows || grid.display_status !== "Write") return null;',
        "grid.grid_rows_by_docname",
        "grid.remove_rows_button?.length",
        "input.className = \"grid-row-check st-repaired-grid-row-check\"",
        "container.appendChild(input)",
        "nativeRow.doc.__checked",
        "MutationObserver",
    ):
        assert clause in code, f"Missing scoped native control guard: {clause}"
    for unsafe in ("remove_rows()", "delete_rows()", "frappe.set_route(", "frappe.call(", "frappe.db."):
        assert unsafe not in code
    assert ".form-grid" in code and "st-grid-row-selection-ready" in code

    for token in ("st-grid-row-selection-ready", "row-check", "row-index",
                  "grid-row-check", "appearance: auto !important;",
                  "right: 31px !important;", "right: 0 !important;",
                  "left: 0 !important;", ":checked", "accent-color:"):
        assert token in css, f"Missing visible selector / RTL collision fix: {token}"
    assert_rule(css, "input.grid-row-check", "appearance: auto !important;")
    assert_rule(css, ".row-check:not(.search)", "flex: 0 0 31px !important;")
    assert_rule(css, ".row-index", "flex: 0 0 40px !important;")
    assert_rule(css, ".col:last-child:not(.grid-data-last)", "left: 0 !important;")
    assert_rule(css, ".col:last-child:not(.grid-data-last)", "right: auto !important;")
    assert ".grid-row-check" in original  # prior CSS remains but scoped repair wins
    assert "child_table_ui.css?v=1" in loader  # protected late-loader remains unchanged

    # Identity belongs to existing Settings/Reload/Logout dropdown, not a
    # substitute account menu or duplicated sidebar user control.
    for token in (
        "function ensure_profile_identity_menu(root)",
        "st-profile-menu-identity",
        '["Settings"',  # intentionally absent: all match __ translations
    )[:2]:
        assert token in brand
    for token in (
        '__("Settings")', '__("Reload")', '__("Logout")',
        "parent.insertBefore(identity, parent.firstElementChild)",
        "identity.querySelector(\".st-profile-menu-name\").textContent = name;",
        "identity.querySelector(\".st-profile-menu-email\").textContent = email;",
        "ensure_profile_identity_menu(root);",
    ):
        assert token in brand, token
    assert "innerHTML = name" not in brand and "innerHTML = email" not in brand
    assert_rule(brand_css, ".body-sidebar-bottom > .dropdown-navbar-user",
                "display: none !important;")
    assert_rule(brand_css, ".st-profile-menu-identity", "display: flex !important;")
    for text in ("st-profile-menu-name", "st-profile-menu-email", "unicode-bidi: plaintext"):
        assert text in brand_css

    tree = ast.parse(read(ROOT / "saas_theme/hooks.py"))
    includes = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in {"app_include_css", "app_include_js"}:
                    includes[target.id] = ast.literal_eval(node.value)
    css_assets = includes["app_include_css"]
    js_assets = includes["app_include_js"]
    expected_css = "/assets/saas_theme/css/grid_row_selection.css?v=1"
    expected_js = "/assets/saas_theme/js/grid_row_selection_repair.js?v=1"
    assert css_assets.count(expected_css) == 1
    assert js_assets.count(expected_js) == 1
    assert css_assets.index(expected_css) > css_assets.index(
        "/assets/saas_theme/css/grid_and_action_alignment.css?v=3"
    )
    assert js_assets.index(expected_js) > js_assets.index(
        "/assets/saas_theme/js/interaction_finish_v2.js?v=10"
    )
    assert css_assets.count("/assets/saas_theme/css/brand_shell.css?v=6") == 1
    assert js_assets.count("/assets/saas_theme/js/brand_shell.js?v=4") == 1
    assert len(set(css_assets)) == len(css_assets)
    assert len(set(js_assets)) == len(js_assets)

    manifest = read(ROOT / "scripts/validate_theme_architecture.py")
    for asset in ("grid_row_selection.css", "grid_row_selection_repair.js",
                  "brand_shell.css?v=6", "brand_shell.js?v=4"):
        assert asset in manifest
    print("Grid native selection repair and profile menu identity: source, permission and asset guards passed.")


if __name__ == "__main__":
    main()

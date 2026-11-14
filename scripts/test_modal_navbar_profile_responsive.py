#!/usr/bin/env python3
"""Scoped dialog Link, balanced Desktop Home utilities and compact account identity."""
import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css"
JS = ROOT / "saas_theme/public/js"

def read(path):
    return path.read_text(encoding="utf-8")

def rules(source):
    clean = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    return re.findall(r"([^{}]+)\{([^{}]*)\}", clean, flags=re.S)

def rule_has(source, selector, declaration):
    return any(selector in sel and declaration in body for sel, body in rules(source))

def main():
    popup = read(CSS / "modal_link_actions.css")
    navbar = read(CSS / "desktop_navbar_refinement.css")
    brand_css = read(CSS / "brand_shell.css")
    brand_js = read(JS / "brand_shell.js")
    form_base = read(CSS / "form.css")
    v7 = read(CSS / "ui_consolidation_v7.css")

    # Root cause is present, so we must override it in the dialog context
    # rather than altering all normal Forms, Link logic, or external editors.
    assert "background: var(--st-form-primary) !important;" in form_base
    assert "display:inline-flex!important" in v7
    for token in (
        'body .modal .frappe-control:is([data-fieldtype="Link"], [data-fieldtype="Dynamic Link"])',
        ".link-field > .link-btn",
        "background: transparent !important;",
        "width: auto !important;",
        "height: 32px !important;",
        "right: 5px !important;",
        "left: auto !important;",
        '.btn-open, .btn-clear',
        '[style*="display: none"]',
        '[style*="display:none"]',
        "display: none !important;",
        "padding-right: 44px !important;",
        "padding-right: 77px !important;",
        "padding-left: 44px !important;",
        "flex-direction: row-reverse !important;",
    ):
        assert token in popup, f"Modal Link action correction absent: {token}"
    assert rule_has(popup, ".link-field > .link-btn", "background: transparent !important;")
    assert rule_has(popup, ".link-field > .link-btn", "border: 0 !important;")
    assert rule_has(popup, ".link-field > .link-btn", "box-shadow: none !important;")
    assert rule_has(popup, ".link-field > .link-btn >", "display: none !important;")
    assert "frappe.call(" not in popup and "grid-row-check" not in popup

    # Real DOM: brand_shell inserts Language right BEFORE the
    # native bell INSIDE .desktop-notifications, so spacing must
    # exist there rather than only on .st-desktop-top-actions.
    assert 'notification.insertAdjacentElement("beforebegin", button)' in brand_js
    for token in (
        ".st-desktop-top-actions .desktop-notifications",
        "column-gap: 9px !important;",
        "column-gap: 6px !important;",
        ".st-home-language-button, .desktop-notification-icon, .desktop-avatar",
        "flex: 0 0 42px !important;",
        "width: 42px !important;",
        "height: 42px !important;",
        "border-radius: 11px !important;",
        "flex-basis: 36px !important;",
        "min-width: 36px !important;",
        "@media screen and (max-width: 767px)",
    ):
        assert token in navbar, f"Balanced navbar utility geometry missing {token}"

    # No email is constructed or displayed; name fits the native menu.
    assert "function ensure_profile_identity_menu(root)" in brand_js
    assert 'copy.append(title);' in brand_js
    assert 'const address = document.createElement("span")' not in brand_js
    assert 'frappe.boot?.user?.email' not in brand_js
    assert 'identity.querySelector(".st-profile-menu-email")?.remove();' in brand_js
    assert 'identity.querySelector(".st-profile-menu-name").textContent = name;' in brand_js
    assert "parent.insertBefore(identity, parent.firstElementChild)" in brand_js
    assert "Settings" in brand_js and "Reload" in brand_js and "Logout" in brand_js
    for token in (
        ".es-menu:has(.st-profile-menu-identity)",
        "max-width: calc(100vw - 16px) !important;",
        "width: 100% !important;",
        "min-width: 0 !important;",
        "max-height: 2.8em !important;",
        "overflow-wrap: anywhere !important;",
        "-webkit-line-clamp: 2 !important;",
    ):
        assert token in brand_css
    assert not any(".st-profile-menu-email {" in rule[0] for rule in rules(brand_css))

    hooks = ast.parse(read(ROOT / "saas_theme/hooks.py"))
    vals = {}
    for n in hooks.body:
        if isinstance(n, ast.Assign):
            for t in n.targets:
                if isinstance(t, ast.Name) and t.id in ("app_include_css", "app_include_js"):
                    vals[t.id] = ast.literal_eval(n.value)
    expected_css = (
        "/assets/saas_theme/css/modal_link_actions.css?v=1",
        "/assets/saas_theme/css/desktop_navbar_refinement.css?v=3",
        "/assets/saas_theme/css/brand_shell.css?v=7",
    )
    for asset in expected_css:
        assert vals["app_include_css"].count(asset) == 1, asset
    assert vals["app_include_js"].count("/assets/saas_theme/js/brand_shell.js?v=5") == 1
    assert len(set(vals["app_include_css"])) == len(vals["app_include_css"])
    assert len(set(vals["app_include_js"])) == len(vals["app_include_js"])
    assert vals["app_include_css"].index(expected_css[0]) > vals["app_include_css"].index(
        "/assets/saas_theme/css/ui_consolidation_v7.css?v=14"
    ), "modal CSS must load after the protected popup/ui_consolidation CSS pair"
    print("Dialog Link native show/hide, nested navbar gap + equal controls, responsive username-only dropdown validated")

if __name__ == "__main__":
    main()

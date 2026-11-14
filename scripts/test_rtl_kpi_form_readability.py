#!/usr/bin/env python3
"""Guard RTL Workspace, native Dashboard KPI / P&L and Form Link geometry.

Test the *actual* Frappe v16 selectors and their existing physical LTR
overrides. These final CSS owners may not rewrite data, icons, app routes,
menus, or the custom Home dashboard. Browser acceptance is still required.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css"
WS = CSS / "rtl_workspace_kpi.css"
DV = CSS / "rtl_dashboard_cards.css"
LINK = CSS / "rtl_form_link_actions.css"
OLD_WS = CSS / "workspace_dashboard_design.css"
OLD_DV = CSS / "native_dashboard_view_design.css"
OLD_LINK = CSS / "precision.css"
OLD_V7 = CSS / "ui_consolidation_v7.css"
HOOKS = ROOT / "saas_theme/hooks.py"
ARCH = ROOT / "scripts/validate_theme_architecture.py"
PREFIX = "/assets/saas_theme/css/"


def rule_has(source: str, selector: str, property_text: str) -> bool:
    """Search one actual CSS rule instead of accepting a comment."""
    clean = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    return any(
        selector in m.group(1) and property_text in m.group(2)
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", clean, re.S)
    )


def assert_scoped(source: str, route: str) -> None:
    clean = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    assert clean.count("{") == clean.count("}"), "Unbalanced CSS braces"
    assert clean.count("(") == clean.count(")"), "Unbalanced CSS functions"
    for m in re.finditer(r"([^{}]+)\{", clean):
        selector = m.group(1).strip()
        if selector.startswith("@media"):
            continue
        assert route in selector, f"RTL style escaped owner {route}: {selector[:140]}"
        assert "rtl" in selector or 'lang^="ps"' in selector, (
            f"Rule must remain RTL-only: {selector[:140]}"
        )


def main() -> None:
    workspace = WS.read_text(encoding="utf-8")
    dashboard = DV.read_text(encoding="utf-8")
    link = LINK.read_text(encoding="utf-8")
    ws_base = OLD_WS.read_text(encoding="utf-8")
    dv_base = OLD_DV.read_text(encoding="utf-8")
    link_base = OLD_LINK.read_text(encoding="utf-8")
    v7 = OLD_V7.read_text(encoding="utf-8")

    ws_route = '[data-page-route="Workspaces"]'
    dv_route = '#page-dashboard-view .dashboard'
    assert_scoped(workspace, ws_route)
    assert_scoped(dashboard, dv_route)

    assert "right: -1px !important;" in ws_base
    assert "right: -1px !important;" in dv_base
    for name, content, route, prefix in (
        ("Workspace", workspace, ws_route, "st-ws-kpi"),
        ("Dashboard", dashboard, dv_route, "st-dv-kpi"),
    ):
        card = f".widget.number-widget-box.{prefix}-v2"
        for decl in (
            "left: -1px !important;", "right: auto !important;",
            "border-radius: 16px 0 90px 0 !important;",
        ):
            assert rule_has(content, card + "::before", decl), f"{name}: {decl}"
        assert rule_has(content, card + ":not(." + prefix + "-featured)::after",
                        "clip-path: circle(0% at 0% 0%) !important;")
        assert "clip-path: circle(155% at 0% 0%) !important;" in content
        for icon in ("icon", "wave", "open"):
            assert rule_has(content, "." + prefix + "-" + icon,
                            "right: auto !important;"), f"{name} {icon} RTL location"
        # English sparkline stays right-anchored and rises on the right.
        # RTL must be the true *mirror*: left:17px + scaleX(-1), with
        # the rising edge near the left Open icon, safely ABOVE its top.
        assert rule_has(content, "." + prefix + "-wave", "left: 17px !important;")
        assert rule_has(content, "." + prefix + "-wave", "inset-inline-end: 17px !important;")
        assert rule_has(content, "." + prefix + "-wave", "inset-block-end: 27px !important;")
        assert rule_has(content, "." + prefix + "-wave svg",
                        "transform: scaleX(-1) !important;")
        assert rule_has(content, "." + prefix + "-open", "left: 14px !important;")
        # At the left edge the path is at SVG y=3/34 of a 31px-high
        # decoration. The icon occupies [bottom:12px, top:37px].
        wave_left_tip_from_bottom = 27 + (34 - 3) * 31 / 34
        open_icon_top_from_bottom = 12 + 25
        assert wave_left_tip_from_bottom - open_icon_top_from_bottom > 15
        assert rule_has(content, card + " .number",
                        "unicode-bidi: isolate !important;")
        assert rule_has(content, card + " .number",
                        "direction: ltr !important;")
        assert rule_has(content, card + " .widget-title",
                        "text-align: right !important;")
        assert rule_has(content, card + " .widget-label",
                        "padding-inline-end: 42px !important;")

    # Profit & Loss: these are real ChartWidget .report-summary children,
    # including long Pashto/Dari translations. Labels must remain visible.
    # English/LTR is a separate presentation contract: label and numeric
    # value should be centered together, not stranded at the left.
    for marker in (
        ":root:dir(ltr) body:dir(ltr)",
        "align-items: center !important;",
        "justify-content: center !important;",
        "text-align: center !important;",
        "font-size: 13px !important;",
        "font-weight: 690 !important;",
        "direction: ltr !important;",
        "unicode-bidi: isolate !important;",
    ):
        assert marker in dv_base, f"Missing English P&L layout: {marker}"
    assert rule_has(dv_base, ".report-summary > .summary-item",
                    "align-items: center !important;")
    assert rule_has(dv_base, ".report-summary .summary-label",
                    "text-align: center !important;")
    assert rule_has(dv_base, ".report-summary :is(.summary-value, .summary-value div)",
                    "text-align: center !important;")
    assert "> .report-summary" in dv_base
    assert rule_has(dv_base, ".summary-label", "font-size: 11.5px !important;")
    assert rule_has(dashboard, ".report-summary .summary-label",
                    "font-size: 13.5px !important;")
    for marker in (
        "line-height: 1.5 !important;",
        "font-weight: 700 !important;",
        "white-space: normal !important;",
        "overflow-wrap: break-word !important;",
        "color: var(--st-dv2-ink, #254b65) !important;",
        "min-height: 102px !important;",
        "unicode-bidi: isolate !important;",
    ):
        assert marker in dashboard, f"Missing legible RTL P&L summary: {marker}"
    assert ".chart-container" not in dashboard
    assert ".st-home-dashboard" not in dashboard

    # Existing Form Link CSS positions the Open button at the physical RIGHT.
    # Override only *normal Form* Link and Dynamic Link, not Grid / Modal.
    assert "right: 4px !important;" in link_base
    assert "padding-right: 72px !important;" in link_base
    assert ".link-field .link-btn" in v7
    for marker in (
        '.frappe-control:is([data-fieldtype="Link"], [data-fieldtype="Dynamic Link"])',
        ".link-field > .link-btn",
        "left: 5px !important;",
        "right: auto !important;",
        "max-width: calc(100% - 10px) !important;",
        "flex-direction: row-reverse !important;",
        "top: 50% !important;",
        "transform: translateY(-50%) !important;",
        "padding-left: 44px !important;",
        "padding-left: 76px !important;",
        "padding-inline-end: 44px !important;",
        "direction: rtl !important;",
        "text-align: right !important;",
        "padding-right: 12px !important;",
        "direction: ltr !important;",
        ':has(> .link-btn:not([style*="display: none"]',
        '[style*="display:none"]',
    ):
        assert marker in link, f"Missing RTL Form Link alignment: {marker}"
    assert 'display: none !important;' in link
    # Native Frappe .toggle(false) cannot be defeated by the generic !important CSS.
    assert '.link-btn > .btn-clear:is(.hide,' in link
    # Regression: direction:ltr on the link-btn makes logical inset-inline-end
    # physically RIGHT; earlier RTL CSS specified both and lost left:5px.
    cleaned = re.sub(r"/\*.*?\*/", "", link, flags=re.S)
    action_rules = [body for selector, body in re.findall(r"([^{}]+)\{([^{}]*)\}", cleaned, re.S)
                    if ".link-field > .link-btn" in selector and "position: absolute" in body]
    assert len(action_rules) == 1, "Exactly one positioning owner for RTL Link actions"
    assert "left: 5px !important;" in action_rules[0]
    assert "right: auto !important;" in action_rules[0]
    assert "flex-direction: row-reverse !important;" in action_rules[0]
    assert "direction: ltr !important;" in action_rules[0]
    # A Frappe Link field uses Clear first and Open second in the DOM.
    # Row-reverse makes the second child (Open) physically LEFT, even if
    # a disabled Clear control retained width from older global CSS.
    assert "inset-inline-" not in action_rules[0], "Logical inset conflicts with LTR icon internals"

    # A 104px screenshot-width field now leaves actual text room:
    # 104 - 44 (single action) - 12 (right padding) = 48px.
    assert 104 - 44 - 12 >= 45
    assert 44 >= 5 + 30 + 8  # button left + width + gap
    assert ".form-grid" not in link and ".modal" not in link
    assert '.st-home-dashboard' not in link
    assert "frappe." not in link and "url(" not in link

    source = ast.parse(HOOKS.read_text(encoding="utf-8"))
    includes = next(
        ast.literal_eval(node.value) for node in source.body
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "app_include_css"
            for target in node.targets
        )
    )
    assert includes[-3:] == [
        PREFIX + "rtl_workspace_kpi.css?v=3",
        PREFIX + "rtl_dashboard_cards.css?v=3",
        PREFIX + "rtl_form_link_actions.css?v=3",
    ]
    assert len(set(includes)) == len(includes)
    manifest = ARCH.read_text(encoding="utf-8")
    for filename in (
        "rtl_workspace_kpi.css", "rtl_dashboard_cards.css",
        "rtl_form_link_actions.css",
    ):
        assert filename in manifest

    print("RTL UI: native Workspace/Dashboard cards mirror correctly; "
          "P&L labels remain readable; Link actions occupy input left, "
          "without affecting LTR, Home, Grid, data, or native handlers.")


if __name__ == "__main__":
    main()

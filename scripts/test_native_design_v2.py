#!/usr/bin/env python3
"""Home-style native Workspace/Dashboard v2 contract (Frappe-independent)."""
from __future__ import annotations

import ast
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme" / "public"
HOOKS = ROOT / "saas_theme" / "hooks.py"
ARCH = ROOT / "scripts" / "validate_theme_architecture.py"
WS_STYLE = "workspace_dashboard_design.css"
DV_STYLE = "native_dashboard_view_design.css"
WS_SCRIPT = "workspace_dashboard.js"
DV_SCRIPT = "native_dashboard_view.js"
ASSET_ROOT = "/assets/saas_theme/"


def check_css(name: str, scope: str, component: str, featured: str) -> None:
    css = (PUBLIC / "css" / name).read_text(encoding="utf-8")
    no_comments = re.sub(r"/\*[\s\S]*?\*/", "", css)
    assert no_comments.count("{") == no_comments.count("}"), name + " unbalanced CSS"
    assert no_comments.count("(") == no_comments.count(")"), name + " unbalanced CSS functions"
    selectors = [line.strip() for line in re.findall(r"([^{}]+)\{", no_comments)]
    assert len(selectors) > 35
    for selector in selectors:
        if selector.startswith("@media"):
            continue
        assert scope in selector, f"Style leak outside {name}: {selector}"
    for marker in (
        component, featured, ".widget.number-widget-box",
        ".widget.dashboard-widget-box", ".widget-title", ".widget-body",
        ".widget-control", ".number", ".card-stats", ".percentage-stat-area",
        "font-variant-numeric: tabular-nums",
        "align-items: flex-start", "text-align: start",
        "position: relative", "pointer-events: none !important",
        "clip-path: circle(155%", "background: #1762ca !important",
        "@media (hover: none)", "@media (max-width: 767px)",
        "@media (prefers-reduced-motion: reduce)",
        '[data-theme="dark"]', '[dir="rtl"]',
    ):
        assert marker in no_comments, f"{name} missing {marker}"
    # Do not touch custom Home, Frappe dynamic series values or route handling.
    for forbidden in (
        ".st-home-dashboard", ".form-layout", ".list-view-container",
        ".dataset-0", ".dataset-1", "frappe.set_route(",
        "frappe.call(", "overflow: hidden !important;",
    ):
        assert forbidden not in no_comments, f"{name} contains {forbidden}"


def check_js(name: str, scope: str, sentinel: str) -> None:
    js = (PUBLIC / "js" / name).read_text(encoding="utf-8")
    for part in (
        sentinel, scope, "MutationObserver", "aria-hidden",
        "node.isConnected", "getClientRects().length",
        "page-change.", "frappe.after_ajax",
        "deco", "currentRoot()", "if (timer !== null)",
        "data", # decorative variant is metadata, never a backend request
    ):
        assert part in js, f"{name} missing lifecycle / duplicate guard: {part}"
    for forbidden in (
        "frappe.call(", "frappe.xcall(", "frappe.set_route(",
        "frappe.route_options", "prototype.", ".removeChild(",
        "fetch(", "localStorage.", "window.open(", "addEventListener(\"click\"",
    ):
        assert forbidden not in js, f"{name} modifies Frappe navigation/data: {forbidden}"


def main() -> None:
    check_css(WS_STYLE, '[data-page-route="Workspaces"]',
              "st-ws-kpi-v2", "st-ws-kpi-featured")
    check_css(DV_STYLE, "#page-dashboard-view .dashboard",
              "st-dv-kpi-v2", "st-dv-kpi-featured")
    check_js(WS_SCRIPT, '[data-page-route="Workspaces"]',
             "__st_workspace_card_design_v2__")
    check_js(DV_SCRIPT, "#page-dashboard-view .dashboard",
             "__st_dashboard_view_design_v2__")


    # Regression: the live Frappe v16 dashboard-view/Accounts page renders
    # #page-dashboard-view .dashboard > .dashboard-graph > .widget-group.
    # Neither .dashboard-view nor .dashboard-page exists in the real browser.
    dashboard_css = (PUBLIC / "css" / DV_STYLE).read_text(encoding="utf-8")
    dashboard_js = (PUBLIC / "js" / DV_SCRIPT).read_text(encoding="utf-8")
    workspace_css = (PUBLIC / "css" / WS_STYLE).read_text(encoding="utf-8")
    assert ".dashboard-page .dashboard-view" not in dashboard_css
    assert "#page-dashboard-view .dashboard" in dashboard_css
    assert ".dashboard-graph > .widget-group:first-child" in dashboard_css
    assert 'const ROOT = "#page-dashboard-view .dashboard";' in dashboard_js
    assert 'route[0] !== "dashboard-view"' in dashboard_js
    assert 'widget.dashboard-widget-box' in dashboard_js
    assert "height: 120px !important;" in workspace_css
    assert "height: 60px !important;" in workspace_css
    assert "height: 100% !important;" not in workspace_css
    assert ".widget.number-widget-box:not(.st-dv-kpi-v2)" in dashboard_css
    assert ".widget.dashboard-widget-box:not(.st-dv-chart-v2)" in dashboard_css
    assert '.report-summary > .summary-item' in dashboard_css
    assert '.report-summary[style*="display: none"]' in dashboard_css
    assert '.report-summary[style*="display:none"]' in dashboard_css
    assert "display: none !important;" in dashboard_css

    source = ast.parse(HOOKS.read_text(encoding="utf-8"))
    variables = {
        name: next(
            ast.literal_eval(node.value)
            for node in source.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == name
                    for target in node.targets)
        )
        for name in ("app_include_css", "app_include_js")
    }
    css = variables["app_include_css"]
    js = variables["app_include_js"]
    expected_css = [
        ASSET_ROOT + "css/" + WS_STYLE + "?v=4",
        ASSET_ROOT + "css/" + DV_STYLE + "?v=4",
        ASSET_ROOT + "css/workspace_sidebar_design.css?v=4",
    ]
    expected_js = [
        ASSET_ROOT + "js/" + DV_SCRIPT + "?v=4",
        ASSET_ROOT + "js/workspace_sidebar_design.js?v=5",
    ]
    assert css[-4:-1] == expected_css, "Native design rules must remain ahead of final header polish"
    assert js[-3:-1] == expected_js, "Native controllers remain ahead of Desk header search owner"
    assert js[-1] == ASSET_ROOT + "js/desk_header_search.js?v=1"
    assert all(css.count(path) == 1 for path in expected_css)
    assert all(js.count(path) == 1 for path in expected_js)
    assert css.index(ASSET_ROOT + "css/workspace_dashboard.css?v=1") < len(css) - 2
    assert css.index(ASSET_ROOT + "css/native_dashboard_view.css?v=1") < len(css) - 2
    assert css.index(ASSET_ROOT + "css/home.css?v=13") < len(css) - 4
    assert ASSET_ROOT + "js/" + WS_SCRIPT + "?v=2" in js

    arch = ARCH.read_text(encoding="utf-8")
    for name in (WS_STYLE, DV_STYLE, WS_SCRIPT, DV_SCRIPT):
        assert name in arch, "Architecture is missing " + name
    print("Home-style native design v2: separate scope, CSS priority, JS lifecycle,"
          " RTL, dark/mobile and preserved Frappe ownership.")


if __name__ == "__main__":
    main()

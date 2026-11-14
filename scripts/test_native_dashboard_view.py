#!/usr/bin/env python3
"""Frappe v16 DashboardView style and regression contract (no Frappe import).

Dashboard / Accounts is the ListView Dashboard tab with
.layout-main-section-wrapper.dashboard-page > ... .dashboard-view.
It is NOT a Workspaces route. This guard also protects unrelated forms,
lists, custom Home, report filters, chart interactivity and widget editing.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css/native_dashboard_view.css"
HOOKS = ROOT / "saas_theme/hooks.py"
ARCH = ROOT / "scripts/validate_theme_architecture.py"
URL = "/assets/saas_theme/css/native_dashboard_view.css?v=1"


def stylesheet_rules(source: str) -> str:
    clean = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    assert clean.count("{") == clean.count("}"), "Unbalanced CSS braces"
    assert clean.count("(") == clean.count(")"), "Unbalanced CSS functions"
    rules = re.findall(r"([^{}]+)\{", clean)
    assert len(rules) > 55, "Expected full KPI + chart styling"
    for raw in rules:
        selector = raw.strip()
        if selector.startswith("@media"):
            continue
        assert ".dashboard-page .dashboard-view" in selector, (
            "Unscoped CSS would affect an unrelated Frappe view: " + selector
        )
    return clean


def main() -> None:
    assert CSS.is_file()
    css = stylesheet_rules(CSS.read_text(encoding="utf-8"))
    for native in (
        ".widget-group-body", ".widget.number-widget-box",
        ".widget.dashboard-widget-box", ".widget-head", ".widget-body",
        ".widget-content", ".widget-control", ".widget-title", ".number",
        ".card-stats", ".percentage-stat-area", ".card-actions",
        ".chart-container", ".frappe-chart", ".chart-legend",
        ".chart-actions", ".filter-chart", ".report-summary",
        ".summary-item", ".summary-label", ".summary-value",
        ".chart-loading-state", ".chart-empty-state", ".chart-error-state",
    ):
        assert native in css, f"Frappe v16 native component not styled: {native}"

    for visual in (
        "linear-gradient(125deg, #1762ca",
        ".widget.number-widget-box:first-child",
        "font-variant-numeric: tabular-nums",
        "align-items: flex-start",
        "text-align: start",
        "min-height: 145px",
        "border-radius: 16px",
        "radial-gradient(",
        ".widget-head::after",
        "opacity: 0 !important;",
        ".widget.number-widget-box.edit-mode",
        "overflow: visible !important;",
        "grid-template-columns: repeat(auto-fit",
        "background: transparent !important;",
        "rect.bar",
        ".line-graph-path",
        ".chart-legend",
        "pointer-events: none !important;",
        "z-index: 4 !important;",
        '[dir="rtl"] .dashboard-page .dashboard-view',
        '[data-theme="dark"] .dashboard-page .dashboard-view',
        "@media (max-width: 767px)",
        "@media (prefers-reduced-motion: reduce)",
    ):
        assert visual in css, f"Missing reference-design or safety contract: {visual}"

    # Ensure no fake stat/sparkline dataset, server call or JS handler change.
    for forbidden in (
        ".st-home-dashboard", '[data-page-route="Workspaces"]',
        "frappe.call(", "frappe.set_route(", "NumberCardWidget",
        "dashboard_utils", ".dataset-0", ".dataset-1",
        ".chart-container { height:", ".frappe-chart { height:",
        "display: none !important;\n}",  # never hide a chart/filter by default
    ):
        assert forbidden not in css, f"Unexpected cross-component change: {forbidden}"
    # The visual glyph must NOT intercept the native menu.
    assert re.search(
        r"\.widget\.number-widget-box \.widget-head::after\s*\{[^}]*pointer-events:\s*none",
        css, flags=re.S,
    )
    assert ":focus-within" in css
    assert "widget.dashboard-widget-box .widget-control" in css

    source = ast.parse(HOOKS.read_text(encoding="utf-8"))
    css_hooks = next(
        ast.literal_eval(node.value)
        for node in source.body
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "app_include_css"
            for t in node.targets
        )
    )
    assert css_hooks.count(URL) == 1
    assert css_hooks[-10] == URL, "Native DashboardView base remains before the separate final design layers"
    assert css_hooks[-9] == "/assets/saas_theme/css/workspace_dashboard_design.css?v=4"
    assert css_hooks[-8] == "/assets/saas_theme/css/native_dashboard_view_design.css?v=5"
    assert css_hooks[-7] == "/assets/saas_theme/css/workspace_sidebar_design.css?v=4"
    assert css_hooks[-6] == "/assets/saas_theme/css/desk_header_finish.css?v=4"
    assert css_hooks[-11] == "/assets/saas_theme/css/ui_consolidation_v7.css?v=14"
    assert css_hooks[-5:-3] == [
        "/assets/saas_theme/css/form_autocomplete_layer.css?v=1",
        "/assets/saas_theme/css/rtl_navbar_alignment.css?v=1",
    ]
    assert "/assets/saas_theme/css/workspace_dashboard.css?v=1" in css_hooks
    assert "/assets/saas_theme/css/home.css?v=13" in css_hooks

    arch = ARCH.read_text(encoding="utf-8")
    assert URL in arch
    assert '"native_dashboard_view.css"' in arch
    print("DashboardView styling passed: actual native view, Home visual parity,"
          " chart/menu safety, RTL, dark/mobile and last-load cascade.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Frappe v16 native Workspace dashboard appearance regression checks.

The theme must style standard Workspace widgets without changing Home,
data, permissions, editor layout, chart datasets or click/filter handlers.
This test is intentionally dependency-free and runs in theme CI.
"""
from __future__ import annotations

import ast
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css/workspace_dashboard.css"
HOOKS = ROOT / "saas_theme/hooks.py"
ARCH = ROOT / "scripts/validate_theme_architecture.py"
URL = "/assets/saas_theme/css/workspace_dashboard.css?v=1"


def validate_css_scope(source: str) -> str:
    clean = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    # Every actual rule's selector must be inside Frappe's Workspace route.
    # @media is allowed only as a wrapper around equally scoped rules.
    rules = re.findall(r"([^{}]+)\{", clean)
    assert len(rules) > 35, "Expected all native Workspace widget families"
    for prelude in rules:
        prelude = prelude.strip()
        if prelude.startswith("@media"):
            continue
        assert '[data-page-route="Workspaces"]' in prelude, (
            "Visual rule can leak into Form/List/Home: " + prelude
        )
        assert not prelude.startswith("body"), "Unexpected global page rule"
    assert clean.count("{") == clean.count("}"), "Unbalanced CSS blocks"
    assert clean.count("(") == clean.count(")"), "Unbalanced CSS functions"
    return clean


def main() -> None:
    assert CSS.is_file(), "Missing native Workspace visual stylesheet"
    text = CSS.read_text(encoding="utf-8")
    clean = validate_css_scope(text)

    # These classes exist in Frappe v16's own widget and EditorJS renderer.
    for selector in (
        ".widget.number-widget-box",
        ".widget.shortcut-widget-box",
        ".widget.dashboard-widget-box",
        ".widget.links-widget-box",
        ".widget.quick-list-widget-box",
        ".widget-control",
        ".widget-title",
        ".widget-body",
        ".widget-content",
        ".number",
        ".percentage-stat-area",
        ".card-stats",
        ".chart-container",
        ".chart-legend",
        ".chart-actions",
        ".filter-chart",
        ".report-summary",
        ".link-item",
        ".quick-list-item",
        ".ce-header",
    ):
        assert selector in clean, f"Missing Frappe widget: {selector}"

    for guard in (
        '[data-theme="dark"] [data-page-route="Workspaces"]',
        '[dir="rtl"] [data-page-route="Workspaces"]',
        "@media (max-width: 767px)",
        "@media (max-width: 480px)",
        "@media (prefers-reduced-motion: reduce)",
        "widget.shortcut-widget-box:not(.edit-mode)",
        "overflow: visible !important;",
        "font-variant-numeric: tabular-nums",
        "inset-inline-start:",
        "margin-inline-start:",
        "--st-ws-surface",
        ".card-stats.green-stat",
        ".card-stats.red-stat",
    ):
        assert guard in clean, f"Accessibility/safety guard missing: {guard}"

    # No attempt to fake displayed values, change Frappe chart graph/series,
    # remove native menus, or intercept route/filters/quick-entry behavior.
    for forbidden in (
        ".st-home-dashboard", ".form-page", ".list-view-container",
        "frappe.call(", "frappe.set_route(", "NumberCardWidget",
        "data-points", ".dataset-0", ".dataset-1",
        "widget.dashboard-widget-box .widget-body:empty",
        "widget.dashboard-widget-box .widget-control:empty",
    ):
        assert forbidden not in clean, f"Non-visual coupling introduced: {forbidden}"
    assert "pointer-events: none !important;" in clean  # cosmetic accent only
    assert re.search(
        r"\.widget\.number-widget-box::before\s*\{[^}]*pointer-events:\s*none",
        clean,
        flags=re.S,
    ), "No widget-body control may be blocked by the decorative accent"

    assignments = ast.parse(HOOKS.read_text(encoding="utf-8"))
    css_list = next(
        ast.literal_eval(node.value)
        for node in assignments.body
        if isinstance(node, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == "app_include_css"
                for t in node.targets)
    )
    assert css_list.count(URL) == 1
    i = css_list.index(URL)
    assert css_list[i - 1] == "/assets/saas_theme/css/workspace_shell_polish.css?v=1"
    assert css_list[i + 1] == "/assets/saas_theme/css/dark.css?v=1"
    assert css_list.index("/assets/saas_theme/css/precision.css?v=1") > i
    assert css_list.index("/assets/saas_theme/css/ui_consolidation_v7.css?v=14") > i
    assert "/assets/saas_theme/css/home.css?v=13" in css_list

    architecture = ARCH.read_text(encoding="utf-8")
    assert URL in architecture
    assert '"workspace_dashboard.css"' in architecture

    print("Native Workspace dashboard passed: route-only CSS, original widgets, responsive/RTL/dark and asset order.")


if __name__ == "__main__":
    main()

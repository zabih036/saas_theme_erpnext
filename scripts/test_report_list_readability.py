#!/usr/bin/env python3
"""Static regression checks for the standard List/Report View readability pass.

Frappe v16 Report View uses frappe-datatable with a 35px virtual cellHeight,
so visual rules must not resize DataTable columns, rows, or filter cells.
The runtime filter geometry is also covered by test_report_filter_geometry.js.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme" / "public" / "css"
report = (PUBLIC / "report_and_form_shell.css").read_text(encoding="utf-8")
list_view = (PUBLIC / "list_view.css").read_text(encoding="utf-8")
hooks = (ROOT / "saas_theme" / "hooks.py").read_text(encoding="utf-8")
architecture = (ROOT / "scripts" / "validate_theme_architecture.py").read_text(
    encoding="utf-8"
)

report_marker = "REPORT DATA TABLE READABILITY — QUERY + NATIVE REPORT VIEW"
list_marker = "LIST VIEW READABILITY — Frappe v16 regular document lists"
assert report.count(report_marker) == 1, "Report readability layer missing/duplicated"
assert list_view.count(list_marker) == 1, "List readability layer missing/duplicated"

report_layer = report.split(report_marker, 1)[1]
list_layer = list_view.split(list_marker, 1)[1]

# Both DataTable implementations must be covered; the two have different
# wrapper classes, and ordinary List View is a different HTML structure.
for token in (
    "#page-query-report .report-wrapper .datatable .dt-row-header",
    "#page-query-report .report-wrapper .datatable .dt-row:not(.dt-row-header)",
    ".report-view .datatable-wrapper .dt-row-header",
    ".report-view .datatable-wrapper .dt-row:not(.dt-row-header)",
    ".report-view .datatable-wrapper .dt-row-filter input.dt-filter",
    ".report-view .page-form .form-control",
):
    assert token in report_layer, f"Missing a Report View surface: {token}"

for token in (
    ".list-view .list-row-head",
    ".list-view .list-row-container:not(:first-child) .list-row-col",
    ".list-view .page-form .form-control",
    ".list-view .indicator-pill",
    "@media (max-width: 767px)",
):
    assert token in list_layer, f"Missing List View readability: {token}"

assert "font-size: 14.25px !important" in report_layer
assert "font-size: 14px !important" in report_layer
assert "font-size: 14.25px !important" in list_layer
assert "font-variant-numeric: tabular-nums" in report_layer
assert "font-variant-numeric: tabular-nums" in list_layer

# Do not replace DataTable's calculated column widths or virtual row geometry.
# Its input field can have a controlled height, but the outer row/cell cannot.
for match in re.finditer(r"([^{}]+)\{([^{}]+)\}", report_layer, re.S):
    selector = re.sub(r"/\*.*?\*/", "", match.group(1), flags=re.S).strip()
    declarations = match.group(2)
    if ".dt-cell" in selector or ".dt-row" in selector:
        if "input.dt-filter" not in selector:
            assert not re.search(
                r"(?:^|;)\s*(?:width|min-width|max-width|flex-basis|height|min-height|max-height)\s*:",
                declarations,
            ), f"Native DataTable geometry must remain untouched: {selector}"

assert ".dt-row-filter > .dt-cell {" not in report_layer, (
    "The outer filter cell is owned by Frappe/v6.2 alignment repair"
)
assert "var(--st-rf-text)" in report_layer, "Dark-mode text token missing"
assert "var(--st-rf-title)" in report_layer, "Dark-mode header token missing"
assert "var(--st-list-text)" not in report_layer, "Cross-domain list style leakage"

# Cache-bust both modified stylesheets while keeping hook and architecture
# registrations in exact agreement.
for name in ("report_and_form_shell.css", "list_view.css"):
    path = f"/assets/saas_theme/css/{name}?v=2"
    assert hooks.count(path) == 1, f"Missing Desk stylesheet: {path}"
    assert architecture.count(path) == 1, f"Out-of-sync architecture manifest: {path}"

print("Report/Report View/List View readability and filter geometry checks passed.")

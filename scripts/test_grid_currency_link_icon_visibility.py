#!/usr/bin/env python3
"""Guard native Frappe v16 inline Currency and Link Clear icon visibility.

Frappe grid_row.js wraps editable currency controls in .grid-currency-input,
then offsets the text by the measured width of the native symbol. The theme's
generic !important padding must not undo that spacing. Keep the fix CSS-only:
Frappe still owns input value, blur/commit, total, and Link button visibility.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme" / "public" / "css"
grid = (CSS / "grid_and_action_alignment.css").read_text(encoding="utf-8")
form = (CSS / "form.css").read_text(encoding="utf-8")
modal = (CSS / "modal_link_actions.css").read_text(encoding="utf-8")
rtl = (CSS / "rtl_form_link_actions.css").read_text(encoding="utf-8")
hooks = (ROOT / "saas_theme" / "hooks.py").read_text(encoding="utf-8")
arch = (ROOT / "scripts" / "validate_theme_architecture.py").read_text(encoding="utf-8")
ci = (ROOT / ".github" / "workflows" / "theme-architecture-check.yml").read_text(
    encoding="utf-8"
)

start = "Frappe v16 wraps editable Currency inputs in .grid-currency-input"
end = "/* Modern edit/settings actions in grid rows. */"
assert grid.count(start) == 1, "A single Currency visibility repair must exist"
fix = grid.split(start, 1)[1].split(end, 1)[0]
for token in (
    ".form-grid .grid-body :is(.editable-row, .grid-row-open)",
    ".grid-currency-input",
    ".grid-currency-has-value:not(.grid-currency-symbol-right)",
    ".grid-currency-has-value.grid-currency-symbol-right",
    "var(--grid-currency-symbol-width, 1em)",
    "6px 9px 6px calc(12px +",
    "6px calc(12px +",
    "direction: ltr !important;",
    "text-align: left !important;",
    "text-align: right !important;",
    "color: var(--st-ga-text) !important;",
    "-webkit-text-fill-color: currentColor !important;",
    "min-width: 0 !important;",
    "pointer-events: none !important;",
):
    assert token in fix, f"Currency visibility guarantee missing: {token}"

# Grid Currency overrides must be in the inline-only owner: no report,
# ordinary form, static-area, amount mutation, or native row-height change.
for forbidden in (
    "#page-query-report",
    ".report-view",
    ".static-area",
    "document.querySelector",
    "set_value(",
    "display: none !important;",
):
    assert forbidden not in fix, f"Unexpected Currency repair scope: {forbidden}"

# The pre-existing ordinary-row form control forces padding: 6px 9px;
# the newly scoped has-value selectors must restore Frappe's symbol spacing.
assert "padding: 6px 9px !important;" in grid
assert fix.count("padding: 6px") >= 2
assert "grid-currency-has-value" not in grid.split(start, 1)[0]

# Both Link and Dynamic Link use the same native Clear/Open SVG control.
link_svg = re.search(
    r'\.form-page \.frappe-control\[data-fieldtype="Link"\] \.link-btn svg,'
    r'.*?\{([^{}]+)\}',
    form,
    flags=re.S,
)
assert link_svg, "Canonical Link icon rule is missing"
decl = link_svg.group(1)
assert "color: inherit !important;" in decl
assert "stroke: currentColor !important;" in decl
assert not re.search(r"(?:color|stroke):\s*(?:#fff|white)\s*!important", decl, re.I)
assert '.frappe-control[data-fieldtype="Dynamic Link"] .link-btn svg' in form

# Visibility and user actions must stay with ControlLink; don't turn the
# hidden clear button into a permanent icon in either modal or RTL Form.
assert ".btn-clear):is(.hide," in modal
assert "display: none !important;" in modal
assert ".link-btn > .btn-clear:is(.hide," in rtl
assert "display: none !important;" in rtl

# Cache versions and canonical runtime architecture must be in lockstep.
for file in ("form.css?v=4", "grid_and_action_alignment.css?v=4"):
    path = "/assets/saas_theme/css/" + file
    assert hooks.count(path) == 1, f"Missing stylesheet URL: {path}"
    assert arch.count(path) == 1, f"Missing manifest URL: {path}"

assert "scripts/test_grid_currency_link_icon_visibility.py" in ci
assert "python3 scripts/test_grid_currency_link_icon_visibility.py" in ci
print("Inline Currency amount and Link Clear SVG visibility checks passed.")

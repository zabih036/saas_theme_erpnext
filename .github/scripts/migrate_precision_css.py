from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "saas_theme" / "public" / "css"
HOOKS = ROOT / "saas_theme" / "hooks.py"
VALIDATOR = ROOT / "scripts" / "validate_theme_architecture.py"
MAINTENANCE = ROOT / "THEME_MAINTENANCE.md"

CONTROL = CSS / "control_precision_fix.css"
FOLLOWUP = CSS / "exact_ui_followup.css"
FINAL = CSS / "final_precision_v2.css"
BUNDLE = CSS / "precision.css"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return text.replace(old, new, 1)


# 1. Preserve the exact historical cascade inside one bundle.
control_bytes = CONTROL.read_bytes()
followup_bytes = FOLLOWUP.read_bytes()
final_bytes = FINAL.read_bytes()
expected_bundle = control_bytes + followup_bytes + final_bytes
BUNDLE.write_bytes(expected_bundle)

if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("precision.css does not exactly match source-byte concatenation")

# 2. Replace only the three adjacent hook entries at the same cascade position.
hooks = HOOKS.read_text(encoding="utf-8")
hooks = replace_once(
    hooks,
    '\t"/assets/saas_theme/css/control_precision_fix.css?v=1",\n'
    '\t"/assets/saas_theme/css/exact_ui_followup.css?v=1",\n'
    '\t"/assets/saas_theme/css/final_precision_v2.css?v=1",',
    '\t"/assets/saas_theme/css/precision.css?v=1",',
    "precision hook block",
)
HOOKS.write_text(hooks, encoding="utf-8")

# 3. Update architecture contract for this migration only.
validator = VALIDATOR.read_text(encoding="utf-8")
validator = replace_once(
    validator,
    '    "/assets/saas_theme/css/control_precision_fix.css?v=1",\n'
    '    "/assets/saas_theme/css/exact_ui_followup.css?v=1",\n'
    '    "/assets/saas_theme/css/final_precision_v2.css?v=1",',
    '    "/assets/saas_theme/css/precision.css?v=1",',
    "validator precision hook block",
)
validator = replace_once(
    validator,
    '    "control_precision_fix.css",',
    '    "precision.css",',
    "validator control precision inventory",
)
validator = replace_once(
    validator,
    '    "exact_ui_followup.css",\n',
    '',
    "validator exact followup inventory",
)
validator = replace_once(
    validator,
    '    "final_precision_v2.css",\n',
    '',
    "validator final precision inventory",
)
retired_marker = 'RETIRED_ASSETS = {\n'
if retired_marker not in validator:
    raise RuntimeError("Could not find RETIRED_ASSETS set")
validator = validator.replace(
    retired_marker,
    retired_marker
    + '    "control_precision_fix.css",\n'
    + '    "exact_ui_followup.css",\n'
    + '    "final_precision_v2.css",\n',
    1,
)
VALIDATOR.write_text(validator, encoding="utf-8")

# 4. Update maintenance ownership and migration history.
maintenance = MAINTENANCE.read_text(encoding="utf-8")
row_anchor = '| Home clarity | `saas_theme/public/css/home_clarity_refinement.css` | Home-only clarity/spacing refinements. |\n'
if row_anchor not in maintenance:
    raise RuntimeError("Could not find Home clarity ownership row")
maintenance = maintenance.replace(
    row_anchor,
    row_anchor
    + '| Precision compatibility styling | `saas_theme/public/css/precision.css` | Exact bundle of the former control precision + exact follow-up + final precision layers, preserving historical order. |\n',
    1,
)
for bullet in (
    '- `control_precision_fix.css`\n',
    '- `exact_ui_followup.css`\n',
    '- `final_precision_v2.css`\n',
):
    if bullet not in maintenance:
        raise RuntimeError(f"Could not find compatibility bullet: {bullet.strip()}")
    maintenance = maintenance.replace(bullet, '', 1)
phase_anchor = '- `form_experience_refinement.css` + `professional_form_card_fix.css` → `form_surface.css`\n'
if phase_anchor not in maintenance:
    raise RuntimeError("Could not find form-surface migration history")
maintenance = maintenance.replace(
    phase_anchor,
    phase_anchor
    + '- `control_precision_fix.css` + `exact_ui_followup.css` + `final_precision_v2.css` → `precision.css`\n',
    1,
)
route_anchor = '- “Change form card spacing/surface/layout” → `form_surface.css`\n'
if route_anchor not in maintenance:
    raise RuntimeError("Could not find form-surface routing anchor")
maintenance = maintenance.replace(
    route_anchor,
    route_anchor + '- “Change established cross-surface precision styling” → `precision.css`\n',
    1,
)
MAINTENANCE.write_text(maintenance, encoding="utf-8")

# 5. Delete source files only after bundle and contracts are ready.
CONTROL.unlink()
FOLLOWUP.unlink()
FINAL.unlink()

# 6. Deterministic final checks.
if not BUNDLE.exists():
    raise RuntimeError("precision.css missing after migration")
if CONTROL.exists() or FOLLOWUP.exists() or FINAL.exists():
    raise RuntimeError("Retired precision source files still exist")
if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("precision.css changed after migration")

print("Precision CSS migration completed successfully.")
print(f"control_precision_fix bytes: {len(control_bytes)}")
print(f"exact_ui_followup bytes: {len(followup_bytes)}")
print(f"final_precision_v2 bytes: {len(final_bytes)}")
print(f"precision.css bytes: {len(expected_bundle)}")

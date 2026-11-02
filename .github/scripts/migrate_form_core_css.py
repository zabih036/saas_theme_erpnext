from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "saas_theme" / "public" / "css"
HOOKS = ROOT / "saas_theme" / "hooks.py"
VALIDATOR = ROOT / "scripts" / "validate_theme_architecture.py"
MAINTENANCE = ROOT / "THEME_MAINTENANCE.md"

CONTROLS = CSS / "form_controls.css"
NAVIGATION = CSS / "form_navigation.css"
BUNDLE = CSS / "form.css"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return text.replace(old, new, 1)


controls_bytes = CONTROLS.read_bytes()
navigation_bytes = NAVIGATION.read_bytes()
expected_bundle = controls_bytes + navigation_bytes
BUNDLE.write_bytes(expected_bundle)

if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("form.css does not exactly match source-byte concatenation")

hooks = HOOKS.read_text(encoding="utf-8")
hooks = replace_once(
    hooks,
    '\t"/assets/saas_theme/css/form_controls.css?v=1",\n\t"/assets/saas_theme/css/form_navigation.css?v=1",',
    '\t"/assets/saas_theme/css/form.css?v=1",',
    "form core hook pair",
)
HOOKS.write_text(hooks, encoding="utf-8")

validator = VALIDATOR.read_text(encoding="utf-8")
validator = replace_once(
    validator,
    '    "/assets/saas_theme/css/form_controls.css?v=1",\n    "/assets/saas_theme/css/form_navigation.css?v=1",',
    '    "/assets/saas_theme/css/form.css?v=1",',
    "validator form core hook pair",
)
validator = replace_once(
    validator,
    '    "form_controls.css",',
    '    "form.css",',
    "validator form controls inventory",
)
validator = replace_once(
    validator,
    '    "form_navigation.css",\n',
    '',
    "validator form navigation inventory",
)
retired_marker = 'RETIRED_ASSETS = {\n'
if retired_marker not in validator:
    raise RuntimeError("Could not find RETIRED_ASSETS set")
validator = validator.replace(
    retired_marker,
    retired_marker + '    "form_controls.css",\n    "form_navigation.css",\n',
    1,
)
VALIDATOR.write_text(validator, encoding="utf-8")

maintenance = MAINTENANCE.read_text(encoding="utf-8")
maintenance = replace_once(
    maintenance,
    '| Form controls | `saas_theme/public/css/form_controls.css` | Data, Link, Select, Date, read-only/submitted controls. |\n'
    '| Form tabs/navigation | `saas_theme/public/css/form_navigation.css` | Normal form tab presentation. Cross-layer sticky-state bugs belong to the final stability layer. |',
    '| Form controls + navigation | `saas_theme/public/css/form.css` | Exact bundle of the former form controls + form navigation layers. Input/control rules remain first; tab/navigation rules remain second. Cross-layer sticky-state bugs still belong to the final stability layer. |',
    "form ownership rows",
)
phase_anchor = '- `ui_finish.css` + `interface_refinement.css` → `interface.css`\n'
if phase_anchor not in maintenance:
    raise RuntimeError("Could not find interface migration history")
maintenance = maintenance.replace(
    phase_anchor,
    phase_anchor + '- `form_controls.css` + `form_navigation.css` → `form.css`\n',
    1,
)
maintenance = replace_once(
    maintenance,
    '- “Make form inputs more modern” → `form_controls.css`',
    '- “Make form inputs more modern” → `form.css` (controls section)',
    "form input route",
)
maintenance = replace_once(
    maintenance,
    '- “Change normal form tab spacing” → `form_navigation.css`',
    '- “Change normal form tab spacing” → `form.css` (navigation section)',
    "form navigation route",
)
MAINTENANCE.write_text(maintenance, encoding="utf-8")

CONTROLS.unlink()
NAVIGATION.unlink()

if not BUNDLE.exists():
    raise RuntimeError("form.css missing after migration")
if CONTROLS.exists() or NAVIGATION.exists():
    raise RuntimeError("Retired form core source files still exist")
if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("form.css changed after migration")

print("Form core CSS migration completed successfully.")
print(f"form_controls bytes: {len(controls_bytes)}")
print(f"form_navigation bytes: {len(navigation_bytes)}")
print(f"form.css bytes: {len(expected_bundle)}")

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "saas_theme" / "public" / "css"
HOOKS = ROOT / "saas_theme" / "hooks.py"
VALIDATOR = ROOT / "scripts" / "validate_theme_architecture.py"
MAINTENANCE = ROOT / "THEME_MAINTENANCE.md"

FORM_PALETTE = CSS / "form_palette.css"
PALETTE_REFINEMENT = CSS / "palette_refinement.css"
BUNDLE = CSS / "palette.css"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {text.count(old)}")
    return text.replace(old, new, 1)


# 1. Build exact bundle in the current runtime order.
form_bytes = FORM_PALETTE.read_bytes()
refinement_bytes = PALETTE_REFINEMENT.read_bytes()
expected_bundle = form_bytes + refinement_bytes
BUNDLE.write_bytes(expected_bundle)

if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("palette.css does not exactly match source-byte concatenation")

# 2. Replace only the two adjacent hook entries with the bundle.
hooks = HOOKS.read_text(encoding="utf-8")
hooks = replace_once(
    hooks,
    '\t"/assets/saas_theme/css/form_palette.css?v=1",\n\t"/assets/saas_theme/css/palette_refinement.css?v=1",',
    '\t"/assets/saas_theme/css/palette.css?v=1",',
    "palette hook pair",
)
HOOKS.write_text(hooks, encoding="utf-8")

# 3. Update the architecture contract without changing any runtime owner outside this pair.
validator = VALIDATOR.read_text(encoding="utf-8")
validator = replace_once(
    validator,
    '    "/assets/saas_theme/css/form_palette.css?v=1",\n    "/assets/saas_theme/css/palette_refinement.css?v=1",',
    '    "/assets/saas_theme/css/palette.css?v=1",',
    "validator palette hook pair",
)
validator = replace_once(
    validator,
    '    "form_palette.css",',
    '    "palette.css",',
    "validator form_palette inventory",
)
validator = replace_once(
    validator,
    '    "palette_refinement.css",\n',
    '',
    "validator palette_refinement inventory",
)
retired_marker = 'RETIRED_ASSETS = {\n'
if retired_marker not in validator:
    raise RuntimeError("Could not find RETIRED_ASSETS set")
validator = validator.replace(
    retired_marker,
    retired_marker + '    "form_palette.css",\n    "palette_refinement.css",\n',
    1,
)
VALIDATOR.write_text(validator, encoding="utf-8")

# 4. Update maintenance ownership/documentation.
maintenance = MAINTENANCE.read_text(encoding="utf-8")
maintenance = replace_once(
    maintenance,
    '| Form palette | `saas_theme/public/css/form_palette.css` | Form-specific color tokens/palette. |',
    '| Form palette | `saas_theme/public/css/palette.css` | Exact bundle of the former form palette + palette refinement layers, preserving historical order. |',
    "maintenance form palette owner",
)
maintenance = replace_once(
    maintenance,
    '- `palette_refinement.css`\n',
    '',
    "historical palette refinement bullet",
)
maintenance = replace_once(
    maintenance,
    '- `dark_mode_refinement.css` + `dark_surface_fix.css` → `dark.css`\n',
    '- `dark_mode_refinement.css` + `dark_surface_fix.css` → `dark.css`\n- `form_palette.css` + `palette_refinement.css` → `palette.css`\n',
    "phase 2 migration list",
)
route_anchor = '- “Change normal form tab spacing” → `form_navigation.css`\n'
if route_anchor not in maintenance:
    raise RuntimeError("Could not find change-routing form tab anchor")
maintenance = maintenance.replace(
    route_anchor,
    route_anchor + '- “Change form palette/colors” → `palette.css`\n',
    1,
)
MAINTENANCE.write_text(maintenance, encoding="utf-8")

# 5. Delete source files only after bundle and contracts have been written.
FORM_PALETTE.unlink()
PALETTE_REFINEMENT.unlink()

# 6. Final deterministic checks.
if not BUNDLE.exists():
    raise RuntimeError("palette.css missing after migration")
if FORM_PALETTE.exists() or PALETTE_REFINEMENT.exists():
    raise RuntimeError("Retired palette source files still exist")
if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("palette.css changed after migration")

print("Palette CSS migration completed successfully.")
print(f"form_palette bytes: {len(form_bytes)}")
print(f"palette_refinement bytes: {len(refinement_bytes)}")
print(f"palette.css bytes: {len(expected_bundle)}")

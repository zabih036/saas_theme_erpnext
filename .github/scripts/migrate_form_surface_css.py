from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "saas_theme" / "public" / "css"
HOOKS = ROOT / "saas_theme" / "hooks.py"
VALIDATOR = ROOT / "scripts" / "validate_theme_architecture.py"
MAINTENANCE = ROOT / "THEME_MAINTENANCE.md"

EXPERIENCE = CSS / "form_experience_refinement.css"
CARD = CSS / "professional_form_card_fix.css"
BUNDLE = CSS / "form_surface.css"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return text.replace(old, new, 1)


# 1. Preserve the exact existing cascade inside one file.
experience_bytes = EXPERIENCE.read_bytes()
card_bytes = CARD.read_bytes()
expected_bundle = experience_bytes + card_bytes
BUNDLE.write_bytes(expected_bundle)
if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("form_surface.css does not exactly match source-byte concatenation")

# 2. Replace only the adjacent hook entries, at the exact same cascade position.
hooks = HOOKS.read_text(encoding="utf-8")
hooks = replace_once(
    hooks,
    '\t"/assets/saas_theme/css/form_experience_refinement.css?v=1",\n\t"/assets/saas_theme/css/professional_form_card_fix.css?v=1",',
    '\t"/assets/saas_theme/css/form_surface.css?v=1",',
    "form surface hook pair",
)
HOOKS.write_text(hooks, encoding="utf-8")

# 3. Update architecture expectations/inventory only for this migration.
validator = VALIDATOR.read_text(encoding="utf-8")
validator = replace_once(
    validator,
    '    "/assets/saas_theme/css/form_experience_refinement.css?v=1",\n    "/assets/saas_theme/css/professional_form_card_fix.css?v=1",',
    '    "/assets/saas_theme/css/form_surface.css?v=1",',
    "validator form surface hook pair",
)
validator = replace_once(
    validator,
    '    "form_experience_refinement.css",',
    '    "form_surface.css",',
    "validator experience inventory",
)
validator = replace_once(
    validator,
    '    "professional_form_card_fix.css",\n',
    '',
    "validator card inventory",
)
retired_marker = 'RETIRED_ASSETS = {\n'
if retired_marker not in validator:
    raise RuntimeError("Could not find RETIRED_ASSETS set")
validator = validator.replace(
    retired_marker,
    retired_marker
    + '    "form_experience_refinement.css",\n'
    + '    "professional_form_card_fix.css",\n',
    1,
)
VALIDATOR.write_text(validator, encoding="utf-8")

# 4. Update canonical ownership and cleanup history.
maintenance = MAINTENANCE.read_text(encoding="utf-8")
maintenance = replace_once(
    maintenance,
    '| Professional form card/surface | `saas_theme/public/css/professional_form_card_fix.css` | Form card shell, spacing and surface treatment. |\n'
    '| Form layout/experience refinements | `saas_theme/public/css/form_experience_refinement.css` | Established form-layout refinements not owned by controls/tabs. |',
    '| Form surface / layout experience | `saas_theme/public/css/form_surface.css` | Exact bundle of the former form experience + professional form card layers, preserving historical order. |',
    "maintenance form surface ownership rows",
)
maintenance = replace_once(
    maintenance,
    '- `form_palette.css` + `palette_refinement.css` → `palette.css`\n',
    '- `form_palette.css` + `palette_refinement.css` → `palette.css`\n'
    '- `form_experience_refinement.css` + `professional_form_card_fix.css` → `form_surface.css`\n',
    "phase 2 migration list",
)
route_anchor = '- “Make form inputs more modern” → `form_controls.css`\n'
if route_anchor not in maintenance:
    raise RuntimeError("Could not find form-control routing anchor")
maintenance = maintenance.replace(
    route_anchor,
    route_anchor + '- “Change form card spacing/surface/layout” → `form_surface.css`\n',
    1,
)
MAINTENANCE.write_text(maintenance, encoding="utf-8")

# 5. Delete sources only after bundle + contracts are ready.
EXPERIENCE.unlink()
CARD.unlink()

# 6. Deterministic final checks.
if not BUNDLE.exists():
    raise RuntimeError("form_surface.css missing after migration")
if EXPERIENCE.exists() or CARD.exists():
    raise RuntimeError("Retired form-surface source files still exist")
if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("form_surface.css changed after migration")

print("Form surface CSS migration completed successfully.")
print(f"form_experience_refinement bytes: {len(experience_bytes)}")
print(f"professional_form_card_fix bytes: {len(card_bytes)}")
print(f"form_surface.css bytes: {len(expected_bundle)}")

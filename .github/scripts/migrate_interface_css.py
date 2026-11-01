from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "saas_theme" / "public" / "css"
HOOKS = ROOT / "saas_theme" / "hooks.py"
VALIDATOR = ROOT / "scripts" / "validate_theme_architecture.py"
MAINTENANCE = ROOT / "THEME_MAINTENANCE.md"

UI_FINISH = CSS / "ui_finish.css"
INTERFACE_REFINEMENT = CSS / "interface_refinement.css"
BUNDLE = CSS / "interface.css"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return text.replace(old, new, 1)


ui_finish_bytes = UI_FINISH.read_bytes()
interface_bytes = INTERFACE_REFINEMENT.read_bytes()
expected_bundle = ui_finish_bytes + interface_bytes
BUNDLE.write_bytes(expected_bundle)
if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("interface.css does not exactly match source-byte concatenation")

hooks = HOOKS.read_text(encoding="utf-8")
hooks = replace_once(
    hooks,
    '\t"/assets/saas_theme/css/ui_finish.css?v=1",\n\t"/assets/saas_theme/css/interface_refinement.css?v=1",',
    '\t"/assets/saas_theme/css/interface.css?v=1",',
    "interface hook pair",
)
HOOKS.write_text(hooks, encoding="utf-8")

validator = VALIDATOR.read_text(encoding="utf-8")
validator = replace_once(
    validator,
    '    "/assets/saas_theme/css/ui_finish.css?v=1",\n    "/assets/saas_theme/css/interface_refinement.css?v=1",',
    '    "/assets/saas_theme/css/interface.css?v=1",',
    "validator interface hook pair",
)
validator = replace_once(
    validator,
    '    "interface_refinement.css",',
    '    "interface.css",',
    "validator interface inventory",
)
validator = replace_once(
    validator,
    '    "ui_finish.css",\n',
    '',
    "validator ui_finish inventory",
)
retired_marker = 'RETIRED_ASSETS = {\n'
if retired_marker not in validator:
    raise RuntimeError("Could not find RETIRED_ASSETS set")
validator = validator.replace(
    retired_marker,
    retired_marker + '    "ui_finish.css",\n    "interface_refinement.css",\n',
    1,
)
VALIDATOR.write_text(validator, encoding="utf-8")

maintenance = MAINTENANCE.read_text(encoding="utf-8")
owner_anchor = '| Precision compatibility styling | `saas_theme/public/css/precision.css` | Exact bundle of the former control precision + exact follow-up + final precision layers, preserving historical order. |\n'
if owner_anchor not in maintenance:
    raise RuntimeError("Could not find precision ownership row")
maintenance = maintenance.replace(
    owner_anchor,
    owner_anchor + '| General interface refinement styling | `saas_theme/public/css/interface.css` | Exact bundle of the former UI finish + interface refinement layers, preserving historical order. |\n',
    1,
)
for bullet in ('- `ui_finish.css`\n', '- `interface_refinement.css`\n'):
    if bullet not in maintenance:
        raise RuntimeError(f"Could not find compatibility bullet: {bullet.strip()}")
    maintenance = maintenance.replace(bullet, '', 1)
phase_anchor = '- `control_precision_fix.css` + `exact_ui_followup.css` + `final_precision_v2.css` → `precision.css`\n'
if phase_anchor not in maintenance:
    raise RuntimeError("Could not find precision migration history")
maintenance = maintenance.replace(
    phase_anchor,
    phase_anchor + '- `ui_finish.css` + `interface_refinement.css` → `interface.css`\n',
    1,
)
route_anchor = '- “Change established cross-surface precision styling” → `precision.css`\n'
if route_anchor not in maintenance:
    raise RuntimeError("Could not find precision routing anchor")
maintenance = maintenance.replace(
    route_anchor,
    route_anchor + '- “Change command-palette/native workspace/general interface refinement styling” → `interface.css`\n',
    1,
)
MAINTENANCE.write_text(maintenance, encoding="utf-8")

UI_FINISH.unlink()
INTERFACE_REFINEMENT.unlink()

if not BUNDLE.exists():
    raise RuntimeError("interface.css missing after migration")
if UI_FINISH.exists() or INTERFACE_REFINEMENT.exists():
    raise RuntimeError("Retired interface source files still exist")
if BUNDLE.read_bytes() != expected_bundle:
    raise RuntimeError("interface.css changed after migration")

print("Interface CSS migration completed successfully.")
print(f"ui_finish bytes: {len(ui_finish_bytes)}")
print(f"interface_refinement bytes: {len(interface_bytes)}")
print(f"interface.css bytes: {len(expected_bundle)}")

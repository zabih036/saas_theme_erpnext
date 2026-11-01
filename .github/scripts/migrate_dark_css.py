from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "saas_theme" / "public" / "css"
HOOKS = ROOT / "saas_theme" / "hooks.py"
VALIDATOR = ROOT / "scripts" / "validate_theme_architecture.py"
MAINTENANCE = ROOT / "THEME_MAINTENANCE.md"

DARK_MODE = CSS / "dark_mode_refinement.css"
DARK_SURFACE = CSS / "dark_surface_fix.css"
BUNDLE = CSS / "dark.css"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    if BUNDLE.exists() and not DARK_MODE.exists() and not DARK_SURFACE.exists():
        print("Dark CSS migration already applied.")
        return

    if not DARK_MODE.is_file() or not DARK_SURFACE.is_file():
        raise RuntimeError("Expected dark-theme source CSS files are missing")

    dark_mode = DARK_MODE.read_bytes()
    dark_surface = DARK_SURFACE.read_bytes()
    bundle = dark_mode + dark_surface

    # Mechanical bundle: exact bytes, exact historical order, no selector edits.
    BUNDLE.write_bytes(bundle)
    if BUNDLE.read_bytes() != dark_mode + dark_surface:
        raise RuntimeError("dark.css does not exactly equal dark-mode + dark-surface source bytes")

    hooks = HOOKS.read_text(encoding="utf-8")
    hooks = replace_once(
        hooks,
        '\t"/assets/saas_theme/css/dark_mode_refinement.css?v=1",\n\t"/assets/saas_theme/css/dark_surface_fix.css?v=2",',
        '\t"/assets/saas_theme/css/dark.css?v=1",',
        "hooks dark CSS entries",
    )
    HOOKS.write_text(hooks, encoding="utf-8")

    validator = VALIDATOR.read_text(encoding="utf-8")
    validator = replace_once(
        validator,
        '    "/assets/saas_theme/css/dark_mode_refinement.css?v=1",\n    "/assets/saas_theme/css/dark_surface_fix.css?v=2",',
        '    "/assets/saas_theme/css/dark.css?v=1",',
        "validator expected dark CSS entries",
    )
    validator = replace_once(
        validator,
        '    "dark_mode_refinement.css",\n    "dark_surface_fix.css",\n    "desktop_navbar_refinement.css",',
        '    "dark.css",\n    "desktop_navbar_refinement.css",',
        "validator dark CSS inventory",
    )
    validator = replace_once(
        validator,
        '    "home_dashboard.css",\n    "home_analytics.css",\n}',
        '    "home_dashboard.css",\n    "home_analytics.css",\n    "dark_mode_refinement.css",\n    "dark_surface_fix.css",\n}',
        "validator retired dark assets",
    )
    VALIDATOR.write_text(validator, encoding="utf-8")

    maintenance = MAINTENANCE.read_text(encoding="utf-8")
    maintenance = replace_once(
        maintenance,
        '| Dark theme base refinements | `saas_theme/public/css/dark_mode_refinement.css` | General dark-mode adjustments. |\n| Dark control/surface corrections | `saas_theme/public/css/dark_surface_fix.css` | Dark-mode surface/control corrections. |',
        '| Dark theme styling | `saas_theme/public/css/dark.css` | Exact bundle of the former dark base + dark surface correction layers, preserving historical order. |',
        "maintenance dark ownership rows",
    )
    maintenance = replace_once(
        maintenance,
        'First migration: `home_dashboard.css` + `home_analytics.css` → `home.css`.\n\nThe bundle is a byte-for-byte concatenation in the original CSS load order. JavaScript remains in `home_dashboard.js` and `home_analytics.js` to avoid changing execution timing.',
        'Completed migrations:\n\n- `home_dashboard.css` + `home_analytics.css` → `home.css`\n- `dark_mode_refinement.css` + `dark_surface_fix.css` → `dark.css`\n\nEach bundle is a byte-for-byte concatenation in the original CSS load order. JavaScript remains separate to avoid changing execution timing.',
        "maintenance Phase 2 migration list",
    )
    MAINTENANCE.write_text(maintenance, encoding="utf-8")

    DARK_MODE.unlink()
    DARK_SURFACE.unlink()

    print("Mechanical dark CSS bundle created successfully.")
    print("  dark_mode_refinement.css sha256:", sha256(dark_mode))
    print("  dark_surface_fix.css sha256:", sha256(dark_surface))
    print("  dark.css sha256:", sha256(bundle))
    print("  dark.css bytes:", len(bundle))


if __name__ == "__main__":
    main()

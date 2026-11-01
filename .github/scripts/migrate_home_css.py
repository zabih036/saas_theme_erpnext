from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "saas_theme" / "public" / "css"
HOOKS = ROOT / "saas_theme" / "hooks.py"
VALIDATOR = ROOT / "scripts" / "validate_theme_architecture.py"
MAINTENANCE = ROOT / "THEME_MAINTENANCE.md"

DASHBOARD = CSS / "home_dashboard.css"
ANALYTICS = CSS / "home_analytics.css"
BUNDLE = CSS / "home.css"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    if BUNDLE.exists() and not DASHBOARD.exists() and not ANALYTICS.exists():
        print("Home CSS migration already applied.")
        return

    if not DASHBOARD.is_file() or not ANALYTICS.is_file():
        raise RuntimeError("Expected source CSS files are missing")

    dashboard = DASHBOARD.read_bytes()
    analytics = ANALYTICS.read_bytes()
    bundle = dashboard + analytics

    # Mechanical bundle: exact bytes, exact historical order, no selector edits.
    BUNDLE.write_bytes(bundle)
    if BUNDLE.read_bytes() != dashboard + analytics:
        raise RuntimeError("home.css does not exactly equal dashboard + analytics source bytes")

    hooks = HOOKS.read_text(encoding="utf-8")
    hooks = replace_once(
        hooks,
        '\t"/assets/saas_theme/css/home_dashboard.css?v=1",\n\t"/assets/saas_theme/css/home_analytics.css?v=1",',
        '\t"/assets/saas_theme/css/home.css?v=1",',
        "hooks home CSS entries",
    )
    HOOKS.write_text(hooks, encoding="utf-8")

    validator = VALIDATOR.read_text(encoding="utf-8")
    validator = replace_once(
        validator,
        '    "/assets/saas_theme/css/home_dashboard.css?v=1",\n    "/assets/saas_theme/css/home_analytics.css?v=1",',
        '    "/assets/saas_theme/css/home.css?v=1",',
        "validator expected CSS entries",
    )
    validator = replace_once(
        validator,
        '    "home_analytics.css",\n    "home_clarity_refinement.css",\n    "home_dashboard.css",',
        '    "home.css",\n    "home_clarity_refinement.css",',
        "validator CSS inventory",
    )
    validator = replace_once(
        validator,
        'RETIRED_ASSETS = {\n    "child_row_editor_refinement_v65.css",\n    "child_row_editor_finish.js",\n}',
        'RETIRED_ASSETS = {\n    "child_row_editor_refinement_v65.css",\n    "child_row_editor_finish.js",\n    "home_dashboard.css",\n    "home_analytics.css",\n}',
        "validator retired assets",
    )
    VALIDATOR.write_text(validator, encoding="utf-8")

    maintenance = MAINTENANCE.read_text(encoding="utf-8")
    maintenance = replace_once(
        maintenance,
        '| Home dashboard | `saas_theme/public/css/home_dashboard.css` / `saas_theme/public/js/home_dashboard.js` | Dashboard cards and dashboard behavior. |\n| ERP analytics | `saas_theme/public/css/home_analytics.css` / `saas_theme/public/js/home_analytics.js` | Analytics widgets and interactions. |',
        '| Home dashboard + ERP analytics styling | `saas_theme/public/css/home.css` | Exact CSS bundle of the former dashboard + analytics styles, preserving historical order. |\n| Home dashboard behavior | `saas_theme/public/js/home_dashboard.js` | Dashboard behavior. |\n| ERP analytics behavior | `saas_theme/public/js/home_analytics.js` | Analytics interactions and data loading. |',
        "maintenance ownership rows",
    )
    maintenance = maintenance.replace(
        "### Phase 2 — Mechanical bundling of contiguous, independent assets\n\nOnly after Phase 1 is verified on the server.",
        "### Phase 2 — Mechanical bundling of contiguous, independent assets — current\n\nFirst migration: `home_dashboard.css` + `home_analytics.css` → `home.css`. JavaScript remains separate to avoid changing execution timing.",
        1,
    )
    MAINTENANCE.write_text(maintenance, encoding="utf-8")

    DASHBOARD.unlink()
    ANALYTICS.unlink()

    print("Mechanical Home CSS bundle created successfully.")
    print("  home_dashboard.css sha256:", sha256(dashboard))
    print("  home_analytics.css sha256:", sha256(analytics))
    print("  home.css sha256:", sha256(bundle))
    print("  home.css bytes:", len(bundle))


if __name__ == "__main__":
    main()

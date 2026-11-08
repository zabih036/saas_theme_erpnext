#!/usr/bin/env python3
"""Phase 3F: verify every CSS/JS asset is reachable from actual runtime loaders.

Do not confuse inactive Desk hooks with unused files: the customized login
page loads login.css directly, while multiple precision layers are injected
from JS at runtime. This intentionally does NOT delete active assets.
"""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme/public"
ROOTS = [
    ROOT / "saas_theme/hooks.py",
    *sorted((ROOT / "saas_theme/www").rglob("*.html")),
    *sorted((ROOT / "saas_theme/www").rglob("*.py")),
    *sorted((PUBLIC / "js").glob("*.js")),
    *sorted((PUBLIC / "css").glob("*.css")),
]
URL_RE = re.compile(r"/assets/saas_theme/(?P<kind>css|js)/(?P<asset>[A-Za-z0-9_.-]+)")
URL_JS_RE = re.compile(r"(/assets/saas_theme/(?:css|js)/[A-Za-z0-9_.-]+)")
EXPECTED_RUNTIME_EXTENSIONS = {".css", ".js"}


def audit() -> None:
    assets = {
        (kind, path.name): path
        for kind in ("css", "js")
        for path in (PUBLIC / kind).glob("*")
        if path.is_file() and path.suffix in EXPECTED_RUNTIME_EXTENSIONS
    }
    # Runtime references only: do not allow a test, README or architecture
    # manifest to make a dead CSS/JS file look live.
    references: dict[tuple[str, str], set[str]] = {}
    unresolved: list[str] = []
    for source in ROOTS:
        content = source.read_text(encoding="utf-8")
        for match in URL_RE.finditer(content):
            key = (match.group("kind"), unquote(match.group("asset")))
            if key not in assets:
                unresolved.append(f"{source.relative_to(ROOT)}: {key[0]}/{key[1]}")
            else:
                references.setdefault(key, set()).add(str(source.relative_to(ROOT)))
    if unresolved:
        raise SystemExit("Unknown runtime asset references:\n" + "\n".join(sorted(set(unresolved))))
    orphaned = sorted(f"{kind}/{name}" for (kind, name) in assets if (kind, name) not in references)
    if orphaned:
        raise SystemExit(
            "Unreferenced runtime assets (do NOT delete blindly; check loading):\n"
            + "\n".join(orphaned)
        )
    # Login CSS is deliberately loaded from the www/login.html page, rather
    # than app_include_css. Guard it explicitly against an invalid cleanup.
    login = references.get(("css", "login.css"), set())
    if "saas_theme/www/login.html" not in login:
        raise SystemExit("Login page's own CSS reference was lost")
    # Final v7 CSS is intentionally hook-loaded and later repositioned by JS.
    v7 = references.get(("css", "ui_consolidation_v7.css"), set())
    if not {"saas_theme/hooks.py", "saas_theme/public/js/interaction_finish_v2.js"} <= v7:
        raise SystemExit("The intentional final CSS reinjection changed")
    late_v4 = references.get(("js", "ui_precision_v4.js"), set())
    if "saas_theme/public/js/user_theme_menu.js" not in late_v4:
        raise SystemExit("Live v4 header/profile controller lost")
    print(
        f"Phase 3F runtime reference audit passed: {len(assets)} live files, "
        f"{len(references)} referenced, no unused assets."
    )
    print("  Login CSS, dual-loaded v7 overlay, and late header/controller retained.")


if __name__ == "__main__":
    audit()

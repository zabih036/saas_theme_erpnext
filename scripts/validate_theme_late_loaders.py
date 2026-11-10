#!/usr/bin/env python3
"""Audit late-loaded SaaS Theme assets without changing Desk runtime behavior.

Phase 3 migration guard: enumerate the intentional loader graph, validate
actual URL references, preserve injection order, and reject missing/duplicate
assets. Update this manifest only in a separate, verified migration PR.
"""

from __future__ import annotations

import ast
from collections import Counter
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "saas_theme" / "public"
HOOKS = ROOT / "saas_theme" / "hooks.py"
ASSET_PREFIX = "/assets/saas_theme/"
URL_PATTERN = re.compile(r"/assets/saas_theme/(?:css|js)/[a-zA-Z0-9_.-]+\?v=[0-9]+")

# Each tuple is (runtime URL, expected literal occurrences in the loader).
# Order is first-injection order, not alphabetical. v6.2 writes its CSS URL
# in both the existing-link and new-link branches.
LATE_LOADERS = {
    "user_theme_menu.js": [
        ("css/desk_stability.css?v=1", 1),
        ("js/stability_refinement_v3.js?v=2", 1),
        ("js/ui_precision_v4.js?v=1", 1),
        ("css/child_table_ui.css?v=1", 1),
        ("js/child_table_ui.js?v=1", 1),
        ("css/control_search_report.css?v=1", 1),
        ("js/control_search_report.js?v=1", 1),
        ("js/ui_precision_v6_2.js?v=2", 1),
    ],
    "form_sidebar_persistence.js": [
        ("css/inline_grid_link_popup_anchor_v5.css?v=5", 1),
        ("js/inline_grid_link_popup_anchor_v5.js?v=5", 1),
    ],
    "interaction_finish_v2.js": [
        ("css/ui_consolidation_v7.css?v=14", 1),
    ],
    "ui_precision_v6_2.js": [
        ("css/ui_precision_v6_2.css?v=3", 2),
    ],
}

# This stability CSS is deliberately present in hooks AND re-injected later
# by interaction_finish_v2.js to keep its existing effective cascade.
INTENTIONAL_REINJECTION = {"css/ui_consolidation_v7.css"}


def fail(message: str) -> None:
    raise SystemExit(f"ERROR: {message}")


def hook_asset_urls() -> set[str]:
    tree = ast.parse(HOOKS.read_text(encoding="utf-8"), filename=str(HOOKS))
    values: dict[str, object] = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            try:
                values[node.targets[0].id] = ast.literal_eval(node.value)
            except (ValueError, TypeError):
                continue
    assets: set[str] = set()
    for name in ("app_include_css", "app_include_js", "web_include_css", "web_include_js"):
        value = values.get(name)
        if isinstance(value, str):
            assets.add(value)
        elif isinstance(value, list):
            assets.update(url for url in value if isinstance(url, str))
    return assets


def validate() -> None:
    hooks = hook_asset_urls()
    direct_paths = {urlsplit(url).path.removeprefix(ASSET_PREFIX) for url in hooks}
    expected_seen: set[str] = set()
    loaded_targets: set[str] = set()
    loader_files = set(LATE_LOADERS)

    for loader, entries in LATE_LOADERS.items():
        source_path = PUBLIC / "js" / loader
        if not source_path.is_file():
            fail(f"late-loader source is missing: {loader}")
        source = source_path.read_text(encoding="utf-8")
        found = URL_PATTERN.findall(source)
        expected = Counter({ASSET_PREFIX + relative: count for relative, count in entries})
        actual = Counter(found)
        if actual != expected:
            missing = expected - actual
            unexpected = actual - expected
            fail(f"{loader} asset reference mismatch: missing={dict(missing)}, unexpected={dict(unexpected)}")

        positions = [source.index(ASSET_PREFIX + relative) for relative, _ in entries]
        if positions != sorted(positions):
            fail(f"{loader} late-asset first-injection order changed")

        for relative, _ in entries:
            url = ASSET_PREFIX + relative
            if url in expected_seen:
                fail(f"asset loaded by multiple late loaders: {url}")
            expected_seen.add(url)
            asset_path = urlsplit(url).path.removeprefix(ASSET_PREFIX)
            if not (PUBLIC / asset_path).is_file():
                fail(f"late-loaded asset file does not exist: {asset_path}")
            if asset_path in direct_paths and asset_path not in INTENTIONAL_REINJECTION:
                fail(f"late-loaded asset also directly registered in hooks: {asset_path}")
            loaded_targets.add(asset_path)

    # A new late load must be registered here before it can affect the cascade
    # or event timing.
    for path in sorted((PUBLIC / "js").glob("*.js")):
        if path.name in loader_files:
            continue
        unknown = URL_PATTERN.findall(path.read_text(encoding="utf-8"))
        if unknown:
            fail(f"unregistered asset injection in {path.name}: {unknown}")

    for loader in loader_files:
        source = f"js/{loader}"
        if source not in loaded_targets and source not in direct_paths:
            fail(f"late loader {loader} cannot be reached from a hook or known loader")

    for relative in sorted(INTENTIONAL_REINJECTION):
        if relative not in direct_paths or relative not in loaded_targets:
            fail(f"intentional final-CSS reinjection changed: {relative}")

    print("Phase 3 late-loaded asset graph validated (no runtime changes).")
    for loader, entries in LATE_LOADERS.items():
        print(f"  {loader}:")
        for relative, count in entries:
            occurrence = f" [literal references: {count}]" if count != 1 else ""
            print(f"    -> {relative}{occurrence}")
    print(f"  Unique late assets: {len(expected_seen)}")
    print(f"  Intentional direct/late CSS reinjections: {len(INTENTIONAL_REINJECTION)}")


if __name__ == "__main__":
    validate()

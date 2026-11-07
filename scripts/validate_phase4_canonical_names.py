#!/usr/bin/env python3
"""Phase 4: canonical popup and overlay filenames change, NOT rule bytes."""
from __future__ import annotations

import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "saas_theme/public/css"
HOOKS = ROOT / "saas_theme/hooks.py"

# Immutable Git blob hashes of the already verified exact Phase 3D/3E bundles.
EXPECTED = {
    "popup_controls.css": "b66a0d4331b8decd856ae5e8a55b5eafeca6c7cc",
    "overlay_layers.css": "badddfae4c683c2ceade2e739c4b0750341d98ab",
}
RETIRED = {"global_popup_polish_v3.css", "overlay_stacking_fix.css"}
URLS = {
    "popup_controls.css": "/assets/saas_theme/css/popup_controls.css?v=1",
    "overlay_layers.css": "/assets/saas_theme/css/overlay_layers.css?v=1",
}


def blob_hash(content: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()


def main() -> None:
    for filename, blob in EXPECTED.items():
        file = CSS / filename
        if not file.is_file() or blob_hash(file.read_bytes()) != blob:
            raise SystemExit(f"Phase 4: renamed CSS changed contents: {filename}")
    if any((CSS / filename).exists() for filename in RETIRED):
        raise SystemExit("Phase 4: retired filename still present")
    hooks = ast.parse(HOOKS.read_text(encoding="utf-8"))
    urls = next(
        ast.literal_eval(node.value)
        for node in hooks.body if isinstance(node, ast.Assign)
        if any(isinstance(target, ast.Name) and target.id == "app_include_css"
               for target in node.targets)
    )
    for filename, url in URLS.items():
        if urls.count(url) != 1:
            raise SystemExit(f"Phase 4: canonical asset hook absent/duplicated: {filename}")
    old_or_new_order = [url for url in urls if "popup_controls.css" in url or "overlay_layers.css" in url]
    if old_or_new_order != [URLS["overlay_layers.css"], URLS["popup_controls.css"]]:
        raise SystemExit("Phase 4: original relative overlay/popup CSS order changed")
    for filename in RETIRED:
        if any(filename in url for url in urls):
            raise SystemExit(f"Phase 4: old asset still hook-loaded: {filename}")
    print("Phase 4 canonical CSS naming passed: exact original blobs, original order")


if __name__ == "__main__":
    main()

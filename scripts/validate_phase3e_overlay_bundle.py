#!/usr/bin/env python3
"""Phase 3E: check byte-for-byte, order-accurate overlay stylesheet migration."""
from __future__ import annotations

import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "saas_theme/public/css/overlay_layers.css"
OLD = ROOT / "saas_theme/public/css/overlay_stacking_v3.css"
HOOKS = ROOT / "saas_theme/hooks.py"
ORIGINAL_V2 = "a62c768b52be9ec260e281070bebedbeee5890b8"
ORIGINAL_V3 = "473e2ddec0f8697c148d68fd7749b13e2254bde2"
BOUNDARY = b"\n/*\n * SaaS Theme \xe2\x80\x94 Overlay / Stacking Context Fix v3\n"
ASSET = "/assets/saas_theme/css/overlay_layers.css?v=1"
OBSOLETE = "overlay_stacking_v3.css"


def blob_hash(content: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()


def main() -> None:
    merged = BUNDLE.read_bytes()
    if merged.count(BOUNDARY) != 1:
        raise SystemExit("Phase 3E: overlay v3 boundary missing/duplicated")
    original_v2, tail = merged.split(BOUNDARY)
    original_v3 = BOUNDARY[1:] + tail
    if blob_hash(original_v2) != ORIGINAL_V2 or blob_hash(original_v3) != ORIGINAL_V3:
        raise SystemExit("Phase 3E: overlay CSS rule bytes changed or reordered")
    if OLD.exists():
        raise SystemExit("Phase 3E: retired v3 stylesheet returned")

    tree = ast.parse(HOOKS.read_text())
    assets = next(
        ast.literal_eval(item.value)
        for item in tree.body if isinstance(item, ast.Assign)
        if any(isinstance(target, ast.Name) and target.id == "app_include_css"
               for target in item.targets)
    )
    if assets.count(ASSET) != 1 or any(OBSOLETE in url for url in assets):
        raise SystemExit("Phase 3E: expected one overlay hook URL")
    index = assets.index(ASSET)
    if (assets[index - 1] != "/assets/saas_theme/css/child_row_editor_finish.css?v=1"
            or assets[index + 1] != "/assets/saas_theme/css/interaction_finish_v2.css?v=2"):
        raise SystemExit("Phase 3E: overlay cascade position changed")
    for path in (ROOT / "saas_theme/public/js").glob("*.js"):
        if OBSOLETE in path.read_text():
            raise SystemExit(f"Phase 3E: stale dynamic loader in {path.name}")
    print("Phase 3E CSS parity passed: overlay v2/v3 rules identical and in order")


if __name__ == "__main__":
    main()

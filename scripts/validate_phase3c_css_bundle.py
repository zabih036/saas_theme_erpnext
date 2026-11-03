#!/usr/bin/env python3
"""Verify Phase 3C stylesheet consolidation without relying on source files.

The historic CSS blocks must remain byte-identical and ordered. Git blob
hashes are pinned to the pre-migration version-16 baseline, allowing
independent verification after the old v4 file has been removed.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "saas_theme/public/css/stability_refinement_v3.css"
V4_MARKER = b"/*\n * SaaS Theme \xe2\x80\x94 UI Precision v4\n"
# Original immutable Git blob IDs, before Phase 3C.
ORIGINAL_V3 = "98e6778f6ffc6869707809003c87f03ebd1003d7"
ORIGINAL_V4 = "c0b4c339c011ff7a9e0e605ca88c35efec366c9c"


def git_blob_sha(contents: bytes) -> str:
    header = b"blob " + str(len(contents)).encode("ascii") + b"\x00"
    return hashlib.sha1(header + contents).hexdigest()


def validate() -> None:
    merged = BUNDLE.read_bytes()
    # One extra newline separates the two original intact CSS blocks.
    separator = b"\n" + V4_MARKER
    if merged.count(separator) != 1:
        raise SystemExit("ERROR: Phase 3C v4 CSS boundary missing or duplicated")
    v3, v4_tail = merged.split(separator)
    original_v4 = V4_MARKER + v4_tail
    if git_blob_sha(v3) != ORIGINAL_V3:
        raise SystemExit("ERROR: Phase 3C original v3 CSS content or order changed")
    if git_blob_sha(original_v4) != ORIGINAL_V4:
        raise SystemExit("ERROR: Phase 3C original v4 CSS content or order changed")

    obsolete = ROOT / "saas_theme/public/css/ui_precision_v4.css"
    if obsolete.exists():
        raise SystemExit("ERROR: obsolete v4 stylesheet still exists")
    print("Phase 3C CSS parity passed: exact original v3 + v4 blocks and order preserved.")


if __name__ == "__main__":
    validate()

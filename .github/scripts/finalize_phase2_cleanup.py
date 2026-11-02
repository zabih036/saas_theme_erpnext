from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAINTENANCE = ROOT / "THEME_MAINTENANCE.md"
VALIDATOR = ROOT / "scripts" / "validate_theme_architecture.py"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return text.replace(old, new, 1)


maintenance = MAINTENANCE.read_text(encoding="utf-8")

maintenance = replace_once(
    maintenance,
    "| Reports / DataTable appearance | `saas_theme/public/css/report_and_form_shell.css` | Query/Script report surfaces and report tables. |",
    "| Reports / DataTable + flat-form shell | `saas_theme/public/css/report_and_form_shell.css` | Query/Script report surfaces, report tables and the intentionally colocated no-tab/flat-form shell. |",
    "report ownership row",
)

owner_anchor = "| Tree / Chart of Accounts | `saas_theme/public/css/tree_view_refinement.css` | Tree-specific rows, controls and checkboxes. |\n"
if owner_anchor not in maintenance:
    raise RuntimeError("Could not find Tree ownership row")
maintenance = maintenance.replace(
    owner_anchor,
    owner_anchor
    + "| Grid + page-action alignment | `saas_theme/public/css/grid_and_action_alignment.css` | Child-grid geometry and page-head action alignment. Keep separate from form surface and reports because it spans both concerns. |\n",
    1,
)

maintenance = replace_once(
    maintenance,
    "### Phase 2 — Mechanical bundling of contiguous, independent assets — current",
    "### Phase 2 — Mechanical bundling of contiguous, independent assets — completed",
    "Phase 2 status",
)

phase2_anchor = "- `form_controls.css` + `form_navigation.css` → `form.css`\n\nEach bundle is a byte-for-byte concatenation in the original CSS load order. JavaScript remains separate to avoid changing execution timing."
if phase2_anchor not in maintenance:
    raise RuntimeError("Could not find Phase 2 completed-migrations anchor")
maintenance = maintenance.replace(
    phase2_anchor,
    "- `form_controls.css` + `form_navigation.css` → `form.css`\n\n"
    "Phase 2 ends here. The remaining adjacent CSS files were reviewed and intentionally **not** bundled when their ownership boundaries differ. In particular, `form_surface.css`, `grid_and_action_alignment.css`, and `report_and_form_shell.css` remain separate because they own different runtime surfaces. The protected child-row/popup/overlay stack also remains untouched.\n\n"
    "Each completed bundle is a byte-for-byte concatenation in the original CSS load order. JavaScript remains separate to avoid changing execution timing.",
    1,
)

phase3_heading = "### Phase 3 — Move late-loaded precision layers into explicit owners"
if phase3_heading not in maintenance:
    raise RuntimeError("Could not find Phase 3 heading")
maintenance = maintenance.replace(
    phase3_heading,
    "## Design-change readiness\n\n"
    "Normal design work may resume after Phase 2. Phase 3 is **not** a prerequisite for new design changes. Future UI work should edit the canonical owner file directly and must not create another versioned/final/follow-up patch layer.\n\n"
    "Protected compatibility files should be migrated only when the feature they own is being deliberately changed and can be regression-tested in that same PR. This keeps design work moving without risking the stabilized child-row, popup, overlay, tab or report behavior.\n\n"
    "---\n\n"
    + phase3_heading,
    1,
)

maintenance = replace_once(
    maintenance,
    "- “Change report table/filter appearance” → `report_and_form_shell.css`",
    "- “Change report table/filter appearance or flat/no-tab form shell” → `report_and_form_shell.css`",
    "report route",
)

route_anchor = "- “Change form card spacing/surface/layout” → `form_surface.css`\n"
if route_anchor not in maintenance:
    raise RuntimeError("Could not find form-surface route")
maintenance = maintenance.replace(
    route_anchor,
    route_anchor + "- “Change child-grid geometry or page-head action alignment” → `grid_and_action_alignment.css`\n",
    1,
)

MAINTENANCE.write_text(maintenance, encoding="utf-8")

validator = VALIDATOR.read_text(encoding="utf-8")
validator = replace_once(
    validator,
    "# Phase 1 cleanup: these were explicit no-op compatibility assets. They must not\n# return through a new hook or runtime loader.\nRETIRED_ASSETS = {",
    "# Retired filenames from proven no-op removals or completed bundle migrations.\n# They must not return through a new hook or runtime loader.\nRETIRED_ASSETS = {",
    "retired-assets comment",
)

late_anchor = "EXPECTED_LATE_ASSET_TOKENS = {"
if late_anchor not in validator:
    raise RuntimeError("Could not find late-asset token block")
protected_block = '''PROTECTED_COMPATIBILITY_FILES = {\n    "css/child_row_editor_finish.css",\n    "css/overlay_stacking_fix.css",\n    "css/overlay_stacking_v3.css",\n    "css/interaction_finish_v2.css",\n    "css/global_popup_polish_v3.css",\n    "css/compact_autocomplete_and_form_gap_v4.css",\n    "css/stability_refinement_v3.css",\n    "css/ui_precision_v4.css",\n    "css/child_table_precision_v5.css",\n    "css/ui_precision_v6.css",\n    "css/ui_precision_v6_2.css",\n    "css/ui_consolidation_v7.css",\n    "css/inline_grid_link_popup_anchor_v5.css",\n    "js/stability_refinement_v3.js",\n    "js/ui_precision_v4.js",\n    "js/child_table_precision_v5.js",\n    "js/ui_precision_v6.js",\n    "js/ui_precision_v6_2.js",\n    "js/interaction_finish_v2.js",\n    "js/inline_grid_link_popup_anchor_v5.js",\n}\n\n'''
validator = validator.replace(late_anchor, protected_block + late_anchor, 1)

runtime_guard_anchor = "def validate_runtime_guards() -> None:\n"
if runtime_guard_anchor not in validator:
    raise RuntimeError("Could not find runtime-guard validator")
protected_validator = '''def validate_protected_compatibility_files() -> None:\n    for relative in sorted(PROTECTED_COMPATIBILITY_FILES):\n        path = PUBLIC / relative\n        if not path.is_file():\n            fail(f"protected compatibility file is missing: {relative}")\n\n\n'''
validator = validator.replace(runtime_guard_anchor, protected_validator + runtime_guard_anchor, 1)

validator = replace_once(
    validator,
    "    validate_late_loaders()\n    validate_runtime_guards()",
    "    validate_late_loaders()\n    validate_protected_compatibility_files()\n    validate_runtime_guards()",
    "main protected validation call",
)
validator = replace_once(
    validator,
    '    print(f"  Retired no-op assets removed: {len(RETIRED_ASSETS)}")\n    print("  PR #53 child-row visibility and popup-scroll guards: preserved")',
    '    print(f"  Retired asset filenames blocked: {len(RETIRED_ASSETS)}")\n    print(f"  Protected compatibility files: {len(PROTECTED_COMPATIBILITY_FILES)}")\n    print("  Phase 2 safe mechanical cleanup: complete")\n    print("  PR #53 child-row visibility and popup-scroll guards: preserved")',
    "validator summary output",
)

VALIDATOR.write_text(validator, encoding="utf-8")

print("Phase 2 cleanup finalization completed successfully.")
print("No runtime CSS/JS asset was modified.")

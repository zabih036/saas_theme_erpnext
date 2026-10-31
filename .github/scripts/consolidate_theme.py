from __future__ import annotations

import re
import subprocess
from pathlib import Path

SOURCE = "041900291b68052807bb1b6c98d116b58a9f50e0"
ROOT = Path("saas_theme/public")
CSS_DIR = ROOT / "css"
JS_DIR = ROOT / "js"

CSS_FILES = [
    "professional_ui.css",
    "form_controls.css",
    "form_navigation.css",
    "list_view.css",
    "home_dashboard.css",
    "home_analytics.css",
    "brand_shell.css",
    "form_palette.css",
    "palette_refinement.css",
    "ui_finish.css",
    "interface_refinement.css",
    "mobile_shell.css",
    "workspace_shell_polish.css",
    "dark_mode_refinement.css",
    "dark_surface_fix.css",
    "desktop_navbar_refinement.css",
    "tree_view_refinement.css",
    "home_clarity_refinement.css",
    "control_precision_fix.css",
    "exact_ui_followup.css",
    "final_precision_v2.css",
    "form_experience_refinement.css",
    "professional_form_card_fix.css",
    "grid_and_action_alignment.css",
    "report_and_form_shell.css",
    "child_row_editor_finish.css",
    "overlay_stacking_fix.css",
    "overlay_stacking_v3.css",
    "interaction_finish_v2.css",
    "global_popup_polish_v3.css",
    "compact_autocomplete_and_form_gap_v4.css",
    # These refinement layers were historically loaded dynamically after hooks.
    # Preserve that effective cascade at the end of the permanent bundle.
    "stability_refinement_v3.css",
    "ui_precision_v4.css",
    "child_table_precision_v5.css",
    "inline_grid_link_popup_anchor_v5.css",
    "ui_precision_v6.css",
    "ui_precision_v6_2.css",
    # PR #49's authoritative final layer remains last.
    "ui_consolidation_v7.css",
]

JS_FILES = [
    # Historical hook order after saas_theme.js.
    "professional_ui.js",
    "home_dashboard.js",
    "home_analytics.js",
    "brand_shell.js",
    "ui_finish.js",
    "route_loader.js",
    "mobile_shell.js",
    "workspace_shell_polish.js",
    "final_shell_cleanup.js",
    "user_theme_menu.js",
    "form_sidebar_persistence.js",
    "quick_access_preferences.js",
    "child_row_editor_finish.js",
    # Historical runtime refinement controllers, now part of the permanent file.
    "stability_refinement_v3.js",
    "ui_precision_v4.js",
    "child_table_precision_v5.js",
    "inline_grid_link_popup_anchor_v5.js",
    "ui_precision_v6.js",
    "ui_precision_v6_2.js",
    # PR #49's authoritative interaction controller remains last.
    "interaction_finish_v2.js",
]


def git_show(path: str) -> str:
    result = subprocess.run(
        ["git", "show", f"{SOURCE}:{path}"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout.decode("utf-8")


def historical_css(name: str) -> str:
    return git_show(f"saas_theme/public/css/{name}")


def historical_js(name: str) -> str:
    return git_show(f"saas_theme/public/js/{name}")


def patch_v62_js(text: str) -> str:
    patched, count = re.subn(
        r"\n\tfunction load_css\(\) \{.*?\n\t\}\n",
        "\n\tfunction load_css() { /* bundled in custom.css */ }\n",
        text,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise RuntimeError("Could not neutralize ui_precision_v6_2.js CSS loader")
    return patched


def patch_v7_js(text: str) -> str:
    # ui_consolidation_v7.css is now the final layer inside custom.css.
    text, count = re.subn(
        r"\n\tfunction ensureStyleLast\(\) \{.*?\n\t\}\n",
        "\n\tfunction ensureStyleLast() { /* bundled last in custom.css */ }\n",
        text,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise RuntimeError("Could not neutralize v7 ensureStyleLast")

    text, count = re.subn(
        r"\n\tfunction setupStyleOrderGuard\(\) \{.*?\n\t\}\n",
        "\n\tfunction setupStyleOrderGuard() { /* no runtime stylesheet injection */ }\n",
        text,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise RuntimeError("Could not neutralize v7 style order observer")

    old = '''\tfunction isInlineGridInput(input) {
\t\treturn Boolean(input instanceof HTMLInputElement && input.closest(".form-grid .editable-row") && input.closest(".grid-static-col, .grid-field"));
\t}'''
    new = '''\tfunction inlineGridFieldType(input) {
\t\treturn String(
\t\t\tinput?.dataset?.fieldtype ||
\t\t\tinput?.getAttribute?.("data-fieldtype") ||
\t\t\tinput?.closest?.("[data-fieldtype]")?.getAttribute?.("data-fieldtype") ||
\t\t\t""
\t\t);
\t}

\tfunction isInlineGridInput(input) {
\t\tif (!(input instanceof HTMLInputElement)) return false;
\t\tif (!input.closest(".form-grid .editable-row")) return false;
\t\tif (!input.closest(".grid-static-col, .grid-field")) return false;
\t\treturn ["Link", "Dynamic Link", "Autocomplete"].includes(inlineGridFieldType(input));
\t}'''
    if old not in text:
        raise RuntimeError("Could not find v7 isInlineGridInput")
    text = text.replace(old, new, 1)

    old = '''\tfunction findGridPopup(input) {
\t\tif (!isInlineGridInput(input)) return null;
\t\tconst controlsId = input.getAttribute("aria-controls");'''
    new = '''\tfunction findGridPopup(input) {
\t\tif (!isInlineGridInput(input)) return null;
\t\tif (input.awesomplete?.ul instanceof Element) return input.awesomplete.ul;
\t\tconst controlsId = input.getAttribute("aria-controls");'''
    if old not in text:
        raise RuntimeError("Could not find v7 findGridPopup")
    text = text.replace(old, new, 1)

    old = '''\tfunction positionGridPopup(list, meta) {
\t\tconst input = meta?.input;
\t\tif (!input?.isConnected || !listIsOpen(list)) return;
\t\tconst rect = input.getBoundingClientRect();'''
    new = '''\tfunction gridPopupAnchorRect(input) {
\t\tconst candidates = [
\t\t\tinput.closest(".control-input-wrapper"),
\t\t\tinput.closest(".frappe-control"),
\t\t\tinput.closest(".grid-field"),
\t\t\tinput.closest(".grid-static-col"),
\t\t\tinput,
\t\t].filter(Boolean);
\t\tfor (const element of candidates) {
\t\t\tconst rect = element.getBoundingClientRect();
\t\t\tif (rect.width >= 160 && rect.height > 0 && rect.height < 140) return rect;
\t\t}
\t\treturn input.getBoundingClientRect();
\t}

\tfunction positionGridPopup(list, meta) {
\t\tconst input = meta?.input;
\t\tif (!input?.isConnected || !listIsOpen(list)) return;
\t\tconst rect = gridPopupAnchorRect(input);'''
    if old not in text:
        raise RuntimeError("Could not find v7 positionGridPopup")
    text = text.replace(old, new, 1)

    old_width = "const width = Math.max(1, Math.round(rect.width));"
    if old_width not in text:
        raise RuntimeError("Could not find v7 popup width calculation")
    text = text.replace(
        old_width,
        "const width = Math.max(180, Math.round(rect.width));",
        1,
    )

    old = '''\t\tif (popupPortals.has(list)) {
\t\t\tpositionGridPopup(list, popupPortals.get(list));
\t\t\treturn;
\t\t}'''
    new = '''\t\tif (popupPortals.has(list)) {
\t\t\tconst meta = popupPortals.get(list);
\t\t\tmeta.input = input;
\t\t\tpositionGridPopup(list, meta);
\t\t\treturn;
\t\t}'''
    if old not in text:
        raise RuntimeError("Could not find v7 existing popup portal block")
    text = text.replace(old, new, 1)

    old = '''\tfunction scanGridPopups() {
\t\tdocument.querySelectorAll(".form-grid .editable-row input").forEach((input) => {
\t\t\tif (!isInlineGridInput(input)) return;
\t\t\tconst list = findGridPopup(input);
\t\t\tif (list && listIsOpen(list)) portalGridPopup(input, list);
\t\t});
\t\tfor (const [list, meta] of Array.from(popupPortals.entries())) {
\t\t\tif (!meta.input?.isConnected || !list.isConnected || !listIsOpen(list)) restoreGridPopup(list);
\t\t}
\t}'''
    new = '''\tfunction scanGridPopups() {
\t\tconst input = document.activeElement;
\t\tif (isInlineGridInput(input)) {
\t\t\tconst list = findGridPopup(input);
\t\t\tif (list && listIsOpen(list)) portalGridPopup(input, list);
\t\t}
\t\tfor (const [list, meta] of Array.from(popupPortals.entries())) {
\t\t\tif (!meta.input?.isConnected || !list.isConnected || !listIsOpen(list)) restoreGridPopup(list);
\t\t}
\t}'''
    if old not in text:
        raise RuntimeError("Could not find v7 scanGridPopups")
    text = text.replace(old, new, 1)
    return text


def build_css() -> None:
    pieces = [
        "/*\n"
        " * SaaS Theme — Complete Project Customizations\n"
        f" * Mechanically consolidated from merged working commit {SOURCE}.\n"
        " * Historical cascade order is preserved. Future Desk CSS changes belong in this file.\n"
        " */\n"
    ]
    for name in CSS_FILES:
        pieces.append(f"\n/* ===== BEGIN HISTORICAL LAYER: {name} ===== */\n")
        pieces.append(historical_css(name))
        pieces.append(f"\n/* ===== END HISTORICAL LAYER: {name} ===== */\n")
    (CSS_DIR / "custom.css").write_text("".join(pieces), encoding="utf-8")


def build_js() -> None:
    pieces = [
        "/*\n"
        " * SaaS Theme — Complete Project Interactions\n"
        f" * Mechanically consolidated from merged working commit {SOURCE}.\n"
        " * Historical execution order is preserved. Future Desk JS changes belong in this file.\n"
        " */\n"
    ]
    for name in JS_FILES:
        text = historical_js(name)
        if name == "ui_precision_v6_2.js":
            text = patch_v62_js(text)
        elif name == "interaction_finish_v2.js":
            text = patch_v7_js(text)
        pieces.append(f"\n/* ===== BEGIN HISTORICAL CONTROLLER: {name} ===== */\n")
        pieces.append(text)
        pieces.append(f"\n/* ===== END HISTORICAL CONTROLLER: {name} ===== */\n")
    (JS_DIR / "custom.js").write_text("".join(pieces), encoding="utf-8")


def build_login() -> None:
    login_css = (
        "/* SaaS Theme — Complete Login Styling */\n"
        + historical_css("login.css")
        + "\n/* ===== HISTORICAL LAYER: login_refinement.css ===== */\n"
        + historical_css("login_refinement.css")
    )
    (CSS_DIR / "login.css").write_text(login_css, encoding="utf-8")

    login_js = (
        "/* SaaS Theme — Complete Login Interactions */\n"
        + historical_js("route_loader.js")
        + "\n/* ===== HISTORICAL CONTROLLER: login_fix.js ===== */\n"
        + historical_js("login_fix.js")
    )
    (JS_DIR / "login.js").write_text(login_js, encoding="utf-8")


def cleanup_assets() -> None:
    keep_css = {"saas_theme.css", "custom.css", "login.css"}
    keep_js = {"saas_theme.js", "custom.js", "login.js"}
    for path in CSS_DIR.iterdir():
        if path.is_file() and path.name not in keep_css:
            path.unlink()
    for path in JS_DIR.iterdir():
        if path.is_file() and path.name not in keep_js:
            path.unlink()


def write_hooks() -> None:
    hooks = '''app_name = "saas_theme"
app_title = "Saas Theme by CommitStreet"
app_publisher = "CommitStreet"
app_description = "A modern, polished SaaS UI theme for Frappe Framework — featuring a dual sidebar with workspace rail, redesigned form inputs, slide-in child table editor, enhanced attachments, and a refined dashboard experience."
app_email = "vineyrawat@yahoo.com"
app_license = "MIT"
frappe_version = ">=16.0.0 <17.0.0"
categories = ["Customization", "UI/UX"]

# Permanent Desk structure. Future Desk theme work edits these exact files.
app_include_css = [
    "/assets/saas_theme/css/saas_theme.css",
    "/assets/saas_theme/css/custom.css",
]

app_include_js = [
    "/assets/saas_theme/js/saas_theme.js",
    "/assets/saas_theme/js/custom.js",
]

# login.css is linked directly by the custom login template.
web_include_js = [
    "/assets/saas_theme/js/login.js",
]
'''
    Path("saas_theme/hooks.py").write_text(hooks, encoding="utf-8")


def update_login_template() -> None:
    path = Path("saas_theme/www/login.html")
    text = git_show("saas_theme/www/login.html")
    text = text.replace(
        '/assets/saas_theme/css/login.css?v=6',
        '/assets/saas_theme/css/login.css',
    )
    path.write_text(text, encoding="utf-8")


def validate() -> None:
    # Base files must still be byte-identical to the merged working source.
    if (CSS_DIR / "saas_theme.css").read_text(encoding="utf-8") != historical_css("saas_theme.css"):
        raise RuntimeError("saas_theme.css base changed unexpectedly")
    if (JS_DIR / "saas_theme.js").read_text(encoding="utf-8") != historical_js("saas_theme.js"):
        raise RuntimeError("saas_theme.js base changed unexpectedly")

    for path in [JS_DIR / "custom.js", JS_DIR / "login.js"]:
        subprocess.run(["node", "--check", str(path)], check=True)

    # The corrected controller must be present in the permanent bundle.
    custom_js = (JS_DIR / "custom.js").read_text(encoding="utf-8")
    required = [
        "function gridPopupAnchorRect(input)",
        'const width = Math.max(180, Math.round(rect.width));',
        "const input = document.activeElement;",
        "input.awesomplete?.ul instanceof Element",
    ]
    for token in required:
        if token not in custom_js:
            raise RuntimeError(f"Missing corrected popup logic: {token}")

    expected = {
        "saas_theme/public/css/saas_theme.css",
        "saas_theme/public/css/custom.css",
        "saas_theme/public/css/login.css",
        "saas_theme/public/js/saas_theme.js",
        "saas_theme/public/js/custom.js",
        "saas_theme/public/js/login.js",
    }
    actual = {
        str(path)
        for folder in [CSS_DIR, JS_DIR]
        for path in folder.iterdir()
        if path.is_file()
    }
    if actual != expected:
        raise RuntimeError(f"Unexpected public theme asset tree: {sorted(actual)}")

    # Print any historical asset URLs still referenced by JS for inspection.
    refs = sorted(set(re.findall(r"/assets/saas_theme/[^\"'\s)]+", custom_js)))
    print("Historical asset URLs still referenced inside custom.js:")
    for ref in refs:
        print("  ", ref)

    print("Final permanent assets:")
    for path in sorted(actual):
        print("  ", path)
    print("custom.css bytes:", (CSS_DIR / "custom.css").stat().st_size)
    print("custom.js bytes:", (JS_DIR / "custom.js").stat().st_size)


def main() -> None:
    build_css()
    build_js()
    build_login()
    cleanup_assets()
    write_hooks()
    update_login_template()
    validate()


if __name__ == "__main__":
    main()

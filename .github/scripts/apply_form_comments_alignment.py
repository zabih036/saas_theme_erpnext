from pathlib import Path
import re

ROOT = Path('.')
FORM = ROOT / 'saas_theme/public/css/form_surface.css'
V7 = ROOT / 'saas_theme/public/css/ui_consolidation_v7.css'
HOOKS = ROOT / 'saas_theme/hooks.py'
JS = ROOT / 'saas_theme/public/js/interaction_finish_v2.js'
VALIDATOR = ROOT / 'scripts/validate_theme_architecture.py'

form = FORM.read_text()
pattern = re.compile(r'/\* ===== FORM CARD / COMMENTS SPACING V1 ===== \*/.*?/\* ===== END FORM CARD / COMMENTS SPACING V1 ===== \*/', re.S)
replacement = r'''/* ===== FORM CARD / COMMENTS SPACING V2 ===== */
/* Frappe mounts the footer as a sibling wrapper of .layout-main-section, not inside .form-page. */
.form-page {
	box-sizing: border-box !important;
	padding-inline: 10px !important;
}

.form-page .form-layout,
.form-page .std-form-layout,
.form-page .form-tab-content {
	min-height: 0 !important;
}

body[data-route^="Form"] .layout-main-section-wrapper > div:has(> .form-footer) {
	box-sizing: border-box !important;
	width: 100% !important;
	margin: 12px 0 0 !important;
	padding: 0 10px 12px !important;
}

body[data-route^="Form"] .layout-main-section-wrapper > div:has(> .form-footer) > .form-footer {
	box-sizing: border-box !important;
	width: 100% !important;
	max-width: none !important;
	margin: 0 !important;
	padding: 0 !important;
}

body[data-route^="Form"] .layout-main-section-wrapper > div:has(> .form-footer) .after-save {
	box-sizing: border-box !important;
	width: 100% !important;
	margin: 0 !important;
}

@media (max-width: 767.98px) {
	.form-page { padding-inline: 6px !important; }
	body[data-route^="Form"] .layout-main-section-wrapper > div:has(> .form-footer) {
		margin-top: 10px !important;
		padding: 0 6px 10px !important;
	}
}
/* ===== END FORM CARD / COMMENTS SPACING V2 ===== */'''
form, count = pattern.subn(replacement, form, count=1)
if count != 1:
    raise SystemExit('V1 form spacing block not found exactly once')
FORM.write_text(form)

css = V7.read_text()
for old, new in [
    ('AUTHORITATIVE FINAL FORM TABS V12', 'AUTHORITATIVE FINAL FORM TABS V13'),
    ('END AUTHORITATIVE FINAL FORM TABS V12', 'END AUTHORITATIVE FINAL FORM TABS V13'),
    ('\tmargin: 0 12px 8px !important;', '\tmargin: 0 !important;'),
    ('\tpadding: 12px 16px 16px !important;', '\tpadding: 12px 16px 14px !important;'),
    ('\tborder-radius: 0 0 12px 12px !important;', '\tborder-radius: 0 0 14px 14px !important;'),
]:
    if old not in css:
        raise SystemExit(f'missing expected V12 fragment: {old}')
    css = css.replace(old, new, 1)
V7.write_text(css)

hooks = HOOKS.read_text()
for old, new in [
    ('/assets/saas_theme/css/form_surface.css?v=6', '/assets/saas_theme/css/form_surface.css?v=7'),
    ('/assets/saas_theme/css/ui_consolidation_v7.css?v=12', '/assets/saas_theme/css/ui_consolidation_v7.css?v=13'),
    ('/assets/saas_theme/js/interaction_finish_v2.js?v=7', '/assets/saas_theme/js/interaction_finish_v2.js?v=8'),
]:
    if hooks.count(old) != 1:
        raise SystemExit(f'hook token missing: {old}')
    hooks = hooks.replace(old, new, 1)
HOOKS.write_text(hooks)

js = JS.read_text()
old = '/assets/saas_theme/css/ui_consolidation_v7.css?v=12'
new = '/assets/saas_theme/css/ui_consolidation_v7.css?v=13'
if js.count(old) != 1:
    raise SystemExit('V12 STYLE_HREF missing')
JS.write_text(js.replace(old, new, 1))

validator = VALIDATOR.read_text()
validator = validator.replace('/assets/saas_theme/css/form_surface.css?v=6', '/assets/saas_theme/css/form_surface.css?v=7')
validator = validator.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=12', '/assets/saas_theme/css/ui_consolidation_v7.css?v=13')
validator = validator.replace('/assets/saas_theme/js/interaction_finish_v2.js?v=7', '/assets/saas_theme/js/interaction_finish_v2.js?v=8')
validator = validator.replace('AUTHORITATIVE FINAL FORM TABS V12', 'AUTHORITATIVE FINAL FORM TABS V13')
VALIDATOR.write_text(validator)

print('Applied real Frappe footer alignment and unified form/tab card edges.')

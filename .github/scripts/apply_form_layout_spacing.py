from pathlib import Path

ROOT = Path('.')
FORM = ROOT / 'saas_theme/public/css/form_surface.css'
V7 = ROOT / 'saas_theme/public/css/ui_consolidation_v7.css'
HOOKS = ROOT / 'saas_theme/hooks.py'
JS = ROOT / 'saas_theme/public/js/interaction_finish_v2.js'
VALIDATOR = ROOT / 'scripts/validate_theme_architecture.py'

form = FORM.read_text()
marker = '/* ===== FORM CARD / COMMENTS SPACING V1 ===== */'
if marker in form:
    raise SystemExit('spacing block already present')
form += r'''

/* ===== FORM CARD / COMMENTS SPACING V1 ===== */
/* Keep the form comfortably separated from the details sidebar and avoid an empty vertical band before Comments. */
.form-page {
	box-sizing: border-box !important;
	padding-inline: 10px !important;
}

.form-page .form-layout,
.form-page .std-form-layout,
.form-page .form-tab-content {
	min-height: 0 !important;
}

.form-page .form-footer,
.form-layout .form-footer {
	margin-top: 0 !important;
	padding-top: 6px !important;
}

.form-footer .after-save {
	margin-top: 0 !important;
}

@media (max-width: 767.98px) {
	.form-page { padding-inline: 6px !important; }
	.form-page .form-footer,
	.form-layout .form-footer { padding-top: 4px !important; }
}
/* ===== END FORM CARD / COMMENTS SPACING V1 ===== */
'''
FORM.write_text(form)

css = V7.read_text()
repls = {
    '/* ===== AUTHORITATIVE FINAL FORM TABS V11 ===== */': '/* ===== AUTHORITATIVE FINAL FORM TABS V12 ===== */',
    '/* ===== END AUTHORITATIVE FINAL FORM TABS V11 ===== */': '/* ===== END AUTHORITATIVE FINAL FORM TABS V12 ===== */',
    '\tgap: 8px !important;\n\twidth: max-content !important;': '\tgap: 10px !important;\n\twidth: max-content !important;',
    '\tpadding: 0 14px !important;\n\tborder: 0 !important;': '\tpadding: 8px 18px 0 !important;\n\tborder: 0 !important;',
    '\tborder-radius: 13px 13px 0 0 !important;\n\tbox-shadow: none !important;': '\tborder-radius: 14px 14px 0 0 !important;\n\tbox-shadow: none !important;',
    '\tmargin: 0 0 14px !important;\n\tpadding: 12px 16px 16px !important;': '\tmargin: 0 12px 8px !important;\n\tpadding: 12px 16px 16px !important;\n\tmin-height: 0 !important;\n\theight: auto !important;',
}
for old, new in repls.items():
    if old not in css:
        raise SystemExit(f'missing expected V11 fragment: {old[:70]}')
    css = css.replace(old, new, 1)
# Desktop radius must not be visually clipped; mobile restores scrolling.
old = '\toverflow-x: auto !important;\n\toverflow-y: hidden !important;\n\tscrollbar-width: none !important;'
new = '\toverflow: visible !important;\n\tscrollbar-width: none !important;'
if old not in css:
    raise SystemExit('outer tab overflow fragment missing')
css = css.replace(old, new, 1)
mobile_anchor = '@media (max-width: 767px) {\n\tbody .form-page .form-tabs-list .form-tabs,'
if mobile_anchor not in css:
    raise SystemExit('mobile tab block missing')
css = css.replace(mobile_anchor, '@media (max-width: 767px) {\n\tbody .form-page > .form-tabs-list,\n\tbody .form-layout .form-tabs-list,\n\tbody .std-form-layout .form-tabs-list { overflow-x: auto !important; overflow-y: hidden !important; }\n\tbody .form-page .form-tabs-list .form-tabs,', 1)
V7.write_text(css)

hooks = HOOKS.read_text()
for old, new in [
    ('/assets/saas_theme/css/form_surface.css?v=5', '/assets/saas_theme/css/form_surface.css?v=6'),
    ('/assets/saas_theme/css/ui_consolidation_v7.css?v=11', '/assets/saas_theme/css/ui_consolidation_v7.css?v=12'),
    ('/assets/saas_theme/js/interaction_finish_v2.js?v=6', '/assets/saas_theme/js/interaction_finish_v2.js?v=7'),
]:
    if hooks.count(old) != 1:
        raise SystemExit(f'hook token missing: {old}')
    hooks = hooks.replace(old, new, 1)
HOOKS.write_text(hooks)

js = JS.read_text()
old = '/assets/saas_theme/css/ui_consolidation_v7.css?v=11'
new = '/assets/saas_theme/css/ui_consolidation_v7.css?v=12'
if js.count(old) != 1:
    raise SystemExit('V11 STYLE_HREF missing')
JS.write_text(js.replace(old, new, 1))

validator = VALIDATOR.read_text()
validator = validator.replace('/assets/saas_theme/css/form_surface.css?v=5', '/assets/saas_theme/css/form_surface.css?v=6')
validator = validator.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=11', '/assets/saas_theme/css/ui_consolidation_v7.css?v=12')
validator = validator.replace('/assets/saas_theme/js/interaction_finish_v2.js?v=6', '/assets/saas_theme/js/interaction_finish_v2.js?v=7')
validator = validator.replace('AUTHORITATIVE FINAL FORM TABS V11', 'AUTHORITATIVE FINAL FORM TABS V12')
validator = validator.replace('"padding: 0 !important",', '"padding: 8px 18px 0 !important",', 1)
validator = validator.replace('"padding: 8px 14px 9px !important",', '"padding: 8px 14px 9px !important",', 1)
VALIDATOR.write_text(validator)

print('Applied compact form/footer spacing and V12 tab radius integration.')

from pathlib import Path

ROOT = Path('.')
V7 = ROOT / 'saas_theme/public/css/ui_consolidation_v7.css'
HOOKS = ROOT / 'saas_theme/hooks.py'
JS = ROOT / 'saas_theme/public/js/interaction_finish_v2.js'
VALIDATOR = ROOT / 'scripts/validate_theme_architecture.py'

START = '/* ===== AUTHORITATIVE FINAL FORM TABS V10 ===== */'
END = '/* ===== END AUTHORITATIVE FINAL FORM TABS V10 ===== */'

new_block = r'''/* ===== AUTHORITATIVE FINAL FORM TABS V11 ===== */
/* Exact reference tabs: neutral outer rail, baseline behind tabs, active tab open at bottom. */
body .form-page > .form-tabs-list,
body .form-layout .form-page > .form-tabs-list,
body .std-form-layout .form-page > .form-tabs-list,
body .form-layout .form-tabs-list,
body .std-form-layout .form-tabs-list {
	box-sizing: border-box !important;
	display: block !important;
	width: 100% !important;
	min-height: 0 !important;
	margin: 0 !important;
	padding: 0 !important;
	border: 0 !important;
	border-radius: 0 !important;
	background: #FFFFFF !important;
	box-shadow: none !important;
	overflow-x: auto !important;
	overflow-y: hidden !important;
	scrollbar-width: none !important;
}

body .form-tabs-list::-webkit-scrollbar { display: none !important; }

body .form-page .form-tabs-list .form-tabs,
body .std-form-layout .form-tabs-list .form-tabs,
body .form-tabs-list .form-tabs,
body .form-tabs-list .nav,
body .form-tabs-list .nav-tabs {
	box-sizing: border-box !important;
	position: relative !important;
	display: flex !important;
	align-items: flex-end !important;
	flex-wrap: nowrap !important;
	gap: 8px !important;
	width: max-content !important;
	min-width: 100% !important;
	margin: 0 !important;
	padding: 0 14px !important;
	border: 0 !important;
	border-radius: 0 !important;
	background: transparent !important;
	box-shadow: none !important;
	overflow: visible !important;
}

/* The blue baseline belongs to the inner tab row, behind the tab buttons. */
body .form-tabs-list .form-tabs::after {
	content: "" !important;
	position: absolute !important;
	left: 0 !important;
	right: 0 !important;
	bottom: 0 !important;
	height: 2px !important;
	background: #064ADB !important;
	z-index: 0 !important;
	pointer-events: none !important;
}

body .form-tabs-list .nav-item {
	position: relative !important;
	z-index: 1 !important;
	flex: 0 0 auto !important;
	margin: 0 !important;
	padding: 0 !important;
	background: transparent !important;
}

body .form-page .form-tabs-list .nav-link,
body .form-layout .form-tabs-list .nav-link,
body .std-form-layout .form-tabs-list .nav-link,
body .form-tabs-list .nav-item > a {
	box-sizing: border-box !important;
	position: relative !important;
	display: inline-flex !important;
	align-items: center !important;
	justify-content: center !important;
	min-height: 40px !important;
	margin: 0 !important;
	padding: 8px 14px 9px !important;
	border: 2px solid transparent !important;
	border-radius: 13px 13px 0 0 !important;
	background: transparent !important;
	color: #8A8A8A !important;
	font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
	font-size: 14px !important;
	font-weight: 500 !important;
	line-height: 1.2 !important;
	letter-spacing: 0 !important;
	white-space: nowrap !important;
	box-shadow: none !important;
	text-decoration: none !important;
	transition: color .14s ease !important;
}

body .form-tabs-list .nav-link:hover:not(.active),
body .form-tabs-list .nav-item > a:hover:not(.active) {
	background: transparent !important;
	border-color: transparent !important;
	color: #5F6672 !important;
	box-shadow: none !important;
}

body .form-page .form-tabs-list .nav-link.active,
body .form-layout .form-tabs-list .nav-link.active,
body .std-form-layout .form-tabs-list .nav-link.active,
body .form-tabs-list .nav-item.active > a,
body .form-tabs-list .nav-item > a.active {
	z-index: 3 !important;
	background: #FFFFFF !important;
	color: #064ADB !important;
	font-weight: 650 !important;
	border-top: 2px solid #064ADB !important;
	border-left: 2px solid #064ADB !important;
	border-right: 2px solid #064ADB !important;
	border-bottom: 0 !important;
	border-radius: 13px 13px 0 0 !important;
	box-shadow: none !important;
}

/* White mask fully removes the baseline under the active tab. */
body .form-tabs-list .nav-link.active::after,
body .form-tabs-list .nav-item.active > a::after,
body .form-tabs-list .nav-item > a.active::after {
	content: "" !important;
	display: block !important;
	position: absolute !important;
	left: 0 !important;
	right: 0 !important;
	bottom: -2px !important;
	height: 3px !important;
	background: #FFFFFF !important;
	z-index: 4 !important;
	pointer-events: none !important;
}

body .form-page .form-tab-content,
body .form-layout .form-tab-content,
body .std-form-layout .form-tab-content {
	box-sizing: border-box !important;
	margin: 0 0 14px !important;
	padding: 12px 16px 16px !important;
	border: 1px solid #D9E2EC !important;
	border-top: 0 !important;
	border-radius: 0 0 12px 12px !important;
	background: #FFFFFF !important;
	box-shadow: 0 8px 22px rgba(15, 23, 42, .04) !important;
}

[data-theme="dark"] body .form-page > .form-tabs-list,
[data-theme="dark"] body .form-layout .form-tabs-list,
[data-theme="dark"] body .std-form-layout .form-tabs-list { background: #111827 !important; }
[data-theme="dark"] body .form-tabs-list .form-tabs::after { background: #6B91FF !important; }
[data-theme="dark"] body .form-tabs-list .nav-link,
[data-theme="dark"] body .form-tabs-list .nav-item > a { color: #9AA7B8 !important; }
[data-theme="dark"] body .form-tabs-list .nav-link.active,
[data-theme="dark"] body .form-tabs-list .nav-item.active > a,
[data-theme="dark"] body .form-tabs-list .nav-item > a.active { background: #111827 !important; color: #8FB0FF !important; border-color: #6B91FF !important; border-bottom: 0 !important; }
[data-theme="dark"] body .form-tabs-list .nav-link.active::after,
[data-theme="dark"] body .form-tabs-list .nav-item.active > a::after,
[data-theme="dark"] body .form-tabs-list .nav-item > a.active::after { background: #111827 !important; }

@media (max-width: 767px) {
	body .form-page .form-tabs-list .form-tabs,
	body .std-form-layout .form-tabs-list .form-tabs,
	body .form-tabs-list .form-tabs,
	body .form-tabs-list .nav,
	body .form-tabs-list .nav-tabs { padding: 0 8px !important; gap: 4px !important; }
	body .form-tabs-list .nav-link,
	body .form-tabs-list .nav-item > a { min-height: 38px !important; padding: 7px 11px 8px !important; font-size: 13px !important; border-radius: 11px 11px 0 0 !important; }
}
/* ===== END AUTHORITATIVE FINAL FORM TABS V11 ===== */'''

css = V7.read_text()
if css.count(START) != 1 or css.count(END) != 1:
    raise SystemExit('Expected exactly one V10 form-tab block')
before, rest = css.split(START, 1)
_, after = rest.split(END, 1)
V7.write_text(before.rstrip() + '\n\n' + new_block + after)

hooks = HOOKS.read_text()
if hooks.count('/assets/saas_theme/css/ui_consolidation_v7.css?v=10') != 1:
    raise SystemExit('v10 CSS hook missing')
hooks = hooks.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=10', '/assets/saas_theme/css/ui_consolidation_v7.css?v=11', 1)
if hooks.count('/assets/saas_theme/js/interaction_finish_v2.js?v=5') != 1:
    raise SystemExit('interaction JS v5 hook missing')
hooks = hooks.replace('/assets/saas_theme/js/interaction_finish_v2.js?v=5', '/assets/saas_theme/js/interaction_finish_v2.js?v=6', 1)
HOOKS.write_text(hooks)

js = JS.read_text()
if js.count('/assets/saas_theme/css/ui_consolidation_v7.css?v=10') != 1:
    raise SystemExit('STYLE_HREF v10 missing')
JS.write_text(js.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=10', '/assets/saas_theme/css/ui_consolidation_v7.css?v=11', 1))

validator = VALIDATOR.read_text()
validator = validator.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=10', '/assets/saas_theme/css/ui_consolidation_v7.css?v=11')
validator = validator.replace('/assets/saas_theme/js/interaction_finish_v2.js?v=5', '/assets/saas_theme/js/interaction_finish_v2.js?v=6')
validator = validator.replace('AUTHORITATIVE FINAL FORM TABS V10', 'AUTHORITATIVE FINAL FORM TABS V11')
VALIDATOR.write_text(validator)

print('Applied V11 exact tab rail/baseline geometry.')

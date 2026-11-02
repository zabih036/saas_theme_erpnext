from pathlib import Path

ROOT = Path('.')
HOOKS = ROOT / 'saas_theme/hooks.py'
V7_CSS = ROOT / 'saas_theme/public/css/ui_consolidation_v7.css'
INTERACTION_JS = ROOT / 'saas_theme/public/js/interaction_finish_v2.js'
VALIDATOR = ROOT / 'scripts/validate_theme_architecture.py'

START = '/* ===== AUTHORITATIVE FINAL FORM TABS V8 ===== */'
END = '/* ===== END AUTHORITATIVE FINAL FORM TABS V8 ===== */'

new_block = r'''/* ===== AUTHORITATIVE FINAL FORM TABS V9 ===== */
/*
 * Compact first-paint form tabs.
 * This file is loaded statically from hooks.py and interaction_finish_v2.js keeps
 * the same link last in <head> after later precision styles are injected.
 */
body .form-page > .form-tabs-list,
body .form-layout .form-page > .form-tabs-list,
body .std-form-layout .form-page > .form-tabs-list,
body .form-layout .form-tabs-list,
body .std-form-layout .form-tabs-list {
	box-sizing: border-box !important;
	display: flex !important;
	align-items: flex-end !important;
	width: auto !important;
	min-height: 46px !important;
	margin: 0 8px !important;
	padding: 4px 10px 0 !important;
	border: 0 !important;
	border-bottom: 2px solid #064ADB !important;
	border-radius: 0 !important;
	background: #FFFFFF !important;
	box-shadow: none !important;
	overflow-x: auto !important;
	overflow-y: hidden !important;
	scrollbar-width: none !important;
}

body .form-tabs-list::-webkit-scrollbar {
	display: none !important;
}

body .form-tabs-list .form-tabs,
body .form-tabs-list .nav,
body .form-tabs-list .nav-tabs {
	display: flex !important;
	align-items: flex-end !important;
	flex-wrap: nowrap !important;
	gap: 6px !important;
	width: max-content !important;
	min-width: 100% !important;
	margin: 0 !important;
	padding: 0 !important;
	border: 0 !important;
	border-radius: 0 !important;
	background: #FFFFFF !important;
	box-shadow: none !important;
	overflow: visible !important;
}

body .form-tabs-list .nav-item {
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
	z-index: 1 !important;
	display: inline-flex !important;
	align-items: center !important;
	justify-content: center !important;
	min-height: 40px !important;
	margin: 0 0 -2px !important;
	padding: 8px 14px 9px !important;
	border: 2px solid transparent !important;
	border-radius: 11px 11px 0 0 !important;
	background: transparent !important;
	color: #7A8392 !important;
	font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
	font-size: 13px !important;
	font-weight: 520 !important;
	line-height: 1.25 !important;
	letter-spacing: 0 !important;
	white-space: nowrap !important;
	box-shadow: none !important;
	text-decoration: none !important;
	transition: color .14s ease, border-color .14s ease !important;
}

body .form-tabs-list .nav-link:hover:not(.active),
body .form-tabs-list .nav-item > a:hover:not(.active) {
	background: transparent !important;
	border-color: transparent !important;
	color: #344054 !important;
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
	border: 2px solid #064ADB !important;
	border-bottom-color: #FFFFFF !important;
	border-radius: 11px 11px 0 0 !important;
	box-shadow: none !important;
}

body .form-tabs-list .nav-link.active:hover,
body .form-tabs-list .nav-item.active > a:hover,
body .form-tabs-list .nav-item > a.active:hover {
	background: #FFFFFF !important;
	color: #064ADB !important;
	border-color: #064ADB #064ADB #FFFFFF !important;
	box-shadow: none !important;
}

body .form-tabs-list .nav-link.active::after,
body .form-tabs-list .nav-item.active > a::after,
body .form-tabs-list .nav-item > a.active::after {
	display: none !important;
	content: none !important;
}

body .form-tabs-list .nav-link:focus-visible,
body .form-tabs-list .nav-item > a:focus-visible {
	outline: 2px solid rgba(6, 74, 219, .20) !important;
	outline-offset: -3px !important;
}

body .form-page .form-tab-content,
body .form-layout .form-tab-content,
body .std-form-layout .form-tab-content {
	box-sizing: border-box !important;
	margin: -1px 8px 14px !important;
	padding: 12px 16px 16px !important;
	border: 1px solid #D9E2EC !important;
	border-top: 0 !important;
	border-radius: 0 0 12px 12px !important;
	background: #FFFFFF !important;
	box-shadow: 0 8px 22px rgba(15, 23, 42, .04) !important;
}

body .form-tabs-list.form-tabs-sticky-down {
	background: #FFFFFF !important;
	box-shadow: 0 6px 18px rgba(15, 23, 42, .06) !important;
}

[data-theme="dark"] body .form-page > .form-tabs-list,
[data-theme="dark"] body .form-layout .form-tabs-list,
[data-theme="dark"] body .std-form-layout .form-tabs-list,
[data-theme="dark"] body .form-tabs-list .form-tabs,
[data-theme="dark"] body .form-tabs-list .nav,
[data-theme="dark"] body .form-tabs-list .nav-tabs {
	background: #111827 !important;
}

[data-theme="dark"] body .form-page > .form-tabs-list,
[data-theme="dark"] body .form-layout .form-tabs-list,
[data-theme="dark"] body .std-form-layout .form-tabs-list {
	border-bottom-color: #6B91FF !important;
}

[data-theme="dark"] body .form-tabs-list .nav-link,
[data-theme="dark"] body .form-tabs-list .nav-item > a {
	color: #9AA7B8 !important;
}

[data-theme="dark"] body .form-tabs-list .nav-link:hover:not(.active),
[data-theme="dark"] body .form-tabs-list .nav-item > a:hover:not(.active) {
	color: #D4DCE7 !important;
}

[data-theme="dark"] body .form-tabs-list .nav-link.active,
[data-theme="dark"] body .form-tabs-list .nav-item.active > a,
[data-theme="dark"] body .form-tabs-list .nav-item > a.active,
[data-theme="dark"] body .form-tabs-list .nav-link.active:hover {
	background: #111827 !important;
	color: #8FB0FF !important;
	border-color: #6B91FF #6B91FF #111827 !important;
}

[data-theme="dark"] body .form-page .form-tab-content,
[data-theme="dark"] body .form-layout .form-tab-content,
[data-theme="dark"] body .std-form-layout .form-tab-content {
	background: #151B24 !important;
	border-color: #2C394A !important;
	border-top: 0 !important;
	box-shadow: 0 12px 26px rgba(0, 0, 0, .20) !important;
}

@media (max-width: 767px) {
	body .form-page > .form-tabs-list,
	body .form-layout .form-tabs-list,
	body .std-form-layout .form-tabs-list {
		min-height: 44px !important;
		margin: 0 6px !important;
		padding: 4px 6px 0 !important;
	}

	body .form-tabs-list .form-tabs,
	body .form-tabs-list .nav,
	body .form-tabs-list .nav-tabs {
		gap: 3px !important;
	}

	body .form-tabs-list .nav-link,
	body .form-tabs-list .nav-item > a {
		min-height: 38px !important;
		padding: 7px 12px 8px !important;
		font-size: 12.75px !important;
		border-radius: 10px 10px 0 0 !important;
	}

	body .form-page .form-tab-content,
	body .form-layout .form-tab-content,
	body .std-form-layout .form-tab-content {
		margin-left: 6px !important;
		margin-right: 6px !important;
		border-radius: 0 0 10px 10px !important;
	}
}
/* ===== END AUTHORITATIVE FINAL FORM TABS V9 ===== */'''

css = V7_CSS.read_text()
if css.count(START) != 1 or css.count(END) != 1:
    raise SystemExit('Expected exactly one V8 form-tab block')
before, rest = css.split(START, 1)
_, after = rest.split(END, 1)
V7_CSS.write_text(before.rstrip() + '\n\n' + new_block + after)

# Load the authoritative tab CSS before first paint. Keep it at the end of the
# normal Desk CSS list so its compact geometry is present immediately.
hooks = HOOKS.read_text()
anchor = '\t"/assets/saas_theme/css/compact_autocomplete_and_form_gap_v4.css?v=4",\n]'
replacement = '\t"/assets/saas_theme/css/compact_autocomplete_and_form_gap_v4.css?v=4",\n\t"/assets/saas_theme/css/ui_consolidation_v7.css?v=9",\n]'
if hooks.count(anchor) != 1:
    raise SystemExit('Desk CSS tail anchor missing')
hooks = hooks.replace(anchor, replacement, 1)
if hooks.count('/assets/saas_theme/js/interaction_finish_v2.js?v=3') != 1:
    raise SystemExit('interaction_finish_v2.js hook version anchor missing')
hooks = hooks.replace('/assets/saas_theme/js/interaction_finish_v2.js?v=3', '/assets/saas_theme/js/interaction_finish_v2.js?v=4', 1)
HOOKS.write_text(hooks)

# Reuse the statically-loaded stylesheet instead of creating a second link.
js = INTERACTION_JS.read_text()
if js.count('/assets/saas_theme/css/ui_consolidation_v7.css?v=8') != 1:
    raise SystemExit('V8 STYLE_HREF anchor missing')
js = js.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=8', '/assets/saas_theme/css/ui_consolidation_v7.css?v=9', 1)
old = '''\t\tlet link = document.getElementById(STYLE_ID);\n\t\tif (!link) {\n\t\t\tlink = document.createElement("link");\n\t\t\tlink.id = STYLE_ID;\n\t\t\tlink.rel = "stylesheet";\n\t\t\tlink.href = STYLE_HREF;\n\t\t\tdocument.head.appendChild(link);\n\t\t\treturn;\n\t\t}\n\t\tif (document.head.lastElementChild !== link) document.head.appendChild(link);'''
new = '''\t\tlet link = document.getElementById(STYLE_ID) ||\n\t\t\tdocument.querySelector('link[rel="stylesheet"][href*="/assets/saas_theme/css/ui_consolidation_v7.css"]');\n\t\tif (link && !link.id) link.id = STYLE_ID;\n\t\tif (!link) {\n\t\t\tlink = document.createElement("link");\n\t\t\tlink.id = STYLE_ID;\n\t\t\tlink.rel = "stylesheet";\n\t\t\tlink.href = STYLE_HREF;\n\t\t\tdocument.head.appendChild(link);\n\t\t\treturn;\n\t\t}\n\t\tif (document.head.lastElementChild !== link) document.head.appendChild(link);'''
if js.count(old) != 1:
    raise SystemExit('ensureStyleLast anchor missing')
INTERACTION_JS.write_text(js.replace(old, new, 1))

# Keep architecture validation exact and protect first-paint reuse behavior.
validator = VALIDATOR.read_text()
css_tail = '    "/assets/saas_theme/css/compact_autocomplete_and_form_gap_v4.css?v=4",\n]'
css_tail_new = '    "/assets/saas_theme/css/compact_autocomplete_and_form_gap_v4.css?v=4",\n    "/assets/saas_theme/css/ui_consolidation_v7.css?v=9",\n]'
if validator.count(css_tail) != 1:
    raise SystemExit('validator Desk CSS tail anchor missing')
validator = validator.replace(css_tail, css_tail_new, 1)
if validator.count('/assets/saas_theme/js/interaction_finish_v2.js?v=3') != 1:
    raise SystemExit('validator JS version anchor missing')
validator = validator.replace('/assets/saas_theme/js/interaction_finish_v2.js?v=3', '/assets/saas_theme/js/interaction_finish_v2.js?v=4', 1)
validator = validator.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=8', '/assets/saas_theme/css/ui_consolidation_v7.css?v=9')
validator = validator.replace('AUTHORITATIVE FINAL FORM TABS V8', 'AUTHORITATIVE FINAL FORM TABS V9')
old_guard = '        "border-bottom-color: #FFFFFF",\n'
new_guard = '        "border-bottom-color: #FFFFFF",\n        "min-height: 46px",\n        "padding: 4px 10px 0",\n        "font-size: 13px",\n'
if validator.count(old_guard) != 1:
    raise SystemExit('v7 guard anchor missing')
validator = validator.replace(old_guard, new_guard, 1)
interaction_guard = '        "/assets/saas_theme/css/ui_consolidation_v7.css?v=9",\n'
if validator.count(interaction_guard) != 1:
    raise SystemExit('interaction v9 guard missing')
validator = validator.replace(
    interaction_guard,
    interaction_guard + '        \'document.querySelector(\'link[rel="stylesheet"][href*="/assets/saas_theme/css/ui_consolidation_v7.css"]\')\',\n',
    1,
)
VALIDATOR.write_text(validator)

print('Applied compact first-paint tabs with static v7 CSS reuse.')

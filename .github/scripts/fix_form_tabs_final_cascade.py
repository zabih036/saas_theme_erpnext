from pathlib import Path

surface = Path('saas_theme/public/css/form_surface.css')
hooks = Path('saas_theme/hooks.py')
validator = Path('scripts/validate_theme_architecture.py')

css = surface.read_text()
marker = '/* ===== FINAL FORM TAB REFERENCE CASCADE START ===== */'
if marker in css:
    raise SystemExit('final form tab cascade already present')

css += r'''

/* ===== FINAL FORM TAB REFERENCE CASCADE START ===== */
/* Final visual owner for form tabs after legacy bundled form-surface rules. */
.form-page .form-tabs-list,
.std-form-layout .form-tabs-list,
.form-layout .form-tabs-list,
.form-tabs-list {
	box-sizing: border-box !important;
	display: flex !important;
	align-items: flex-end !important;
	width: 100% !important;
	min-height: 58px !important;
	margin: 0 0 16px !important;
	padding: 8px 26px 0 !important;
	border: 0 !important;
	border-bottom: 2px solid #064ADB !important;
	border-radius: 0 !important;
	background: #FFFFFF !important;
	box-shadow: none !important;
	overflow-x: auto !important;
	overflow-y: hidden !important;
	scrollbar-width: none !important;
}

.form-page .form-tabs-list::-webkit-scrollbar,
.std-form-layout .form-tabs-list::-webkit-scrollbar,
.form-layout .form-tabs-list::-webkit-scrollbar,
.form-tabs-list::-webkit-scrollbar {
	display: none !important;
}

.form-tabs-list .form-tabs,
.form-tabs-list .nav,
.form-tabs-list .nav-tabs {
	display: flex !important;
	align-items: flex-end !important;
	flex-wrap: nowrap !important;
	gap: 4px !important;
	width: max-content !important;
	min-width: 100% !important;
	margin: 0 !important;
	padding: 0 !important;
	border: 0 !important;
	background: transparent !important;
	box-shadow: none !important;
	overflow: visible !important;
}

.form-tabs-list .nav-item {
	flex: 0 0 auto !important;
	margin: 0 !important;
	padding: 0 !important;
	background: transparent !important;
}

.form-page .form-tabs-list .nav-link,
.std-form-layout .form-tabs-list .nav-link,
.form-layout .form-tabs-list .nav-link,
.form-tabs-list .nav-link,
.form-tabs-list .nav-item > a {
	box-sizing: border-box !important;
	position: relative !important;
	z-index: 1 !important;
	display: inline-flex !important;
	align-items: center !important;
	justify-content: center !important;
	min-height: 46px !important;
	margin: 0 0 -2px !important;
	padding: 11px 22px 12px !important;
	border: 2px solid transparent !important;
	border-radius: 15px 15px 0 0 !important;
	background: transparent !important;
	color: #8A8D93 !important;
	font-size: 15px !important;
	font-weight: 500 !important;
	line-height: 1.2 !important;
	white-space: nowrap !important;
	box-shadow: none !important;
	text-decoration: none !important;
	transition: color .15s ease !important;
}

.form-tabs-list .nav-link:hover:not(.active),
.form-tabs-list .nav-item > a:hover:not(.active) {
	background: transparent !important;
	border-color: transparent !important;
	color: #4B5563 !important;
	box-shadow: none !important;
}

.form-page .form-tabs-list .nav-link.active,
.std-form-layout .form-tabs-list .nav-link.active,
.form-layout .form-tabs-list .nav-link.active,
.form-tabs-list .nav-link.active,
.form-tabs-list .nav-item.active > a,
.form-tabs-list .nav-item > a.active {
	z-index: 3 !important;
	background: #FFFFFF !important;
	color: #064ADB !important;
	font-weight: 700 !important;
	border-color: #064ADB #064ADB #FFFFFF !important;
	box-shadow: none !important;
}

.form-tabs-list .nav-link.active::after,
.form-tabs-list .nav-item.active > a::after,
.form-tabs-list .nav-item > a.active::after {
	display: none !important;
	content: none !important;
}

.form-tabs-list .nav-link:focus-visible,
.form-tabs-list .nav-item > a:focus-visible {
	outline: 2px solid rgba(6, 74, 219, .24) !important;
	outline-offset: -4px !important;
}

.form-page .form-tabs-list.form-tabs-sticky-down,
.std-form-layout .form-tabs-list.form-tabs-sticky-down,
.form-layout .form-tabs-list.form-tabs-sticky-down,
.form-tabs-list.form-tabs-sticky-down {
	background: #FFFFFF !important;
	box-shadow: 0 6px 16px rgba(15, 23, 42, .05) !important;
}

[data-theme="dark"] .form-page .form-tabs-list,
[data-theme="dark"] .std-form-layout .form-tabs-list,
[data-theme="dark"] .form-layout .form-tabs-list,
[data-theme="dark"] .form-tabs-list {
	background: #111827 !important;
	border-bottom-color: #6B91FF !important;
}

[data-theme="dark"] .form-tabs-list .nav-link,
[data-theme="dark"] .form-tabs-list .nav-item > a {
	color: #9AA7B8 !important;
}

[data-theme="dark"] .form-tabs-list .nav-link:hover:not(.active),
[data-theme="dark"] .form-tabs-list .nav-item > a:hover:not(.active) {
	color: #D4DCE7 !important;
}

[data-theme="dark"] .form-tabs-list .nav-link.active,
[data-theme="dark"] .form-tabs-list .nav-item.active > a,
[data-theme="dark"] .form-tabs-list .nav-item > a.active {
	background: #111827 !important;
	color: #8FB0FF !important;
	border-color: #6B91FF #6B91FF #111827 !important;
}

[data-theme="dark"] .form-tabs-list.form-tabs-sticky-down {
	background: #111827 !important;
}

@media (max-width: 767px) {
	.form-page .form-tabs-list,
	.std-form-layout .form-tabs-list,
	.form-layout .form-tabs-list,
	.form-tabs-list {
		min-height: 54px !important;
		padding: 7px 12px 0 !important;
	}

	.form-tabs-list .nav-link,
	.form-tabs-list .nav-item > a {
		min-height: 42px !important;
		padding: 9px 16px 10px !important;
		font-size: 14px !important;
	}
}
/* ===== FINAL FORM TAB REFERENCE CASCADE END ===== */
'''

surface.write_text(css)

old = '/assets/saas_theme/css/form_surface.css?v=1'
new = '/assets/saas_theme/css/form_surface.css?v=2'
for path in (hooks, validator):
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'expected one {old} in {path}')
    path.write_text(text.replace(old, new, 1))

print('Applied final form tab cascade and bumped form_surface.css to v2')

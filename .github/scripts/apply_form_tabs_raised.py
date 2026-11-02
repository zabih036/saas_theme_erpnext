from pathlib import Path

form = Path('saas_theme/public/css/form.css')
hooks = Path('saas_theme/hooks.py')
validator = Path('scripts/validate_theme_architecture.py')

css = form.read_text()
hooks_text = hooks.read_text()
validator_text = validator.read_text()

marker = '/* ===== FORM TABS RAISED OUTLINE V2 START ===== */'
if marker in css:
    raise SystemExit('Raised form-tab style already exists')

css += r'''

/* ===== FORM TABS RAISED OUTLINE V2 START ===== */
/*
 * Reference style: continuous blue baseline with a white raised active tab.
 * Sticky positioning remains owned by the existing interaction/stability layer.
 */
.form-page .form-tabs-list,
.form-layout .form-tabs-list {
	box-sizing: border-box !important;
	position: relative !important;
	display: flex !important;
	align-items: flex-end !important;
	width: 100% !important;
	min-height: 62px !important;
	margin: 0 0 14px !important;
	padding: 8px 28px 0 !important;
	border: 0 !important;
	border-bottom: 2px solid #0759e6 !important;
	border-radius: 0 !important;
	background: transparent !important;
	box-shadow: none !important;
	overflow-x: auto !important;
	overflow-y: hidden !important;
	scrollbar-width: none;
}

.form-page .form-tabs-list::-webkit-scrollbar,
.form-layout .form-tabs-list::-webkit-scrollbar {
	display: none;
}

.form-page .form-tabs-list .nav,
.form-page .form-tabs-list .nav-tabs,
.form-layout .form-tabs-list .nav,
.form-layout .form-tabs-list .nav-tabs {
	display: flex !important;
	align-items: flex-end !important;
	flex-wrap: nowrap !important;
	gap: 10px !important;
	width: max-content !important;
	min-width: 100% !important;
	margin: 0 !important;
	padding: 0 !important;
	border: 0 !important;
	background: transparent !important;
}

.form-page .form-tabs-list .nav-item,
.form-layout .form-tabs-list .nav-item {
	flex: 0 0 auto !important;
	margin: 0 !important;
	padding: 0 !important;
	background: transparent !important;
}

.form-page .form-tabs-list .nav-link,
.form-page .form-tabs-list .nav-item > a,
.form-layout .form-tabs-list .nav-link,
.form-layout .form-tabs-list .nav-item > a {
	box-sizing: border-box !important;
	position: relative !important;
	z-index: 1 !important;
	display: inline-flex !important;
	align-items: center !important;
	justify-content: center !important;
	min-height: 48px !important;
	margin: 0 0 -2px !important;
	padding: 12px 22px 13px !important;
	border: 2px solid transparent !important;
	border-radius: 14px 14px 0 0 !important;
	background: transparent !important;
	color: #7a7f87 !important;
	font-size: 15px !important;
	font-weight: 500 !important;
	line-height: 1.2 !important;
	letter-spacing: 0 !important;
	white-space: nowrap !important;
	box-shadow: none !important;
	text-decoration: none !important;
	transition: color .16s ease, background .16s ease, border-color .16s ease !important;
}

.form-page .form-tabs-list .nav-link:hover,
.form-page .form-tabs-list .nav-item > a:hover,
.form-layout .form-tabs-list .nav-link:hover,
.form-layout .form-tabs-list .nav-item > a:hover {
	background: #f7faff !important;
	color: #0759e6 !important;
	border-color: transparent !important;
}

.form-page .form-tabs-list .nav-link.active,
.form-page .form-tabs-list .nav-item.active > a,
.form-page .form-tabs-list .nav-item > a.active,
.form-layout .form-tabs-list .nav-link.active,
.form-layout .form-tabs-list .nav-item.active > a,
.form-layout .form-tabs-list .nav-item > a.active {
	z-index: 3 !important;
	background: #ffffff !important;
	color: #0759e6 !important;
	font-weight: 700 !important;
	border-color: #0759e6 #0759e6 #ffffff !important;
	box-shadow: none !important;
}

.form-page .form-tabs-list .nav-link.active:hover,
.form-page .form-tabs-list .nav-item.active > a:hover,
.form-layout .form-tabs-list .nav-link.active:hover,
.form-layout .form-tabs-list .nav-item.active > a:hover {
	background: #ffffff !important;
	color: #0759e6 !important;
}

.form-page .form-tabs-list .nav-link:focus-visible,
.form-page .form-tabs-list .nav-item > a:focus-visible,
.form-layout .form-tabs-list .nav-link:focus-visible,
.form-layout .form-tabs-list .nav-item > a:focus-visible {
	outline: 2px solid rgba(7, 89, 230, .28) !important;
	outline-offset: -4px !important;
}

/* Sticky tabs retain the same visual surface when Frappe pins the rail. */
.form-page .form-tabs-list.form-tabs-sticky-down,
.form-layout .form-tabs-list.form-tabs-sticky-down {
	background: #ffffff !important;
	box-shadow: 0 6px 16px rgba(15, 23, 42, .055) !important;
}

[data-theme="dark"] .form-page .form-tabs-list,
[data-theme="dark"] .form-layout .form-tabs-list {
	border-bottom-color: #6b91ff !important;
}

[data-theme="dark"] .form-page .form-tabs-list .nav-link,
[data-theme="dark"] .form-page .form-tabs-list .nav-item > a,
[data-theme="dark"] .form-layout .form-tabs-list .nav-link,
[data-theme="dark"] .form-layout .form-tabs-list .nav-item > a {
	color: #9aa7b8 !important;
}

[data-theme="dark"] .form-page .form-tabs-list .nav-link:hover,
[data-theme="dark"] .form-page .form-tabs-list .nav-item > a:hover,
[data-theme="dark"] .form-layout .form-tabs-list .nav-link:hover,
[data-theme="dark"] .form-layout .form-tabs-list .nav-item > a:hover {
	background: rgba(107, 145, 255, .08) !important;
	color: #8fb0ff !important;
}

[data-theme="dark"] .form-page .form-tabs-list .nav-link.active,
[data-theme="dark"] .form-page .form-tabs-list .nav-item.active > a,
[data-theme="dark"] .form-page .form-tabs-list .nav-item > a.active,
[data-theme="dark"] .form-layout .form-tabs-list .nav-link.active,
[data-theme="dark"] .form-layout .form-tabs-list .nav-item.active > a,
[data-theme="dark"] .form-layout .form-tabs-list .nav-item > a.active {
	background: #111827 !important;
	color: #8fb0ff !important;
	border-color: #6b91ff #6b91ff #111827 !important;
}

[data-theme="dark"] .form-page .form-tabs-list.form-tabs-sticky-down,
[data-theme="dark"] .form-layout .form-tabs-list.form-tabs-sticky-down {
	background: #111827 !important;
	box-shadow: 0 8px 20px rgba(0, 0, 0, .22) !important;
}

@media (max-width: 768px) {
	.form-page .form-tabs-list,
	.form-layout .form-tabs-list {
		min-height: 56px !important;
		padding-left: 14px !important;
		padding-right: 14px !important;
	}

	.form-page .form-tabs-list .nav-link,
	.form-page .form-tabs-list .nav-item > a,
	.form-layout .form-tabs-list .nav-link,
	.form-layout .form-tabs-list .nav-item > a {
		min-height: 44px !important;
		padding: 10px 17px 11px !important;
		font-size: 14px !important;
	}
}
/* ===== FORM TABS RAISED OUTLINE V2 END ===== */
'''

old_asset = '/assets/saas_theme/css/form.css?v=1'
new_asset = '/assets/saas_theme/css/form.css?v=2'
for label, text in [('hooks', hooks_text), ('validator', validator_text)]:
    if text.count(old_asset) != 1:
        raise SystemExit(f'Expected one {old_asset} reference in {label}')

hooks_text = hooks_text.replace(old_asset, new_asset, 1)
validator_text = validator_text.replace(old_asset, new_asset, 1)

form.write_text(css)
hooks.write_text(hooks_text)
validator.write_text(validator_text)
print('Applied raised-outline form tab design and bumped form.css cache version to v2.')

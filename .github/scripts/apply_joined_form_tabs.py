from pathlib import Path

surface = Path('saas_theme/public/css/form_surface.css')
hooks = Path('saas_theme/hooks.py')
validator = Path('scripts/validate_theme_architecture.py')

css = surface.read_text()
start = '/* ===== FINAL FORM TAB REFERENCE CASCADE START ===== */'
end = '/* ===== FINAL FORM TAB REFERENCE CASCADE END ===== */'
if css.count(start) != 1 or css.count(end) != 1:
    raise SystemExit('Expected exactly one final form-tab cascade block')

new_block = r'''/* ===== FINAL FORM TAB REFERENCE CASCADE START ===== */
/*
 * Integrated form tabs: one continuous card with the form body below.
 * The tab rail owns the top corners; the form body owns the bottom corners.
 * Sticky positioning remains controlled by the existing stability layer.
 */
.form-page > .form-tabs-list,
.form-page .std-form-layout > .form-tabs-list,
.form-page .form-layout > .form-tabs-list {
	box-sizing: border-box !important;
	position: relative !important;
	z-index: 2 !important;
	display: flex !important;
	align-items: flex-end !important;
	width: 100% !important;
	min-height: 64px !important;
	margin: 0 !important;
	padding: 14px 28px 0 !important;
	border: 1px solid #D9E2EC !important;
	border-bottom: 2px solid #064ADB !important;
	border-radius: 16px 16px 0 0 !important;
	background: #FFFFFF !important;
	box-shadow: 0 -1px 0 rgba(15, 23, 42, .02), 0 8px 20px rgba(15, 23, 42, .035) !important;
	overflow-x: auto !important;
	overflow-y: hidden !important;
	scrollbar-width: none !important;
}

.form-page > .form-tabs-list::-webkit-scrollbar,
.form-page .std-form-layout > .form-tabs-list::-webkit-scrollbar,
.form-page .form-layout > .form-tabs-list::-webkit-scrollbar {
	display: none !important;
}

.form-page > .form-tabs-list .form-tabs,
.form-page > .form-tabs-list .nav,
.form-page > .form-tabs-list .nav-tabs,
.form-page .std-form-layout > .form-tabs-list .form-tabs,
.form-page .std-form-layout > .form-tabs-list .nav-tabs,
.form-page .form-layout > .form-tabs-list .form-tabs,
.form-page .form-layout > .form-tabs-list .nav-tabs {
	display: flex !important;
	align-items: flex-end !important;
	flex-wrap: nowrap !important;
	gap: 8px !important;
	width: max-content !important;
	min-width: 100% !important;
	margin: 0 !important;
	padding: 0 !important;
	border: 0 !important;
	background: transparent !important;
	box-shadow: none !important;
	overflow: visible !important;
}

.form-page > .form-tabs-list .nav-item,
.form-page .std-form-layout > .form-tabs-list .nav-item,
.form-page .form-layout > .form-tabs-list .nav-item {
	flex: 0 0 auto !important;
	margin: 0 !important;
	padding: 0 !important;
	background: transparent !important;
}

.form-page > .form-tabs-list .nav-link,
.form-page > .form-tabs-list .nav-item > a,
.form-page .std-form-layout > .form-tabs-list .nav-link,
.form-page .form-layout > .form-tabs-list .nav-link {
	box-sizing: border-box !important;
	position: relative !important;
	z-index: 1 !important;
	display: inline-flex !important;
	align-items: center !important;
	justify-content: center !important;
	min-height: 48px !important;
	margin: 0 0 -2px !important;
	padding: 11px 24px 12px !important;
	border: 2px solid transparent !important;
	border-radius: 16px 16px 0 0 !important;
	background: transparent !important;
	color: #8A8D93 !important;
	font-size: 15px !important;
	font-weight: 500 !important;
	line-height: 1.2 !important;
	letter-spacing: 0 !important;
	white-space: nowrap !important;
	box-shadow: none !important;
	text-decoration: none !important;
	transition: color .16s ease, border-color .16s ease, background-color .16s ease !important;
}

.form-page > .form-tabs-list .nav-link:hover:not(.active),
.form-page > .form-tabs-list .nav-item > a:hover:not(.active),
.form-page .std-form-layout > .form-tabs-list .nav-link:hover:not(.active),
.form-page .form-layout > .form-tabs-list .nav-link:hover:not(.active) {
	background: transparent !important;
	border-color: transparent !important;
	color: #4B5563 !important;
	box-shadow: none !important;
}

.form-page > .form-tabs-list .nav-link.active,
.form-page > .form-tabs-list .nav-item.active > a,
.form-page > .form-tabs-list .nav-item > a.active,
.form-page .std-form-layout > .form-tabs-list .nav-link.active,
.form-page .form-layout > .form-tabs-list .nav-link.active {
	z-index: 3 !important;
	background: #FFFFFF !important;
	color: #064ADB !important;
	font-weight: 700 !important;
	border-color: #064ADB #064ADB #FFFFFF !important;
	box-shadow: none !important;
}

.form-page > .form-tabs-list .nav-link.active::after,
.form-page > .form-tabs-list .nav-item.active > a::after,
.form-page > .form-tabs-list .nav-item > a.active::after {
	display: none !important;
	content: none !important;
}

/* Join the tab rail and form body into one card. */
.form-page > .form-tabs-list + .form-layout,
.form-page > .form-tabs-list + .std-form-layout,
.form-page > .form-tabs-list ~ .form-layout,
.form-page > .form-tabs-list ~ .std-form-layout {
	position: relative !important;
	z-index: 1 !important;
	margin-top: -1px !important;
	border-top: 0 !important;
	border-radius: 0 0 16px 16px !important;
	background: #FFFFFF !important;
	box-shadow: 0 14px 32px rgba(15, 23, 42, .055) !important;
}

.form-page > .form-tabs-list + .form-layout::before,
.form-page > .form-tabs-list + .std-form-layout::before,
.form-page > .form-tabs-list ~ .form-layout::before,
.form-page > .form-tabs-list ~ .std-form-layout::before {
	display: none !important;
	content: none !important;
}

.form-page > .form-tabs-list .nav-link:focus-visible,
.form-page > .form-tabs-list .nav-item > a:focus-visible {
	outline: 2px solid rgba(6, 74, 219, .22) !important;
	outline-offset: -4px !important;
}

/* Sticky state becomes a compact floating rail only while Frappe pins it. */
.form-page > .form-tabs-list.form-tabs-sticky-down,
.form-page .std-form-layout > .form-tabs-list.form-tabs-sticky-down,
.form-page .form-layout > .form-tabs-list.form-tabs-sticky-down {
	border-radius: 0 0 12px 12px !important;
	background: #FFFFFF !important;
	box-shadow: 0 8px 22px rgba(15, 23, 42, .08) !important;
}

[data-theme="dark"] .form-page > .form-tabs-list,
[data-theme="dark"] .form-page .std-form-layout > .form-tabs-list,
[data-theme="dark"] .form-page .form-layout > .form-tabs-list {
	border-color: #2C394A !important;
	border-bottom-color: #6B91FF !important;
	background: #111827 !important;
}

[data-theme="dark"] .form-page > .form-tabs-list .nav-link,
[data-theme="dark"] .form-page > .form-tabs-list .nav-item > a {
	color: #9AA7B8 !important;
}

[data-theme="dark"] .form-page > .form-tabs-list .nav-link:hover:not(.active),
[data-theme="dark"] .form-page > .form-tabs-list .nav-item > a:hover:not(.active) {
	color: #D4DCE7 !important;
}

[data-theme="dark"] .form-page > .form-tabs-list .nav-link.active,
[data-theme="dark"] .form-page > .form-tabs-list .nav-item.active > a,
[data-theme="dark"] .form-page > .form-tabs-list .nav-item > a.active {
	background: #111827 !important;
	color: #8FB0FF !important;
	border-color: #6B91FF #6B91FF #111827 !important;
}

[data-theme="dark"] .form-page > .form-tabs-list + .form-layout,
[data-theme="dark"] .form-page > .form-tabs-list + .std-form-layout,
[data-theme="dark"] .form-page > .form-tabs-list ~ .form-layout,
[data-theme="dark"] .form-page > .form-tabs-list ~ .std-form-layout {
	background: #151B24 !important;
	border-color: #2C394A !important;
	border-top: 0 !important;
	box-shadow: 0 16px 34px rgba(0, 0, 0, .24) !important;
}

[data-theme="dark"] .form-page > .form-tabs-list.form-tabs-sticky-down {
	background: #111827 !important;
}

@media (max-width: 767px) {
	.form-page > .form-tabs-list,
	.form-page .std-form-layout > .form-tabs-list,
	.form-page .form-layout > .form-tabs-list {
		min-height: 56px !important;
		padding: 10px 14px 0 !important;
		border-radius: 14px 14px 0 0 !important;
	}

	.form-page > .form-tabs-list .nav-link,
	.form-page > .form-tabs-list .nav-item > a,
	.form-page .std-form-layout > .form-tabs-list .nav-link,
	.form-page .form-layout > .form-tabs-list .nav-link {
		min-height: 44px !important;
		padding: 10px 17px 11px !important;
		font-size: 14px !important;
		border-radius: 14px 14px 0 0 !important;
	}

	.form-page > .form-tabs-list + .form-layout,
	.form-page > .form-tabs-list + .std-form-layout,
	.form-page > .form-tabs-list ~ .form-layout,
	.form-page > .form-tabs-list ~ .std-form-layout {
		border-radius: 0 0 14px 14px !important;
	}
}
/* ===== FINAL FORM TAB REFERENCE CASCADE END ===== */'''

before, rest = css.split(start, 1)
_, after = rest.split(end, 1)
surface.write_text(before + new_block + after)

old = '/assets/saas_theme/css/form_surface.css?v=2'
new = '/assets/saas_theme/css/form_surface.css?v=3'
for path in (hooks, validator):
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'Expected one {old} in {path}')
    path.write_text(text.replace(old, new, 1))

print('Replaced final form-tab block with joined-card design and bumped form_surface.css to v3.')

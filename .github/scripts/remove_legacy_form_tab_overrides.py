from pathlib import Path

surface = Path('saas_theme/public/css/form_surface.css')
hooks = Path('saas_theme/hooks.py')
validator = Path('scripts/validate_theme_architecture.py')

css = surface.read_text()

start1 = "/* =========================================================\n   FORM TABS — QUIETER RAIL, CLEAR ACTIVE STATE\n   ========================================================= */"
end1 = "/* =========================================================\n   CONTROLS — MODERN ENTERPRISE DENSITY"
if css.count(start1) != 1 or css.count(end1) < 1:
    raise SystemExit('Could not locate first historical form-tab block')
pre, rest = css.split(start1, 1)
_, post = rest.split(end1, 1)
css = pre + "/* Form-tab appearance is owned by the final reference block below. */\n\n" + end1 + post

start2 = "/* The tab rail is one small surface; the active tab remains the only strong blue. */"
end2 = "/* Main tab content becomes the professional white card the form was missing. */"
if css.count(start2) != 1 or css.count(end2) != 1:
    raise SystemExit('Could not locate second historical form-tab block')
pre, rest = css.split(start2, 1)
_, post = rest.split(end2, 1)
css = pre + "/* Legacy filled-blue tab styling removed; final reference block below is authoritative. */\n\n" + end2 + post

content_start = "/* Main tab content becomes the professional white card the form was missing. */"
content_end = "/* Remove the long grey bands/dividers introduced by the previous pass. */"
if css.count(content_start) != 1 or css.count(content_end) != 1:
    raise SystemExit('Could not locate form-tab-content card block')
joined_content = r'''/* Main tab content joins directly to the reference-style tab rail. */
.form-page .form-tab-content,
.std-form-layout .form-tab-content,
.form-layout .form-tab-content {
	box-sizing: border-box !important;
	margin: -1px 12px 14px !important;
	padding: 14px 16px 16px !important;
	border: 1px solid var(--st-pf-border) !important;
	border-top: 0 !important;
	border-radius: 0 0 14px 14px !important;
	background: var(--st-pf-card) !important;
	box-shadow: 0 12px 28px rgba(20, 33, 61, .055) !important;
}

'''
pre, rest = css.split(content_start, 1)
_, post = rest.split(content_end, 1)
css = pre + joined_content + content_end + post

final_start = "/* ===== FINAL FORM TAB REFERENCE CASCADE START ===== */"
final_end = "/* ===== FINAL FORM TAB REFERENCE CASCADE END ===== */"
if css.count(final_start) != 1 or css.count(final_end) != 1:
    raise SystemExit('Expected exactly one final reference form-tab block')

final_block = r'''/* ===== FINAL FORM TAB REFERENCE CASCADE START ===== */
/* Authoritative visual owner for Frappe form tabs. */
.form-page .form-tabs-list,
.form-layout .form-tabs-list,
.std-form-layout .form-tabs-list,
.form-tabs-list {
	box-sizing: border-box !important;
	display: flex !important;
	align-items: flex-end !important;
	width: auto !important;
	min-height: 62px !important;
	margin: 0 12px !important;
	padding: 12px 22px 0 !important;
	border: 1px solid #D9E2EC !important;
	border-bottom: 2px solid #064ADB !important;
	border-radius: 14px 14px 0 0 !important;
	background: #FFFFFF !important;
	box-shadow: 0 5px 16px rgba(15, 23, 42, .035) !important;
	overflow-x: auto !important;
	overflow-y: hidden !important;
	scrollbar-width: none !important;
}

.form-tabs-list::-webkit-scrollbar {
	display: none !important;
}

.form-tabs-list .form-tabs,
.form-tabs-list .nav,
.form-tabs-list .nav-tabs {
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

.form-tabs-list .nav-item {
	flex: 0 0 auto !important;
	margin: 0 !important;
	padding: 0 !important;
	background: transparent !important;
}

.form-page .form-tabs-list .nav-link,
.form-layout .form-tabs-list .nav-link,
.std-form-layout .form-tabs-list .nav-link,
.form-tabs-list .nav-link,
.form-tabs-list .nav-item > a {
	box-sizing: border-box !important;
	position: relative !important;
	z-index: 1 !important;
	display: inline-flex !important;
	align-items: center !important;
	justify-content: center !important;
	min-height: 48px !important;
	margin: 0 0 -2px !important;
	padding: 10px 22px 11px !important;
	border: 2px solid transparent !important;
	border-radius: 14px 14px 0 0 !important;
	background: transparent !important;
	color: #8E9096 !important;
	font-size: 15px !important;
	font-weight: 500 !important;
	line-height: 1.2 !important;
	letter-spacing: 0 !important;
	white-space: nowrap !important;
	box-shadow: none !important;
	text-decoration: none !important;
	transition: color .15s ease !important;
}

.form-tabs-list .nav-link:hover:not(.active),
.form-tabs-list .nav-item > a:hover:not(.active) {
	background: transparent !important;
	border-color: transparent !important;
	color: #5F636B !important;
	box-shadow: none !important;
}

.form-page .form-tabs-list .nav-link.active,
.form-layout .form-tabs-list .nav-link.active,
.std-form-layout .form-tabs-list .nav-link.active,
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
	outline: 2px solid rgba(6, 74, 219, .22) !important;
	outline-offset: -4px !important;
}

.form-page .form-tabs-list + .form-tab-content,
.form-layout .form-tabs-list + .form-tab-content,
.std-form-layout .form-tabs-list + .form-tab-content,
.form-tabs-list + .form-tab-content {
	margin-top: -1px !important;
	border-top: 0 !important;
	border-radius: 0 0 14px 14px !important;
}

.form-tabs-list.form-tabs-sticky-down {
	background: #FFFFFF !important;
	box-shadow: 0 8px 22px rgba(15, 23, 42, .07) !important;
}

[data-theme="dark"] .form-page .form-tabs-list,
[data-theme="dark"] .form-layout .form-tabs-list,
[data-theme="dark"] .std-form-layout .form-tabs-list,
[data-theme="dark"] .form-tabs-list {
	border-color: #2C394A !important;
	border-bottom-color: #6B91FF !important;
	background: #111827 !important;
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

[data-theme="dark"] .form-page .form-tab-content,
[data-theme="dark"] .form-layout .form-tab-content,
[data-theme="dark"] .std-form-layout .form-tab-content {
	background: #151B24 !important;
	border-color: #2C394A !important;
	border-top: 0 !important;
	box-shadow: 0 14px 30px rgba(0, 0, 0, .22) !important;
}

@media (max-width: 767px) {
	.form-page .form-tabs-list,
	.form-layout .form-tabs-list,
	.std-form-layout .form-tabs-list,
	.form-tabs-list {
		min-height: 54px !important;
		margin: 0 8px !important;
		padding: 8px 10px 0 !important;
		border-radius: 12px 12px 0 0 !important;
	}

	.form-tabs-list .nav-link,
	.form-tabs-list .nav-item > a {
		min-height: 42px !important;
		padding: 9px 15px 10px !important;
		font-size: 14px !important;
		border-radius: 12px 12px 0 0 !important;
	}

	.form-page .form-tab-content,
	.form-layout .form-tab-content,
	.std-form-layout .form-tab-content {
		margin-left: 8px !important;
		margin-right: 8px !important;
		border-radius: 0 0 12px 12px !important;
	}
}
/* ===== FINAL FORM TAB REFERENCE CASCADE END ===== */'''

pre, rest = css.split(final_start, 1)
_, post = rest.split(final_end, 1)
css = pre + final_block + post

if 'FORM TABS — QUIETER RAIL, CLEAR ACTIVE STATE' in css:
    raise SystemExit('First historical form-tab block still present')
if 'The tab rail is one small surface; the active tab remains the only strong blue.' in css:
    raise SystemExit('Second historical form-tab block still present')

surface.write_text(css)

old = '/assets/saas_theme/css/form_surface.css?v=3'
new = '/assets/saas_theme/css/form_surface.css?v=4'
for path in (hooks, validator):
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'Expected exactly one {old} in {path}')
    path.write_text(text.replace(old, new, 1))

print('Removed legacy forced-blue tab owners, joined form content, and bumped form_surface.css to v4.')

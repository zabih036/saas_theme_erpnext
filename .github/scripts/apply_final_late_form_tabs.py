from pathlib import Path

ROOT = Path('.')
form_css = ROOT / 'saas_theme/public/css/form.css'
surface_css = ROOT / 'saas_theme/public/css/form_surface.css'
v7_css = ROOT / 'saas_theme/public/css/ui_consolidation_v7.css'
interaction_js = ROOT / 'saas_theme/public/js/interaction_finish_v2.js'
hooks = ROOT / 'saas_theme/hooks.py'
validator = ROOT / 'scripts/validate_theme_architecture.py'


def remove_heading_section(text: str, heading: str, replacement: str) -> str:
    start = text.find(heading)
    if start < 0:
        raise SystemExit(f'Missing section heading: {heading!r}')
    next_heading = text.find('\n/* =========================================================', start + len(heading))
    if next_heading < 0:
        raise SystemExit(f'Could not find next section after: {heading!r}')
    return text[:start] + replacement + '\n' + text[next_heading + 1:]


def remove_between(text: str, start_marker: str, end_marker: str, replacement: str) -> str:
    if text.count(start_marker) != 1 or text.count(end_marker) != 1:
        raise SystemExit(f'Expected exactly one marker pair: {start_marker!r}')
    before, rest = text.split(start_marker, 1)
    _, after = rest.split(end_marker, 1)
    return before + replacement + after


# 1) Remove historical tab appearance from form.css.
text = form_css.read_text()
text = remove_heading_section(
    text,
    '/* =========================================================\n   FORM TABS — soft blue rail + filled active pill\n   ========================================================= */',
    '/* Form-tab appearance is intentionally owned by ui_consolidation_v7.css. */',
)
text = remove_heading_section(
    text,
    '/* =========================================================\n   FORM TABS\n   Soft blue rail + solid blue active pill, matching the reference UI.\n   The selectors are deliberately not dependent on .form-layout because\n   Frappe v16 renders .form-tabs-list at the form-page level.\n   ========================================================= */',
    '/* Legacy form-navigation appearance removed; final owner is ui_consolidation_v7.css. */',
)
text = remove_between(
    text,
    '/* ===== FORM TABS RAISED OUTLINE V2 START ===== */',
    '/* ===== FORM TABS RAISED OUTLINE V2 END ===== */',
    '/* Raised-outline tab appearance moved to the always-last v7 layer. */',
)
if '.form-tabs-list .nav-link.active' in text:
    raise SystemExit('form.css still contains active tab appearance selectors')
form_css.write_text(text)

# 2) Remove the duplicated final tab appearance from form_surface.css.
text = surface_css.read_text()
text = remove_between(
    text,
    '/* ===== FINAL FORM TAB REFERENCE CASCADE START ===== */',
    '/* ===== FINAL FORM TAB REFERENCE CASCADE END ===== */',
    '/* Form-tab appearance moved to the always-last ui_consolidation_v7.css layer. */',
)
if '.form-tabs-list .nav-link.active' in text:
    raise SystemExit('form_surface.css still contains active tab appearance selectors')
surface_css.write_text(text)

# 3) Make the existing always-last v7 CSS the single authoritative tab owner.
text = v7_css.read_text()
marker = '/* ===== AUTHORITATIVE FINAL FORM TABS V8 ===== */'
if marker in text:
    raise SystemExit('v7 final tab block already exists')
block = r'''

/* ===== AUTHORITATIVE FINAL FORM TABS V8 ===== */
/*
 * This stylesheet is deliberately kept LAST in <head> by interaction_finish_v2.js.
 * Therefore these rules are the only final visual owner of normal Frappe form tabs.
 */
.form-page .form-tabs-list,
.form-layout .form-tabs-list,
.std-form-layout .form-tabs-list,
.form-tabs-list {
	box-sizing: border-box !important;
	display: flex !important;
	align-items: flex-end !important;
	width: auto !important;
	min-height: 60px !important;
	margin: 0 12px !important;
	padding: 10px 20px 0 !important;
	border: 0 !important;
	border-bottom: 2px solid #064ADB !important;
	border-radius: 0 !important;
	background: #FFFFFF !important;
	box-shadow: none !important;
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
	gap: 10px !important;
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
	color: #92959B !important;
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
	border: 2px solid #064ADB !important;
	border-bottom-color: #FFFFFF !important;
	border-radius: 14px 14px 0 0 !important;
	box-shadow: none !important;
}

.form-tabs-list .nav-link.active:hover,
.form-tabs-list .nav-item.active > a:hover,
.form-tabs-list .nav-item > a.active:hover {
	background: #FFFFFF !important;
	color: #064ADB !important;
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

.form-page .form-tab-content,
.form-layout .form-tab-content,
.std-form-layout .form-tab-content {
	box-sizing: border-box !important;
	margin: -1px 12px 14px !important;
	padding: 14px 16px 16px !important;
	border: 1px solid #D9E2EC !important;
	border-top: 0 !important;
	border-radius: 0 0 14px 14px !important;
	background: #FFFFFF !important;
	box-shadow: 0 10px 26px rgba(15, 23, 42, .045) !important;
}

.form-tabs-list.form-tabs-sticky-down {
	background: #FFFFFF !important;
	box-shadow: 0 8px 22px rgba(15, 23, 42, .07) !important;
}

[data-theme="dark"] .form-page .form-tabs-list,
[data-theme="dark"] .form-layout .form-tabs-list,
[data-theme="dark"] .std-form-layout .form-tabs-list,
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
[data-theme="dark"] .form-tabs-list .nav-item > a.active,
[data-theme="dark"] .form-tabs-list .nav-link.active:hover {
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
/* ===== END AUTHORITATIVE FINAL FORM TABS V8 ===== */
'''
v7_css.write_text(text.rstrip() + block + '\n')

# 4) Cache-bust every changed runtime asset.
js = interaction_js.read_text()
old_v7 = '/assets/saas_theme/css/ui_consolidation_v7.css?v=7'
new_v7 = '/assets/saas_theme/css/ui_consolidation_v7.css?v=8'
if js.count(old_v7) != 1:
    raise SystemExit('Expected one v7 stylesheet URL in interaction_finish_v2.js')
interaction_js.write_text(js.replace(old_v7, new_v7, 1))

for path, replacements in {
    hooks: [
        ('/assets/saas_theme/css/form.css?v=2', '/assets/saas_theme/css/form.css?v=3'),
        ('/assets/saas_theme/css/form_surface.css?v=4', '/assets/saas_theme/css/form_surface.css?v=5'),
        ('/assets/saas_theme/js/interaction_finish_v2.js?v=2', '/assets/saas_theme/js/interaction_finish_v2.js?v=3'),
    ],
    validator: [
        ('/assets/saas_theme/css/form.css?v=2', '/assets/saas_theme/css/form.css?v=3'),
        ('/assets/saas_theme/css/form_surface.css?v=4', '/assets/saas_theme/css/form_surface.css?v=5'),
        ('/assets/saas_theme/js/interaction_finish_v2.js?v=2', '/assets/saas_theme/js/interaction_finish_v2.js?v=3'),
    ],
}.items():
    current = path.read_text()
    for old, new in replacements:
        if current.count(old) != 1:
            raise SystemExit(f'Expected one {old} in {path}')
        current = current.replace(old, new, 1)
    path.write_text(current)

# 5) Strengthen the permanent architecture guards for this exact contract.
text = validator.read_text()
interaction_guard = '        \'const GRID_POPUP_CLASS = "st-v7-inline-grid-popup"\',\n'
if interaction_guard not in text:
    raise SystemExit('interaction runtime guard anchor missing')
text = text.replace(
    interaction_guard,
    interaction_guard + '        "/assets/saas_theme/css/ui_consolidation_v7.css?v=8",\n',
    1,
)
v7_guard = '        "st-v7-awesomebar-backdrop",\n'
if v7_guard not in text:
    raise SystemExit('v7 runtime guard anchor missing')
text = text.replace(
    v7_guard,
    v7_guard + '        "AUTHORITATIVE FINAL FORM TABS V8",\n        "border-bottom: 2px solid #064ADB",\n        "border-bottom-color: #FFFFFF",\n',
    1,
)
validator.write_text(text)

print('Moved all normal form-tab appearance to the always-last v7 stylesheet and cache-busted changed assets.')

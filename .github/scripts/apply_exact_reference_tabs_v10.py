from pathlib import Path
import re

ROOT = Path('.')
CSS_DIR = ROOT / 'saas_theme/public/css'
V7 = CSS_DIR / 'ui_consolidation_v7.css'
HOOKS = ROOT / 'saas_theme/hooks.py'
JS = ROOT / 'saas_theme/public/js/interaction_finish_v2.js'
VALIDATOR = ROOT / 'scripts/validate_theme_architecture.py'

# Remove the exact three legacy inner-tab-container declarations wherever they still exist.
changed_sources = []
for path in CSS_DIR.glob('*.css'):
    text = path.read_text()
    original = text
    # Only touch rule blocks that target the inner .form-tabs wrapper.
    def clean_block(match):
        selector = match.group(1)
        body = match.group(2)
        if 'form-tabs-list' not in selector or '.form-tabs' not in selector:
            return match.group(0)
        body = re.sub(r'\s*background:\s*#F4F7FC\s*!important;?', '', body, flags=re.I)
        body = re.sub(r'\s*border-radius:\s*8px\s*!important;?', '', body, flags=re.I)
        body = re.sub(r'\s*padding:\s*5px\s*!important;?', '', body, flags=re.I)
        return selector + '{' + body + '}'
    text = re.sub(r'([^{}]+)\{([^{}]*)\}', clean_block, text)
    if text != original:
        path.write_text(text)
        changed_sources.append(str(path))

START = '/* ===== AUTHORITATIVE FINAL FORM TABS V9 ===== */'
END = '/* ===== END AUTHORITATIVE FINAL FORM TABS V9 ===== */'
new_block = r'''/* ===== AUTHORITATIVE FINAL FORM TABS V10 ===== */
/* Exact reference-style tabs: clean white rail, blue baseline, open-bottom active tab. */
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
	padding: 0 10px !important;
	border: 0 !important;
	border-bottom: 2px solid #064ADB !important;
	border-radius: 0 !important;
	background: #FFFFFF !important;
	box-shadow: none !important;
	overflow-x: auto !important;
	overflow-y: hidden !important;
	scrollbar-width: none !important;
}

body .form-tabs-list::-webkit-scrollbar { display: none !important; }

/* Explicitly neutralize the old inner-tab card styles from earlier layers. */
body .form-page .form-tabs-list .form-tabs,
body .std-form-layout .form-tabs-list .form-tabs,
body .form-tabs-list .form-tabs,
body .form-tabs-list .nav,
body .form-tabs-list .nav-tabs {
	display: flex !important;
	align-items: flex-end !important;
	flex-wrap: nowrap !important;
	gap: 8px !important;
	width: max-content !important;
	min-width: 100% !important;
	margin: 0 !important;
	padding: 0 !important;
	border: 0 !important;
	border-radius: 0 !important;
	background: transparent !important;
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
	min-height: 42px !important;
	margin: 0 0 -2px !important;
	padding: 9px 18px 10px !important;
	border: 2px solid transparent !important;
	border-radius: 14px 14px 0 0 !important;
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
	border-radius: 14px 14px 0 0 !important;
	box-shadow: none !important;
}

/* Mask the rail baseline under the active tab so the bottom is visually open. */
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
	pointer-events: none !important;
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

[data-theme="dark"] body .form-page > .form-tabs-list,
[data-theme="dark"] body .form-layout .form-tabs-list,
[data-theme="dark"] body .std-form-layout .form-tabs-list { background: #111827 !important; border-bottom-color: #6B91FF !important; }
[data-theme="dark"] body .form-page .form-tabs-list .form-tabs,
[data-theme="dark"] body .std-form-layout .form-tabs-list .form-tabs,
[data-theme="dark"] body .form-tabs-list .form-tabs,
[data-theme="dark"] body .form-tabs-list .nav,
[data-theme="dark"] body .form-tabs-list .nav-tabs { background: transparent !important; }
[data-theme="dark"] body .form-tabs-list .nav-link,
[data-theme="dark"] body .form-tabs-list .nav-item > a { color: #9AA7B8 !important; }
[data-theme="dark"] body .form-tabs-list .nav-link.active,
[data-theme="dark"] body .form-tabs-list .nav-item.active > a,
[data-theme="dark"] body .form-tabs-list .nav-item > a.active { background: #111827 !important; color: #8FB0FF !important; border-color: #6B91FF !important; border-bottom: 0 !important; }
[data-theme="dark"] body .form-tabs-list .nav-link.active::after,
[data-theme="dark"] body .form-tabs-list .nav-item.active > a::after,
[data-theme="dark"] body .form-tabs-list .nav-item > a.active::after { background: #111827 !important; }

@media (max-width: 767px) {
	body .form-page > .form-tabs-list,
	body .form-layout .form-tabs-list,
	body .std-form-layout .form-tabs-list { min-height: 44px !important; margin: 0 6px !important; padding: 0 6px !important; }
	body .form-tabs-list .nav-link,
	body .form-tabs-list .nav-item > a { min-height: 40px !important; padding: 8px 14px 9px !important; font-size: 13px !important; border-radius: 12px 12px 0 0 !important; }
	body .form-page .form-tab-content,
	body .form-layout .form-tab-content,
	body .std-form-layout .form-tab-content { margin-left: 6px !important; margin-right: 6px !important; }
}
/* ===== END AUTHORITATIVE FINAL FORM TABS V10 ===== */'''

css = V7.read_text()
if css.count(START) != 1 or css.count(END) != 1:
    raise SystemExit('Expected exactly one V9 form-tab block')
before, rest = css.split(START, 1)
_, after = rest.split(END, 1)
V7.write_text(before.rstrip() + '\n\n' + new_block + after)

hooks = HOOKS.read_text()
if hooks.count('/assets/saas_theme/css/ui_consolidation_v7.css?v=9') != 1:
    raise SystemExit('v9 CSS hook missing')
hooks = hooks.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=9', '/assets/saas_theme/css/ui_consolidation_v7.css?v=10', 1)
if hooks.count('/assets/saas_theme/js/interaction_finish_v2.js?v=4') != 1:
    raise SystemExit('interaction JS v4 hook missing')
hooks = hooks.replace('/assets/saas_theme/js/interaction_finish_v2.js?v=4', '/assets/saas_theme/js/interaction_finish_v2.js?v=5', 1)
HOOKS.write_text(hooks)

js = JS.read_text()
if js.count('/assets/saas_theme/css/ui_consolidation_v7.css?v=9') != 1:
    raise SystemExit('STYLE_HREF v9 missing')
JS.write_text(js.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=9', '/assets/saas_theme/css/ui_consolidation_v7.css?v=10', 1))

validator = VALIDATOR.read_text()
validator = validator.replace('/assets/saas_theme/css/ui_consolidation_v7.css?v=9', '/assets/saas_theme/css/ui_consolidation_v7.css?v=10')
validator = validator.replace('/assets/saas_theme/js/interaction_finish_v2.js?v=4', '/assets/saas_theme/js/interaction_finish_v2.js?v=5')
validator = validator.replace('AUTHORITATIVE FINAL FORM TABS V9', 'AUTHORITATIVE FINAL FORM TABS V10')
validator = validator.replace('"min-height: 46px",\n        "padding: 4px 10px 0",\n        "font-size: 13px",', '"min-height: 46px",\n        "padding: 0 10px",\n        "font-size: 14px",\n        "border-bottom: 0 !important",')
VALIDATOR.write_text(validator)

print('Removed legacy inner-tab card styles from:', changed_sources)
print('Applied exact reference tabs V10.')

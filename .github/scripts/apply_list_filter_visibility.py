from pathlib import Path

ROOT = Path('.')
HOOKS = ROOT / 'saas_theme/hooks.py'
VALIDATOR = ROOT / 'scripts/validate_theme_architecture.py'

hooks = HOOKS.read_text(encoding='utf-8')
old_hooks = '\t"/assets/saas_theme/js/professional_ui.js?v=1",\n\t"/assets/saas_theme/js/home_dashboard.js?v=1",'
new_hooks = '\t"/assets/saas_theme/js/professional_ui.js?v=1",\n\t"/assets/saas_theme/js/list_view.js?v=1",\n\t"/assets/saas_theme/js/home_dashboard.js?v=1",'
if old_hooks not in hooks:
    raise SystemExit('hooks JS insertion point not found')
hooks = hooks.replace(old_hooks, new_hooks, 1)
HOOKS.write_text(hooks, encoding='utf-8')

validator = VALIDATOR.read_text(encoding='utf-8')
old_expected = '    "/assets/saas_theme/js/professional_ui.js?v=1",\n    "/assets/saas_theme/js/home_dashboard.js?v=1",'
new_expected = '    "/assets/saas_theme/js/professional_ui.js?v=1",\n    "/assets/saas_theme/js/list_view.js?v=1",\n    "/assets/saas_theme/js/home_dashboard.js?v=1",'
if old_expected not in validator:
    raise SystemExit('validator expected JS insertion point not found')
validator = validator.replace(old_expected, new_expected, 1)

old_known = '    "login_fix.js",\n    "mobile_shell.js",'
new_known = '    "login_fix.js",\n    "list_view.js",\n    "mobile_shell.js",'
if old_known not in validator:
    raise SystemExit('validator known JS insertion point not found')
validator = validator.replace(old_known, new_known, 1)
VALIDATOR.write_text(validator, encoding='utf-8')

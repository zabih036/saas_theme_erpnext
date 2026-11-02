from pathlib import Path

hooks = Path('saas_theme/hooks.py')
validator = Path('scripts/validate_theme_architecture.py')

hooks_text = hooks.read_text()
validator_text = validator.read_text()

replacements = {
    '/assets/saas_theme/css/home.css?v=1': '/assets/saas_theme/css/home.css?v=7',
    '/assets/saas_theme/js/home_analytics.js?v=1': '/assets/saas_theme/js/home_analytics.js?v=7',
}

for old, new in replacements.items():
    if hooks_text.count(old) != 1:
        raise SystemExit(f'Expected exactly one hooks reference: {old}')
    if validator_text.count(old) != 1:
        raise SystemExit(f'Expected exactly one validator reference: {old}')
    hooks_text = hooks_text.replace(old, new, 1)
    validator_text = validator_text.replace(old, new, 1)

hooks.write_text(hooks_text)
validator.write_text(validator_text)

print('Home asset cache versions bumped to v7.')

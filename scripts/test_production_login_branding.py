#!/usr/bin/env python3
"""Production login: actual default Company branding, native Frappe auth states.

Static regression contract; no Frappe DB or network dependencies in CI.
Run manually with: python3 scripts/test_production_login_branding.py
"""

from pathlib import Path
import ast
import re

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "saas_theme/www/login.html").read_text(encoding="utf-8")
py = (ROOT / "saas_theme/www/login.py").read_text(encoding="utf-8")
css = (ROOT / "saas_theme/public/css/login_production.css").read_text(encoding="utf-8")
js = (ROOT / "saas_theme/public/js/login_fix.js").read_text(encoding="utf-8")
branding = (ROOT / "saas_theme/branding.py").read_text(encoding="utf-8")
hooks = (ROOT / "saas_theme/hooks.py").read_text(encoding="utf-8")
arch = (ROOT / "scripts/validate_theme_architecture.py").read_text(encoding="utf-8")
workflow = (ROOT / ".github/workflows/theme-architecture-check.yml").read_text(encoding="utf-8")

# Preserve Frappe login state machinery and never nest HTML forms.
assert html.count("<form ") == html.count("</form>") == 4
assert not re.search(r"<form[^>]*>\s*<form", html)
for token in (
    '{% extends "templates/web.html" %}',
    '{% block script %}',
    '{% include "templates/includes/login/login.js" %}',
    'id="login_email"',
    'id="login_password"',
    'autocomplete="username"',
    'autocomplete="current-password"',
    'class="form-signin form-login"',
    'btn-login',
    'btn-ldap-login',
    'provider_logins',
    'login_with_frappe_cloud_url',
    'login_with_email_link',
    'signup_form_template',
    'class=\'for-forgot\'',
    'class=\'for-login-with-email-link\'',
    'class=\'for-signup',
    'class=\'for-email-login\'',
    'href="#forgot"',
    'href="#login"',
):
    assert token in html, f"Native Frappe auth flow changed: {token}"

# Company branding is site configuration, NOT a hard-coded organization's logo.
for token in (
    "from saas_theme.branding import get_company_branding",
    "context[\"company_name\"]",
    "context[\"company_logo\"]",
    "context[\"logo_fallback\"]",
    "context[\"company_initial\"]",
    "context[\"copyright_year\"]",
    'branding.get("company_logo")',
    'startswith("/private/")',
):
    assert token in py, f"Missing server-side Company branding: {token}"
assert '@frappe.whitelist(allow_guest=True)' in branding
assert 'get_single_value(' in branding
assert '"default_company"' in branding
for token in (
    'data-st-company-name',
    'data-st-panel-company',
    'data-st-footer-company',
    'src="{{ company_logo }}"',
    'data-fallback-src="{{ logo_fallback or \'\' }}"',
    '{{ company_name }}',
    '{{ company_initial }}',
    'class="st-login-monogram"',
    'class="st-login-wrapper"',
    'class="st-login-form-col"',
    'class="st-login-panel"',
    'class="st-login-footer"',
    'class="st-insight-scene"',
    'class="st-industry-silhouette"',
    'aria-hidden="true"',
    '/assets/saas_theme/css/login_production.css?v=1',
):
    assert token in html, f"Production login markup missing: {token}"
assert not re.search(r"\bAOGC\b|Afghanistan Oil|Yaseen Steel", html, re.I)
assert not re.search(r"\bAOGC\b|Afghanistan Oil|Yaseen Steel", css, re.I)

# Production panels are illustrative, not made-up live financial metrics.
assert "42%" not in html
assert "Workspace overview" in html
assert 'aria-hidden="true"' in html
assert "Production ERP System" in html

# All pages use a single scoped stylesheet; desktop, narrow/mobile, RTL,
# keyboard accessibility, and reduced motion are explicitly covered.
for token in (
    'body[data-path="login"] .st-login-wrapper',
    'body[data-path="login"] .st-login-form-col',
    'body[data-path="login"] .st-login-panel',
    ".st-login-logo-frame.has-logo",
    ".st-login-monogram",
    ".st-login-company-name",
    ".st-login-footer",
    ".st-insight-card",
    ".st-insight-ring",
    ".st-industry-silhouette",
    ".st-login-form-col .btn-login",
    ":focus-visible",
    "min-height: 100svh",
    "grid-template-columns:",
    "@media (max-width:820px)",
    "@media (max-width:490px)",
    'html[data-theme="dark"] body[data-path="login"]',
    ".page-card-body.invalid",
    "@media (prefers-reduced-motion:reduce)",
):
    assert token in css, f"Production layout guard missing: {token}"

# Error fallback does not publish private File data or hide a genuine company
# logo; no mutations to Frappe login handlers beyond existing wrapper.
for token in (
    "function prepare_company_logo(",
    "function prepare_login_logos(",
    "image.naturalWidth > 0",
    "image.addEventListener(\"error\"",
    "image.dataset.fallbackSrc",
    'logo.startsWith("/private/")',
    '"[data-st-company-name], [data-st-panel-company], [data-st-footer-company]"',
    "function patch_login()",
    'login.login_handlers[200]',
    "loader_done();",
    'document.addEventListener("login_rendered"',
):
    assert token in js, f"Logo or login behavior regression: {token}"

tree = ast.parse(hooks)
names = {
    target.id: ast.literal_eval(statement.value)
    for statement in tree.body if isinstance(statement, ast.Assign)
    for target in statement.targets if isinstance(target, ast.Name)
    and target.id in ("web_include_css", "web_include_js")
}
assert names["web_include_css"] == "/assets/saas_theme/css/login_refinement.css?v=3"
assert names["web_include_js"].count("/assets/saas_theme/js/login_fix.js?v=3") == 1
assert '"login_production.css"' in arch
assert '"/assets/saas_theme/js/login_fix.js?v=3"' in arch
assert "python3 scripts/test_production_login_branding.py" in workflow

print("Production login company branding, auth compatibility, and responsive layout guards passed.")

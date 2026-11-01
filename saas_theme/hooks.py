app_name = "saas_theme"
app_title = "Saas Theme by CommitStreet"
app_publisher = "CommitStreet"
app_description = "A modern, polished SaaS UI theme for Frappe Framework — featuring a dual sidebar with workspace rail, redesigned form inputs, slide-in child table editor, enhanced attachments, and a refined dashboard experience."
app_email = "vineyrawat@yahoo.com"
app_license = "MIT"
frappe_version = ">=16.0.0 <17.0.0"
categories = ["Customization", "UI/UX"]

# Permanent Desk structure. Future Desk theme work edits these exact files.
app_include_css = [
    "/assets/saas_theme/css/saas_theme.css",
    "/assets/saas_theme/css/custom.css",
]

app_include_js = [
    "/assets/saas_theme/js/saas_theme.js",
    "/assets/saas_theme/js/custom.js",
]

# login.css is linked directly by the custom login template.
web_include_js = [
    "/assets/saas_theme/js/login.js",
]

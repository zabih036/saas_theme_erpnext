app_name = "saas_theme"
app_title = "Saas Theme by CommitStreet"
app_publisher = "CommitStreet"
app_description = "A modern, polished SaaS UI theme for Frappe Framework — featuring a dual sidebar with workspace rail, redesigned form inputs, slide-in child table editor, enhanced attachments, and a refined dashboard experience."
app_email = "vineyrawat@yahoo.com"
app_license = "MIT"
frappe_version = ">=16.0.0 <17.0.0"
categories = ["Customization", "UI/UX"]

# -----------------------------------------------------------------------------
# Desk assets
# -----------------------------------------------------------------------------
# IMPORTANT: This order is intentional and is part of the current working UI.
# Do not reorder, merge, rename, or remove live assets during ordinary feature work.
# See THEME_MAINTENANCE.md for canonical ownership and staged cleanup rules.

app_include_css = [
	"/assets/saas_theme/css/saas_theme.css?v=64",
	"/assets/saas_theme/css/professional_ui.css?v=1",
	"/assets/saas_theme/css/form_controls.css?v=1",
	"/assets/saas_theme/css/form_navigation.css?v=1",
	"/assets/saas_theme/css/list_view.css?v=1",
	"/assets/saas_theme/css/home_dashboard.css?v=1",
	"/assets/saas_theme/css/home_analytics.css?v=1",
	"/assets/saas_theme/css/brand_shell.css?v=1",
	"/assets/saas_theme/css/form_palette.css?v=1",
	"/assets/saas_theme/css/palette_refinement.css?v=1",
	"/assets/saas_theme/css/ui_finish.css?v=1",
	"/assets/saas_theme/css/interface_refinement.css?v=1",
	"/assets/saas_theme/css/mobile_shell.css?v=1",
	"/assets/saas_theme/css/workspace_shell_polish.css?v=1",
	"/assets/saas_theme/css/dark_mode_refinement.css?v=1",
	"/assets/saas_theme/css/dark_surface_fix.css?v=2",
	"/assets/saas_theme/css/desktop_navbar_refinement.css?v=1",
	"/assets/saas_theme/css/tree_view_refinement.css?v=1",
	"/assets/saas_theme/css/home_clarity_refinement.css?v=1",
	"/assets/saas_theme/css/control_precision_fix.css?v=1",
	"/assets/saas_theme/css/exact_ui_followup.css?v=1",
	"/assets/saas_theme/css/final_precision_v2.css?v=1",
	"/assets/saas_theme/css/form_experience_refinement.css?v=1",
	"/assets/saas_theme/css/professional_form_card_fix.css?v=1",
	"/assets/saas_theme/css/grid_and_action_alignment.css?v=1",
	"/assets/saas_theme/css/report_and_form_shell.css?v=1",
	"/assets/saas_theme/css/child_row_editor_finish.css?v=1",
	"/assets/saas_theme/css/overlay_stacking_fix.css?v=2",
	"/assets/saas_theme/css/overlay_stacking_v3.css?v=1",
	"/assets/saas_theme/css/interaction_finish_v2.css?v=2",
	"/assets/saas_theme/css/global_popup_polish_v3.css?v=3",
	"/assets/saas_theme/css/compact_autocomplete_and_form_gap_v4.css?v=4",
]

app_include_js = [
	"/assets/saas_theme/js/saas_theme.js?v=64",
	"/assets/saas_theme/js/professional_ui.js?v=1",
	"/assets/saas_theme/js/home_dashboard.js?v=1",
	"/assets/saas_theme/js/home_analytics.js?v=1",
	"/assets/saas_theme/js/brand_shell.js?v=1",
	"/assets/saas_theme/js/ui_finish.js?v=1",
	"/assets/saas_theme/js/route_loader.js?v=1",
	"/assets/saas_theme/js/mobile_shell.js?v=2",
	"/assets/saas_theme/js/workspace_shell_polish.js?v=1",
	"/assets/saas_theme/js/final_shell_cleanup.js?v=2",
	"/assets/saas_theme/js/user_theme_menu.js?v=1",
	"/assets/saas_theme/js/form_sidebar_persistence.js?v=2",
	"/assets/saas_theme/js/quick_access_preferences.js?v=1",
	"/assets/saas_theme/js/interaction_finish_v2.js?v=2",
]

# -----------------------------------------------------------------------------
# Login / website assets
# -----------------------------------------------------------------------------

web_include_css = "/assets/saas_theme/css/login_refinement.css?v=3"
web_include_js = [
	"/assets/saas_theme/js/route_loader.js?v=2",
	"/assets/saas_theme/js/login_fix.js?v=2",
]

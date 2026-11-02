from pathlib import Path

js_path = Path('saas_theme/public/js/home_analytics.js')
css_path = Path('saas_theme/public/css/home.css')
js = js_path.read_text()
css = css_path.read_text()

js = js.replace('const QUICK_SIDEBAR_KEY = "saas_theme_home_quick_sidebar_hidden_v1";', 'const QUICK_SIDEBAR_KEY = "saas_theme_home_quick_sidebar_hidden_v2";', 1)
js = js.replace('href="${esc(list_route("Sales Invoice"))}"', 'href="${esc(report_route("Profit and Loss Statement"))}"', 1)
js = js.replace('<span>${__("Suppliers")}</span>', '<span>${__("Active Suppliers")}</span>', 1)

old_state = '''\tfunction apply_quick_sidebar_state($home) {\n\t\tconst hidden = quick_sidebar_hidden();\n\t\t$home.toggleClass('st-home-quick-sidebar-hidden', hidden);\n\t\t$('.navbar-brand .app-logo').attr({\n\t\t\t'aria-expanded': hidden ? 'false' : 'true',\n\t\t\t'title': hidden ? __('Show Quick Access') : __('Hide Quick Access'),\n\t\t});\n\t}\n\n\tfunction bind_quick_sidebar_toggle() {\n\t\tif (window.__saas_theme_home_quick_sidebar_toggle_v1__) return;\n\t\twindow.__saas_theme_home_quick_sidebar_toggle_v1__ = true;\n\n\t\tdocument.addEventListener('click', (event) => {\n\t\t\tconst logo = event.target?.closest?.('.navbar-brand .app-logo');\n\t\t\tif (!logo) return;\n\n\t\t\tconst home = document.querySelector('.st-home-dashboard.st-dashboard-redesign-v6');\n\t\t\tif (!home) return;\n\n\t\t\tevent.preventDefault();\n\t\t\tevent.stopPropagation();\n\t\t\tevent.stopImmediatePropagation?.();\n\n\t\t\tconst $home = $(home);\n\t\t\tset_quick_sidebar_hidden(!quick_sidebar_hidden());\n\t\t\tapply_quick_sidebar_state($home);\n\t\t}, true);\n\t}\n'''

new_state = '''\tfunction apply_quick_sidebar_state($home) {\n\t\tconst hidden = quick_sidebar_hidden();\n\t\t$home.toggleClass('st-home-quick-sidebar-hidden', hidden);\n\t\t$home.find('.st-home-sidebar-toggle').attr({\n\t\t\t'aria-expanded': hidden ? 'false' : 'true',\n\t\t\t'aria-label': hidden ? __('Show Quick Access') : __('Hide Quick Access'),\n\t\t\t'title': hidden ? __('Show Quick Access') : __('Hide Quick Access'),\n\t\t}).toggleClass('is-collapsed', hidden);\n\t}\n\n\tfunction bind_quick_sidebar_toggle() {\n\t\t$(document)\n\t\t\t.off('click.saas_home_sidebar_toggle', '.st-home-sidebar-toggle')\n\t\t\t.on('click.saas_home_sidebar_toggle', '.st-home-sidebar-toggle', function (event) {\n\t\t\t\tevent.preventDefault();\n\t\t\t\tevent.stopPropagation();\n\n\t\t\t\tconst $home = $(this).closest('.st-home-dashboard.st-dashboard-redesign-v7');\n\t\t\t\tif (!$home.length) return;\n\n\t\t\t\tset_quick_sidebar_hidden(!quick_sidebar_hidden());\n\t\t\t\tapply_quick_sidebar_state($home);\n\t\t\t});\n\t}\n'''

if old_state not in js:
    raise SystemExit('Expected v6 sidebar state/toggle block not found')
js = js.replace(old_state, new_state, 1)

old_enhance = '''\tfunction enhance() {\n\t\tconst $home = $(".st-home-dashboard").last();\n\t\tif (!$home.length || $home.hasClass("st-dashboard-redesign-v6")) return;\n\t\t$home.addClass("st-dashboard-redesign-v5 st-dashboard-redesign-v6");\n\t\tconst token = ++enhance_token;\n\n\t\torganize_existing_sections($home);\n\t\tconst name = String(user_name()).trim() || __("User");\n\t\t$home.find(".st-hub-welcome").html(`<div class="st-dash-title"><h1>${__("Welcome")}, ${esc(name)}<span>👋</span></h1><p>${esc(greeting())} · ${__("Here is your business overview for today.")}</p></div><span class="st-dash-period">${__("Current month")}</span>`);\n\t\t$home.find(".st-hub-metrics").replaceWith(dashboard_html());\n\t\t$home.find(".st-dashboard-activity-section").remove();\n\n\t\tbind_quick_sidebar_toggle();\n\t\tapply_quick_sidebar_state($home);\n\t\tload_dashboard($home, token);\n\t\tload_recent_activity($home, token);\n\t}\n\n\tfunction schedule() { [40, 120, 260].forEach((delay) => setTimeout(enhance, delay)); }\n\t$(document).off("desktop_screen.saas_home_analytics").on("desktop_screen.saas_home_analytics", schedule);\n\t$(document).off("page-change.saas_home_analytics").on("page-change.saas_home_analytics", function () { const route = frappe.get_route?.() || []; if (route[0] === "desktop" || route.length === 0) schedule(); });\n\t$(schedule);\n'''

new_enhance = '''\tfunction enhance() {\n\t\tconst $home = $(".st-home-dashboard").last();\n\t\tif (!$home.length || $home.hasClass("st-dashboard-redesign-v7")) return;\n\t\t$home.addClass("st-dashboard-redesign-v5 st-dashboard-redesign-v6 st-dashboard-redesign-v7");\n\t\tdocument.body.classList.add('st-home-sidebar-ui-active');\n\t\tconst token = ++enhance_token;\n\n\t\torganize_existing_sections($home);\n\t\tconst name = String(user_name()).trim() || __("User");\n\t\t$home.find(".st-hub-welcome").html(`<div class="st-dash-welcome-group"><button type="button" class="st-home-sidebar-toggle" aria-expanded="true" aria-label="${__("Hide Quick Access")}" title="${__("Hide Quick Access")}"><span class="st-home-sidebar-toggle-bars" aria-hidden="true"><i></i><i></i><i></i></span></button><div class="st-dash-title"><h1>${__("Welcome")}, ${esc(name)}<span>👋</span></h1><p>${esc(greeting())} · ${__("Here is your business overview for today.")}</p></div></div><span class="st-dash-period">${__("Current month")}</span>`);\n\t\t$home.find(".st-hub-metrics").replaceWith(dashboard_html());\n\n\t\tconst $main = $home.find('.st-hub-main').first();\n\t\tconst $dashboard = $home.find('.st-dashboard-v5').first();\n\t\tif ($main.length && $dashboard.length) {\n\t\t\t$dashboard.detach().prependTo($main);\n\t\t}\n\n\t\t$home.find(".st-dashboard-activity-section").remove();\n\t\tbind_quick_sidebar_toggle();\n\t\tapply_quick_sidebar_state($home);\n\t\tload_dashboard($home, token);\n\t\tload_recent_activity($home, token);\n\t}\n\n\tfunction schedule() { [40, 120, 260].forEach((delay) => setTimeout(enhance, delay)); }\n\t$(document).off("desktop_screen.saas_home_analytics").on("desktop_screen.saas_home_analytics", schedule);\n\t$(document).off("page-change.saas_home_analytics").on("page-change.saas_home_analytics", function () {\n\t\tconst route = frappe.get_route?.() || [];\n\t\tif (route[0] === "desktop" || route.length === 0) schedule();\n\t\telse document.body.classList.remove('st-home-sidebar-ui-active');\n\t});\n\t$(schedule);\n'''

if old_enhance not in js:
    raise SystemExit('Expected v6 enhance block not found')
js = js.replace(old_enhance, new_enhance, 1)

css_marker = '/* ===== HOME DASHBOARD V7 SIDEBAR POSITION FIX START ===== */'
if css_marker not in css:
    css += r'''

/* ===== HOME DASHBOARD V7 SIDEBAR POSITION FIX START ===== */
/* Dedicated Home navigation toggle + true left-column sidebar placement. */
body.st-home-sidebar-ui-active .navbar-brand .app-logo {
	display: none !important;
}

.st-dashboard-redesign-v7 .st-hub-welcome {
	align-items: center !important;
}

.st-dashboard-redesign-v7 .st-dash-welcome-group {
	display: flex;
	align-items: center;
	gap: 12px;
	min-width: 0;
}

.st-dashboard-redesign-v7 .st-home-sidebar-toggle {
	width: 40px;
	height: 40px;
	padding: 0;
	border: 1px solid var(--st-hub-border);
	border-radius: 11px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 auto;
	background: var(--st-hub-surface);
	color: var(--st-hub-text);
	box-shadow: var(--st-hub-shadow-sm);
	cursor: pointer;
	transition: border-color .16s ease, background .16s ease, color .16s ease, transform .16s ease, box-shadow .16s ease;
}

.st-dashboard-redesign-v7 .st-home-sidebar-toggle:hover {
	transform: translateY(-1px);
	border-color: rgba(6, 74, 219, .28);
	background: var(--st-hub-primary-soft);
	color: var(--st-hub-primary);
	box-shadow: 0 6px 16px rgba(15, 23, 42, .08);
}

.st-dashboard-redesign-v7 .st-home-sidebar-toggle-bars {
	width: 18px;
	display: grid;
	gap: 4px;
}

.st-dashboard-redesign-v7 .st-home-sidebar-toggle-bars i {
	display: block;
	height: 2px;
	border-radius: 999px;
	background: currentColor;
	transition: width .16s ease, transform .16s ease;
}

.st-dashboard-redesign-v7 .st-home-sidebar-toggle-bars i:nth-child(2) {
	width: 13px;
}

.st-dashboard-redesign-v7 .st-home-sidebar-toggle.is-collapsed .st-home-sidebar-toggle-bars i:nth-child(2) {
	width: 18px;
}

.st-dashboard-redesign-v7 .st-hub-layout {
	grid-template-columns: minmax(260px, 300px) minmax(0, 1fr) !important;
	align-items: start !important;
	gap: 16px !important;
}

.st-dashboard-redesign-v7 .st-home-navigation-sidebar {
	grid-column: 1;
	grid-row: 1;
	margin: 0 !important;
}

.st-dashboard-redesign-v7 .st-hub-main {
	grid-column: 2;
	grid-row: 1;
	min-width: 0;
	gap: 16px !important;
}

.st-dashboard-redesign-v7 .st-hub-main > .st-dashboard-v5 {
	width: 100%;
	min-width: 0;
	margin: 0 !important;
}

.st-dashboard-redesign-v7 .st-home-quick-sidebar {
	order: 0;
}

.st-dashboard-redesign-v7 .st-hub-recent-card {
	order: 1;
}

.st-dashboard-redesign-v7.st-home-quick-sidebar-hidden .st-hub-layout {
	grid-template-columns: minmax(0, 1fr) !important;
}

.st-dashboard-redesign-v7.st-home-quick-sidebar-hidden .st-hub-main {
	grid-column: 1;
}

.st-dashboard-redesign-v7.st-home-quick-sidebar-hidden .st-home-navigation-sidebar {
	display: none !important;
}

@media (max-width: 980px) {
	.st-dashboard-redesign-v7 .st-hub-layout {
		grid-template-columns: 1fr !important;
	}

	.st-dashboard-redesign-v7 .st-home-navigation-sidebar,
	.st-dashboard-redesign-v7 .st-hub-main {
		grid-column: 1;
		grid-row: auto;
	}
}

@media (max-width: 680px) {
	.st-dashboard-redesign-v7 .st-dash-welcome-group {
		align-items: flex-start;
	}

	.st-dashboard-redesign-v7 .st-home-sidebar-toggle {
		width: 36px;
		height: 36px;
	}
}
/* ===== HOME DASHBOARD V7 SIDEBAR POSITION FIX END ===== */
'''

js_path.write_text(js)
css_path.write_text(css)

checks = {
    'new visible-default persistence key': 'saas_theme_home_quick_sidebar_hidden_v2',
    'dedicated sidebar button': 'st-home-sidebar-toggle',
    'dashboard moved into main': "$dashboard.detach().prependTo($main)",
    'Revenue links to P&L': 'st-dash-kpi st-dash-kpi-primary" href="${esc(report_route("Profit and Loss Statement"))}',
    'Active Suppliers label': '${__("Active Suppliers")}',
    'old cube toggle removed': ".navbar-brand .app-logo');\n\t\t\tif (!logo) return;",
}

for label, token in list(checks.items())[:5]:
    if token not in js:
        raise SystemExit(f'Missing {label}: {token}')
if checks['old cube toggle removed'] in js:
    raise SystemExit('Old cube/app-logo click toggle is still present')

print('Home sidebar v7 position/toggle revision applied successfully.')

from pathlib import Path

js_path = Path('saas_theme/public/js/home_analytics.js')
css_path = Path('saas_theme/public/css/home.css')
js = js_path.read_text()
css = css_path.read_text()

if 'saas_theme_home_quick_sidebar_hidden_v1' not in js:
    js = js.replace(
        '\tlet enhance_token = 0;\n',
        '\tlet enhance_token = 0;\n\tconst QUICK_SIDEBAR_KEY = "saas_theme_home_quick_sidebar_hidden_v1";\n',
        1,
    )

old_organize = '''\tfunction organize_existing_sections($home) {\n\t\tconst $clock = $home.find('.st-hub-clock-card').first();\n\t\tif ($clock.length) {\n\t\t\t$clock.detach().addClass('st-hub-clock-strip').prependTo($home);\n\t\t}\n\n\t\tconst $sidebar = $home.find('.st-hub-sidebar').first();\n\t\tconst $workspaces = $home.find('.st-hub-workspaces-section').first();\n\t\tif ($sidebar.length && $workspaces.length) {\n\t\t\t$workspaces.detach().addClass('st-hub-workspaces-sidebar').appendTo($sidebar);\n\t\t}\n\t}\n'''

new_organize = '''\tfunction organize_existing_sections($home) {\n\t\tconst $welcome = $home.find('.st-hub-welcome').first();\n\t\tconst $clock = $home.find('.st-hub-clock-card').first();\n\t\tif ($clock.length && $welcome.length) {\n\t\t\t$clock.detach().addClass('st-hub-clock-strip').insertAfter($welcome);\n\t\t}\n\n\t\tconst $sidebar = $home.find('.st-hub-sidebar').first();\n\t\tconst $quick = $home.find('.st-hub-quick-section').first();\n\t\tconst $workspaces = $home.find('.st-hub-workspaces-section').first();\n\t\t$workspaces.remove();\n\n\t\tif ($sidebar.length && $quick.length) {\n\t\t\t$quick.detach().addClass('st-home-quick-sidebar').prependTo($sidebar);\n\t\t\t$sidebar.addClass('st-home-navigation-sidebar');\n\t\t}\n\t}\n\n\tfunction quick_sidebar_hidden() {\n\t\ttry { return localStorage.getItem(QUICK_SIDEBAR_KEY) === '1'; }\n\t\tcatch (e) { return false; }\n\t}\n\n\tfunction set_quick_sidebar_hidden(hidden) {\n\t\ttry { localStorage.setItem(QUICK_SIDEBAR_KEY, hidden ? '1' : '0'); }\n\t\tcatch (e) { /* Sidebar persistence is optional if storage is unavailable. */ }\n\t}\n\n\tfunction apply_quick_sidebar_state($home) {\n\t\tconst hidden = quick_sidebar_hidden();\n\t\t$home.toggleClass('st-home-quick-sidebar-hidden', hidden);\n\t\t$('.navbar-brand .app-logo').attr({\n\t\t\t'aria-expanded': hidden ? 'false' : 'true',\n\t\t\t'title': hidden ? __('Show Quick Access') : __('Hide Quick Access'),\n\t\t});\n\t}\n\n\tfunction bind_quick_sidebar_toggle() {\n\t\tif (window.__saas_theme_home_quick_sidebar_toggle_v1__) return;\n\t\twindow.__saas_theme_home_quick_sidebar_toggle_v1__ = true;\n\n\t\tdocument.addEventListener('click', (event) => {\n\t\t\tconst logo = event.target?.closest?.('.navbar-brand .app-logo');\n\t\t\tif (!logo) return;\n\n\t\t\tconst home = document.querySelector('.st-home-dashboard.st-dashboard-redesign-v6');\n\t\t\tif (!home) return;\n\n\t\t\tevent.preventDefault();\n\t\t\tevent.stopPropagation();\n\t\t\tevent.stopImmediatePropagation?.();\n\n\t\t\tconst $home = $(home);\n\t\t\tset_quick_sidebar_hidden(!quick_sidebar_hidden());\n\t\t\tapply_quick_sidebar_state($home);\n\t\t}, true);\n\t}\n'''

if old_organize not in js:
    raise SystemExit('Expected organize_existing_sections block was not found')
js = js.replace(old_organize, new_organize, 1)

old_enhance = '''\tfunction enhance() {\n\t\tconst $home = $(".st-home-dashboard").last();\n\t\tif (!$home.length || $home.hasClass("st-dashboard-redesign-v5")) return;\n\t\t$home.addClass("st-dashboard-redesign-v5");\n\t\tconst token = ++enhance_token;\n\n\t\torganize_existing_sections($home);\n\t\tconst name = String(user_name()).split(/\\s+/).filter(Boolean)[0] || __("User");\n\t\t$home.find(".st-hub-welcome").html(`<div class="st-dash-title"><h1>${__("Dashboard Overview")}<span>👋</span></h1><p>${esc(greeting())}, ${esc(name)} · ${__("Finance, customers and operations at a glance.")}</p></div><span class="st-dash-period">${__("Current month")}</span>`);\n\t\t$home.find(".st-hub-metrics").replaceWith(dashboard_html());\n\t\t$home.find(".st-dashboard-activity-section").remove();\n\n\t\tload_dashboard($home, token);\n\t\tload_recent_activity($home, token);\n\t}\n'''

new_enhance = '''\tfunction enhance() {\n\t\tconst $home = $(".st-home-dashboard").last();\n\t\tif (!$home.length || $home.hasClass("st-dashboard-redesign-v6")) return;\n\t\t$home.addClass("st-dashboard-redesign-v5 st-dashboard-redesign-v6");\n\t\tconst token = ++enhance_token;\n\n\t\torganize_existing_sections($home);\n\t\tconst name = String(user_name()).trim() || __("User");\n\t\t$home.find(".st-hub-welcome").html(`<div class="st-dash-title"><h1>${__("Welcome")}, ${esc(name)}<span>👋</span></h1><p>${esc(greeting())} · ${__("Here is your business overview for today.")}</p></div><span class="st-dash-period">${__("Current month")}</span>`);\n\t\t$home.find(".st-hub-metrics").replaceWith(dashboard_html());\n\t\t$home.find(".st-dashboard-activity-section").remove();\n\n\t\tbind_quick_sidebar_toggle();\n\t\tapply_quick_sidebar_state($home);\n\t\tload_dashboard($home, token);\n\t\tload_recent_activity($home, token);\n\t}\n'''

if old_enhance not in js:
    raise SystemExit('Expected enhance block was not found')
js = js.replace(old_enhance, new_enhance, 1)

css_marker = '/* ===== HOME DASHBOARD V6 QUICK SIDEBAR START ===== */'
if css_marker not in css:
    css += r'''

/* ===== HOME DASHBOARD V6 QUICK SIDEBAR START ===== */
/* Welcome-first Home composition with persistent Quick Access sidebar. */
.st-home-dashboard.st-dashboard-redesign-v6 {
	max-width: 1680px;
}

.st-dashboard-redesign-v6 .st-hub-welcome {
	margin-bottom: 10px !important;
	align-items: center !important;
}

.st-dashboard-redesign-v6 .st-dash-title h1 {
	font-size: clamp(24px, 2.15vw, 32px) !important;
}

.st-dashboard-redesign-v6 .st-hub-clock-strip {
	margin: 0 0 16px !important;
	min-height: 62px !important;
	padding: 11px 16px !important;
	border-radius: 13px !important;
	display: grid !important;
	grid-template-columns: auto auto minmax(0, 1fr) auto !important;
	align-items: center !important;
	gap: 16px !important;
}

.st-dashboard-redesign-v6 .st-hub-clock-strip .st-hub-clock-time {
	order: 1;
	margin: 0 !important;
	font-size: 24px !important;
}

.st-dashboard-redesign-v6 .st-hub-clock-strip .st-hub-clock-top {
	order: 0;
	display: contents !important;
}

.st-dashboard-redesign-v6 .st-hub-clock-strip .st-hub-clock-weekday {
	order: 0;
	font-size: 10px !important;
}

.st-dashboard-redesign-v6 .st-hub-clock-strip .st-hub-clock-date {
	order: 2;
	margin: 0 !important;
	font-size: 11px !important;
	color: var(--st-hub-muted) !important;
}

.st-dashboard-redesign-v6 .st-hub-clock-strip .st-hub-live-dot {
	order: 3;
	justify-self: end;
}

.st-dashboard-redesign-v6 .st-hub-clock-strip .st-hub-clock-zone {
	display: none !important;
}

.st-dashboard-redesign-v6 .st-hub-layout {
	grid-template-columns: minmax(260px, 300px) minmax(0, 1fr) !important;
	gap: 16px !important;
	transition: grid-template-columns .18s ease;
}

.st-dashboard-redesign-v6 .st-home-navigation-sidebar {
	display: grid !important;
	gap: 12px !important;
	align-self: start;
	position: sticky;
	top: 76px;
	max-height: calc(100vh - 96px);
	overflow-y: auto;
	overflow-x: hidden;
	padding-right: 2px;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar {
	padding: 14px !important;
	margin: 0 !important;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar .st-hub-section-head {
	margin-bottom: 10px !important;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar .st-hub-section-head h2 {
	font-size: 13px !important;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar .st-hub-section-head p {
	font-size: 9.5px !important;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar .st-hub-quick-grid {
	grid-template-columns: 1fr !important;
	gap: 6px !important;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar .st-hub-quick-card {
	min-height: 52px !important;
	padding: 8px 9px !important;
	border-radius: 10px !important;
	box-shadow: none !important;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar .st-hub-quick-icon {
	width: 32px !important;
	height: 32px !important;
	border-radius: 9px !important;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar .st-hub-quick-copy strong {
	font-size: 10.5px !important;
}

.st-dashboard-redesign-v6 .st-home-quick-sidebar .st-hub-quick-copy small {
	font-size: 8.5px !important;
}

.st-dashboard-redesign-v6 .st-hub-workspaces-section {
	display: none !important;
}

.st-dashboard-redesign-v6.st-home-quick-sidebar-hidden .st-hub-layout {
	grid-template-columns: minmax(0, 1fr) !important;
}

.st-dashboard-redesign-v6.st-home-quick-sidebar-hidden .st-home-navigation-sidebar {
	display: none !important;
}

.st-dashboard-redesign-v6 .st-hub-main {
	min-width: 0;
}

.st-dashboard-redesign-v6 .st-hub-main:empty {
	display: none !important;
}

@media (max-width: 980px) {
	.st-dashboard-redesign-v6 .st-hub-layout {
		grid-template-columns: 1fr !important;
	}

	.st-dashboard-redesign-v6 .st-home-navigation-sidebar {
		position: static;
		max-height: none;
	}
}

@media (max-width: 680px) {
	.st-dashboard-redesign-v6 .st-hub-clock-strip {
		grid-template-columns: auto 1fr auto !important;
		gap: 10px !important;
	}

	.st-dashboard-redesign-v6 .st-hub-clock-strip .st-hub-clock-date {
		grid-column: 1 / -1;
	}

	.st-dashboard-redesign-v6 .st-hub-clock-strip .st-hub-live-dot {
		justify-self: end;
	}
}
/* ===== HOME DASHBOARD V6 QUICK SIDEBAR END ===== */
'''

js_path.write_text(js)
css_path.write_text(css)

# Guard exact user-requested behavior.
checks = {
    'Welcome heading': 'h1>${__("Welcome")}, ${esc(name)}',
    'persistent storage': 'saas_theme_home_quick_sidebar_hidden_v1',
    'app logo toggle': ".navbar-brand .app-logo",
    'workspace removal': '$workspaces.remove();',
    'clock after welcome': ".insertAfter($welcome)",
}
for label, token in checks.items():
    if token not in js:
        raise SystemExit(f'Missing {label}: {token}')

print('Home welcome/Quick Access sidebar revision applied successfully.')

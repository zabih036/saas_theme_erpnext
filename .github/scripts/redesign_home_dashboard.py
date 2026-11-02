from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "saas_theme" / "public" / "js" / "home_analytics.js"
CSS = ROOT / "saas_theme" / "public" / "css" / "home.css"


def replace_block(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"Could not find start of {label}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"Could not find end of {label}")
    return text[:start_index] + replacement + text[end_index:]


js = JS.read_text(encoding="utf-8")

analytics_function = r'''	function analytics_html() {
		return `<div class="st-hub-section-head st-analytics-head"><div><h2>${__("Business Overview")}</h2><p>${__("A focused view of financial movement, operational activity and recent user actions")}</p></div><span class="st-analytics-updated">${__("Loading analytics…")}</span></div>
		<div class="st-analytics-grid st-analytics-grid-v2">
			<article class="st-analytics-card st-analytics-finance-card"><div class="st-analytics-card-head"><div><strong>${__("Sales vs Purchases")}</strong><small>${__("Submitted invoice value across the last 6 months")}</small></div><span class="st-analytics-card-tag">${__("6 months")}</span></div><div class="st-analytics-chart st-finance-chart">${empty_chart(__("Loading chart…"))}</div></article>
			<article class="st-analytics-card st-analytics-activity-card"><div class="st-analytics-card-head"><div><strong>${__("Recent User Activity")}</strong><small>${__("Actions on documents you are allowed to view")}</small></div><span class="st-analytics-live"><i></i>${__("Live")}</span></div><div class="st-activity-summary"><div class="st-activity-summary-loading">${__("Loading activity…")}</div></div><div class="st-activity-list"><div class="st-analytics-empty st-activity-loading">${__("Loading recent activity…")}</div></div></article>
			<article class="st-analytics-card st-analytics-payments-card"><div class="st-analytics-card-head"><div><strong>${__("Payment Activity")}</strong><small>${__("Submitted payment value by month")}</small></div><span class="st-analytics-card-icon">${icon("payment")}</span></div><div class="st-analytics-chart st-payments-chart">${empty_chart(__("Loading chart…"))}</div></article>
			<article class="st-analytics-card st-analytics-stock-card"><div class="st-analytics-card-head"><div><strong>${__("Stock Transactions")}</strong><small>${__("Submitted stock entries by month")}</small></div><span class="st-analytics-card-icon">${icon("stock")}</span></div><div class="st-analytics-chart st-stock-chart">${empty_chart(__("Loading chart…"))}</div></article>
		</div>`;
	}

'''
js = replace_block(js, "\tfunction analytics_html() {", "\tfunction kpi(", analytics_function, "analytics_html")

# kpi() is no longer rendered after the redesign; remove the dead helper.
js = replace_block(js, "\tfunction kpi(", "\tfunction empty_chart(", "", "legacy kpi helper")

activity_helpers = r'''
	function form_route(doctype, name) {
		if (!doctype || !name) return "#";
		const prefix = window.location.pathname.startsWith("/app") ? "/app" : "/desk";
		return `${prefix}/${slug(doctype)}/${encodeURIComponent(String(name))}`;
	}

	function relative_time(value) {
		if (!value) return "";
		try {
			if (typeof frappe.datetime?.prettyDate === "function") return frappe.datetime.prettyDate(value);
		} catch (e) {
			// Fall through to the local formatter.
		}
		const parsed = new Date(String(value).replace(" ", "T"));
		if (Number.isNaN(parsed.getTime())) return String(value);
		const seconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
		if (seconds < 60) return __("Just now");
		if (seconds < 3600) return __("{0}m ago", [Math.floor(seconds / 60)]);
		if (seconds < 86400) return __("{0}h ago", [Math.floor(seconds / 3600)]);
		if (seconds < 604800) return __("{0}d ago", [Math.floor(seconds / 86400)]);
		return new Intl.DateTimeFormat(document.documentElement.lang || navigator.language || "en", { month: "short", day: "numeric" }).format(parsed);
	}

	function initials(value) {
		const text = String(value || __("User")).replace(/@.*$/, "").replace(/[._-]+/g, " ").trim();
		const parts = text.split(/\s+/).filter(Boolean);
		if (!parts.length) return "U";
		return `${parts[0][0] || ""}${parts.length > 1 ? parts[parts.length - 1][0] || "" : ""}`.toUpperCase().slice(0, 2);
	}

	function activity_meta(type) {
		const map = {
			Created: { action: __("created"), tone: "created" },
			Submitted: { action: __("submitted"), tone: "submitted" },
			Cancelled: { action: __("cancelled"), tone: "cancelled" },
			Updated: { action: __("updated"), tone: "updated" },
			Edit: { action: __("edited"), tone: "updated" },
			Workflow: { action: __("changed workflow for"), tone: "workflow" },
			Assigned: { action: __("assigned"), tone: "assigned" },
			"Assignment Completed": { action: __("completed assignment for"), tone: "submitted" },
			Attachment: { action: __("added an attachment to"), tone: "attachment" },
			"Attachment Removed": { action: __("removed an attachment from"), tone: "attachment" },
			Shared: { action: __("shared"), tone: "shared" },
			Unshared: { action: __("unshared"), tone: "shared" },
		};
		return map[type] || { action: __("updated"), tone: "updated" };
	}

	function activity_item_html(item) {
		const meta = activity_meta(item.activity_type);
		const doctype = item.reference_doctype || __("Document");
		const name = item.reference_name || item.subject || "";
		const actor = item.actor || __("User");
		const href = item.reference_doctype && item.reference_name ? form_route(item.reference_doctype, item.reference_name) : "#";
		return `<a class="st-activity-item" href="${esc(href)}"><span class="st-activity-avatar">${esc(initials(actor))}</span><span class="st-activity-copy"><span class="st-activity-line"><strong>${esc(actor)}</strong> <span>${esc(meta.action)}</span> <b>${esc(doctype)}</b></span><small><span>${esc(name)}</span><i></i>${esc(relative_time(item.creation))}</small></span><span class="st-activity-badge st-activity-${esc(meta.tone)}">${esc(item.activity_type || __("Updated"))}</span></a>`;
	}

	function activity_summary_html(summary) {
		const values = [
			{ key: "created", label: __("Created"), tone: "created" },
			{ key: "updated", label: __("Updated"), tone: "updated" },
			{ key: "submitted", label: __("Submitted"), tone: "submitted" },
			{ key: "other", label: __("Other"), tone: "other" },
		];
		return values.map((item) => `<div class="st-activity-stat"><span class="st-activity-stat-dot st-activity-${item.tone}"></span><div><strong>${Number(summary?.[item.key] || 0)}</strong><small>${esc(item.label)}</small></div></div>`).join("");
	}

	async function load_recent_activity($home, token) {
		try {
			const response = await frappe.call({ method: "saas_theme.home.get_recent_activity", args: { limit: 9 } });
			if (token !== enhance_token || !$home.closest("body").length) return;
			const payload = response?.message || {};
			const items = Array.isArray(payload.items) ? payload.items : [];
			$home.find(".st-activity-summary").html(activity_summary_html(payload.summary || {}));
			$home.find(".st-activity-list").html(items.length ? items.map(activity_item_html).join("") : `<div class="st-activity-empty">${__("No recent document activity is available for your current permissions.")}</div>`);
		} catch (e) {
			if (token !== enhance_token || !$home.closest("body").length) return;
			$home.find(".st-activity-summary").html(activity_summary_html({}));
			$home.find(".st-activity-list").html(`<div class="st-activity-empty">${__("Recent activity could not be loaded.")}</div>`);
		}
	}

'''
empty_marker = '\tfunction empty_chart(message) {\n\t\treturn `<div class="st-analytics-empty">${esc(message)}</div>`;\n\t}\n'
if empty_marker not in js:
    raise RuntimeError("Could not find empty_chart helper")
js = js.replace(empty_marker, empty_marker + activity_helpers, 1)

# Preserve the user's personalized Quick Access grid. The analytics layer no longer
# replaces it with a fixed six-module list.
quick_override = '\n\t\t$home.find(".st-hub-quick-section .st-hub-section-head p").text(__("Buying, sales, assets, payments, accounting and stock"));\n\t\t$home.find(".st-hub-quick-grid").html(quick_items(items).map(quick_html).join(""));\n'
if quick_override not in js:
    raise RuntimeError("Could not find fixed Quick Access override")
js = js.replace(quick_override, '\n\t\t$home.find(".st-hub-quick-section .st-hub-section-head p").text(__("Favorites and recently used workspaces"));\n', 1)

load_marker = '\t\tload_analytics($home, token);\n'
if load_marker not in js:
    raise RuntimeError("Could not find analytics load call")
js = js.replace(load_marker, load_marker + '\t\tload_recent_activity($home, token);\n', 1)

JS.write_text(js, encoding="utf-8")

css = CSS.read_text(encoding="utf-8")
css_marker = "/* SaaS Theme — Home Dashboard Professional Analytics v2 */"
if css_marker in css:
    raise RuntimeError("Home redesign CSS already exists")

css += r'''

/* SaaS Theme — Home Dashboard Professional Analytics v2 */
.st-home-dashboard.st-analytics-enhanced {
	--st-home-card-radius: 15px;
	--st-home-card-shadow: 0 8px 24px rgba(20, 33, 61, .055), 0 1px 2px rgba(20, 33, 61, .04);
	--st-home-card-hover: 0 14px 34px rgba(20, 33, 61, .085), 0 2px 5px rgba(20, 33, 61, .045);
}

.st-home-dashboard.st-analytics-enhanced .st-hub-welcome {
	margin-bottom: 20px;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-welcome h1 {
	font-size: clamp(26px, 2.35vw, 36px);
	font-weight: 760;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-metrics {
	gap: 14px;
	margin-bottom: 20px;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-metric {
	min-height: 112px;
	align-items: flex-start;
	justify-content: space-between;
	flex-direction: row-reverse;
	padding: 17px 17px 15px;
	border-radius: var(--st-home-card-radius);
	background: linear-gradient(145deg, var(--st-hub-surface) 0%, color-mix(in srgb, var(--st-hub-soft) 35%, var(--st-hub-surface)) 100%);
	box-shadow: var(--st-home-card-shadow);
}

.st-home-dashboard.st-analytics-enhanced .st-hub-metric::after {
	height: 3px;
	op: 0;
	bottom: auto;
	opacity: .78;
}

.st-home-dashboard.st-analytics-enhanced a.st-hub-metric:hover {
	transform: translateY(-2px);
	box-shadow: var(--st-home-card-hover);
}

.st-home-dashboard.st-analytics-enhanced .st-hub-metric-icon {
	width: 42px;
	height: 42px;
	border-radius: 12px;
	background: var(--st-hub-primary-soft);
}

.st-home-dashboard.st-analytics-enhanced .st-hub-metric-copy {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 0;
	min-width: 0;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-metric-copy small {
	order: 1;
	font-size: 10.5px;
	font-weight: 680;
	letter-spacing: .01em;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-metric-copy strong {
	order: 2;
	margin-top: 9px;
	font-size: clamp(22px, 1.8vw, 29px);
	font-weight: 780;
	line-height: 1;
	letter-spacing: -.035em;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-metric-copy span {
	order: 3;
	margin-top: 8px;
	font-size: 10px;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-section,
.st-home-dashboard.st-analytics-enhanced .st-hub-clock-card,
.st-home-dashboard.st-analytics-enhanced .st-hub-side-card {
	border-radius: var(--st-home-card-radius);
	box-shadow: var(--st-home-card-shadow);
}

.st-home-dashboard.st-analytics-enhanced .st-hub-quick-section {
	padding: 18px;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-quick-grid {
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10px;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-quick-card {
	min-height: 66px;
	border-radius: 12px;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-workspace-nav-list {
	max-height: min(430px, 44vh) !important;
}

.st-home-dashboard.st-analytics-enhanced .st-hub-analytics-section {
	padding: 18px !important;
}

.st-analytics-grid-v2 {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 14px;
	align-items: stretch;
}

.st-analytics-grid-v2 .st-analytics-card {
	padding: 16px;
	border-radius: 14px;
	box-shadow: 0 5px 18px rgba(20, 33, 61, .045);
}

.st-analytics-finance-card {
	grid-column: 1 / span 2;
}

.st-analytics-activity-card {
	grid-column: 3;
	grid-row: 1 / span 2;
	display: flex;
	flex-direction: column;
	min-height: 480px;
}

.st-analytics-payments-card { grid-column: 1; }
.st-analytics-stock-card { grid-column: 2; }

.st-analytics-card-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	min-height: 38px;
}

.st-analytics-card-head strong {
	font-size: 12.5px;
	font-weight: 730;
}

.st-analytics-card-head small {
	margin-top: 3px;
	font-size: 9.5px;
	line-height: 1.45;
}

.st-analytics-card-tag,
.st-analytics-live {
	flex: 0 0 auto;
	display: inline-flex;
	align-items: center;
	height: 26px;
	padding: 0 9px;
	border: 1px solid var(--st-hub-border);
	border-radius: 999px;
	background: var(--st-hub-soft);
	color: var(--st-hub-muted);
	font-size: 9px;
	font-weight: 680;
}

.st-analytics-live {
	gap: 6px;
	color: var(--st-hub-success);
}

.st-analytics-live i {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
	box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 11%, transparent);
}

.st-analytics-card-icon {
	width: 30px;
	height: 30px;
	border-radius: 9px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: var(--st-hub-primary-soft);
	color: var(--st-hub-primary);
}

.st-analytics-card-icon svg,
.st-analytics-card-icon .icon {
	width: 15px !important;
	height: 15px !important;
	stroke: currentColor !important;
	color: currentColor !important;
}

.st-analytics-finance-card .st-analytics-chart {
	min-height: 238px;
	margin-top: 8px;
}

.st-analytics-payments-card .st-analytics-chart,
.st-analytics-stock-card .st-analytics-chart {
	min-height: 178px;
	margin-top: 6px;
}

.st-analytics-grid-v2 .st-analytics-empty {
	min-height: 165px;
	border: 1px dashed var(--st-hub-border);
	background: var(--st-hub-soft);
}

.st-activity-summary {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 7px;
	margin: 12px 0 10px;
}

.st-activity-summary-loading {
	grid-column: 1 / -1;
	padding: 12px;
	border-radius: 10px;
	background: var(--st-hub-soft);
	color: var(--st-hub-muted);
	font-size: 9.5px;
	text-align: center;
}

.st-activity-stat {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	padding: 8px 9px;
	border: 1px solid var(--st-hub-border);
	border-radius: 10px;
	background: var(--st-hub-soft);
}

.st-activity-stat-dot {
	width: 7px;
	height: 7px;
	border-radius: 99px;
	flex: 0 0 auto;
	background: var(--st-hub-muted);
}

.st-activity-stat > div {
	min-width: 0;
}

.st-activity-stat strong,
.st-activity-stat small {
	display: block;
}

.st-activity-stat strong {
	font-size: 13px;
	line-height: 1;
	font-weight: 760;
	color: var(--st-hub-text);
}

.st-activity-stat small {
	margin-top: 3px;
	font-size: 8.5px;
	color: var(--st-hub-muted);
}

.st-activity-list {
	min-height: 0;
	flex: 1 1 auto;
	display: grid;
	align-content: start;
	gap: 2px;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding-right: 2px;
}

.st-activity-item {
	display: grid;
	grid-template-columns: 34px minmax(0, 1fr) auto;
	align-items: center;
	gap: 9px;
	min-height: 58px;
	padding: 8px 6px;
	border-bottom: 1px solid color-mix(in srgb, var(--st-hub-border) 72%, transparent);
	color: var(--st-hub-text) !important;
	text-decoration: none !important;
	transition: background-color .14s ease, transform .14s ease;
}

.st-activity-item:last-child { border-bottom: 0; }
.st-activity-item:hover { background: var(--st-hub-soft); transform: translateX(1px); }

.st-activity-avatar {
	width: 34px;
	height: 34px;
	border-radius: 10px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(145deg, var(--st-hub-primary-soft), color-mix(in srgb, var(--st-hub-primary-soft) 60%, var(--st-hub-surface)));
	color: var(--st-hub-primary);
	font-size: 10px;
	font-weight: 760;
	letter-spacing: .02em;
}

.st-activity-copy {
	min-width: 0;
}

.st-activity-line {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 10px;
	line-height: 1.4;
	color: var(--st-hub-muted);
}

.st-activity-line strong,
.st-activity-line b {
	color: var(--st-hub-text);
	font-weight: 680;
}

.st-activity-copy small {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	margin-top: 3px;
	font-size: 8.5px;
	color: var(--st-hub-muted);
}

.st-activity-copy small > span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.st-activity-copy small i {
	width: 3px;
	height: 3px;
	border-radius: 50%;
	background: currentColor;
	flex: 0 0 auto;
}

.st-activity-badge {
	max-width: 82px;
	padding: 4px 6px;
	border-radius: 999px;
	font-size: 7.5px;
	font-weight: 720;
	line-height: 1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	background: var(--st-hub-soft);
	color: var(--st-hub-muted);
}

.st-activity-created { color: #0b82f6; background: rgba(11, 130, 246, .10); }
.st-activity-updated { color: #7467e8; background: rgba(116, 103, 232, .11); }
.st-activity-submitted { color: #1f9d69; background: rgba(31, 157, 105, .11); }
.st-activity-workflow { color: #b7791f; background: rgba(183, 121, 31, .11); }
.st-activity-assigned { color: #0e7490; background: rgba(14, 116, 144, .11); }
.st-activity-cancelled { color: #c2415a; background: rgba(194, 65, 90, .11); }
.st-activity-attachment { color: #7c3aed; background: rgba(124, 58, 237, .10); }
.st-activity-shared { color: #2563eb; background: rgba(37, 99, 235, .10); }
.st-activity-other { color: var(--st-hub-muted); background: var(--st-hub-soft); }

.st-activity-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 160px;
	padding: 22px 16px;
	border: 1px dashed var(--st-hub-border);
	border-radius: 11px;
	background: var(--st-hub-soft);
	color: var(--st-hub-muted);
	font-size: 9.5px;
	line-height: 1.5;
	text-align: center;
}

[data-theme="dark"] .st-home-dashboard.st-analytics-enhanced {
	--st-home-card-shadow: 0 8px 26px rgba(0, 0, 0, .20), 0 1px 2px rgba(0, 0, 0, .16);
	--st-home-card-hover: 0 16px 36px rgba(0, 0, 0, .27);
}

@media (max-width: 1180px) {
	.st-home-dashboard.st-analytics-enhanced .st-hub-quick-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.st-analytics-grid-v2 {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.st-analytics-finance-card {
		grid-column: 1 / -1;
	}

	.st-analytics-activity-card {
		grid-column: 1 / -1;
		grid-row: auto;
		min-height: 420px;
	}

	.st-analytics-payments-card { grid-column: 1; }
	.st-analytics-stock-card { grid-column: 2; }
}

@media (max-width: 680px) {
	.st-home-dashboard.st-analytics-enhanced .st-hub-metric {
		min-height: 96px;
	}

	.st-home-dashboard.st-analytics-enhanced .st-hub-quick-grid,
	.st-analytics-grid-v2 {
		grid-template-columns: 1fr !important;
	}

	.st-analytics-finance-card,
	.st-analytics-activity-card,
	.st-analytics-payments-card,
	.st-analytics-stock-card {
		grid-column: auto !important;
	}

	.st-analytics-activity-card {
		min-height: 390px;
	}

	.st-activity-badge {
		display: none;
	}

	.st-activity-item {
		grid-template-columns: 34px minmax(0, 1fr);
	}
}
'''

CSS.write_text(css, encoding="utf-8")
print("Home dashboard redesign patch applied successfully.")

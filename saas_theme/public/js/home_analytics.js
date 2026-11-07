/*
 * SaaS Theme — ERP Home Dashboard Analytics
 * Finance/customer overview with preserved Quick Access, Recent and Workspaces.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	let enhance_token = 0;
	const QUICK_SIDEBAR_KEY = "saas_theme_home_quick_sidebar_hidden_v2";
	let home_currency = "";

	function esc(value) {
		const text = value == null ? "" : String(value);
		return frappe.utils?.escape_html ? frappe.utils.escape_html(text) : $("<div>").text(text).html();
	}

	function slug(value) {
		if (frappe.router?.slug) return frappe.router.slug(value);
		return String(value || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
	}

	function list_route(doctype) {
		return `${window.location.pathname.startsWith("/app") ? "/app" : "/desk"}/${slug(doctype)}`;
	}

	function report_route(report) {
		return `${window.location.pathname.startsWith("/app") ? "/app" : "/desk"}/query-report/${encodeURIComponent(report)}`;
	}

	function form_route(doctype, name) {
		if (!doctype || !name) return "#";
		return `${window.location.pathname.startsWith("/app") ? "/app" : "/desk"}/${slug(doctype)}/${encodeURIComponent(String(name))}`;
	}

	function icon(name, fallback = "layout-grid") {
		try { return frappe.utils.icon(name || fallback, "md"); } catch (e) {
			try { return frappe.utils.icon(fallback, "md"); } catch (ignored) { return ""; }
		}
	}

	function kpi_icon(name) {
		// Fixed inline SVG paths avoid empty icon squares when the icon name
		// is absent from a particular Frappe v16 icon sprite.
		const shapes = {
			"trending-up": '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
			"credit-card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
			"users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
			"truck": '<path d="M1 5h14v12H1zM15 9h4l3 4v4h-7z"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/>',
			"package": '<path d="M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10"/>',
			"landmark": '<path d="m3 10 9-7 9 7M4 10h16M5 10v9m5-9v9m5-9v9m4-9v9M3 21h18"/>',
			"arrow-down-left": '<path d="M17 7 7 17M17 17H7V7"/>',
			"arrow-up-right": '<path d="M7 17 17 7M7 7h10v10"/>',
		};
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.package}</svg>`;
	}

	function user_name() {
		try { return frappe.user?.full_name?.() || frappe.boot?.user?.full_name || frappe.session?.user || __("User"); }
		catch (e) { return frappe.session?.user || __("User"); }
	}

	function greeting() {
		const hour = new Date().getHours();
		if (hour < 12) return __("Good morning");
		if (hour < 17) return __("Good afternoon");
		return __("Good evening");
	}

	function currency() {
		return home_currency || frappe.boot?.sysdefaults?.currency || frappe.sys_defaults?.currency || frappe.defaults?.get_default?.("currency") || "";
	}

	function money(value) {
		if (value == null || Number.isNaN(Number(value))) return "—";
		const number = Number(value), code = currency();
		try {
			return new Intl.NumberFormat(document.documentElement.lang || navigator.language || "en", {
				style: code ? "currency" : "decimal",
				currency: code || undefined,
				notation: Math.abs(number) >= 1000000 ? "compact" : "standard",
				maximumFractionDigits: Math.abs(number) >= 100000 ? 1 : 0,
			}).format(number);
		} catch (e) { return `${code ? code + " " : ""}${Math.round(number).toLocaleString()}`; }
	}

	function number(value) {
		if (value == null || Number.isNaN(Number(value))) return "—";
		return new Intl.NumberFormat(document.documentElement.lang || navigator.language || "en", { maximumFractionDigits: 0 }).format(Number(value));
	}

	function relative_time(value) {
		if (!value) return "";
		try { if (typeof frappe.datetime?.prettyDate === "function") return frappe.datetime.prettyDate(value); } catch (e) {}
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

	function delta_html(value, inverse = false) {
		if (value == null || Number.isNaN(Number(value))) return `<span class="st-dash-delta neutral">${__("Current month")}</span>`;
		const numeric = Number(value), positive = inverse ? numeric <= 0 : numeric >= 0;
		return `<span class="st-dash-delta ${positive ? "positive" : "negative"}">${numeric >= 0 ? "↗" : "↘"} ${Math.abs(numeric).toFixed(1)}% <em>${__("vs last month")}</em></span>`;
	}


	function kpi_card(key, title, icon_name, primary = false) {
		return `<article hidden class="st-dash-kpi${primary ? " st-dash-kpi-primary" : ""}" data-dashboard-kpi="${esc(key)}">
			<div class="st-dash-kpi-top"><span>${esc(__(title))}</span><i aria-hidden="true">${kpi_icon(icon_name)}</i></div>
			<div class="st-kpi-value-row"><strong data-kpi-value="${esc(key)}">—</strong><span hidden class="st-kpi-sparkline" data-kpi-mini="${esc(key)}"></span></div>
			<div data-kpi-delta="${esc(key)}"></div>
			<small data-kpi-note="${esc(key)}"></small>
		</article>`;
	}

	function dashboard_html() {
		// Match the reference dashboard's compact navigation, statistics and
		// chart grid. All underlying data still comes from permission-checked
		// ERPNext endpoints; the HTML remains hidden until data is returned.
		return `<section class="st-dashboard-v5 st-dashboard-v8 st-dashboard-v9 st-dashboard-v10">
			<nav class="st-v10-page-nav" aria-label="${esc(__("Dashboard sections"))}">
				<div class="st-v10-nav-tabs" role="group" aria-label="${esc(__("Jump to section"))}">
					<button type="button" class="st-v10-nav-tab is-active" data-home-target="overview" aria-pressed="true">${__("Dashboard")}</button>
					<button type="button" hidden class="st-v10-nav-tab" data-home-target="analytics" aria-pressed="false">${__("Analytics")}</button>
					<button type="button" class="st-v10-nav-tab" data-home-target="activity" aria-pressed="false">${__("Activity")}</button>
				</div>
				<span class="st-v10-nav-caption">${__("ERPNext business overview")}</span>
			</nav>
			<section class="st-v10-overview-section" data-home-section="overview">
				<div class="st-dashboard-section-title"><div><span class="st-dashboard-eyebrow">${__("BUSINESS OVERVIEW")}</span><h2>${__("Financial overview")}</h2></div><small>${__("Selected company · current balances")}</small></div>
				<div class="st-dash-kpis">
					${kpi_card("revenue", "Revenue", "trending-up", true)}
					${kpi_card("expenses", "Expenses", "credit-card")}
					${kpi_card("customers", "Active Customers", "users")}
					${kpi_card("suppliers", "Active Suppliers", "truck")}
				</div>
				<div class="st-dash-financial-kpis">
					${kpi_card("stock_value", "Stock Value", "package")}
					${kpi_card("cash", "Bank & Treasury Cash", "landmark")}
					${kpi_card("receivables", "Receivables", "arrow-down-left")}
					${kpi_card("payables", "Payables", "arrow-up-right")}
				</div>
			</section>
			<section class="st-v10-analytics-section" data-home-section="analytics">
				<div class="st-dashboard-section-title st-dashboard-section-title--charts"><div><span class="st-dashboard-eyebrow">${__("BUSINESS ANALYTICS")}</span><h2>${__("Performance & operations")}</h2></div><small>${__("Based on your accessible ERPNext records")}</small></div>
				<div class="st-dash-insights">
					<article hidden class="st-dash-card st-dash-revenue-card" data-dashboard-panel="trend">
						<div class="st-dash-card-head"><div><strong>${__("Revenue & Expenses")}</strong><small>${__("Monthly totals · six months")}</small></div><div class="st-dash-card-meta"><span class="st-dash-period-pill">${__("6 months")}</span><div class="st-dash-legend" data-trend-legend></div></div></div>
						<div class="st-dash-chart" data-dashboard-chart="trend"></div>
					</article>
					<article hidden class="st-dash-card st-dash-production-card" data-dashboard-panel="production">
						<div class="st-dash-card-head"><div><strong>${__("Manufacturing Activity")}</strong><small>${__("Completed production runs · six months")}</small></div><strong class="st-v10-stat-total" data-production-total></strong></div>
						<div class="st-production-chart" data-production-chart></div>
					</article>
				</div>
				<div class="st-dash-lower-grid">
					<article hidden class="st-dash-card st-dash-heatmap-card" data-dashboard-panel="heatmap">
						<div class="st-dash-card-head"><div><strong>${__("Sales Activity")}</strong><small>${__("Submitted invoices · weekday and time")}</small></div><span class="st-dash-mini-value" data-heatmap-total>—</span></div>
						<div class="st-sales-heatmap" data-sales-heatmap></div>
					</article>
					<article hidden class="st-dash-card st-dash-invoice-card" data-dashboard-panel="invoices">
						<div class="st-dash-card-head"><div><strong>${__("Sales Invoice Status")}</strong><small>${__("Paid vs unpaid · past six months")}</small></div></div>
						<div class="st-invoice-status" data-invoice-status></div>
					</article>
				</div>
			</section>
			<section class="st-v10-audit-section" data-home-section="activity">
				<article class="st-dash-card st-dash-activity-card">
					<div class="st-dash-card-head"><div><strong>${__("Recent Document Changes")}</strong><small>${__("Version history · only documents you can access")}</small></div><div class="st-activity-summary"></div></div>
					<div class="st-activity-list" role="feed" aria-label="${esc(__("Recent Version history"))}"><div class="st-dash-loading">${__("Loading activity…")}</div></div>
				</article>
			</section>
		</section>`;
	}

	function line_points(values, width, height, low, high, left = 0, top = 0) {
		const range = Math.max(1, high - low);
		const dx = values.length > 1 ? width / (values.length - 1) : 0;
		return values.map((raw, index) => ({
			x: left + index * dx,
			y: top + (high - Number(raw || 0)) / range * height,
		}));
	}

	function smooth_line_path(points) {
		if (!points.length) return "";
		return points.slice(1).reduce((d, point, i) => {
			const last = points[i], mid = (last.x + point.x) / 2;
			return d + ` C ${mid.toFixed(2)} ${last.y.toFixed(2)}, ${mid.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
		}, `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`);
	}

	function kpi_sparkline(values) {
		if (!Array.isArray(values) || values.length < 2) return "";
		const clean = values.map((raw) => Number(raw || 0));
		if (!clean.every(Number.isFinite)) return "";
		const lo = Math.min(...clean), hi = Math.max(...clean);
		const points = line_points(clean, 90, 30, lo - Math.max(1, (hi - lo) * .18),
			hi + Math.max(1, (hi - lo) * .18), 2, 2);
		return `<svg class="st-v9-kpi-spark" viewBox="0 0 94 34" aria-hidden="true" focusable="false"><path d="${smooth_line_path(points)}"/></svg>`;
	}

	function trend_chart(data) {
		const labels = Array.isArray(data?.labels) ? data.labels : [];
		const series = [
			{ key: "revenue", title: __("Revenue"), values: data?.revenue },
			{ key: "expenses", title: __("Expenses"), values: data?.expenses },
		].filter((item) => Array.isArray(item.values) &&
			item.values.length === labels.length &&
			item.values.every((value) => Number.isFinite(Number(value))));
		if (!labels.length || !series.length) return "";
		const all = series.flatMap((item) => item.values.map(Number));
		if (!all.length) return "";
		const width = 800, height = 284, left = 76, right = 22, top = 20, bottom = 42;
		const plotW = width - left - right, plotH = height - top - bottom;
		const minValue = Math.min(0, ...all), maxValue = Math.max(0, ...all);
		const padding = Math.max(1, (maxValue - minValue) * .13);
		const lo = minValue < 0 ? minValue - padding : 0;
		const hi = maxValue + padding;
		const ticks = [0, .25, .5, .75, 1];
		const grid = ticks.map((ratio) => {
			const y = top + plotH - ratio * plotH;
			const value = lo + (hi - lo) * ratio;
			return `<line x1="${left}" x2="${width - right}" y1="${y.toFixed(2)}" y2="${y.toFixed(2)}" class="st-dash-grid-line"/>
				<text x="${left - 11}" y="${(y + 3).toFixed(2)}" text-anchor="end" class="st-dash-axis">${esc(money(value))}</text>`;
		}).join("");
		const months = labels.map((label, i) => {
			const x = left + (labels.length === 1 ? plotW / 2 : (i * plotW / (labels.length - 1)));
			return `<text x="${x.toFixed(2)}" y="${height - 13}" text-anchor="middle" class="st-dash-axis st-dash-month">${esc(label)}</text>`;
		}).join("");
		const lines = series.map((item) => {
			const points = line_points(item.values, plotW, plotH, lo, hi, left, top);
			const path = smooth_line_path(points);
			const baseline = top + (hi / (hi - lo)) * plotH;
			const bottomY = Math.min(top + plotH, Math.max(top, baseline));
			const areaPath = `${path} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
			const circles = points.map((point, index) =>
				`<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4" class="st-dash-chart-dot ${item.key}"><title>${esc(labels[index])} · ${esc(item.title)}: ${esc(money(item.values[index]))}</title></circle>`
			).join("");
			return `<path class="st-dash-chart-area ${item.key}" d="${areaPath}"/>
				<path class="st-dash-chart-line ${item.key}" d="${path}"/>${circles}`;
		}).join("");
		return `<svg class="st-dash-chart-svg st-v9-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(__("Revenue and expenses by month"))}">
			<defs><linearGradient id="st-v9-trend-purple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b5cf6" stop-opacity=".24"/><stop offset="100%" stop-color="#8b5cf6" stop-opacity=".015"/></linearGradient>
			<linearGradient id="st-v9-trend-cyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity=".14"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></linearGradient></defs>
			${grid}${months}${lines}</svg>`;
	}

	function production_chart(data) {
		if (!Array.isArray(data?.labels) || !Array.isArray(data?.runs)) return "";
		const max = Math.max(1, ...data.runs.map(Number));
		return `<div class="st-production-bars">${data.labels.map((label, index) => {
			const value = Number(data.runs[index] || 0);
			return `<div class="st-production-month" title="${esc(label)}: ${number(value)}"><strong>${number(value)}</strong><span class="st-production-bar-track"><i style="height:${Math.max(value ? 7 : 0, Math.round(value / max * 100))}%"></i></span><small>${esc(label)}</small></div>`;
		}).join("")}</div>`;
	}

	function heatmap_html(data) {
		// Frappe supplies a five-time-bucket by seven-weekday count matrix.
		// This reference-style stacked bar visualization represents exactly
		// those counts; it does not present invoice counts as money or visits.
		const days = Array.isArray(data?.days) ? data.days : [];
		const times = Array.isArray(data?.times) ? data.times : [];
		const values = Array.isArray(data?.values) ? data.values : [];
		if (!days.length || !times.length) return `<div class="st-dash-empty">${__("No sales activity is available.")}</div>`;
		const totals = days.map((_day, index) =>
			times.reduce((sum, _time, bucket) => sum + Math.max(0, Number(values?.[bucket]?.[index] || 0)), 0));
		const max = Math.max(1, ...totals);
		const bars = days.map((day, index) => {
			const total = totals[index];
			const height = total ? Math.max(6, total / max * 100) : 0;
			const segments = times.map((time, bucket) => {
				const count = Math.max(0, Number(values?.[bucket]?.[index] || 0));
				const segment = total ? count / total * 100 : 0;
				return segment > 0
					? `<span class="st-v10-sales-segment bucket-${bucket % 5}" style="height:${segment.toFixed(2)}%" title="${esc(time)} · ${esc(day)}: ${number(count)}"></span>`
					: "";
			}).join("");
			return `<div class="st-v10-sales-day"><strong>${number(total)}</strong>
				<div class="st-v10-sales-track"><div class="st-v10-sales-stack" style="height:${height.toFixed(2)}%">${segments}</div></div>
				<span>${esc(day)}</span></div>`;
		}).join("");
		return `<div class="st-v10-sales-chart" role="img" aria-label="${esc(__("Submitted sales invoices by weekday and time of day"))}">${bars}</div>
			<div class="st-v10-sales-caption">${esc(__("Segment colors represent time-of-day buckets"))}</div>`;
	}

	function invoice_html(data) {
		if (!data || data.paid_count == null) return `<div class="st-dash-empty">${__("Invoice information is unavailable.")}</div>`;
		const paid = Number(data.paid_count || 0), unpaid = Number(data.unpaid_count || 0), total = paid + unpaid, percentage = total ? Math.round(paid / total * 100) : 0;
		return `<div class="st-invoice-ring-wrap"><div class="st-invoice-ring" style="--paid:${percentage * 3.6}deg"><div><small>${__("Total")}</small><strong>${number(total)}</strong></div></div></div><div class="st-invoice-legend"><div><span><i class="paid"></i>${__("Paid")}</span><strong>${number(paid)}</strong><small>${money(data.paid_amount)}</small></div><div><span><i class="unpaid"></i>${__("Unpaid")}</span><strong>${number(unpaid)}</strong><small>${money(data.unpaid_amount)}</small></div></div>`;
	}

	function activity_meta(type) {
		const map = {
			Created: { action: __("created"), tone: "created" }, Submitted: { action: __("submitted"), tone: "submitted" }, Cancelled: { action: __("cancelled"), tone: "cancelled" }, Updated: { action: __("updated"), tone: "updated" }, Edit: { action: __("edited"), tone: "updated" }, Workflow: { action: __("changed workflow for"), tone: "workflow" }, Assigned: { action: __("assigned"), tone: "assigned" }, "Assignment Completed": { action: __("completed assignment for"), tone: "submitted" }, Attachment: { action: __("added an attachment to"), tone: "attachment" }, "Attachment Removed": { action: __("removed an attachment from"), tone: "attachment" }, Shared: { action: __("shared"), tone: "shared" }, Unshared: { action: __("unshared"), tone: "shared" },
		};
		return map[type] || { action: __("updated"), tone: "updated" };
	}

	function activity_item_html(item) {
		// Source is Version only. Render who/what/when separately instead of
		// compressing long document IDs and metadata into a single text line.
		const doctype = item.reference_doctype || __("Document");
		const name = item.reference_name || "";
		const actor = item.actor || __("User");
		const description = item.description || __("Updated document");
		const date = item.creation || "";
		return `<a class="st-activity-item st-v9-activity-entry" href="${esc(form_route(doctype, name))}" title="${esc(doctype + " · " + name)}">
			<span class="st-activity-avatar" aria-hidden="true">${esc(initials(actor))}</span>
			<span class="st-activity-copy">
				<span class="st-v9-activity-top"><strong class="st-v9-activity-actor">${esc(actor)}</strong><time datetime="${esc(date)}">${esc(relative_time(date))}</time></span>
				<span class="st-v9-activity-document"><b>${esc(doctype)}</b><span>${esc(name)}</span></span>
				<span class="st-v9-activity-detail">${esc(description)}</span>
			</span>
			<span class="st-v9-activity-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></span>
		</a>`;
	}

	function activity_summary_html(summary) {
		const count = Number(summary?.updated || 0);
		return count > 0
			? `<span class="st-v9-activity-counter"><i aria-hidden="true"></i>${number(count)} ${esc(__("updates"))}</span>`
			: "";
	}

	async function load_dashboard($home, token) {
		try {
			const response = await frappe.call({ method: "saas_theme.home.get_dashboard_overview" });
			if (token !== enhance_token || !$home.closest("body").length) return;
			const data = response?.message || {}, kpis = data.kpis || {};
			home_currency = data.currency || "";
			const money_keys = new Set(["revenue", "expenses", "stock_value", "cash", "receivables", "payables"]);
			Object.entries(kpis).forEach(([key, item]) => {
				if (!item || item.value == null) return;
				const $card = $home.find(`[data-dashboard-kpi="${key}"]`);
				if (!$card.length) return;
				$card.removeAttr("hidden");
				$card.find(`[data-kpi-value="${key}"]`).text(money_keys.has(key) ? money(item.value) : number(item.value));
				if ((key === "revenue" || key === "expenses") && item.delta != null) {
					$card.find(`[data-kpi-delta="${key}"]`).html(delta_html(item.delta, key === "expenses"));
				}
				$card.find(`[data-kpi-note="${key}"]`).text(item.note || "");
			});
			if (data.trend && (Array.isArray(data.trend.revenue) || Array.isArray(data.trend.expenses))) {
				$home.find('[data-dashboard-panel="trend"]').removeAttr("hidden");
				$home.find('[data-dashboard-chart="trend"]').html(trend_chart(data.trend));
				const legend = [["revenue", __("Revenue")], ["expenses", __("Expenses")]]
					.filter(([key]) => Array.isArray(data.trend[key]))
					.map(([key, label]) => `<span><i class="${key}"></i>${esc(label)}</span>`).join("");
				$home.find("[data-trend-legend]").html(legend);
				// Tiny historical charts use exactly the same permitted totals
				// as the large chart; omit when the source was not authorized.
				for (const key of ["revenue", "expenses"]) {
					if (!kpis[key] || !Array.isArray(data.trend[key])) continue;
					const svg = kpi_sparkline(data.trend[key]);
					if (svg) $home.find(`[data-kpi-mini="${key}"]`).html(svg).removeAttr("hidden");
				}

			}
			if (data.heatmap) {
				$home.find('[data-dashboard-panel="heatmap"]').removeAttr("hidden");
				$home.find("[data-sales-heatmap]").html(heatmap_html(data.heatmap));
				$home.find("[data-heatmap-total]").text(number(data.heatmap.total));
			}
			if (data.invoices) {
				$home.find('[data-dashboard-panel="invoices"]').removeAttr("hidden");
				$home.find("[data-invoice-status]").html(invoice_html(data.invoices));
			}
			if (data.production) {
				$home.find('[data-dashboard-panel="production"]').removeAttr("hidden");
				$home.find("[data-production-chart]").html(production_chart(data.production));
				$home.find("[data-production-total]").text(number(data.production.total));
			}
			// Charts are loaded only for permitted data. Never reveal a tab
			// leading to an empty, restricted analytics section.
			const hasAnalytics = $home.find('.st-v10-analytics-section [data-dashboard-panel]:not([hidden])').length > 0;
			$home.find('.st-v10-nav-tab[data-home-target="analytics"]').prop("hidden", !hasAnalytics);
		} catch (error) {
			// Do not render permission-denied or incomplete KPI cards as zeroes.
			if (token !== enhance_token) return;
			$home.find(".st-dashboard-v8 [data-dashboard-panel]").attr("hidden", "hidden");
		}
	}

	async function load_recent_activity($home, token) {
		try {
			const response = await frappe.call({ method: "saas_theme.home.get_recent_activity", args: { limit: 9 } });
			if (token !== enhance_token || !$home.closest("body").length) return;
			const payload = response?.message || {}, items = Array.isArray(payload.items) ? payload.items : [];
			$home.find('.st-dash-activity-card .st-activity-summary').html(activity_summary_html(payload.summary || {}));
			$home.find('.st-dash-activity-card .st-activity-list').html(items.length ? items.map(activity_item_html).join("") : `<div class="st-dash-empty">${__("No recent user activity is available.")}</div>`);
		} catch (e) {
			if (token !== enhance_token || !$home.closest("body").length) return;
			$home.find('.st-dash-activity-card').remove();
		}
	}

	function organize_existing_sections($home) {
		const $welcome = $home.find('.st-hub-welcome').first();
		const $clock = $home.find('.st-hub-clock-card').first();
		if ($clock.length && $welcome.length) {
			$clock.detach().addClass('st-hub-clock-strip').insertAfter($welcome);
		}

		const $sidebar = $home.find('.st-hub-sidebar').first();
		const $quick = $home.find('.st-hub-quick-section').first();
		const $workspaces = $home.find('.st-hub-workspaces-section').first();
		$workspaces.remove();

		if ($sidebar.length && $quick.length) {
			$quick.detach().addClass('st-home-quick-sidebar').prependTo($sidebar);
			$sidebar.addClass('st-home-navigation-sidebar');
			$quick.find('.st-hub-section-head h2').text(__('Quick Access'));
			$quick.find('.st-hub-section-head p').text(__('Available module sidebars'));
			$quick.find('.st-hub-quick-grid').toggleClass('st-hub-sidebar-links', true);
		}
	}

	function bind_home_section_navigation() {
		// Functional in-page navigation (no fake pages or route changes).
		$(document)
			.off("click.saas_home_sections", ".st-v10-page-nav [data-home-target]")
			.on("click.saas_home_sections", ".st-v10-page-nav [data-home-target]", function (event) {
				event.preventDefault();
				const $button = $(this);
				const $home = $button.closest(".st-home-dashboard");
				const key = String($button.attr("data-home-target") || "");
				if (!["overview", "analytics", "activity"].includes(key)) return;
				const section = $home.find(`[data-home-section="${key}"]`).get(0);
				if (!section) return;
				$home.find(".st-v10-nav-tab").removeClass("is-active").attr("aria-pressed", "false");
				$button.addClass("is-active").attr("aria-pressed", "true");
				section.scrollIntoView({ behavior: "smooth", block: "start" });
			});
	}

	function quick_sidebar_hidden() {
		try { return localStorage.getItem(QUICK_SIDEBAR_KEY) === '1'; }
		catch (e) { return false; }
	}

	function set_quick_sidebar_hidden(hidden) {
		try { localStorage.setItem(QUICK_SIDEBAR_KEY, hidden ? '1' : '0'); }
		catch (e) { /* Sidebar persistence is optional if storage is unavailable. */ }
	}

	function apply_quick_sidebar_state($home) {
		const hidden = quick_sidebar_hidden();
		$home.toggleClass('st-home-quick-sidebar-hidden', hidden);
		$home.find('.st-home-sidebar-toggle').attr({
			'aria-expanded': hidden ? 'false' : 'true',
			'aria-label': hidden ? __('Show Quick Access') : __('Hide Quick Access'),
			'title': hidden ? __('Show Quick Access') : __('Hide Quick Access'),
		}).toggleClass('is-collapsed', hidden);
	}

	function bind_quick_sidebar_toggle() {
		$(document)
			.off('click.saas_home_sidebar_toggle', '.st-home-sidebar-toggle')
			.on('click.saas_home_sidebar_toggle', '.st-home-sidebar-toggle', function (event) {
				event.preventDefault();
				event.stopPropagation();

				const $home = $(this).closest('.st-home-dashboard.st-dashboard-redesign-v7');
				if (!$home.length) return;

				set_quick_sidebar_hidden(!quick_sidebar_hidden());
				apply_quick_sidebar_state($home);
			});
	}

	function enhance() {
		const $home = $(".st-home-dashboard").last();
		if (!$home.length || $home.hasClass("st-dashboard-redesign-v7")) return;
		$home.addClass("st-dashboard-redesign-v5 st-dashboard-redesign-v6 st-dashboard-redesign-v7");
		document.body.classList.add('st-home-sidebar-ui-active');
		const token = ++enhance_token;

		organize_existing_sections($home);
		const name = String(user_name()).trim() || __("User");
		$home.find(".st-hub-welcome").html(`<div class="st-dash-welcome-group"><button type="button" class="st-home-sidebar-toggle" aria-expanded="true" aria-label="${__("Hide Quick Access")}" title="${__("Hide Quick Access")}"><span class="st-home-sidebar-toggle-bars" aria-hidden="true"><i></i><i></i><i></i></span></button><div class="st-dash-title"><h1>${__("Welcome")}, ${esc(name)}<span>👋</span></h1><p>${esc(greeting())} · ${__("Here is your business overview for today.")}</p></div></div><span class="st-dash-period">${__("Current month")}</span>`);
		$home.find(".st-hub-metrics").replaceWith(dashboard_html());

		const $main = $home.find('.st-hub-main').first();
		const $dashboard = $home.find('.st-dashboard-v5').first();
		if ($main.length && $dashboard.length) {
			$dashboard.detach().prependTo($main);
		}

		$home.find(".st-dashboard-activity-section").remove();
		bind_quick_sidebar_toggle();
		bind_home_section_navigation();
		apply_quick_sidebar_state($home);
		load_dashboard($home, token);
		load_recent_activity($home, token);
	}

	function schedule() { [40, 120, 260].forEach((delay) => setTimeout(enhance, delay)); }
	$(document).off("desktop_screen.saas_home_analytics").on("desktop_screen.saas_home_analytics", schedule);
	$(document).off("page-change.saas_home_analytics").on("page-change.saas_home_analytics", function () {
		const route = frappe.get_route?.() || [];
		if (route[0] === "desktop" || route.length === 0) schedule();
		else document.body.classList.remove('st-home-sidebar-ui-active');
	});
	$(schedule);
})();

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
			<div class="st-dash-kpi-top"><span>${esc(__(title))}</span><i aria-hidden="true">${icon(icon_name)}</i></div>
			<strong data-kpi-value="${esc(key)}">—</strong>
			<div data-kpi-delta="${esc(key)}"></div>
			<small data-kpi-note="${esc(key)}"></small>
		</article>`;
	}

	function dashboard_html() {
		return `<section class="st-dashboard-v5 st-dashboard-v8">
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
			<div class="st-dash-insights">
				<article hidden class="st-dash-card st-dash-revenue-card" data-dashboard-panel="trend">
					<div class="st-dash-card-head"><div><strong>${__("Revenue & Expenses")}</strong><small>${__("Six-month financial movement")}</small></div><div class="st-dash-legend" data-trend-legend></div></div>
					<div class="st-dash-chart" data-dashboard-chart="trend"></div>
				</article>
				<article hidden class="st-dash-card st-dash-heatmap-card" data-dashboard-panel="heatmap">
					<div class="st-dash-card-head"><div><strong>${__("Sales Heatmap")}</strong><small>${__("Submitted invoices by weekday and time")}</small></div><span class="st-dash-mini-value" data-heatmap-total>—</span></div>
					<div class="st-sales-heatmap" data-sales-heatmap></div>
				</article>
			</div>
			<div class="st-dash-lower-grid">
				<article hidden class="st-dash-card st-dash-invoice-card" data-dashboard-panel="invoices">
					<div class="st-dash-card-head"><div><strong>${__("Sales Invoices")}</strong><small>${__("Paid vs unpaid · past six months")}</small></div></div>
					<div class="st-invoice-status" data-invoice-status></div>
				</article>
				<article class="st-dash-card st-dash-activity-card">
					<div class="st-dash-card-head"><div><strong>${__("Recent User Activity")}</strong><small>${__("Document audit events you can view")}</small></div></div>
					<div class="st-activity-summary"></div>
					<div class="st-activity-list"><div class="st-dash-loading">${__("Loading activity…")}</div></div>
				</article>
			</div>
			<article hidden class="st-dash-card st-dash-production-card" data-dashboard-panel="production">
				<div class="st-dash-card-head"><div><strong>${__("Production Runs")}</strong><small>${__("Submitted Manufacture stock entries · six months")}</small></div><strong data-production-total></strong></div>
				<div class="st-production-chart" data-production-chart></div>
			</article>
		</section>`;
	}

	function trend_chart(data) {
		const labels = data?.labels || [];
		const series = [
			{ key: "revenue", title: __("Revenue"), values: data?.revenue },
			{ key: "expenses", title: __("Expenses"), values: data?.expenses },
		].filter((item) => Array.isArray(item.values));
		if (!labels.length || !series.length) return "";
		const values = series.flatMap((item) => item.values.map(Number).filter(Number.isFinite));
		if (!values.some((value) => value > 0)) return `<div class="st-dash-empty">${__("No posted activity for this period.")}</div>`;
		const width = 760, height = 280, left = 56, right = 18, top = 16, bottom = 38;
		const plotW = width - left - right, plotH = height - top - bottom;
		const max = Math.max(1, ...values), slot = plotW / labels.length;
		const barWidth = Math.min(27, slot * .27);
		const grid = [0, .25, .5, .75, 1].map((ratio) => {
			const y = top + plotH - ratio * plotH;
			return `<line x1="${left}" x2="${width - right}" y1="${y}" y2="${y}" class="st-dash-grid-line"/><text x="${left - 8}" y="${y + 3}" text-anchor="end" class="st-dash-axis">${esc(money(max * ratio))}</text>`;
		}).join("");
		const bars = labels.map((label, index) => {
			const center = left + slot * (index + .5);
			return series.map((item, si) => {
				const val = Number(item.values[index] || 0);
				const h = Math.max(0, val / max * plotH);
				const x = center + (si - (series.length - 1) / 2) * (barWidth + 6) - barWidth / 2;
				return `<rect x="${x}" y="${top + plotH - h}" width="${barWidth}" height="${h}" rx="5" class="st-dash-bar ${item.key}"><title>${esc(label)} ${esc(item.title)}: ${esc(money(val))}</title></rect>`;
			}).join("") + `<text x="${center}" y="${height - 12}" text-anchor="middle" class="st-dash-axis">${esc(label)}</text>`;
		}).join("");
		return `<svg class="st-dash-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(__("Revenue and expense totals by month"))}">${grid}${bars}</svg>`;
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
		const days = data?.days || [], times = data?.times || [], values = data?.values || [], flat = values.flat().map(Number), max = Math.max(1, ...flat, 1);
		if (!days.length || !times.length) return `<div class="st-dash-empty">${__("No sales heatmap data is available.")}</div>`;
		const heads = days.map((day) => `<span class="st-heatmap-day">${esc(day)}</span>`).join("");
		const rows = times.map((time, rowIndex) => `<div class="st-heatmap-time">${esc(time)}</div>${days.map((_day, colIndex) => {
			const value = Number(values?.[rowIndex]?.[colIndex] || 0), strength = value ? Math.max(.12, value / max) : .035;
			return `<div class="st-heatmap-cell" style="--heat:${strength.toFixed(3)}" title="${esc(`${time} · ${days[colIndex]}: ${value}`)}"><span>${value || ""}</span></div>`;
		}).join("")}`).join("");
		return `<div class="st-heatmap-grid"><div></div>${heads}${rows}</div>`;
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
		const meta = activity_meta(item.activity_type), doctype = item.reference_doctype || __("Document"), name = item.reference_name || item.subject || "", actor = item.actor || __("User");
		return `<a class="st-activity-item" href="${esc(form_route(item.reference_doctype, item.reference_name))}"><span class="st-activity-avatar">${esc(initials(actor))}</span><span class="st-activity-copy"><span class="st-activity-line"><strong>${esc(actor)}</strong> <span>${esc(meta.action)}</span> <b>${esc(doctype)}</b></span><small><span>${esc(name)}</span><i></i>${esc(relative_time(item.creation))}</small></span><span class="st-activity-badge st-activity-${esc(meta.tone)}">${esc(item.activity_type || __("Updated"))}</span></a>`;
	}

	function activity_summary_html(summary) {
		return [["created", __("Created"), "created"], ["updated", __("Updated"), "updated"], ["submitted", __("Submitted"), "submitted"], ["other", __("Other"), "other"]]
			.map(([key, label, tone]) => `<div class="st-activity-stat"><span class="st-activity-stat-dot st-activity-${tone}"></span><div><strong>${Number(summary?.[key] || 0)}</strong><small>${esc(label)}</small></div></div>`).join("");
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
			$home.find('.st-dash-activity-card .st-activity-list').html(`<div class="st-dash-empty">${__("Recent activity could not be loaded.")}</div>`);
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
		}
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

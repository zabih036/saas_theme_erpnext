/*
 * SaaS Theme — ERP Home Dashboard Analytics
 * Finance/customer overview with preserved Quick Access, Recent and Workspaces.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	let enhance_token = 0;
	const QUICK_SIDEBAR_KEY = "saas_theme_home_quick_sidebar_hidden_v1";

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
		return frappe.boot?.sysdefaults?.currency || frappe.sys_defaults?.currency || frappe.defaults?.get_default?.("currency") || "";
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

	function dashboard_html() {
		return `<section class="st-dashboard-v5">
			<div class="st-dash-kpis">
				<a class="st-dash-kpi st-dash-kpi-primary" href="${esc(list_route("Sales Invoice"))}"><div class="st-dash-kpi-top"><span>${__("Revenue")}</span><i>${icon("selling")}</i></div><strong data-kpi-value="revenue">—</strong><div data-kpi-delta="revenue">${delta_html(null)}</div><small data-kpi-note="revenue">${__("Loading sales…")}</small></a>
				<a class="st-dash-kpi" href="${esc(report_route("Profit and Loss Statement"))}"><div class="st-dash-kpi-top"><span>${__("Expenses")}</span><i>${icon("accounting")}</i></div><strong data-kpi-value="expenses">—</strong><div data-kpi-delta="expenses">${delta_html(null)}</div><small data-kpi-note="expenses">${__("Loading expense ledger…")}</small></a>
				<a class="st-dash-kpi" href="${esc(list_route("Customer"))}"><div class="st-dash-kpi-top"><span>${__("Active Customers")}</span><i>${icon("users")}</i></div><strong data-kpi-value="customers">—</strong><div data-kpi-delta="customers"><span class="st-dash-delta neutral">${__("Customer master")}</span></div><small data-kpi-note="customers">${__("Loading customers…")}</small></a>
				<a class="st-dash-kpi" href="${esc(list_route("Supplier"))}"><div class="st-dash-kpi-top"><span>${__("Suppliers")}</span><i>${icon("organization")}</i></div><strong data-kpi-value="suppliers">—</strong><div data-kpi-delta="suppliers"><span class="st-dash-delta neutral">${__("Supplier master")}</span></div><small data-kpi-note="suppliers">${__("Loading suppliers…")}</small></a>
			</div>
			<div class="st-dash-insights">
				<article class="st-dash-card st-dash-revenue-card"><div class="st-dash-card-head"><div><strong>${__("Revenue & Expenses")}</strong><small>${__("Six-month financial movement")}</small></div><div class="st-dash-legend"><span><i class="revenue"></i>${__("Revenue")}</span><span><i class="expenses"></i>${__("Expenses")}</span></div></div><div class="st-dash-chart" data-dashboard-chart="trend"><div class="st-dash-loading">${__("Loading chart…")}</div></div></article>
				<article class="st-dash-card st-dash-heatmap-card"><div class="st-dash-card-head"><div><strong>${__("Sales Heatmap")}</strong><small>${__("Invoice activity by weekday and time")}</small></div><span class="st-dash-mini-value" data-heatmap-total>—</span></div><div class="st-sales-heatmap" data-sales-heatmap><div class="st-dash-loading">${__("Loading heatmap…")}</div></div></article>
			</div>
			<div class="st-dash-lower-grid">
				<article class="st-dash-card st-dash-invoice-card"><div class="st-dash-card-head"><div><strong>${__("Invoices")}</strong><small>${__("Paid vs unpaid · last six months")}</small></div></div><div class="st-invoice-status" data-invoice-status><div class="st-dash-loading">${__("Loading invoice status…")}</div></div></article>
				<article class="st-dash-card st-dash-activity-card"><div class="st-dash-card-head"><div><strong>${__("Recent User Activity")}</strong><small>${__("Recent document actions visible to your account")}</small></div><span class="st-dash-card-pill">${__("Live")}</span></div><div class="st-activity-summary"><div class="st-activity-summary-loading">${__("Loading activity…")}</div></div><div class="st-activity-list"><div class="st-dash-loading">${__("Loading recent activity…")}</div></div></article>
			</div>
		</section>`;
	}

	function trend_chart(data) {
		const labels = data?.labels || [], revenue = data?.revenue || [], expenses = data?.expenses || [];
		const values = [...revenue, ...expenses].map(Number).filter((value) => Number.isFinite(value));
		if (!labels.length || !values.some((value) => value > 0)) return `<div class="st-dash-empty">${__("No financial activity is available for this period.")}</div>`;
		const width = 760, height = 280, left = 52, right = 18, top = 16, bottom = 38;
		const plotW = width - left - right, plotH = height - top - bottom, max = Math.max(1, ...values), slot = plotW / labels.length, bar = Math.min(28, slot * .24);
		const grid = [0, .25, .5, .75, 1].map((ratio) => {
			const y = top + plotH - ratio * plotH;
			return `<line x1="${left}" x2="${width-right}" y1="${y}" y2="${y}" class="st-dash-grid-line"/><text x="${left-8}" y="${y+3}" text-anchor="end" class="st-dash-axis">${esc(money(max*ratio))}</text>`;
		}).join("");
		const bars = labels.map((label, index) => {
			const cx = left + slot * index + slot / 2, rv = Number(revenue[index] || 0), ev = Number(expenses[index] || 0), rh = rv / max * plotH, eh = ev / max * plotH;
			return `<rect x="${cx-bar-3}" y="${top+plotH-rh}" width="${bar}" height="${Math.max(2,rh)}" rx="6" class="st-dash-bar revenue"><title>${esc(`${label} ${__("Revenue")}: ${money(rv)}`)}</title></rect><rect x="${cx+3}" y="${top+plotH-eh}" width="${bar}" height="${Math.max(2,eh)}" rx="6" class="st-dash-bar expenses"><title>${esc(`${label} ${__("Expenses")}: ${money(ev)}`)}</title></rect><text x="${cx}" y="${height-12}" text-anchor="middle" class="st-dash-axis">${esc(label)}</text>`;
		}).join("");
		return `<svg class="st-dash-chart-svg" viewBox="0 0 ${width} ${height}">${grid}${bars}</svg>`;
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
			[["revenue", false, money], ["expenses", true, money], ["customers", false, number], ["suppliers", false, number]].forEach(([key, inverse, formatter]) => {
				const item = kpis[key] || {};
				$home.find(`[data-kpi-value="${key}"]`).text(formatter(item.value));
				if (key === "revenue" || key === "expenses") $home.find(`[data-kpi-delta="${key}"]`).html(delta_html(item.delta, inverse));
				$home.find(`[data-kpi-note="${key}"]`).text(item.note || __("No data available"));
			});
			$home.find('[data-dashboard-chart="trend"]').html(trend_chart(data.trend));
			$home.find('[data-sales-heatmap]').html(heatmap_html(data.heatmap));
			$home.find('[data-heatmap-total]').text(data.heatmap?.total == null ? "—" : number(data.heatmap.total));
			$home.find('[data-invoice-status]').html(invoice_html(data.invoices));
		} catch (e) {
			if (token !== enhance_token || !$home.closest("body").length) return;
			$home.find('.st-dash-loading').text(__("Dashboard data could not be loaded."));
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
		$('.navbar-brand .app-logo').attr({
			'aria-expanded': hidden ? 'false' : 'true',
			'title': hidden ? __('Show Quick Access') : __('Hide Quick Access'),
		});
	}

	function bind_quick_sidebar_toggle() {
		if (window.__saas_theme_home_quick_sidebar_toggle_v1__) return;
		window.__saas_theme_home_quick_sidebar_toggle_v1__ = true;

		document.addEventListener('click', (event) => {
			const logo = event.target?.closest?.('.navbar-brand .app-logo');
			if (!logo) return;

			const home = document.querySelector('.st-home-dashboard.st-dashboard-redesign-v6');
			if (!home) return;

			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation?.();

			const $home = $(home);
			set_quick_sidebar_hidden(!quick_sidebar_hidden());
			apply_quick_sidebar_state($home);
		}, true);
	}

	function enhance() {
		const $home = $(".st-home-dashboard").last();
		if (!$home.length || $home.hasClass("st-dashboard-redesign-v6")) return;
		$home.addClass("st-dashboard-redesign-v5 st-dashboard-redesign-v6");
		const token = ++enhance_token;

		organize_existing_sections($home);
		const name = String(user_name()).trim() || __("User");
		$home.find(".st-hub-welcome").html(`<div class="st-dash-title"><h1>${__("Welcome")}, ${esc(name)}<span>👋</span></h1><p>${esc(greeting())} · ${__("Here is your business overview for today.")}</p></div><span class="st-dash-period">${__("Current month")}</span>`);
		$home.find(".st-hub-metrics").replaceWith(dashboard_html());
		$home.find(".st-dashboard-activity-section").remove();

		bind_quick_sidebar_toggle();
		apply_quick_sidebar_state($home);
		load_dashboard($home, token);
		load_recent_activity($home, token);
	}

	function schedule() { [40, 120, 260].forEach((delay) => setTimeout(enhance, delay)); }
	$(document).off("desktop_screen.saas_home_analytics").on("desktop_screen.saas_home_analytics", schedule);
	$(document).off("page-change.saas_home_analytics").on("page-change.saas_home_analytics", function () { const route = frappe.get_route?.() || []; if (route[0] === "desktop" || route.length === 0) schedule(); });
	$(schedule);
})();

/*
 * SaaS Theme — ERP Home Analytics
 * Refines the home dashboard with fixed core navigation and real ERP analytics.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;

	const MONTHS = 6;
	const LIMIT = 400;
	let enhance_token = 0;

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

	function icon(name, fallback = "layout-grid") {
		try { return frappe.utils.icon(name || fallback, "md"); } catch (e) {
			try { return frappe.utils.icon(fallback, "md"); } catch (ignored) { return ""; }
		}
	}

	function arrow() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>`;
	}

	function workspaces() {
		try { return saas_theme.professional_ui?.get_workspaces?.() || []; } catch (e) { return []; }
	}

	function visible_workspaces(items) {
		const pages = frappe.boot?.workspaces?.pages || [];
		const hidden = new Set();
		pages.forEach((page) => {
			if (!page || (page.hidden !== 1 && page.is_hidden !== 1 && page.hide_custom !== 1)) return;
			[page.name, page.title, page.label].filter(Boolean).forEach((value) => hidden.add(String(value)));
		});
		return (items || []).filter((item) => item?.name && item?.route && !hidden.has(String(item.name)) && !hidden.has(String(item.title || "")));
	}

	function find_workspace(items, aliases) {
		const needles = aliases.map((value) => value.toLowerCase());
		return items.find((item) => {
			const hay = [item.name, item.title, item.module].filter(Boolean).map((value) => String(value).toLowerCase());
			return needles.some((needle) => hay.some((value) => value === needle || value.includes(needle)));
		});
	}

	function quick_items(items) {
		return [
			{ title: __("Buying"), aliases: ["buying", "purchase"], icon: "shopping-cart", fallback: list_route("Purchase Order") },
			{ title: __("Sales"), aliases: ["selling", "sales"], icon: "selling", fallback: list_route("Sales Invoice") },
			{ title: __("Assets"), aliases: ["assets", "asset"], icon: "assets", fallback: list_route("Asset") },
			{ title: __("Payments"), aliases: ["payments", "payment"], icon: "payment", fallback: list_route("Payment Entry") },
			{ title: __("Accounting"), aliases: ["accounting", "accounts"], icon: "accounting", fallback: list_route("Journal Entry") },
			{ title: __("Stock"), aliases: ["stock", "inventory"], icon: "stock", fallback: list_route("Stock Entry") },
		].map((definition) => {
			const workspace = find_workspace(items, definition.aliases);
			return {
				...definition,
				name: workspace?.name || "",
				route: workspace?.route || definition.fallback,
				icon: workspace?.icon || definition.icon,
			};
		});
	}

	function quick_html(item) {
		const workspace_attr = item.name ? ` data-workspace-name="${esc(item.name)}"` : "";
		return `<a class="st-hub-quick-card" href="${esc(item.route)}"${workspace_attr}><span class="st-hub-quick-icon">${icon(item.icon)}</span><span class="st-hub-quick-copy"><strong>${esc(item.title)}</strong><small>${__("Open module")}</small></span><span class="st-hub-quick-arrow">${arrow()}</span></a>`;
	}

	function workspace_navigation_html(items) {
		const visible = visible_workspaces(items);
		if (!visible.length) return "";
		const rows = visible.map((item) => `<a class="st-hub-recent-item st-hub-workspace-nav-item" href="${esc(item.route)}" data-workspace-name="${esc(item.name)}"><span class="st-hub-recent-icon">${icon(item.icon)}</span><span class="st-hub-recent-copy"><strong>${esc(__(item.title || item.name))}</strong><small>${esc(__(item.module || __("Workspace")))}</small></span><span class="st-hub-recent-arrow">${arrow()}</span></a>`).join("");
		return `<section class="st-hub-side-card st-hub-workspace-nav"><div class="st-hub-side-head"><div><span>${__("Workspaces")}</span><small>${__("Navigate to available work areas")}</small></div></div><div class="st-hub-recent-list st-hub-workspace-nav-list" style="max-height:min(430px,44vh);overflow-y:auto;overscroll-behavior:contain;padding-right:2px;">${rows}</div></section>`;
	}

	function metric_html(key, title, icon_name, route) {
		return `<a class="st-hub-metric st-hub-business-metric" href="${esc(route)}" data-business-metric="${key}"><span class="st-hub-metric-icon">${icon(icon_name)}</span><span class="st-hub-metric-copy"><small>${esc(title)}</small><strong data-business-value="${key}">…</strong><span data-business-caption="${key}">${__("Loading current month")}</span></span></a>`;
	}

	function analytics_html() {
		return `<div class="st-hub-section-head st-analytics-head"><div><h2>${__("Business Overview")}</h2><p>${__("Sales, purchases, payments and stock activity for the last 6 months")}</p></div><span class="st-analytics-updated">${__("Loading analytics…")}</span></div>
		<div class="st-analytics-kpis">
			${kpi("sales", __("Sales Invoices"), "selling", list_route("Sales Invoice"))}
			${kpi("purchases", __("Purchase Invoices"), "shopping-cart", list_route("Purchase Invoice"))}
			${kpi("payments", __("Payment Entries"), "payment", list_route("Payment Entry"))}
			${kpi("stock", __("Stock Activity"), "stock", list_route("Stock Entry"))}
		</div>
		<div class="st-analytics-grid">
			<article class="st-analytics-card st-analytics-card-wide"><div class="st-analytics-card-head"><strong>${__("Sales vs Purchases")}</strong><small>${__("Submitted invoice value by month")}</small></div><div class="st-analytics-chart st-finance-chart">${empty_chart(__("Loading chart…"))}</div></article>
			<article class="st-analytics-card"><div class="st-analytics-card-head"><strong>${__("Payment Activity")}</strong><small>${__("Submitted payment value by month")}</small></div><div class="st-analytics-chart st-payments-chart">${empty_chart(__("Loading chart…"))}</div></article>
			<article class="st-analytics-card"><div class="st-analytics-card-head"><strong>${__("Stock Transactions")}</strong><small>${__("Submitted stock entries by month")}</small></div><div class="st-analytics-chart st-stock-chart">${empty_chart(__("Loading chart…"))}</div></article>
		</div>`;
	}

	function kpi(key, title, icon_name, route) {
		return `<a class="st-analytics-kpi" href="${esc(route)}"><span class="st-analytics-kpi-icon">${icon(icon_name)}</span><span><small>${esc(title)}</small><strong data-analytics-value="${key}">—</strong><em data-analytics-note="${key}">${__("Loading…")}</em></span>${arrow()}</a>`;
	}

	function empty_chart(message) {
		return `<div class="st-analytics-empty">${esc(message)}</div>`;
	}

	function currency() {
		return frappe.boot?.sysdefaults?.currency || frappe.sys_defaults?.currency || frappe.defaults?.get_default?.("currency") || "";
	}

	function amount(value) {
		if (value == null || Number.isNaN(Number(value))) return "—";
		const number = Number(value);
		const code = currency();
		try {
			return new Intl.NumberFormat(document.documentElement.lang || navigator.language || "en", {
				style: code ? "currency" : "decimal",
				currency: code || undefined,
				notation: Math.abs(number) >= 1000000 ? "compact" : "standard",
				maximumFractionDigits: Math.abs(number) >= 100000 ? 1 : 0,
			}).format(number);
		} catch (e) { return `${code ? code + " " : ""}${Math.round(number).toLocaleString()}`; }
	}

	function qty(value) {
		if (value == null || Number.isNaN(Number(value))) return "—";
		return new Intl.NumberFormat(document.documentElement.lang || navigator.language || "en", { notation: Math.abs(value) >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value));
	}

	function iso(date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	}

	function period() {
		const now = new Date();
		return {
			start: iso(new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1)),
			current: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
			end: iso(now),
		};
	}

	function buckets() {
		const now = new Date();
		const locale = document.documentElement.lang || navigator.language || "en";
		return Array.from({ length: MONTHS }, (_, index) => {
			const date = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - index), 1);
			return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat(locale, { month: "short" }).format(date) };
		});
	}

	async function get_list(doctype, fields, filters, group_by = "") {
		try {
			const response = await frappe.call({ method: "frappe.client.get_list", args: { doctype, fields, filters, group_by: group_by || undefined, order_by: "posting_date asc", limit_page_length: LIMIT } });
			return Array.isArray(response?.message) ? response.message : [];
		} catch (e) { return null; }
	}

	function total(rows, field, absolute = false) {
		return (rows || []).reduce((sum, row) => sum + (absolute ? Math.abs(Number(row[field] || 0)) : Number(row[field] || 0)), 0);
	}

	function monthly(rows, field, absolute = false) {
		const months = buckets();
		const values = Object.fromEntries(months.map((month) => [month.key, 0]));
		(rows || []).forEach((row) => {
			const key = String(row.posting_date || "").slice(0, 7);
			if (!(key in values)) return;
			const value = Number(row[field] || 0);
			values[key] += absolute ? Math.abs(value) : value;
		});
		return { labels: months.map((month) => month.label), values: months.map((month) => values[month.key]) };
	}

	function line_chart(labels, series) {
		if (!series.some((item) => item.values.some((value) => Number(value) > 0))) return empty_chart(__("No data available for this period."));
		const width = 700, height = 230, left = 44, right = 14, top = 18, bottom = 34;
		const plot_w = width - left - right, plot_h = height - top - bottom;
		const max = Math.max(1, ...series.flatMap((item) => item.values));
		const x = (i) => left + (labels.length <= 1 ? plot_w / 2 : (i * plot_w) / (labels.length - 1));
		const y = (value) => top + plot_h - (Number(value || 0) / max) * plot_h;
		const grid = [0, .5, 1].map((ratio) => { const yy = top + plot_h - ratio * plot_h; return `<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" class="st-chart-grid"/><text x="${left-7}" y="${yy+3}" text-anchor="end" class="st-chart-label">${esc(amount(max*ratio))}</text>`; }).join("");
		const lines = series.map((item, s) => `<polyline points="${item.values.map((value, i) => `${x(i)},${y(value)}`).join(" ")}" class="st-chart-line st-chart-series-${s}"/>${item.values.map((value, i) => `<circle cx="${x(i)}" cy="${y(value)}" r="3" class="st-chart-dot st-chart-series-${s}"/>`).join("")}`).join("");
		const xlabels = labels.map((label, i) => `<text x="${x(i)}" y="${height-9}" text-anchor="middle" class="st-chart-label">${esc(label)}</text>`).join("");
		const legend = series.map((item, s) => `<span><i class="st-chart-series-${s}"></i>${esc(item.label)}</span>`).join("");
		return `<div class="st-chart-wrap"><div class="st-chart-legend">${legend}</div><svg viewBox="0 0 ${width} ${height}" class="st-chart-svg">${grid}${lines}${xlabels}</svg></div>`;
	}

	function bar_chart(labels, values, formatter, class_name) {
		if (!values.some((value) => Number(value) > 0)) return empty_chart(__("No data available for this period."));
		const width = 700, height = 215, left = 44, right = 14, top = 16, bottom = 34;
		const plot_w = width - left - right, plot_h = height - top - bottom, max = Math.max(1, ...values), slot = plot_w / labels.length, bar_w = Math.min(48, slot * .52);
		const grid = [0, .5, 1].map((ratio) => { const yy = top + plot_h - ratio * plot_h; return `<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" class="st-chart-grid"/><text x="${left-7}" y="${yy+3}" text-anchor="end" class="st-chart-label">${esc(formatter(max*ratio))}</text>`; }).join("");
		const bars = values.map((value, i) => { const h = (Number(value || 0) / max) * plot_h, xx = left + i*slot + (slot-bar_w)/2, yy = top + plot_h - h; return `<rect x="${xx}" y="${yy}" width="${bar_w}" height="${Math.max(2,h)}" rx="6" class="st-chart-bar ${class_name}"><title>${esc(`${labels[i]}: ${formatter(value)}`)}</title></rect><text x="${left+i*slot+slot/2}" y="${height-9}" text-anchor="middle" class="st-chart-label">${esc(labels[i])}</text>`; }).join("");
		return `<div class="st-chart-wrap"><svg viewBox="0 0 ${width} ${height}" class="st-chart-svg">${grid}${bars}</svg></div>`;
	}

	function set_business_metric($home, key, value, caption) {
		$home.find(`[data-business-value="${key}"]`).text(value == null ? "—" : value);
		$home.find(`[data-business-caption="${key}"]`).text(caption || __("No data available"));
	}

	function set_kpi($home, key, value, note) {
		$home.find(`[data-analytics-value="${key}"]`).text(value == null ? "—" : value);
		$home.find(`[data-analytics-note="${key}"]`).text(note || __("No data available"));
	}

	async function load_analytics($home, token) {
		const range = period();
		const submitted = [["docstatus", "=", 1], ["posting_date", ">=", range.start], ["posting_date", "<=", range.end]];
		const sum_field = (field, alias = "value") => ({ SUM: field, as: alias });
		const count_field = (field = "name", alias = "count") => ({ COUNT: field, as: alias });
		const [sales, purchases, primary_payments, stock] = await Promise.all([
			get_list("Sales Invoice", ["posting_date", sum_field("base_grand_total"), count_field()], submitted, "posting_date"),
			get_list("Purchase Invoice", ["posting_date", sum_field("base_grand_total"), count_field()], submitted, "posting_date"),
			get_list("Payment Entry", ["posting_date", sum_field("base_paid_amount"), count_field()], submitted, "posting_date"),
			get_list("Stock Entry", ["posting_date", count_field("name", "value")], submitted, "posting_date"),
		]);
		let payments = primary_payments;
		if (payments === null) { payments = await get_list("Payment Entry", ["posting_date", sum_field("paid_amount"), count_field()], submitted, "posting_date"); }
		if (token !== enhance_token || !$home.closest("body").length) return;

		const sales_current = (sales || []).filter((row) => String(row.posting_date || "") >= range.current);
		const purchase_current = (purchases || []).filter((row) => String(row.posting_date || "") >= range.current);
		const row_count = (rows) => total(rows || [], "count");
		set_business_metric($home, "sales", sales === null ? null : amount(total(sales_current, "value")), sales === null ? __("No access") : __("{0} submitted invoices", [row_count(sales_current)]));
		set_business_metric($home, "purchases", purchases === null ? null : amount(total(purchase_current, "value")), purchases === null ? __("No access") : __("{0} submitted invoices", [row_count(purchase_current)]));

		set_kpi($home, "sales", sales === null ? null : amount(total(sales, "value")), sales === null ? __("No access") : __("{0} invoices · 6 months", [row_count(sales)]));
		set_kpi($home, "purchases", purchases === null ? null : amount(total(purchases, "value")), purchases === null ? __("No access") : __("{0} invoices · 6 months", [row_count(purchases)]));
		set_kpi($home, "payments", payments === null ? null : amount(total(payments, "value")), payments === null ? __("No access") : __("{0} entries · 6 months", [row_count(payments)]));
		set_kpi($home, "stock", stock === null ? null : qty(total(stock, "value")), stock === null ? __("No access") : __("{0} submitted stock entries", [total(stock || [], "value")]));

		const s = monthly(sales || [], "value"), p = monthly(purchases || [], "value"), pay = monthly(payments || [], "value"), st = monthly(stock || [], "value");
		$home.find(".st-finance-chart").html(line_chart(s.labels, [{ label: __("Sales"), values: s.values }, { label: __("Purchases"), values: p.values }]));
		$home.find(".st-payments-chart").html(bar_chart(pay.labels, pay.values, amount, "st-chart-series-0"));
		$home.find(".st-stock-chart").html(bar_chart(st.labels, st.values, qty, "st-chart-series-2"));
		$home.find(".st-analytics-updated").text(__("Updated just now"));
	}

	function enhance() {
		const $home = $(".st-home-dashboard").last();
		if (!$home.length || $home.hasClass("st-analytics-enhanced")) return;
		$home.addClass("st-analytics-enhanced");
		const token = ++enhance_token;
		const items = workspaces();

		$home.find(".st-hub-workspace-total").remove();
		const $metrics = $home.find(".st-hub-metrics");
		$metrics.find(".st-hub-metric").slice(2).remove();
		$metrics.append(metric_html("sales", __("Sales This Month"), "selling", list_route("Sales Invoice")));
		$metrics.append(metric_html("purchases", __("Purchases This Month"), "shopping-cart", list_route("Purchase Invoice")));

		$home.find(".st-hub-quick-section .st-hub-section-head p").text(__("Buying, sales, assets, payments, accounting and stock"));
		$home.find(".st-hub-quick-grid").html(quick_items(items).map(quick_html).join(""));

		const $sidebar = $home.find(".st-hub-sidebar");
		$sidebar.find(".st-hub-workspace-nav").remove();
		$sidebar.append(workspace_navigation_html(items));

		const $workspace_section = $home.find(".st-hub-workspaces-section");
		$workspace_section.removeClass("st-hub-workspaces-section").addClass("st-hub-analytics-section").html(analytics_html());
		load_analytics($home, token);
	}

	function schedule() {
		[40, 120, 260].forEach((delay) => setTimeout(enhance, delay));
	}

	$(document).off("desktop_screen.saas_home_analytics").on("desktop_screen.saas_home_analytics", schedule);
	$(document).off("page-change.saas_home_analytics").on("page-change.saas_home_analytics", function () {
		const route = frappe.get_route?.() || [];
		if (route[0] === "desktop" || route.length === 0) schedule();
	});
	$(schedule);
})();

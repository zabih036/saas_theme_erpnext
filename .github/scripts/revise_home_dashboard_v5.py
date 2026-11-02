from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOME_PY = ROOT / "saas_theme/home.py"
HOME_JS = ROOT / "saas_theme/public/js/home_analytics.js"
HOME_CSS = ROOT / "saas_theme/public/css/home.css"

HOME_PY_TEXT = r'''from __future__ import annotations

from collections import Counter, defaultdict
from datetime import time

import frappe
from frappe import _
from frappe.utils import add_months, cint, flt, get_first_day, getdate, nowdate, strip_html_tags


ACTIVITY_TYPES = (
    "Created",
    "Submitted",
    "Cancelled",
    "Updated",
    "Edit",
    "Workflow",
    "Assigned",
    "Assignment Completed",
    "Attachment",
    "Attachment Removed",
    "Shared",
    "Unshared",
)


def _can_read_reference(doctype: str | None, name: str | None, user: str) -> bool:
    if not doctype or not name:
        return False
    try:
        return bool(frappe.has_permission(doctype, "read", doc=name, user=user))
    except Exception:
        return False


def _clean_text(value: str | None, max_length: int = 160) -> str:
    text = " ".join(strip_html_tags(value or "").split())
    if len(text) <= max_length:
        return text
    return f"{text[: max_length - 1].rstrip()}…"


def _safe_list(doctype: str, *, fields: list, filters=None, order_by: str | None = None, limit: int = 1000):
    try:
        return frappe.get_list(
            doctype,
            fields=fields,
            filters=filters or [],
            order_by=order_by,
            limit_page_length=limit,
        )
    except Exception:
        return None


def _month_key(value) -> str:
    return str(value or "")[:7]


def _month_series(start_date, count: int = 6):
    result = []
    for index in range(count):
        date = getdate(add_months(start_date, index))
        result.append({"key": date.strftime("%Y-%m"), "label": date.strftime("%b")})
    return result


def _sum(rows, field: str) -> float:
    return sum(flt(row.get(field)) for row in (rows or []))


def _change(current: float, previous: float):
    current = flt(current)
    previous = flt(previous)
    if not previous:
        return None if not current else 100.0
    return round(((current - previous) / abs(previous)) * 100, 1)


def _posting_hour(value) -> int:
    if isinstance(value, time):
        return value.hour
    text = str(value or "12:00:00")
    try:
        return int(text.split(":", 1)[0])
    except Exception:
        return 12


def _heatmap_bucket(hour: int) -> int:
    if hour < 11:
        return 0
    if hour < 14:
        return 1
    if hour < 17:
        return 2
    if hour < 20:
        return 3
    return 4


@frappe.whitelist()
def get_dashboard_overview() -> dict:
    """Permission-aware finance/customer overview for the custom Home dashboard."""

    if frappe.session.user == "Guest":
        return {}

    today = getdate(nowdate())
    current_start = getdate(get_first_day(today))
    series_start = getdate(add_months(current_start, -5))
    previous_start = getdate(add_months(current_start, -1))
    series = _month_series(series_start)

    common_date_filters = [
        ["docstatus", "=", 1],
        ["posting_date", ">=", series_start],
        ["posting_date", "<=", today],
    ]

    sales = _safe_list(
        "Sales Invoice",
        fields=["name", "posting_date", "posting_time", "base_grand_total", "outstanding_amount", "customer", "status"],
        filters=common_date_filters,
        order_by="posting_date desc, posting_time desc",
        limit=2500,
    )

    customers = _safe_list(
        "Customer",
        fields=["name"],
        filters=[["disabled", "=", 0]],
        order_by="modified desc",
        limit=5000,
    )

    suppliers = _safe_list(
        "Supplier",
        fields=["name"],
        filters=[["disabled", "=", 0]],
        order_by="modified desc",
        limit=5000,
    )

    # Frappe v16 rejects raw SQL functions such as "sum(debit) as debit"
    # in string field definitions. Read permitted GL rows and aggregate safely
    # in Python instead. This keeps normal get_list permission filtering.
    expense_rows = None
    accounts = _safe_list(
        "Account",
        fields=["name"],
        filters=[["root_type", "=", "Expense"], ["is_group", "=", 0]],
        limit=2500,
    )
    expense_accounts = [row.get("name") for row in (accounts or []) if row.get("name")]
    if expense_accounts:
        expense_rows = _safe_list(
            "GL Entry",
            fields=["posting_date", "debit", "credit"],
            filters=[
                ["is_cancelled", "=", 0],
                ["posting_date", ">=", series_start],
                ["posting_date", "<=", today],
                ["account", "in", expense_accounts],
            ],
            order_by="posting_date asc",
            limit=25000,
        )

    revenue_monthly = defaultdict(float)
    for row in sales or []:
        revenue_monthly[_month_key(row.get("posting_date"))] += flt(row.get("base_grand_total"))

    expense_monthly = defaultdict(float)
    for row in expense_rows or []:
        expense_monthly[_month_key(row.get("posting_date"))] += flt(row.get("debit")) - flt(row.get("credit"))

    current_key = current_start.strftime("%Y-%m")
    previous_key = previous_start.strftime("%Y-%m")
    revenue_current = revenue_monthly[current_key]
    revenue_previous = revenue_monthly[previous_key]
    expense_current = expense_monthly[current_key] if expense_rows is not None else None
    expense_previous = expense_monthly[previous_key] if expense_rows is not None else None

    day_labels = [_("Sun"), _("Mon"), _("Tue"), _("Wed"), _("Thu"), _("Fri"), _("Sat")]
    time_labels = [_("9AM"), _("12PM"), _("3PM"), _("6PM"), _("9PM")]
    heatmap = [[0 for _ in range(7)] for _ in range(5)]
    for row in sales or []:
        date = getdate(row.get("posting_date"))
        day_index = (date.weekday() + 1) % 7
        bucket = _heatmap_bucket(_posting_hour(row.get("posting_time")))
        heatmap[bucket][day_index] += 1

    paid_rows = [row for row in (sales or []) if flt(row.get("outstanding_amount")) <= 0.005]
    unpaid_rows = [row for row in (sales or []) if flt(row.get("outstanding_amount")) > 0.005]

    return {
        "currency": frappe.defaults.get_global_default("currency") or "",
        "period": {"start": series_start, "end": today, "label": _("Current month")},
        "kpis": {
            "revenue": {
                "value": revenue_current if sales is not None else None,
                "delta": _change(revenue_current, revenue_previous) if sales is not None else None,
                "note": _("{0} submitted sales invoices", [len([row for row in (sales or []) if _month_key(row.get("posting_date")) == current_key])]),
            },
            "expenses": {
                "value": expense_current,
                "delta": _change(expense_current or 0, expense_previous or 0) if expense_current is not None else None,
                "note": _("Expense ledger this month") if expense_current is not None else _("No expense ledger access"),
            },
            "customers": {
                "value": len(customers) if customers is not None else None,
                "delta": None,
                "note": _("Enabled customer records") if customers is not None else _("No Customer access"),
            },
            "suppliers": {
                "value": len(suppliers) if suppliers is not None else None,
                "delta": None,
                "note": _("Enabled supplier records") if suppliers is not None else _("No Supplier access"),
            },
        },
        "trend": {
            "labels": [item["label"] for item in series],
            "revenue": [revenue_monthly[item["key"]] for item in series],
            "expenses": [expense_monthly[item["key"]] if expense_rows is not None else 0 for item in series],
            "expenses_available": expense_rows is not None,
        },
        "heatmap": {
            "days": day_labels,
            "times": time_labels,
            "values": heatmap,
            "total": len(sales or []) if sales is not None else None,
        },
        "invoices": {
            "paid_count": len(paid_rows) if sales is not None else None,
            "unpaid_count": len(unpaid_rows) if sales is not None else None,
            "paid_amount": _sum(paid_rows, "base_grand_total") if sales is not None else None,
            "unpaid_amount": _sum(unpaid_rows, "outstanding_amount") if sales is not None else None,
        },
    }


@frappe.whitelist()
def get_recent_activity(limit: int = 10) -> dict:
    """Return recent document activity that the current user is allowed to see."""

    user = frappe.session.user
    if not user or user == "Guest":
        return {"items": [], "summary": {}, "total": 0}

    limit = min(max(cint(limit) or 10, 1), 12)
    scan_limit = min(max(limit * 6, 48), 84)
    rows = frappe.get_all(
        "Comment",
        fields=[
            "name",
            "creation",
            "owner",
            "comment_type",
            "comment_email",
            "comment_by",
            "subject",
            "content",
            "reference_doctype",
            "reference_name",
        ],
        filters={"comment_type": ["in", ACTIVITY_TYPES]},
        order_by="creation desc",
        limit_page_length=scan_limit,
    )

    permission_cache: dict[tuple[str, str], bool] = {}
    items: list[dict] = []
    summary: Counter[str] = Counter()
    for row in rows:
        reference_doctype = row.get("reference_doctype")
        reference_name = row.get("reference_name")
        cache_key = (reference_doctype or "", reference_name or "")
        if cache_key not in permission_cache:
            permission_cache[cache_key] = _can_read_reference(reference_doctype, reference_name, user)
        if not permission_cache[cache_key]:
            continue

        activity_type = row.get("comment_type") or "Updated"
        summary[activity_type] += 1
        actor = row.get("comment_by") or row.get("comment_email") or row.get("owner") or _("User")
        items.append(
            {
                "name": row.get("name"),
                "creation": row.get("creation"),
                "actor": actor,
                "activity_type": activity_type,
                "subject": _clean_text(row.get("subject"), 120),
                "content": _clean_text(row.get("content")),
                "reference_doctype": reference_doctype,
                "reference_name": reference_name,
            }
        )
        if len(items) >= limit:
            break

    grouped = {
        "created": summary.get("Created", 0),
        "updated": summary.get("Updated", 0) + summary.get("Edit", 0) + summary.get("Workflow", 0),
        "submitted": summary.get("Submitted", 0),
        "other": sum(summary.values())
        - summary.get("Created", 0)
        - summary.get("Updated", 0)
        - summary.get("Edit", 0)
        - summary.get("Workflow", 0)
        - summary.get("Submitted", 0),
    }
    return {"items": items, "summary": grouped, "total": len(items)}
'''

HOME_JS_TEXT = r'''/*
 * SaaS Theme — ERP Home Dashboard Analytics
 * Finance/customer overview with preserved Quick Access, Recent and Workspaces.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
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
		const $clock = $home.find('.st-hub-clock-card').first();
		if ($clock.length) {
			$clock.detach().addClass('st-hub-clock-strip').prependTo($home);
		}

		const $sidebar = $home.find('.st-hub-sidebar').first();
		const $workspaces = $home.find('.st-hub-workspaces-section').first();
		if ($sidebar.length && $workspaces.length) {
			$workspaces.detach().addClass('st-hub-workspaces-sidebar').appendTo($sidebar);
		}
	}

	function enhance() {
		const $home = $(".st-home-dashboard").last();
		if (!$home.length || $home.hasClass("st-dashboard-redesign-v5")) return;
		$home.addClass("st-dashboard-redesign-v5");
		const token = ++enhance_token;

		organize_existing_sections($home);
		const name = String(user_name()).split(/\s+/).filter(Boolean)[0] || __("User");
		$home.find(".st-hub-welcome").html(`<div class="st-dash-title"><h1>${__("Dashboard Overview")}<span>👋</span></h1><p>${esc(greeting())}, ${esc(name)} · ${__("Finance, customers and operations at a glance.")}</p></div><span class="st-dash-period">${__("Current month")}</span>`);
		$home.find(".st-hub-metrics").replaceWith(dashboard_html());
		$home.find(".st-dashboard-activity-section").remove();

		load_dashboard($home, token);
		load_recent_activity($home, token);
	}

	function schedule() { [40, 120, 260].forEach((delay) => setTimeout(enhance, delay)); }
	$(document).off("desktop_screen.saas_home_analytics").on("desktop_screen.saas_home_analytics", schedule);
	$(document).off("page-change.saas_home_analytics").on("page-change.saas_home_analytics", function () { const route = frappe.get_route?.() || []; if (route[0] === "desktop" || route.length === 0) schedule(); });
	$(schedule);
})();
'''

CSS_V5 = r'''

/* ===== HOME DASHBOARD V5 START ===== */
/* Refined finance/customer dashboard: top clock strip, sidebar workspaces and activity-first lower row. */
.st-home-dashboard.st-dashboard-redesign-v5 {
	max-width: 1680px;
	padding-top: 16px;
}

.st-dashboard-redesign-v5 .st-hub-clock-strip {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto auto;
	align-items: center;
	gap: 18px;
	min-height: 58px;
	margin: 0 0 14px;
	padding: 10px 16px;
	border: 1px solid var(--st-hub-border);
	border-radius: 14px;
	background: var(--st-hub-surface);
	box-shadow: 0 7px 24px rgba(15, 23, 42, .045);
	overflow: hidden;
}
.st-dashboard-redesign-v5 .st-hub-clock-strip::before { display: none; }
.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-clock-top { display: contents; }
.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-clock-weekday { grid-column: 1; font-size: 11px; }
.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-live-dot { grid-column: 4; justify-self: end; }
.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-clock-time { grid-column: 2; grid-row: 1; margin: 0; font-size: 24px; letter-spacing: -.03em; }
.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-clock-date { grid-column: 3; grid-row: 1; margin: 0; color: var(--st-hub-text); font-size: 11px; white-space: nowrap; }
.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-clock-zone { display: none; }

.st-dashboard-redesign-v5 .st-hub-welcome {
	align-items: center;
	margin-bottom: 14px;
}
.st-dashboard-redesign-v5 .st-dash-title h1 {
	display: flex;
	align-items: center;
	gap: 5px;
	margin: 0;
	font-size: clamp(23px, 2vw, 31px);
	font-weight: 780;
	letter-spacing: -.038em;
}
.st-dashboard-redesign-v5 .st-dash-title h1 span { font-size: .8em; }
.st-dashboard-redesign-v5 .st-dash-title p { margin: 4px 0 0; color: var(--st-hub-muted); font-size: 11px; }

.st-dashboard-v5 { margin-bottom: 16px; }
.st-dashboard-redesign-v5 .st-dash-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.st-dashboard-redesign-v5 .st-dash-kpi { min-height: 132px; }
.st-dashboard-redesign-v5 .st-dash-kpi-primary {
	background: linear-gradient(135deg, #064ADB 0%, #1769ee 58%, #2f7af2 100%);
	border-color: transparent;
	box-shadow: 0 14px 34px rgba(6, 74, 219, .25);
}
.st-dashboard-redesign-v5 .st-dash-kpi-primary,
.st-dashboard-redesign-v5 .st-dash-kpi-primary > strong,
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-kpi-top,
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-kpi-top span,
.st-dashboard-redesign-v5 .st-dash-kpi-primary small,
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-delta,
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-delta em {
	color: #fff !important;
}
.st-dashboard-redesign-v5 .st-dash-kpi-primary small,
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-delta em { opacity: .78; }
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-kpi-top i {
	background: rgba(255,255,255,.16) !important;
	color: #fff !important;
}
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-kpi-top i svg,
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-kpi-top i .icon { color: #fff !important; stroke: #fff !important; }
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-delta.positive { color: #bfffdc !important; }
.st-dashboard-redesign-v5 .st-dash-kpi-primary .st-dash-delta.negative { color: #ffd1d5 !important; }

.st-dashboard-redesign-v5 .st-dash-insights {
	display: grid;
	grid-template-columns: minmax(0, 1.85fr) minmax(310px, .95fr);
	gap: 12px;
	margin-top: 12px;
}
.st-dashboard-redesign-v5 .st-dash-lower-grid {
	display: grid;
	grid-template-columns: minmax(280px, .72fr) minmax(0, 2fr);
	gap: 12px;
	margin-top: 12px;
}
.st-dashboard-redesign-v5 .st-dash-activity-card {
	min-height: 310px;
	display: flex;
	flex-direction: column;
}
.st-dashboard-redesign-v5 .st-dash-activity-card .st-activity-summary {
	grid-template-columns: repeat(4, minmax(0, 1fr));
	margin: 8px 0 8px;
}
.st-dashboard-redesign-v5 .st-dash-activity-card .st-activity-list {
	max-height: 230px;
	min-height: 0;
}

.st-dashboard-redesign-v5 .st-hub-layout {
	grid-template-columns: 300px minmax(0, 1fr);
	gap: 14px;
}
.st-dashboard-redesign-v5 .st-hub-sidebar {
	display: grid;
	grid-template-columns: 1fr;
	gap: 12px;
	align-content: start;
}
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar {
	padding: 13px;
	max-height: 720px;
	overflow: hidden;
}
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-section-head { margin-bottom: 9px; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspaces-head p { display: none; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-search-row { margin-bottom: 8px; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-search input { height: 34px; font-size: 10.5px; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-chips { display: none !important; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-grid {
	display: grid;
	grid-template-columns: 1fr !important;
	gap: 5px;
	max-height: 590px;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding-right: 2px;
}
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-card {
	min-height: 58px;
	padding: 8px 38px 8px 10px;
	align-items: center;
	justify-items: start;
	text-align: left;
}
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-icon { width: 34px; height: 34px; border-radius: 9px; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-icon svg,
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-icon .icon { width: 16px !important; height: 16px !important; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-title { margin-top: 7px; font-size: 10.5px; text-align: left; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-module { margin-top: 2px; font-size: 8.5px; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-arrow { bottom: 18px; }
.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-favorite { top: 16px; }
.st-dashboard-redesign-v5 .st-hub-empty { padding: 22px 10px; }

.st-dashboard-redesign-v5 .st-hub-main { gap: 12px; }
.st-dashboard-redesign-v5 .st-hub-quick-section { margin-top: 0; }
.st-dashboard-redesign-v5 .st-hub-quick-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }

[data-theme="dark"] .st-dashboard-redesign-v5 .st-hub-clock-strip,
[data-theme="dark"] .st-dashboard-redesign-v5 .st-dash-card,
[data-theme="dark"] .st-dashboard-redesign-v5 .st-dash-kpi:not(.st-dash-kpi-primary) {
	border-color: var(--st-hub-border);
	box-shadow: 0 10px 30px rgba(0,0,0,.18);
}

@media (max-width: 1180px) {
	.st-dashboard-redesign-v5 .st-dash-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.st-dashboard-redesign-v5 .st-dash-insights,
	.st-dashboard-redesign-v5 .st-dash-lower-grid { grid-template-columns: 1fr; }
	.st-dashboard-redesign-v5 .st-dash-activity-card { min-height: 360px; }
	.st-dashboard-redesign-v5 .st-hub-quick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 900px) {
	.st-dashboard-redesign-v5 .st-hub-layout { grid-template-columns: 1fr; }
	.st-dashboard-redesign-v5 .st-hub-sidebar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar { max-height: 560px; }
	.st-dashboard-redesign-v5 .st-hub-workspaces-sidebar .st-hub-workspace-grid { max-height: 430px; }
}

@media (max-width: 680px) {
	.st-dashboard-redesign-v5 .st-hub-clock-strip { grid-template-columns: 1fr auto; gap: 5px 12px; }
	.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-clock-weekday { grid-column: 1; }
	.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-live-dot { grid-column: 2; }
	.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-clock-time { grid-column: 1; grid-row: 2; }
	.st-dashboard-redesign-v5 .st-hub-clock-strip .st-hub-clock-date { grid-column: 2; grid-row: 2; }
	.st-dashboard-redesign-v5 .st-dash-kpis,
	.st-dashboard-redesign-v5 .st-hub-sidebar,
	.st-dashboard-redesign-v5 .st-hub-quick-grid { grid-template-columns: 1fr; }
	.st-dashboard-redesign-v5 .st-dash-activity-card .st-activity-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* ===== HOME DASHBOARD V5 END ===== */
'''

HOME_PY.write_text(HOME_PY_TEXT, encoding="utf-8")
HOME_JS.write_text(HOME_JS_TEXT, encoding="utf-8")

css = HOME_CSS.read_text(encoding="utf-8")
marker = "/* ===== HOME DASHBOARD V5 START ===== */"
if marker in css:
    css = css.split(marker, 1)[0].rstrip() + "\n" + CSS_V5.lstrip()
else:
    css = css.rstrip() + "\n" + CSS_V5
HOME_CSS.write_text(css, encoding="utf-8")

print("Home dashboard v5 revision applied.")

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "saas_theme/public/js/home_analytics.js"
CSS = ROOT / "saas_theme/public/css/home.css"
HOME = ROOT / "saas_theme/home.py"

HOME.write_text(r'''from __future__ import annotations

from collections import Counter, defaultdict
from datetime import time

import frappe
from frappe import _
from frappe.utils import add_days, add_months, cint, flt, get_first_day, getdate, nowdate, strip_html_tags


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


def _safe_list(doctype: str, *, fields: list, filters=None, order_by: str | None = None, limit: int = 1000, group_by: str | None = None):
    try:
        return frappe.get_list(
            doctype,
            fields=fields,
            filters=filters or [],
            order_by=order_by,
            group_by=group_by,
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


def _transaction(doctype: str, row: dict, *, title: str, subtitle: str, value: float = 0, value_type: str = "amount", status: str = ""):
    return {
        "doctype": doctype,
        "name": row.get("name"),
        "title": title,
        "subtitle": subtitle,
        "status": status or row.get("status") or "",
        "value": flt(value),
        "value_type": value_type,
        "date": row.get("posting_date") or row.get("planned_start_date") or row.get("modified"),
        "sort_date": str(row.get("modified") or row.get("posting_date") or row.get("planned_start_date") or ""),
    }


@frappe.whitelist()
def get_dashboard_overview() -> dict:
    """Permission-aware ERP/manufacturing overview for the custom Home dashboard."""

    if frappe.session.user == "Guest":
        return {}

    today = getdate(nowdate())
    current_start = getdate(get_first_day(today))
    series_start = getdate(add_months(current_start, -5))
    previous_start = getdate(add_months(current_start, -1))
    previous_end = getdate(add_days(current_start, -1))
    series = _month_series(series_start)

    common_date_filters = [
        ["docstatus", "=", 1],
        ["posting_date", ">=", series_start],
        ["posting_date", "<=", today],
    ]

    sales = _safe_list(
        "Sales Invoice",
        fields=["name", "posting_date", "posting_time", "base_grand_total", "outstanding_amount", "customer", "status", "modified"],
        filters=common_date_filters,
        order_by="posting_date desc, posting_time desc",
        limit=2500,
    )

    purchase_recent = _safe_list(
        "Purchase Invoice",
        fields=["name", "posting_date", "base_grand_total", "supplier", "status", "modified"],
        filters=[["docstatus", "=", 1]],
        order_by="modified desc",
        limit=8,
    )

    payments_recent = _safe_list(
        "Payment Entry",
        fields=["name", "posting_date", "base_paid_amount", "paid_amount", "party", "payment_type", "modified"],
        filters=[["docstatus", "=", 1]],
        order_by="modified desc",
        limit=8,
    )

    work_orders = _safe_list(
        "Work Order",
        fields=["name", "status", "production_item", "qty", "produced_qty", "planned_start_date", "modified"],
        filters=[["docstatus", "=", 1]],
        order_by="modified desc",
        limit=1000,
    )

    stock_entries = _safe_list(
        "Stock Entry",
        fields=["name", "posting_date", "purpose", "stock_entry_type", "fg_completed_qty", "modified"],
        filters=common_date_filters,
        order_by="posting_date desc, modified desc",
        limit=1500,
    )
    if stock_entries is None:
        stock_entries = _safe_list(
            "Stock Entry",
            fields=["name", "posting_date", "purpose", "fg_completed_qty", "modified"],
            filters=common_date_filters,
            order_by="posting_date desc, modified desc",
            limit=1500,
        )

    expense_daily = None
    accounts = _safe_list("Account", fields=["name"], filters=[["root_type", "=", "Expense"], ["is_group", "=", 0]], limit=2000)
    expense_accounts = [row.get("name") for row in (accounts or []) if row.get("name")]
    if expense_accounts:
        expense_daily = _safe_list(
            "GL Entry",
            fields=["posting_date", "sum(debit) as debit", "sum(credit) as credit"],
            filters=[
                ["is_cancelled", "=", 0],
                ["posting_date", ">=", series_start],
                ["posting_date", "<=", today],
                ["account", "in", expense_accounts],
            ],
            group_by="posting_date",
            order_by="posting_date asc",
            limit=400,
        )

    revenue_monthly = defaultdict(float)
    for row in sales or []:
        revenue_monthly[_month_key(row.get("posting_date"))] += flt(row.get("base_grand_total"))

    expense_monthly = defaultdict(float)
    for row in expense_daily or []:
        expense_monthly[_month_key(row.get("posting_date"))] += flt(row.get("debit")) - flt(row.get("credit"))

    current_key = current_start.strftime("%Y-%m")
    previous_key = previous_start.strftime("%Y-%m")
    revenue_current = revenue_monthly[current_key]
    revenue_previous = revenue_monthly[previous_key]
    expense_current = expense_monthly[current_key] if expense_daily is not None else None
    expense_previous = expense_monthly[previous_key] if expense_daily is not None else None

    active_work_orders = [row for row in (work_orders or []) if row.get("status") not in {"Completed", "Stopped", "Closed"}]
    in_process = [row for row in active_work_orders if row.get("status") == "In Process"]

    manufacture_entries = []
    for row in stock_entries or []:
        purpose = str(row.get("stock_entry_type") or row.get("purpose") or "")
        if purpose.lower() == "manufacture":
            manufacture_entries.append(row)
    production_current = [row for row in manufacture_entries if _month_key(row.get("posting_date")) == current_key]
    production_previous = [row for row in manufacture_entries if _month_key(row.get("posting_date")) == previous_key]
    production_qty = _sum(production_current, "fg_completed_qty")
    production_prev_qty = _sum(production_previous, "fg_completed_qty")

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

    recent_transactions = []
    for row in (sales or [])[:8]:
        recent_transactions.append(_transaction("Sales Invoice", row, title=row.get("customer") or _("Sales Invoice"), subtitle=_("Sales Invoice"), value=row.get("base_grand_total"), status=row.get("status") or _("Submitted")))
    for row in purchase_recent or []:
        recent_transactions.append(_transaction("Purchase Invoice", row, title=row.get("supplier") or _("Purchase Invoice"), subtitle=_("Purchase Invoice"), value=row.get("base_grand_total"), status=row.get("status") or _("Submitted")))
    for row in payments_recent or []:
        recent_transactions.append(_transaction("Payment Entry", row, title=row.get("party") or row.get("payment_type") or _("Payment"), subtitle=_("Payment Entry"), value=row.get("base_paid_amount") or row.get("paid_amount"), status=row.get("payment_type") or _("Submitted")))
    for row in (work_orders or [])[:8]:
        recent_transactions.append(_transaction("Work Order", row, title=row.get("production_item") or _("Production"), subtitle=_("Work Order"), value=row.get("qty"), value_type="qty", status=row.get("status") or _("Submitted")))
    for row in manufacture_entries[:8]:
        recent_transactions.append(_transaction("Stock Entry", row, title=_("Manufacture Entry"), subtitle=_("Stock Entry"), value=row.get("fg_completed_qty"), value_type="qty", status=_("Manufacture")))

    recent_transactions.sort(key=lambda item: item.get("sort_date") or "", reverse=True)
    for item in recent_transactions:
        item.pop("sort_date", None)

    return {
        "currency": frappe.defaults.get_global_default("currency") or frappe.get_system_settings("country") or "",
        "period": {"start": series_start, "end": today, "label": _("Current month")},
        "kpis": {
            "revenue": {"value": revenue_current if sales is not None else None, "delta": _change(revenue_current, revenue_previous) if sales is not None else None, "note": _("{0} submitted sales invoices", [len([row for row in (sales or []) if _month_key(row.get("posting_date")) == current_key])])},
            "expenses": {"value": expense_current, "delta": _change(expense_current or 0, expense_previous or 0) if expense_current is not None else None, "note": _("Expense ledger this month") if expense_current is not None else _("No expense ledger access")},
            "work_orders": {"value": len(active_work_orders) if work_orders is not None else None, "delta": None, "note": _("{0} currently in process", [len(in_process)]) if work_orders is not None else _("No Work Order access")},
            "production": {"value": production_qty if stock_entries is not None else None, "delta": _change(production_qty, production_prev_qty) if stock_entries is not None else None, "note": _("{0} manufacture entries this month", [len(production_current)]) if stock_entries is not None else _("No Stock Entry access")},
        },
        "trend": {
            "labels": [item["label"] for item in series],
            "revenue": [revenue_monthly[item["key"]] for item in series],
            "expenses": [expense_monthly[item["key"]] if expense_daily is not None else 0 for item in series],
            "expenses_available": expense_daily is not None,
        },
        "heatmap": {"days": day_labels, "times": time_labels, "values": heatmap, "total": len(sales or []) if sales is not None else None},
        "invoices": {
            "paid_count": len(paid_rows) if sales is not None else None,
            "unpaid_count": len(unpaid_rows) if sales is not None else None,
            "paid_amount": _sum(paid_rows, "base_grand_total") if sales is not None else None,
            "unpaid_amount": _sum(unpaid_rows, "outstanding_amount") if sales is not None else None,
        },
        "recent_transactions": recent_transactions[:10],
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
        fields=["name", "creation", "owner", "comment_type", "comment_email", "comment_by", "subject", "content", "reference_doctype", "reference_name"],
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
        items.append({
            "name": row.get("name"),
            "creation": row.get("creation"),
            "actor": actor,
            "activity_type": activity_type,
            "subject": _clean_text(row.get("subject"), 120),
            "content": _clean_text(row.get("content")),
            "reference_doctype": reference_doctype,
            "reference_name": reference_name,
        })
        if len(items) >= limit:
            break

    grouped = {
        "created": summary.get("Created", 0),
        "updated": summary.get("Updated", 0) + summary.get("Edit", 0) + summary.get("Workflow", 0),
        "submitted": summary.get("Submitted", 0),
        "other": sum(summary.values()) - summary.get("Created", 0) - summary.get("Updated", 0) - summary.get("Edit", 0) - summary.get("Workflow", 0) - summary.get("Submitted", 0),
    }
    return {"items": items, "summary": grouped, "total": len(items)}
''', encoding="utf-8")

JS.write_text(r'''/*
 * SaaS Theme — ERP Home Dashboard Analytics
 * Reference-style finance, sales and manufacturing overview.
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
		try { return frappe.user?.full_name?.() || frappe.boot?.user?.full_name || frappe.session?.user || __("User"); } catch (e) { return frappe.session?.user || __("User"); }
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

	function number(value) {
		if (value == null || Number.isNaN(Number(value))) return "—";
		return new Intl.NumberFormat(document.documentElement.lang || navigator.language || "en", { notation: Math.abs(Number(value)) >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value));
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
		const numeric = Number(value);
		const positive = inverse ? numeric <= 0 : numeric >= 0;
		return `<span class="st-dash-delta ${positive ? "positive" : "negative"}">${numeric >= 0 ? "↗" : "↘"} ${Math.abs(numeric).toFixed(1)}% <em>${__("vs last month")}</em></span>`;
	}

	function dashboard_html() {
		return `<section class="st-dashboard-v4">
			<div class="st-dash-kpis">
				<a class="st-dash-kpi st-dash-kpi-primary" href="${esc(list_route("Sales Invoice"))}"><div class="st-dash-kpi-top"><span>${__("Revenue")}</span><i>${icon("selling")}</i></div><strong data-kpi-value="revenue">—</strong><div data-kpi-delta="revenue">${delta_html(null)}</div><small data-kpi-note="revenue">${__("Loading sales…")}</small></a>
				<a class="st-dash-kpi" href="${esc(report_route("Profit and Loss Statement"))}"><div class="st-dash-kpi-top"><span>${__("Expenses")}</span><i>${icon("accounting")}</i></div><strong data-kpi-value="expenses">—</strong><div data-kpi-delta="expenses">${delta_html(null)}</div><small data-kpi-note="expenses">${__("Loading expense ledger…")}</small></a>
				<a class="st-dash-kpi" href="${esc(list_route("Work Order"))}"><div class="st-dash-kpi-top"><span>${__("Active Work Orders")}</span><i>${icon("setting")}</i></div><strong data-kpi-value="work_orders">—</strong><div data-kpi-delta="work_orders"><span class="st-dash-delta neutral">${__("Manufacturing")}</span></div><small data-kpi-note="work_orders">${__("Loading production queue…")}</small></a>
				<a class="st-dash-kpi" href="${esc(list_route("Stock Entry"))}"><div class="st-dash-kpi-top"><span>${__("Production Completed")}</span><i>${icon("stock")}</i></div><strong data-kpi-value="production">—</strong><div data-kpi-delta="production">${delta_html(null)}</div><small data-kpi-note="production">${__("Loading manufacture entries…")}</small></a>
			</div>
			<div class="st-dash-insights">
				<article class="st-dash-card st-dash-revenue-card"><div class="st-dash-card-head"><div><strong>${__("Revenue & Expenses")}</strong><small>${__("Six-month financial movement")}</small></div><div class="st-dash-legend"><span><i class="revenue"></i>${__("Revenue")}</span><span><i class="expenses"></i>${__("Expenses")}</span></div></div><div class="st-dash-chart" data-dashboard-chart="trend"><div class="st-dash-loading">${__("Loading chart…")}</div></div></article>
				<article class="st-dash-card st-dash-heatmap-card"><div class="st-dash-card-head"><div><strong>${__("Sales Heatmap")}</strong><small>${__("Invoice activity by weekday and time")}</small></div><span class="st-dash-mini-value" data-heatmap-total>—</span></div><div class="st-sales-heatmap" data-sales-heatmap><div class="st-dash-loading">${__("Loading heatmap…")}</div></div></article>
				<article class="st-dash-card st-dash-invoice-card"><div class="st-dash-card-head"><div><strong>${__("Invoices")}</strong><small>${__("Paid vs unpaid · last six months")}</small></div></div><div class="st-invoice-status" data-invoice-status><div class="st-dash-loading">${__("Loading invoice status…")}</div></div></article>
				<article class="st-dash-card st-dash-transactions-card"><div class="st-dash-card-head"><div><strong>${__("Recent Transactions")}</strong><small>${__("Sales, purchases, payments and manufacturing")}</small></div><span class="st-dash-card-pill">${__("Live")}</span></div><div class="st-transaction-table" data-recent-transactions><div class="st-dash-loading">${__("Loading recent transactions…")}</div></div></article>
			</div>
		</section>`;
	}

	function trend_chart(data) {
		const labels = data?.labels || [];
		const revenue = data?.revenue || [];
		const expenses = data?.expenses || [];
		const values = [...revenue, ...expenses].map(Number).filter((value) => Number.isFinite(value));
		if (!labels.length || !values.some((value) => value > 0)) return `<div class="st-dash-empty">${__("No financial activity is available for this period.")}</div>`;
		const width = 760, height = 280, left = 52, right = 18, top = 16, bottom = 38;
		const plotW = width - left - right, plotH = height - top - bottom;
		const max = Math.max(1, ...values);
		const slot = plotW / labels.length;
		const bar = Math.min(28, slot * .24);
		const grid = [0, .25, .5, .75, 1].map((ratio) => {
			const y = top + plotH - ratio * plotH;
			return `<line x1="${left}" x2="${width-right}" y1="${y}" y2="${y}" class="st-dash-grid-line"/><text x="${left-8}" y="${y+3}" text-anchor="end" class="st-dash-axis">${esc(money(max*ratio))}</text>`;
		}).join("");
		const bars = labels.map((label, index) => {
			const cx = left + slot * index + slot / 2;
			const rv = Number(revenue[index] || 0), ev = Number(expenses[index] || 0);
			const rh = rv / max * plotH, eh = ev / max * plotH;
			return `<rect x="${cx-bar-3}" y="${top+plotH-rh}" width="${bar}" height="${Math.max(2,rh)}" rx="6" class="st-dash-bar revenue"><title>${esc(`${label} ${__("Revenue")}: ${money(rv)}`)}</title></rect><rect x="${cx+3}" y="${top+plotH-eh}" width="${bar}" height="${Math.max(2,eh)}" rx="6" class="st-dash-bar expenses"><title>${esc(`${label} ${__("Expenses")}: ${money(ev)}`)}</title></rect><text x="${cx}" y="${height-12}" text-anchor="middle" class="st-dash-axis">${esc(label)}</text>`;
		}).join("");
		return `<svg class="st-dash-chart-svg" viewBox="0 0 ${width} ${height}">${grid}${bars}</svg>`;
	}

	function heatmap_html(data) {
		const days = data?.days || [];
		const times = data?.times || [];
		const values = data?.values || [];
		const flat = values.flat().map(Number);
		const max = Math.max(1, ...flat, 1);
		if (!days.length || !times.length) return `<div class="st-dash-empty">${__("No sales heatmap data is available.")}</div>`;
		const heads = days.map((day) => `<span class="st-heatmap-day">${esc(day)}</span>`).join("");
		const rows = times.map((time, rowIndex) => `<div class="st-heatmap-time">${esc(time)}</div>${days.map((_day, colIndex) => {
			const value = Number(values?.[rowIndex]?.[colIndex] || 0);
			const strength = value ? Math.max(.12, value / max) : .035;
			return `<div class="st-heatmap-cell" style="--heat:${strength.toFixed(3)}" title="${esc(`${time} · ${days[colIndex]}: ${value}`)}"><span>${value || ""}</span></div>`;
		}).join("")}`).join("");
		return `<div class="st-heatmap-grid"><div></div>${heads}${rows}</div>`;
	}

	function invoice_html(data) {
		if (!data || data.paid_count == null) return `<div class="st-dash-empty">${__("Invoice information is unavailable.")}</div>`;
		const paid = Number(data.paid_count || 0), unpaid = Number(data.unpaid_count || 0), total = paid + unpaid;
		const percentage = total ? Math.round(paid / total * 100) : 0;
		return `<div class="st-invoice-ring-wrap"><div class="st-invoice-ring" style="--paid:${percentage * 3.6}deg"><div><small>${__("Total")}</small><strong>${number(total)}</strong></div></div></div><div class="st-invoice-legend"><div><span><i class="paid"></i>${__("Paid")}</span><strong>${number(paid)}</strong><small>${money(data.paid_amount)}</small></div><div><span><i class="unpaid"></i>${__("Unpaid")}</span><strong>${number(unpaid)}</strong><small>${money(data.unpaid_amount)}</small></div></div>`;
	}

	function status_class(value) {
		const text = String(value || "").toLowerCase();
		if (text.includes("complete") || text.includes("paid") || text.includes("submit") || text.includes("manufacture")) return "success";
		if (text.includes("process") || text.includes("part") || text.includes("receive")) return "info";
		if (text.includes("overdue") || text.includes("cancel") || text.includes("stop")) return "danger";
		return "neutral";
	}

	function transactions_html(items) {
		if (!Array.isArray(items) || !items.length) return `<div class="st-dash-empty">${__("No recent transactions are available.")}</div>`;
		const head = `<div class="st-transaction-row st-transaction-head"><span>${__("Document")}</span><span>${__("Type")}</span><span>${__("Status")}</span><span>${__("Value / Qty")}</span><span>${__("Date")}</span></div>`;
		const rows = items.map((item) => {
			const value = item.value_type === "qty" ? number(item.value) : money(item.value);
			return `<a class="st-transaction-row" href="${esc(form_route(item.doctype, item.name))}"><span class="st-transaction-doc"><strong>${esc(item.title || item.name)}</strong><small>${esc(item.name || "")}</small></span><span>${esc(item.subtitle || item.doctype || "")}</span><span><b class="st-transaction-status ${status_class(item.status)}">${esc(item.status || __("Submitted"))}</b></span><span class="st-transaction-value">${esc(value)}</span><span>${esc(item.date || "")}</span></a>`;
		}).join("");
		return head + rows;
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
		return [
			["created", __("Created"), "created"], ["updated", __("Updated"), "updated"], ["submitted", __("Submitted"), "submitted"], ["other", __("Other"), "other"],
		].map(([key, label, tone]) => `<div class="st-activity-stat"><span class="st-activity-stat-dot st-activity-${tone}"></span><div><strong>${Number(summary?.[key] || 0)}</strong><small>${esc(label)}</small></div></div>`).join("");
	}

	function activity_section_html() {
		return `<section class="st-hub-section st-dashboard-activity-section"><div class="st-hub-section-head"><div><h2>${__("Recent User Activity")}</h2><p>${__("Recent document actions visible to your account")}</p></div><span class="st-dash-card-pill">${__("Live")}</span></div><div class="st-activity-summary"><div class="st-activity-summary-loading">${__("Loading activity…")}</div></div><div class="st-activity-list"><div class="st-dash-loading">${__("Loading recent activity…")}</div></div></section>`;
	}

	async function load_dashboard($home, token) {
		try {
			const response = await frappe.call({ method: "saas_theme.home.get_dashboard_overview" });
			if (token !== enhance_token || !$home.closest("body").length) return;
			const data = response?.message || {};
			const kpis = data.kpis || {};
			[["revenue", false, money], ["expenses", true, money], ["work_orders", false, number], ["production", false, number]].forEach(([key, inverse, formatter]) => {
				const item = kpis[key] || {};
				$home.find(`[data-kpi-value="${key}"]`).text(formatter(item.value));
				if (key !== "work_orders") $home.find(`[data-kpi-delta="${key}"]`).html(delta_html(item.delta, inverse));
				$home.find(`[data-kpi-note="${key}"]`).text(item.note || __("No data available"));
			});
			$home.find('[data-dashboard-chart="trend"]').html(trend_chart(data.trend));
			$home.find('[data-sales-heatmap]').html(heatmap_html(data.heatmap));
			$home.find('[data-heatmap-total]').text(data.heatmap?.total == null ? "—" : `${number(data.heatmap.total)}+`);
			$home.find('[data-invoice-status]').html(invoice_html(data.invoices));
			$home.find('[data-recent-transactions]').html(transactions_html(data.recent_transactions));
		} catch (e) {
			if (token !== enhance_token || !$home.closest("body").length) return;
			$home.find('.st-dash-loading').text(__("Dashboard data could not be loaded."));
		}
	}

	async function load_recent_activity($home, token) {
		try {
			const response = await frappe.call({ method: "saas_theme.home.get_recent_activity", args: { limit: 8 } });
			if (token !== enhance_token || !$home.closest("body").length) return;
			const payload = response?.message || {}, items = Array.isArray(payload.items) ? payload.items : [];
			$home.find('.st-dashboard-activity-section .st-activity-summary').html(activity_summary_html(payload.summary || {}));
			$home.find('.st-dashboard-activity-section .st-activity-list').html(items.length ? items.map(activity_item_html).join("") : `<div class="st-dash-empty">${__("No recent user activity is available.")}</div>`);
		} catch (e) {
			if (token !== enhance_token || !$home.closest("body").length) return;
			$home.find('.st-dashboard-activity-section .st-activity-list').html(`<div class="st-dash-empty">${__("Recent activity could not be loaded.")}</div>`);
		}
	}

	function enhance() {
		const $home = $(".st-home-dashboard").last();
		if (!$home.length || $home.hasClass("st-dashboard-redesign-v4")) return;
		$home.addClass("st-dashboard-redesign-v4");
		const token = ++enhance_token;

		const name = String(user_name()).split(/\s+/).filter(Boolean)[0] || __("User");
		$home.find(".st-hub-welcome").html(`<div class="st-dash-title"><h1>${__("Dashboard Overview")}<span>👋</span></h1><p>${esc(greeting())}, ${esc(name)} · ${__("Finance, sales and manufacturing at a glance.")}</p></div><span class="st-dash-period">${__("Current month")}</span>`);

		$home.find(".st-hub-metrics").replaceWith(dashboard_html());
		$home.find(".st-dashboard-activity-section").remove();
		$home.find(".st-hub-quick-section").after(activity_section_html());

		load_dashboard($home, token);
		load_recent_activity($home, token);
	}

	function schedule() { [40, 120, 260].forEach((delay) => setTimeout(enhance, delay)); }
	$(document).off("desktop_screen.saas_home_analytics").on("desktop_screen.saas_home_analytics", schedule);
	$(document).off("page-change.saas_home_analytics").on("page-change.saas_home_analytics", function () { const route = frappe.get_route?.() || []; if (route[0] === "desktop" || route.length === 0) schedule(); });
	$(schedule);
})();
''', encoding="utf-8")

start = "/* ===== HOME DASHBOARD V4 START ===== */"
end = "/* ===== HOME DASHBOARD V4 END ===== */"
css = CSS.read_text(encoding="utf-8")
if start in css and end in css:
    before, rest = css.split(start, 1)
    _old, after = rest.split(end, 1)
    css = before.rstrip() + "\n" + after.lstrip("\n")

css_block = r'''
/* ===== HOME DASHBOARD V4 START ===== */
/* Reference-style finance + manufacturing dashboard. Scoped to the redesigned Home. */
.st-home-dashboard.st-dashboard-redesign-v4 {
	max-width: 1680px;
	padding-top: 22px;
}

.st-dashboard-redesign-v4 .st-hub-welcome {
	align-items: center;
	margin-bottom: 16px;
}

.st-dashboard-redesign-v4 .st-dash-title h1 {
	display: flex;
	align-items: center;
	gap: 5px;
	margin: 0;
	font-size: clamp(23px, 2vw, 31px);
	font-weight: 760;
	letter-spacing: -.035em;
}

.st-dashboard-redesign-v4 .st-dash-title h1 span { font-size: .8em; }
.st-dashboard-redesign-v4 .st-dash-title p { margin: 5px 0 0; color: var(--st-hub-muted); font-size: 11.5px; }
.st-dash-period, .st-dash-card-pill { display: inline-flex; align-items: center; height: 30px; padding: 0 11px; border: 1px solid var(--st-hub-border); border-radius: 999px; background: var(--st-hub-surface); color: var(--st-hub-muted); font-size: 10px; font-weight: 650; white-space: nowrap; }

.st-dashboard-v4 { margin-bottom: 18px; }
.st-dash-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.st-dash-kpi { position: relative; min-width: 0; min-height: 142px; padding: 17px 18px 14px; border: 1px solid rgba(214, 222, 232, .78); border-radius: 15px; background: var(--st-hub-surface); color: var(--st-hub-text) !important; text-decoration: none !important; box-shadow: 0 8px 28px rgba(15, 23, 42, .045); transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; overflow: hidden; }
.st-dash-kpi:hover { transform: translateY(-2px); border-color: rgba(47, 111, 237, .26); box-shadow: 0 15px 34px rgba(15, 23, 42, .08); }
.st-dash-kpi-primary { border-color: transparent; background: linear-gradient(135deg, #2f6fed 0%, #1559e7 100%); color: #fff !important; box-shadow: 0 14px 34px rgba(37, 99, 235, .24); }
.st-dash-kpi-primary:hover { border-color: transparent; box-shadow: 0 18px 42px rgba(37, 99, 235, .3); }
.st-dash-kpi-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--st-hub-muted); font-size: 10.5px; font-weight: 650; }
.st-dash-kpi-top i { width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: var(--st-hub-primary-soft); color: var(--st-hub-primary); font-style: normal; }
.st-dash-kpi-top i svg, .st-dash-kpi-top i .icon { width: 17px !important; height: 17px !important; color: currentColor !important; stroke: currentColor !important; }
.st-dash-kpi-primary .st-dash-kpi-top, .st-dash-kpi-primary small { color: rgba(255,255,255,.8); }
.st-dash-kpi-primary .st-dash-kpi-top i { background: rgba(255,255,255,.15); color: #fff; }
.st-dash-kpi > strong { display: block; margin-top: 12px; font-size: clamp(25px, 2vw, 32px); line-height: 1; font-weight: 790; letter-spacing: -.035em; }
.st-dash-kpi small { display: block; margin-top: 7px; color: var(--st-hub-muted); font-size: 9.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-dash-delta { display: inline-flex; align-items: baseline; gap: 4px; margin-top: 10px; font-size: 9.5px; font-weight: 720; }
.st-dash-delta em { font-style: normal; font-weight: 520; color: var(--st-hub-muted); }
.st-dash-delta.positive { color: #119c67; }
.st-dash-delta.negative { color: #e2414b; }
.st-dash-delta.neutral { color: var(--st-hub-muted); }
.st-dash-kpi-primary .st-dash-delta { color: #bfffe3; }
.st-dash-kpi-primary .st-dash-delta em { color: rgba(255,255,255,.72); }

.st-dash-insights { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(300px, .95fr); gap: 12px; margin-top: 12px; }
.st-dash-card { min-width: 0; padding: 15px; border: 1px solid rgba(214, 222, 232, .72); border-radius: 15px; background: var(--st-hub-surface); box-shadow: 0 8px 28px rgba(15, 23, 42, .04); }
.st-dash-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 8px; }
.st-dash-card-head strong { display: block; font-size: 12.5px; font-weight: 740; color: var(--st-hub-text); }
.st-dash-card-head small { display: block; margin-top: 3px; font-size: 9.5px; color: var(--st-hub-muted); }
.st-dash-legend { display: flex; gap: 12px; color: var(--st-hub-muted); font-size: 9px; }
.st-dash-legend span { display: inline-flex; align-items: center; gap: 5px; }
.st-dash-legend i { width: 7px; height: 7px; border-radius: 50%; }
.st-dash-legend i.revenue { background: #b5a6ff; }
.st-dash-legend i.expenses { background: #1769ee; }
.st-dash-mini-value { color: var(--st-hub-text); font-size: 20px; line-height: 1; font-weight: 780; }
.st-dash-revenue-card { min-height: 330px; }
.st-dash-heatmap-card { min-height: 330px; }
.st-dash-invoice-card { min-height: 310px; }
.st-dash-transactions-card { min-height: 310px; }
.st-dash-chart { min-height: 255px; }
.st-dash-chart-svg { width: 100%; height: auto; display: block; min-height: 245px; }
.st-dash-grid-line { stroke: rgba(100,116,139,.13); stroke-width: 1; stroke-dasharray: 3 4; }
.st-dash-axis { fill: var(--st-hub-muted); font-family: inherit; font-size: 8.5px; }
.st-dash-bar.revenue { fill: #b7a7ff; }
.st-dash-bar.expenses { fill: #1769ee; }
.st-dash-loading, .st-dash-empty { min-height: 130px; display: flex; align-items: center; justify-content: center; padding: 20px; color: var(--st-hub-muted); font-size: 10px; text-align: center; }

.st-heatmap-grid { display: grid; grid-template-columns: 38px repeat(7, minmax(28px, 1fr)); gap: 7px; align-items: center; padding-top: 13px; }
.st-heatmap-day, .st-heatmap-time { color: var(--st-hub-muted); font-size: 8.5px; text-align: center; }
.st-heatmap-time { text-align: left; font-weight: 600; }
.st-heatmap-cell { aspect-ratio: 1.3; min-height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: rgba(24, 105, 238, var(--heat)); color: #fff; font-size: 8px; font-weight: 700; transition: transform .14s ease, box-shadow .14s ease; }
.st-heatmap-cell:hover { transform: translateY(-1px) scale(1.03); box-shadow: 0 5px 12px rgba(23,105,238,.16); }

.st-invoice-status { display: grid; grid-template-columns: 1fr; gap: 13px; }
.st-invoice-ring-wrap { display: flex; justify-content: center; padding: 8px 0 2px; }
.st-invoice-ring { width: 150px; height: 150px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#1769ee 0 var(--paid), #6fc7ef var(--paid) 360deg); position: relative; }
.st-invoice-ring::after { content: ""; position: absolute; inset: 18px; border-radius: 50%; background: var(--st-hub-surface); }
.st-invoice-ring > div { position: relative; z-index: 1; text-align: center; }
.st-invoice-ring small { display: block; color: var(--st-hub-muted); font-size: 9px; }
.st-invoice-ring strong { display: block; margin-top: 2px; color: var(--st-hub-text); font-size: 24px; font-weight: 790; }
.st-invoice-legend { display: grid; gap: 8px; }
.st-invoice-legend > div { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 8px 9px; border-radius: 9px; background: var(--st-hub-soft); }
.st-invoice-legend span { display: inline-flex; align-items: center; gap: 6px; color: var(--st-hub-text); font-size: 9.5px; }
.st-invoice-legend i { width: 7px; height: 7px; border-radius: 50%; }
.st-invoice-legend i.paid { background: #1769ee; }
.st-invoice-legend i.unpaid { background: #6fc7ef; }
.st-invoice-legend strong { font-size: 11px; }
.st-invoice-legend small { grid-column: 1 / -1; color: var(--st-hub-muted); font-size: 8.5px; }

.st-transaction-table { overflow: hidden; border: 1px solid var(--st-hub-border); border-radius: 11px; }
.st-transaction-row { display: grid; grid-template-columns: minmax(170px,1.4fr) minmax(110px,.9fr) minmax(92px,.75fr) minmax(100px,.8fr) minmax(90px,.65fr); gap: 10px; align-items: center; min-height: 46px; padding: 7px 11px; border-bottom: 1px solid var(--st-hub-border); color: var(--st-hub-text) !important; text-decoration: none !important; font-size: 9px; }
.st-transaction-row:last-child { border-bottom: 0; }
.st-transaction-row:not(.st-transaction-head):hover { background: var(--st-hub-soft); }
.st-transaction-head { min-height: 38px; background: var(--st-hub-soft); color: var(--st-hub-muted) !important; font-size: 8.5px; font-weight: 700; }
.st-transaction-doc { min-width: 0; }
.st-transaction-doc strong, .st-transaction-doc small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-transaction-doc strong { font-size: 9.5px; }
.st-transaction-doc small { margin-top: 2px; color: var(--st-hub-muted); font-size: 8px; }
.st-transaction-value { font-weight: 730; }
.st-transaction-status { display: inline-flex; max-width: 100%; padding: 4px 7px; border-radius: 999px; font-size: 8px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-transaction-status.success { background: rgba(17,156,103,.10); color: #119c67; }
.st-transaction-status.info { background: rgba(23,105,238,.09); color: #1769ee; }
.st-transaction-status.danger { background: rgba(226,65,75,.09); color: #d83d48; }
.st-transaction-status.neutral { background: var(--st-hub-soft); color: var(--st-hub-muted); }

.st-dashboard-activity-section { margin-top: 0; }
.st-dashboard-activity-section .st-activity-summary { grid-template-columns: repeat(4, minmax(0,1fr)); }
.st-dashboard-activity-section .st-activity-list { max-height: 320px; overflow-y: auto; }

[data-theme="dark"] .st-dash-kpi, [data-theme="dark"] .st-dash-card { border-color: rgba(81,97,119,.62); box-shadow: 0 10px 28px rgba(0,0,0,.16); }
[data-theme="dark"] .st-dash-kpi-primary { border-color: transparent; }
[data-theme="dark"] .st-dash-grid-line { stroke: rgba(148,163,184,.15); }

@media (max-width: 1180px) {
	.st-dash-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); }
	.st-dash-insights { grid-template-columns: 1fr 1fr; }
	.st-dash-revenue-card, .st-dash-transactions-card { grid-column: 1 / -1; }
}

@media (max-width: 820px) {
	.st-dash-insights { grid-template-columns: 1fr; }
	.st-dash-revenue-card, .st-dash-transactions-card { grid-column: auto; }
	.st-transaction-table { overflow-x: auto; }
	.st-transaction-row { min-width: 700px; }
}

@media (max-width: 680px) {
	.st-dashboard-redesign-v4 .st-hub-welcome { align-items: flex-start; }
	.st-dash-period { display: none; }
	.st-dash-kpis { grid-template-columns: 1fr; }
	.st-dash-kpi { min-height: 124px; }
	.st-dash-legend { display: none; }
	.st-heatmap-grid { grid-template-columns: 34px repeat(7, minmax(23px,1fr)); gap: 4px; }
	.st-dashboard-activity-section .st-activity-summary { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
/* ===== HOME DASHBOARD V4 END ===== */
'''
CSS.write_text(css.rstrip() + "\n\n" + css_block.strip() + "\n", encoding="utf-8")

print("Home dashboard v4 revision applied.")

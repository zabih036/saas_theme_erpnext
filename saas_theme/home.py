from __future__ import annotations

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

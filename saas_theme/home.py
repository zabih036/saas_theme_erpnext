from __future__ import annotations

from collections import Counter, defaultdict
import json
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


def _read_rows(doctype, fields, filters=None, *, limit=1000, order_by=None):
    """Read permitted records; never expose partial totals or permission exceptions."""
    try:
        if not frappe.has_permission(doctype, ptype="read"):
            return None
        rows = frappe.get_list(
            doctype, fields=fields, filters=filters or [],
            order_by=order_by, limit_page_length=limit + 1,
        )
        # Capped aggregates are deliberately omitted rather than shown as
        # plausible but incorrect figures on large installations.
        return rows if len(rows) <= limit else None
    except Exception:
        frappe.logger("saas_theme").debug("Home metric skipped: %s", doctype)
        return None


def _home_company():
    """Never mix balances from different companies or currencies."""
    company = frappe.defaults.get_user_default("Company")
    if not company:
        company = frappe.defaults.get_global_default("company")
    if not company:
        companies = _read_rows("Company", ["name"], limit=1)
        if companies and len(companies) == 1:
            company = companies[0].name
    return company


def _home_currency(company):
    if company:
        rows = _read_rows("Company", ["name", "default_currency"],
                          [["name", "=", company]], limit=1)
        if rows:
            return rows[0].get("default_currency") or ""
    return frappe.defaults.get_global_default("currency") or ""


def _account_balances(company, today):
    """Return company-currency GL balances only if the permitted result is complete."""
    if not company or not frappe.has_permission("GL Entry", ptype="read"):
        return None
    account_types = ("Bank", "Cash", "Receivable", "Payable")
    accounts = _read_rows(
        "Account", ["name", "account_type"],
        [["company", "=", company], ["is_group", "=", 0],
         ["account_type", "in", list(account_types)]], limit=3500,
    )
    if accounts is None:
        return None
    mapping = {row.name: row.account_type for row in accounts}
    balances = {key: 0.0 for key in account_types}
    if not mapping:
        return balances
    rows = _read_rows(
        "GL Entry", ["account", "debit", "credit"],
        [["company", "=", company], ["is_cancelled", "=", 0],
         ["posting_date", "<=", today], ["account", "in", list(mapping)]],
        limit=50000,
    )
    if rows is None:
        return None
    for row in rows:
        kind = mapping.get(row.account)
        if kind:
            net = flt(row.debit) - flt(row.credit)
            balances[kind] += -net if kind == "Payable" else net
    return balances


def _stock_balance(company):
    """Bin.stock_value is current inventory valuation, not period movement."""
    if not company:
        return None
    warehouses = _read_rows(
        "Warehouse", ["name"],
        [["company", "=", company], ["is_group", "=", 0]], limit=4000,
    )
    if warehouses is None:
        return None
    if not warehouses:
        return 0.0
    bins = _read_rows(
        "Bin", ["warehouse", "stock_value"],
        [["warehouse", "in", [row.name for row in warehouses]]],
        limit=35000,
    )
    return _sum(bins, "stock_value") if bins is not None else None


@frappe.whitelist()
def get_dashboard_overview() -> dict:
    """Permission-safe Home summary. Missing keys mean 'do not display'."""
    if frappe.session.user == "Guest":
        return {}

    today = getdate(nowdate())
    start = getdate(get_first_day(today))
    first = getdate(add_months(start, -5))
    previous = getdate(add_months(start, -1))
    company = _home_company()
    company_filter = [["company", "=", company]] if company else []
    series = _month_series(first)
    current_key = start.strftime("%Y-%m")
    previous_key = previous.strftime("%Y-%m")
    kpis = {}
    result = {
        "company": company or "",
        "currency": _home_currency(company),
        "kpis": kpis,
        "trend": None,
        "heatmap": None,
        "invoices": None,
        "production": None,
    }

    customers = _read_rows("Customer", ["name"],
                           [["disabled", "=", 0]], limit=10000)
    suppliers = _read_rows("Supplier", ["name"],
                           [["disabled", "=", 0]], limit=10000)
    if customers is not None:
        kpis["customers"] = {"value": len(customers), "note": _("Enabled customers")}
    if suppliers is not None:
        kpis["suppliers"] = {"value": len(suppliers), "note": _("Enabled suppliers")}

    # The sales invoice set is exact for the entire six-month chart window.
    # Missing/unauthorized invoice sets never become misleading zero values.
    sales = _read_rows(
        "Sales Invoice",
        ["name", "posting_date", "posting_time", "base_net_total",
         "base_grand_total", "outstanding_amount", "conversion_rate"],
        company_filter + [["docstatus", "=", 1],
                          ["posting_date", ">=", first], ["posting_date", "<=", today]],
        limit=15000, order_by="posting_date desc",
    ) if company else None
    revenue_monthly = defaultdict(float)
    if sales is not None:
        counts = Counter()
        for row in sales:
            key = _month_key(row.posting_date)
            counts[key] += 1
            revenue_monthly[key] += flt(row.base_net_total)
        current = revenue_monthly[current_key]
        prior = revenue_monthly[previous_key]
        kpis["revenue"] = {
            "value": current,
            # No percentage is mathematically defined when previous month = 0.
            "delta": _change(current, prior) if prior else None,
            "note": _("{0} submitted sales invoices").format(counts[current_key]),
        }
        paid = [row for row in sales if flt(row.outstanding_amount) <= 0.005]
        unpaid = [row for row in sales if flt(row.outstanding_amount) > 0.005]
        result["invoices"] = {
            "paid_count": len(paid),
            "unpaid_count": len(unpaid),
            "paid_amount": _sum(paid, "base_grand_total"),
            # The overdue amount is converted to the company base currency.
            "unpaid_amount": sum(
                flt(row.outstanding_amount) * flt(row.conversion_rate or 1)
                for row in unpaid
            ),
        }
        days = [_("Sun"), _("Mon"), _("Tue"), _("Wed"), _("Thu"), _("Fri"), _("Sat")]
        times = [_("9AM"), _("12PM"), _("3PM"), _("6PM"), _("9PM")]
        heatmap = [[0 for _ in range(7)] for _ in range(5)]
        for row in sales:
            date = getdate(row.posting_date)
            heatmap[_heatmap_bucket(_posting_hour(row.posting_time))][
                (date.weekday() + 1) % 7
            ] += 1
        result["heatmap"] = {"days": days, "times": times, "values": heatmap,
                             "total": len(sales)}

    # Expense GL entries respect row permissions, are company-scoped and
    # include only true expense accounts, never other asset/liability debits.
    expenses = None
    if company and frappe.has_permission("GL Entry", ptype="read"):
        accounts = _read_rows(
            "Account", ["name"],
            company_filter + [["root_type", "=", "Expense"], ["is_group", "=", 0]],
            limit=3500,
        )
        if accounts is not None:
            if not accounts:
                expenses = []
            else:
                expenses = _read_rows(
                    "GL Entry", ["posting_date", "debit", "credit"],
                    company_filter + [["is_cancelled", "=", 0],
                                      ["posting_date", ">=", first],
                                      ["posting_date", "<=", today],
                                      ["account", "in", [row.name for row in accounts]]],
                    limit=50000,
                )
    expense_monthly = defaultdict(float)
    if expenses is not None:
        for row in expenses:
            expense_monthly[_month_key(row.posting_date)] += flt(row.debit) - flt(row.credit)
        current, prior = expense_monthly[current_key], expense_monthly[previous_key]
        kpis["expenses"] = {
            "value": current,
            "delta": _change(current, prior) if prior else None,
            "note": _("Posted expenses this month"),
        }
    if sales is not None or expenses is not None:
        result["trend"] = {
            "labels": [item["label"] for item in series],
            "revenue": [revenue_monthly[item["key"]] for item in series] if sales is not None else None,
            "expenses": [expense_monthly[item["key"]] for item in series] if expenses is not None else None,
        }

    balances = _account_balances(company, today)
    if balances is not None:
        for key, amount, description in (
            ("cash", balances["Cash"] + balances["Bank"], _("Cash, treasury and bank accounts")),
            ("receivables", balances["Receivable"], _("Net customer receivables")),
            ("payables", balances["Payable"], _("Net supplier payables")),
        ):
            kpis[key] = {"value": amount, "note": description}

    stock = _stock_balance(company)
    if stock is not None:
        kpis["stock_value"] = {"value": stock, "note": _("Current warehouse valuation")}

    # A production run count is comparable month to month; summing mixed
    # production weights/items and calling them a single quantity would not be.
    production = _read_rows(
        "Stock Entry", ["name", "posting_date"],
        company_filter + [["docstatus", "=", 1], ["purpose", "=", "Manufacture"],
                          ["posting_date", ">=", first], ["posting_date", "<=", today]],
        limit=10000,
    ) if company else None
    if production is not None:
        runs = Counter(_month_key(row.posting_date) for row in production)
        result["production"] = {
            "labels": [item["label"] for item in series],
            "runs": [runs[item["key"]] for item in series],
            "total": len(production),
        }
    return result


@frappe.whitelist()
def get_recent_activity(limit: int = 10) -> dict:
    """Real document audit trail: Comments + Versions, filtered per document.

    Only safe metadata is surfaced. Version change values and private fields
    are never included; each referenced document must pass read permission.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        return {"items": [], "summary": {}, "total": 0}
    limit = min(max(cint(limit) or 10, 1), 15)
    candidates = []

    # Comments record document creation, submission, cancellation, workflow
    # transitions, attachments and assignments.
    try:
        comments = frappe.get_all(
            "Comment",
            fields=["creation", "owner", "comment_type", "comment_by",
                    "reference_doctype", "reference_name"],
            filters={"comment_type": ["in", list(ACTIVITY_TYPES)]},
            order_by="creation desc",
            limit_page_length=180,
        )
        for row in comments:
            candidates.append({
                "creation": row.creation, "actor": row.comment_by or row.owner,
                "activity_type": row.comment_type,
                "reference_doctype": row.reference_doctype,
                "reference_name": row.reference_name,
            })
    except Exception:
        pass

    # Version is Frappe's actual field-change audit log, not recent navigation.
    try:
        versions = frappe.get_all(
            "Version", fields=["creation", "owner", "ref_doctype", "docname", "data"],
            order_by="creation desc", limit_page_length=180,
        )
        for row in versions:
            try:
                changes = json.loads(row.data or "{}")
            except (ValueError, TypeError):
                changes = {}
            count = sum(
                len(changes.get(key) or []) for key in ("changed", "added", "removed", "row_changed")
            )
            candidates.append({
                "creation": row.creation, "actor": row.owner,
                "activity_type": "Updated",
                "description": _("{0} field changes").format(count) if count else _("Updated document"),
                "reference_doctype": row.ref_doctype,
                "reference_name": row.docname,
            })
    except Exception:
        pass

    candidates.sort(key=lambda row: str(row["creation"] or ""), reverse=True)
    permission_cache = {}
    items = []
    grouped = Counter()
    for row in candidates:
        doctype, name = row.get("reference_doctype"), row.get("reference_name")
        if not doctype or not name:
            continue
        reference = (doctype, name)
        if reference not in permission_cache:
            permission_cache[reference] = _can_read_reference(doctype, name, user)
        if not permission_cache[reference]:
            continue
        kind = row.get("activity_type") or "Updated"
        grouped[kind] += 1
        items.append({
            "creation": row.get("creation"),
            "actor": _clean_text(row.get("actor"), 90) or _("User"),
            "activity_type": kind,
            "description": _clean_text(row.get("description"), 90),
            "reference_doctype": doctype,
            "reference_name": name,
        })
        if len(items) >= limit:
            break
    summary = {
        "created": grouped["Created"],
        "updated": grouped["Updated"] + grouped["Edit"] + grouped["Workflow"],
        "submitted": grouped["Submitted"],
    }
    summary["other"] = len(items) - sum(summary.values())
    return {"items": items, "summary": summary, "total": len(items)}

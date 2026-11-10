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



def _grouped_sum(doctype, filters, fields, *, group_by=None, or_filters=None):
    """Frappe v16 permission-enforced SQL aggregation, not raw unrestricted SQL.

    Ignore permissions MUST remain False (Frappe's QB default is True).
    Returns None when a field, source or permission is not available.
    """
    try:
        if not frappe.has_permission(doctype, ptype="read"):
            return None
        selections = ([group_by] if group_by else []) + [
            {"SUM": field, "as": f"total_{field}"} for field in fields
        ]
        options = {
            "fields": selections, "filters": filters,
            "group_by": group_by, "ignore_permissions": False,
        }
        if or_filters is not None:
            options["or_filters"] = or_filters
        query = frappe.qb.get_query(doctype, **options)
        return query.run(as_dict=True)
    except Exception:
        frappe.logger("saas_theme").debug("Home aggregate skipped: %s", doctype)
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
    rows = _grouped_sum(
        "GL Entry",
        [["company", "=", company], ["is_cancelled", "=", 0],
         ["posting_date", "<=", today], ["account", "in", list(mapping)]],
        ["debit", "credit"], group_by="account",
    )
    if rows is None:
        return None
    for row in rows:
        kind = mapping.get(row.account)
        if kind:
            net = flt(row.total_debit) - flt(row.total_credit)
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
    bins = _grouped_sum(
        "Bin", [["warehouse", "in", [row.name for row in warehouses]]],
        ["stock_value"],
    )
    return flt(bins[0].total_stock_value) if bins else (0.0 if bins == [] else None)



def _profit_and_loss_gl_rows(company, from_date, to_date, root_type):
    """Read company P&L postings with user permissions, excluding closing vouchers."""
    if not company:
        return None
    accounts = _read_rows(
        "Account", ["name"],
        [["company", "=", company], ["root_type", "=", root_type],
         ["is_group", "=", 0]], limit=3500,
    )
    if accounts is None:
        return None
    if not accounts:
        return []
    # The default P&L report includes empty/null Finance Books and the
    # company's default Finance Book (Include Default FB Entries = on).
    # Do not mix postings from other, independently selected books.
    companies = _read_rows(
        "Company", ["name", "default_finance_book"],
        [["name", "=", company]], limit=1,
    )
    if not companies:
        return None
    finance_book = companies[0].get("default_finance_book")
    book_filters = [
        ["finance_book", "is", "not set"],
        ["finance_book", "=", ""],
    ]
    if finance_book:
        book_filters.append(["finance_book", "=", finance_book])
    return _grouped_sum(
        "GL Entry",
        [["company", "=", company], ["is_cancelled", "=", 0],
         ["voucher_type", "!=", "Period Closing Voucher"],
         ["posting_date", ">=", from_date], ["posting_date", "<=", to_date],
         ["account", "in", [row.name for row in accounts]]],
        ["debit", "credit"], group_by="posting_date", or_filters=book_filters,
    )


def _fiscal_year_start(company, today):
    """Use the company's actual ERPNext fiscal year, not January 1."""
    if not company:
        return None
    try:
        from erpnext.accounts.utils import get_fiscal_year
        return getdate(get_fiscal_year(today, company=company)[1])
    except Exception:
        frappe.logger("saas_theme").debug("Home fiscal year unavailable for %s", company)
        return None


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
    if sales is not None:
        # Sales Invoice counts and status do not represent P&L income.
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


    # Match the standard Profit and Loss Income accounts in the company's
    # fiscal year. Journal Entries, Credit Notes and other income are included.
    revenue_monthly = defaultdict(float)
    fiscal_start = _fiscal_year_start(company, today) if (
        company and frappe.has_permission("GL Entry", ptype="read")
    ) else None
    income_entries = _profit_and_loss_gl_rows(
        company, min(first, fiscal_start), today, "Income",
    ) if fiscal_start and fiscal_start <= today else None
    if income_entries is not None:
        fiscal_revenue = 0.0
        for row in income_entries:
            amount = flt(row.total_credit) - flt(row.total_debit)
            revenue_monthly[_month_key(row.posting_date)] += amount
            if fiscal_start <= getdate(row.posting_date) <= today:
                fiscal_revenue += amount
        kpis["revenue"] = {
            "value": fiscal_revenue,
            "delta": None,
            "note": _("P&L total income · fiscal year to date"),
        }

    # P&L Expense accounts follow debit-minus-credit with the same
    # cancelled/period-closing exclusions as Income.
    expense_entries = _profit_and_loss_gl_rows(company, first, today, "Expense")
    expense_monthly = defaultdict(float)
    if expense_entries is not None:
        for row in expense_entries:
            expense_monthly[_month_key(row.posting_date)] += (
                flt(row.total_debit) - flt(row.total_credit)
            )
        current, prior = expense_monthly[current_key], expense_monthly[previous_key]
        kpis["expenses"] = {
            "value": current,
            "delta": _change(current, prior) if prior else None,
            "note": _("P&L expense postings this month"),
        }
    if income_entries is not None or expense_entries is not None:
        result["trend"] = {
            "labels": [item["label"] for item in series],
            "revenue": [revenue_monthly[item["key"]] for item in series]
            if income_entries is not None else None,
            "expenses": [expense_monthly[item["key"]] for item in series]
            if expense_entries is not None else None,
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



def _sidebar_role_field_names(table_field):
    """Find actual Role links in the custom child table without guessing its name."""
    names = ["role", "allowed_role", "custom_role", "role_name", "custom_allowed_role"]
    if not table_field or not getattr(table_field, "options", None):
        return names
    child = frappe.get_meta(table_field.options)
    names.extend(
        field.fieldname for field in child.fields
        if field.fieldtype == "Link" and field.options == "Role"
    )
    return list(dict.fromkeys(names))


def _sidebar_allowed_roles(doc, field_names):
    rows = doc.get("custom_allowed_roles") or []
    if not rows:
        return None  # An empty role table is unrestricted.
    allowed = set()
    for row in rows:
        for fieldname in field_names:
            value = row.get(fieldname) if hasattr(row, "get") else None
            if value:
                allowed.add(str(value).strip())
    # A configured but malformed nonempty role table denies access.
    return allowed


@frappe.whitelist()
def get_home_sidebar_access(names=None):
    """Check custom_hidden and custom_allowed_roles for Quick Access modules.

    Frappe boot supplies only visible module candidates, but does not always
    include the custom Check field and role child-table. The shared permitted
    response drives both the left Quick Access list and Customize modal.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        return {"allowed": []}
    if isinstance(names, str):
        try:
            names = json.loads(names)
        except (TypeError, ValueError):
            return {"allowed": []}
    if not isinstance(names, list):
        return {"allowed": []}
    names = list(dict.fromkeys(str(name) for name in names if isinstance(name, str) and name.strip()))
    if not names or len(names) > 100 or any(len(name) > 180 for name in names):
        return {"allowed": []}

    # Administrator bypasses role checks, but not custom_hidden.
    is_admin = user == "Administrator"
    try:
        user_roles = set(frappe.get_roles(user)) if not is_admin else set()
        allowed = set(names)
        for doctype in ("Sidebar", "Workspace Sidebar"):
            if not frappe.db.exists("DocType", doctype):
                continue
            meta = frappe.get_meta(doctype)
            hidden_field = meta.get_field("custom_hidden")
            table_field = meta.get_field("custom_allowed_roles")
            has_roles = bool(table_field and table_field.fieldtype == "Table")
            if not hidden_field and not has_roles:
                continue
            fields = _sidebar_role_field_names(table_field) if has_roles else []
            rows = frappe.get_all(
                doctype, fields=["name"],
                filters=[["name", "in", names]], limit_page_length=len(names) + 1,
            )
            for row in rows:
                doc = frappe.get_doc(doctype, row.name)
                if hidden_field and cint(doc.get("custom_hidden")):
                    allowed.discard(row.name)
                    continue
                if has_roles and not is_admin:
                    configured = _sidebar_allowed_roles(doc, fields)
                    if configured is not None and not (configured & user_roles):
                        allowed.discard(row.name)
        return {"allowed": [name for name in names if name in allowed]}
    except Exception:
        frappe.logger("saas_theme").warning("Home sidebar role check unavailable")
        # A failure must not show restricted sidebars.
        return {"allowed": []}


@frappe.whitelist()
def get_recent_activity(limit: int = 10) -> dict:
    """Read activity from Version only, not Comment or workspace navigation.

    Do not expose old/new values. Version rows are filtered by the current
    user's read permission on each referenced document.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        return {"items": [], "summary": {}, "total": 0}
    limit = min(max(cint(limit) or 10, 1), 15)
    try:
        versions = frappe.get_all(
            "Version",
            fields=["creation", "owner", "ref_doctype", "docname", "data"],
            order_by="creation desc",
            limit_page_length=max(180, limit * 15),
        )
    except Exception:
        return {"items": [], "summary": {}, "total": 0}

    permission_cache = {}
    items = []
    for row in versions:
        doctype, name = row.get("ref_doctype"), row.get("docname")
        if not doctype or not name:
            continue
        ref = (doctype, name)
        if ref not in permission_cache:
            permission_cache[ref] = _can_read_reference(doctype, name, user)
        if not permission_cache[ref]:
            continue

        try:
            changes = json.loads(row.get("data") or "{}")
        except (ValueError, TypeError):
            changes = {}
        if not isinstance(changes, dict):
            changes = {}

        changed = len(changes.get("changed") or [])
        added = len(changes.get("added") or [])
        removed = len(changes.get("removed") or [])
        row_changed = len(changes.get("row_changed") or [])
        descriptions = []
        if changed:
            descriptions.append((_("1 field changed") if changed == 1 else _("{0} fields changed").format(changed)))
        if added:
            descriptions.append(_("{0} rows added").format(added))
        if removed:
            descriptions.append(_("{0} rows removed").format(removed))
        if row_changed:
            descriptions.append(_("{0} child rows changed").format(row_changed))
        items.append({
            "creation": row.get("creation"),
            "actor": _clean_text(row.get("owner"), 90) or _("User"),
            "activity_type": "Updated",
            "description": ", ".join(descriptions) or _("Updated document"),
            "reference_doctype": doctype,
            "reference_name": name,
        })
        if len(items) >= limit:
            break
    return {
        "items": items,
        "summary": {"updated": len(items)},
        "total": len(items),
    }

#!/usr/bin/env python3
"""Permission, totals and audit-log regression checks for the Home dashboard.

Uses a minimal Frappe stub and imports the actual endpoint. No database or
Frappe bench required; CI also compiles the Python and JS source.
"""
from __future__ import annotations

from datetime import date
import importlib.util
import json
from pathlib import Path
import re
import sys
import types


class Row(dict):
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name) from None


class FakeQuery:
    def __init__(self, rows):
        self.rows = [Row(row) for row in rows]

    def run(self, as_dict=False):
        assert as_dict is True
        return self.rows


frappe = types.ModuleType("frappe")
frappe_utils = types.ModuleType("frappe.utils")
frappe._ = lambda text: text
frappe.whitelist = lambda: lambda func: func
frappe.session = types.SimpleNamespace(user="employee@example.com")
frappe.defaults = types.SimpleNamespace(
    get_user_default=lambda key: "Demo Company",
    get_global_default=lambda key: "AFN",
)
frappe.logger = lambda name: types.SimpleNamespace(debug=lambda *args: None)
frappe_utils.cint = lambda x: int(x or 0)
frappe_utils.flt = lambda x: float(x or 0)
frappe_utils.getdate = lambda x: x if isinstance(x, date) else date.fromisoformat(str(x)[:10])
frappe_utils.nowdate = lambda: "2026-11-07"
frappe_utils.get_first_day = lambda x: x.replace(day=1)
frappe_utils.add_months = lambda x, offset: date(
    x.year + (x.month - 1 + offset) // 12,
    (x.month - 1 + offset) % 12 + 1, min(x.day, 28)
)
frappe_utils.strip_html_tags = lambda x: re.sub(r"<[^>]*>", "", x)
for key in ("cint", "flt", "getdate", "nowdate",
            "get_first_day", "add_months", "strip_html_tags"):
    setattr(frappe_utils, key, getattr(frappe_utils, key))
sys.modules["frappe"] = frappe
sys.modules["frappe.utils"] = frappe_utils

source = Path(__file__).resolve().parents[1] / "saas_theme" / "home.py"
spec = importlib.util.spec_from_file_location("saas_theme_home_under_test", source)
home = importlib.util.module_from_spec(spec)
spec.loader.exec_module(home)

readable = set()
datasets = {}
audit_rows = {}
queries = []
query_rows = {}


def can_read(doctype, ptype="read", doc=None, user=None):
    assert ptype == "read"
    if doc:
        return (doctype, doc) in readable
    return doctype in readable


def get_list(doctype, fields=None, filters=None, order_by=None, limit_page_length=None):
    assert doctype in readable, "Permission-denied read attempted: " + doctype
    return [Row(x) for x in datasets.get(doctype, [])]


def get_all(doctype, fields=None, filters=None, order_by=None, limit_page_length=None):
    return [Row(x) for x in audit_rows.get(doctype, [])]


def qb_get_query(doctype, fields, filters, group_by=None, ignore_permissions=True):
    assert ignore_permissions is False, "Aggregates MUST enforce user permissions"
    assert doctype in readable
    queries.append((doctype, fields, filters, group_by))
    return FakeQuery(query_rows.get((doctype, group_by), []))


frappe.has_permission = can_read
frappe.get_list = get_list
frappe.get_all = get_all
frappe.qb = types.SimpleNamespace(get_query=qb_get_query)

# A user with no access must not trigger a restricted query or see KPI placeholders.
denied = home.get_dashboard_overview()
assert denied["kpis"] == {}, denied
assert denied["trend"] is None and denied["production"] is None
assert denied["invoices"] is None and denied["heatmap"] is None
assert queries == []

# One submitted invoice: proper translated count, never the literal {0};
# growth percentage is undefined when the previous month had no sales.
readable.update({"Sales Invoice", "Customer", "Supplier", "Company"})
datasets.update({
    "Company": [dict(name="Demo Company", default_currency="AFN")],
    "Customer": [dict(name="CUST-001")],
    "Supplier": [dict(name="SUP-001")],
    "Sales Invoice": [dict(
        name="SI-1", posting_date="2026-11-06", posting_time="10:00:00",
        base_net_total=17000, base_grand_total=17000,
        outstanding_amount=0, conversion_rate=1,
    )],
})
overview = home.get_dashboard_overview()
assert overview["currency"] == "AFN"
assert overview["kpis"]["revenue"]["value"] == 17000
assert overview["kpis"]["revenue"]["delta"] is None
assert overview["kpis"]["revenue"]["note"] == "1 submitted sales invoices"
assert overview["invoices"]["paid_count"] == 1
assert overview["invoices"]["unpaid_count"] == 0
assert "cash" not in overview["kpis"]
assert "stock_value" not in overview["kpis"]

# Company-scoped balances: GL figures are aggregated with permission checks,
# using debit-credit for assets and credit-debit for liabilities.
readable.update({"GL Entry", "Account", "Warehouse", "Bin", "Stock Entry"})
datasets.update({
    "Account": [
        dict(name="Cash", account_type="Cash"),
        dict(name="Bank", account_type="Bank"),
        dict(name="Receivable", account_type="Receivable"),
        dict(name="Payable", account_type="Payable"),
    ],
    "Warehouse": [dict(name="Stores")],
    "Stock Entry": [dict(name="STE-1", posting_date="2026-11-06")],
})
query_rows[("GL Entry", "account")] = [
    dict(account="Cash", total_debit=1000, total_credit=100),
    dict(account="Bank", total_debit=800, total_credit=200),
    dict(account="Receivable", total_debit=1200, total_credit=400),
    dict(account="Payable", total_debit=200, total_credit=500),
]
query_rows[("GL Entry", "posting_date")] = []
query_rows[("Bin", None)] = [dict(total_stock_value=12500)]
overview = home.get_dashboard_overview()
assert overview["kpis"]["cash"]["value"] == 1500, overview["kpis"]
assert overview["kpis"]["receivables"]["value"] == 800
assert overview["kpis"]["payables"]["value"] == 300
assert overview["kpis"]["stock_value"]["value"] == 12500
assert overview["production"]["total"] == 1
assert queries and all(q[0] in readable for q in queries)

# The feed must load from Version ONLY, never Comment. It includes the
# permitted document but not sensitive field values or inaccessible records.
readable.update({("Sales Invoice", "SI-1")})
audit_rows.update({
    "Comment": [dict(
        creation="2026-11-07 09:00:00", owner="alice@example.com",
        comment_by="Alice", comment_type="Submitted",
        reference_doctype="Sales Invoice", reference_name="SI-1",
    )],
    "Version": [
        dict(creation="2026-11-07 10:00:00", owner="bob@example.com",
             ref_doctype="Sales Invoice", docname="SI-1",
             data=json.dumps({"changed": [["status", "Draft", "Submitted"]]})),
        dict(creation="2026-11-07 11:00:00", owner="admin@example.com",
             ref_doctype="Salary Slip", docname="SECRET-1",
             data=json.dumps({"changed": [["salary", 1, 100000]]})),
    ],
})
activity = home.get_recent_activity(limit=9)
assert len(activity["items"]) == 1, activity
assert activity["items"][0]["actor"] == "bob@example.com"
assert activity["items"][0]["description"] == "1 fields changed"
assert activity["summary"] == {"updated": 1}
assert "Alice" not in str(activity)
assert "100000" not in str(activity)
assert "SECRET-1" not in str(activity)

# custom_allowed_roles on Sidebar is a *child table*; only users with an
# allowed role can see that sidebar in Home Quick Access AND its modal.
class FakeMeta:
    def __init__(self, fields):
        self.fields = fields

    def get_field(self, name):
        return self.fields.get(name)


meta = {
    "Sidebar": FakeMeta({"custom_allowed_roles": types.SimpleNamespace(
        fieldtype="Table", options="Sidebar Allowed Role",
    )}),
    "Workspace Sidebar": FakeMeta({}),
    "Sidebar Allowed Role": FakeMeta({}),
}
frappe.get_meta = lambda doctype: meta[doctype]
frappe.db = types.SimpleNamespace(exists=lambda doctype, name: doctype == "DocType")
frappe.get_roles = lambda user: ["Employee", "Accounts User"]
frappe.get_all = lambda doctype, fields=None, filters=None, order_by=None, limit_page_length=None: (
    [Row({"name": "Buying"}), Row({"name": "Accounting"})]
    if doctype == "Sidebar"
    else [Row(v) for v in audit_rows.get(doctype, [])]
)
docs = {
    ("Sidebar", "Buying"): Row({"custom_allowed_roles": [Row({"role": "Employee"})]}),
    ("Sidebar", "Accounting"): Row({"custom_allowed_roles": [Row({"role": "System Manager"})]}),
}
frappe.get_doc = lambda doctype, name: docs[(doctype, name)]
names = ["Buying", "Accounting", "Manufacturing"]
allowed = home.get_home_sidebar_access(names)
assert allowed == {"allowed": ["Buying", "Manufacturing"]}, allowed
assert home.get_home_sidebar_access('["Buying","Accounting"]') == {"allowed": ["Buying"]}
assert home.get_home_sidebar_access(["Accounting"]) == {"allowed": []}
docs[("Sidebar", "Buying")] = Row({"custom_allowed_roles": [Row({"unknown": "Employee"})]})
assert home.get_home_sidebar_access(["Buying"]) == {"allowed": []}  # fail-closed
docs[("Sidebar", "Buying")] = Row({"custom_allowed_roles": []})
assert home.get_home_sidebar_access(["Buying"]) == {"allowed": ["Buying"]}
frappe.get_doc = lambda doctype, name: (_ for _ in ()).throw(ValueError("unreadable roles"))
assert home.get_home_sidebar_access(["Accounting"]) == {"allowed": []}

frappe.session.user = "Guest"
assert home.get_dashboard_overview() == {}
assert home.get_recent_activity()["items"] == []
print("Home permission, finance, production, invoice and audit-log tests passed.")

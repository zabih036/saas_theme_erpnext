import frappe
from frappe.defaults import get_user_default


@frappe.whitelist()
def get_company_branding():
    """Return the logged-in user's default company branding for the Desk shell."""

    if frappe.session.user == "Guest":
        return {"company": None, "company_logo": None}

    company = get_user_default("Company") or frappe.db.get_single_value(
        "Global Defaults", "default_company"
    )

    if not company:
        return {"company": None, "company_logo": None}

    return {
        "company": company,
        "company_logo": frappe.db.get_value("Company", company, "company_logo"),
    }

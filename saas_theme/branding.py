import frappe
from frappe.defaults import get_user_default


@frappe.whitelist(allow_guest=True)
def get_company_branding():
    """Return safe company branding for Desk and the public login screen."""

    company = None

    if frappe.session.user != "Guest":
        company = get_user_default("Company")

    company = company or frappe.db.get_single_value(
        "Global Defaults", "default_company"
    )

    if not company:
        return {"company": None, "company_logo": None}

    return {
        "company": company,
        "company_logo": frappe.db.get_value("Company", company, "company_logo"),
    }

"""Self-service Desk language settings for the SaaS Theme.

Frappe resolves logged-in users' UI language from User.language. Do not use
cookies or modify System Settings; both entry points must update only the
current signed-in user's own preference.
"""
from __future__ import annotations

import frappe
from frappe import _


def _signed_in_user() -> str:
    user = getattr(frappe.session, "user", None)
    if not user or user == "Guest":
        frappe.throw(_("Please log in to change your language."), frappe.PermissionError)
    return user


@frappe.whitelist()
def get_available_languages() -> dict:
    """List enabled Language records without exposing other users' preferences."""
    user = _signed_in_user()
    current = (
        frappe.db.get_value("User", user, "language")
        or frappe.get_system_settings("language")
        or "en"
    )
    languages = frappe.get_all(
        "Language",
        filters={"enabled": 1},
        fields=["name", "language_name"],
        order_by="language_name asc",
        limit_page_length=250,
    )
    return {
        "current": current,
        "languages": [
            {"code":item.name, "name":item.language_name or item.name}
            for item in languages
        ],
    }


@frappe.whitelist()
def set_user_language(language: str) -> dict:
    """Update *only* the current user's enabled language, never site defaults."""
    user = _signed_in_user()
    if not isinstance(language, str) or not language.strip() or len(language) > 30:
        frappe.throw(_("Please choose a valid language."), frappe.ValidationError)
    language = language.strip()
    if not frappe.db.exists("Language", {"name": language, "enabled": 1}):
        frappe.throw(_("This language is not enabled on this site."), frappe.ValidationError)

    user_doc = frappe.get_doc("User", user)
    if user_doc.language != language:
        # Users may not have generic write permission on the User DocType.
        # The whitelisted endpoint is restricted to self + this one field.
        # Save through the User controller to update per-user locale defaults.
        user_doc.language = language
        user_doc.save(ignore_permissions=True)
        frappe.clear_cache(user=user)

    return {"language": language}

from __future__ import annotations

from collections import Counter

import frappe
from frappe import _
from frappe.utils import cint, strip_html_tags


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


@frappe.whitelist()
def get_recent_activity(limit: int = 10) -> dict:
    """Return recent document activity that the current user is allowed to see.

    Comment is an internal timeline/audit DocType and is not directly readable by
    normal Desk users. This endpoint deliberately reads recent timeline events on
    the server, then checks read permission against every referenced document
    before returning anything to the browser.
    """

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

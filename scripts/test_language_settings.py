#!/usr/bin/env python3
"""Self-only language preference tests without a running bench."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import types


class Row(dict):
    def __getattr__(self, key):
        return self[key]


class FakeUser:
    def __init__(self, username, language):
        self.name = username
        self.language = language
        self.saved = []

    def save(self, ignore_permissions=False):
        assert ignore_permissions is True
        self.saved.append(self.language)


frappe = types.ModuleType("frappe")
frappe._ = lambda message: message
frappe.whitelist = lambda: lambda fn: fn
frappe.PermissionError = type("PermissionError", (Exception,), {})
frappe.ValidationError = type("ValidationError", (Exception,), {})
frappe.session = types.SimpleNamespace(user="alice@example.com")
frappe.throw = lambda message, kind=Exception: (_ for _ in ()).throw(kind(message))
frappe.get_system_settings = lambda name: "en"
users = {
    "alice@example.com": FakeUser("alice@example.com", "en"),
    "bob@example.com": FakeUser("bob@example.com", "en"),
}
enabled = {"en": "English", "ps": "پښتو", "fa": "فارسی", "ar": "العربية"}
cache_clear = []
calls = []


def get_value(doctype, name, fieldname):
    calls.append(("get_value", doctype, name, fieldname))
    assert doctype == "User" and fieldname == "language"
    return users[name].language


def get_all(doctype, filters=None, fields=None, order_by=None, limit_page_length=None):
    assert (doctype, filters, fields, order_by, limit_page_length) == (
        "Language", {"enabled": 1}, ["name", "language_name"],
        "language_name asc", 250,
    )
    return [Row(name=code, language_name=label) for code, label in enabled.items()]


def exists(doctype, filters):
    assert doctype == "Language" and filters.get("enabled") == 1
    return filters.get("name") in enabled


def get_doc(doctype, name):
    assert doctype == "User" and name == frappe.session.user
    return users[name]


frappe.db = types.SimpleNamespace(get_value=get_value, exists=exists)
frappe.get_all = get_all
frappe.get_doc = get_doc
frappe.clear_cache = lambda user=None: cache_clear.append(user)
sys.modules["frappe"] = frappe

source = Path(__file__).resolve().parents[1] / "saas_theme" / "language.py"
spec = importlib.util.spec_from_file_location("saas_language_under_test", source)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

available = mod.get_available_languages()
assert available["current"] == "en"
assert {item["code"] for item in available["languages"]} == set(enabled)

assert mod.set_user_language("ps") == {"language": "ps"}
assert users["alice@example.com"].language == "ps"
assert users["bob@example.com"].language == "en"
assert users["alice@example.com"].saved == ["ps"]
assert cache_clear == ["alice@example.com"]
assert mod.get_available_languages()["current"] == "ps"

# Selecting the current language is a no-op and does not alter user defaults.
assert mod.set_user_language("ps") == {"language": "ps"}
assert users["alice@example.com"].saved == ["ps"]
assert cache_clear == ["alice@example.com"]

for invalid in ("xx", "disabled", "", " " * 2, 123, None, "z" * 31):
    try:
        mod.set_user_language(invalid)
    except frappe.ValidationError:
        pass
    else:
        raise AssertionError(f"Invalid language accepted: {invalid!r}")
assert users["alice@example.com"].saved == ["ps"]

# Auth checks must occur before listing or writing any language.
frappe.session.user = "Guest"
for request in (mod.get_available_languages, lambda: mod.set_user_language("en")):
    try:
        request()
    except frappe.PermissionError:
        pass
    else:
        raise AssertionError("Guest language action was permitted")
assert users["bob@example.com"].saved == []

print("Language API passed: enabled options, self-only save, cache, no-op and guest denial.")

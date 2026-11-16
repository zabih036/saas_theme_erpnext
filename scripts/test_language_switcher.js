#!/usr/bin/env node
"use strict";
/* Language switcher integration checks without jsdom or a Frappe server. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "saas_theme/public/js/brand_shell.js"), "utf8");
const css = fs.readFileSync(path.join(root, "saas_theme/public/css/brand_shell.css"), "utf8");
const navbarCss = fs.readFileSync(
    path.join(root, "saas_theme/public/css/desktop_navbar_refinement.css"), "utf8"
);
new vm.Script(source);

function extract(start, end) {
    const i = source.indexOf("\tfunction " + start + "(");
    const j = source.indexOf("\n\tfunction " + end + "(", i);
    assert.ok(i >= 0 && j > i, "Missing language function " + start);
    return source.slice(i, j);
}

class Node {
    constructor() {
        this.children = [];
        this.events = {};
        this.attrs = {};
        this.classList = {
            values: new Set(),
            add: (value) => this.classList.values.add(value),
            contains: (value) => this.classList.values.has(value),
        };
    }
    setAttribute(k, v) { this.attrs[k] = v; }
    append(...items) { this.children.push(...items); }
    addEventListener(key, fn) { this.events[key] = fn; }
}

// Header: one globe button immediately before the existing bell, not a
// replacement for notification handlers; duplicate rerenders must be safe.
let inserted = 0;
const bell = {
    insertAdjacentElement(position, item) {
        assert.equal(position, "beforebegin");
        inserted++;
        this.before = item;
    },
};
const header = {
    querySelector(selector) {
        if (selector === ".st-home-language-button") return bell.before || null;
        if (selector === ".st-desktop-top-actions .desktop-notification-icon") return bell;
        return null;
    },
};
let opened = 0;
const makeDoc = () => ({
    querySelectorAll(selector) {
        assert.equal(selector, ".desktop-wrapper .desktop-navbar");
        return [header];
    },
    createElement: () => new Node(),
});
const headerFn = vm.runInNewContext(
    extract("ensure_home_language_button", "ensure_user_language_menu") +
    "\nensure_home_language_button;",
    {
        frappe: {session: {user: "alice@example.com"}},
        document: makeDoc(),
        current_language: () => "ps",
        language_icon: () => "<svg></svg>",
        open_language_picker: () => opened++,
        __: (label) => label,
    }
);
headerFn();
headerFn();
assert.equal(inserted, 1, "Home toolbar must not duplicate the language button");
assert.equal(bell.before.className, "st-home-language-button");
assert.equal(bell.before.children[1].textContent, "PS");
assert.equal(bell.before.attrs["aria-label"], "Change Language");
bell.before.events.click({preventDefault() {},stopPropagation() {}});
assert.equal(opened, 1);

// User menu: the same picker appears immediately AFTER Settings; unrelated
// menus must remain untouched, and reopening must not add duplicate rows.
let injected = 0;
let languageRow = null;
const settings = {
    textContent: "Settings",
    querySelector: () => ({textContent: "Settings"}),
    insertAdjacentElement(position, child) {
        assert.equal(position, "afterend");
        injected++;
        languageRow = child;
    },
};
const rows = [
    settings,
    {textContent: "Reload",querySelector: () => ({textContent: "Reload"})},
    {textContent: "Logout",querySelector: () => ({textContent: "Logout"})},
];
const menu = {
    querySelector(selector) {
        assert.equal(selector, ".st-language-user-menu-item");
        return languageRow;
    },
    querySelectorAll(selector) {
        assert.equal(selector, ".es-menu__item");
        return rows;
    },
};
const jquery = () => ({
    filter() { return this; },
    add() { return this; },
    find() { return this; },
    closest() { return this; },
    each(fn) { fn.call(menu); return this; },
});
const menuFn = vm.runInNewContext(
    extract("ensure_user_language_menu", "patch_sidebar_help_menu") +
    "\nensure_user_language_menu;",
    {
        $: jquery,
        document: {createElement: () => new Node()},
        language_icon: () => "<svg></svg>",
        open_language_picker: () => opened++,
        __: (label) => label,
    }
);
menuFn(menu);
menuFn(menu);
assert.equal(injected, 1, "Menu item must never duplicate on observer refresh");
assert.equal(languageRow.className, "es-menu__item st-language-user-menu-item");
assert.equal(languageRow.children[1].textContent, "Language");
languageRow.events.click({preventDefault() {},stopPropagation() {}});
assert.equal(opened, 2, "Both entry points must use the exact same picker");

// A successful server confirmation reloads the whole Desk; exceptions and
// malformed API responses must never trigger an unconfirmed refresh.
const saveSource = source.slice(
    source.indexOf("\tasync function save_user_language("),
    source.indexOf("\n\tasync function open_language_picker(")
);
assert.ok(saveSource.includes('method: "saas_theme.language.set_user_language"'));
let reloads = 0;
let APIResult = {message: {language: "fa"}};
const saveFn = vm.runInNewContext(saveSource + "\nsave_user_language;", {
    frappe: {call: async () => APIResult},
    window: {location: {reload: () => reloads++}},
});
(async () => {
    await saveFn("fa");
    assert.equal(reloads, 1);
    APIResult = {message: {language: "en"}};
    await assert.rejects(() => saveFn("ps"));
    assert.equal(reloads, 1);
    APIResult = null;
    await assert.rejects(() => saveFn("en"));
    assert.equal(reloads, 1);

    assert.ok(source.includes('method: "saas_theme.language.get_available_languages"'));
    assert.ok(source.includes('if (state.language_loading || state.language_dialog || state.language_saving) return'));
    assert.ok(source.includes('button.hidden = !!term'));
    assert.ok(source.includes("ensure_home_language_button();") &&
              source.includes("ensure_user_language_menu(root);"));

    assert.ok(navbarCss.includes(".st-home-language-button") &&
              navbarCss.includes("[data-theme=\"dark\"]"));
    assert.ok(css.includes(".st-language-picker-options") &&
              css.includes(".st-language-user-menu-item") &&
              css.includes(".st-language-picker-option[hidden]"));
    console.log("Language UI passed: header + menu placement, one shared picker and save/reload guards.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

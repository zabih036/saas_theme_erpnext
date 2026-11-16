#!/usr/bin/env node
"use strict";
/* Phase 4F late profile repair smoke checks (no Frappe server required). */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.join(__dirname, "..", "saas_theme/public/js/header_profile_repair.js"), "utf8"
);
new vm.Script(source);

const events = new Map();
const timers = [];
const afterAjax = [];
let observed = 0;
let observerCallback = null;
let repairPasses = 0;
const doc = {body: {}};
const win = {};
const frappe = {
    session: {user: "alice@example.com"},
    boot: {user: {full_name: "Alice Example"}},
    utils: {escape_html: (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")},
    avatar: () => '<span class="avatar">A</span>',
    app: {sidebar: {create_user_menu() {}}},
    after_ajax(fn) {afterAjax.push(fn);},
};

function jquery(arg) {
    if (typeof arg === "function") {
        arg();
        return undefined;
    }
    if (arg === doc || arg === win) {
        return {
            off() {return this;},
            on(names, callback) {
                names.split(/\s+/).forEach((name) => events.set(name, callback));
                return this;
            },
        };
    }
    if (arg === ".page-head:visible") {
        return {each() {repairPasses += 1; return this;}};
    }
    throw new Error("Unexpected jQuery input: " + String(arg));
}
class MutationObserverMock {
    constructor(callback) {observerCallback = callback;}
    observe(target, options) {
        assert.equal(target, doc.body);
        assert.equal(options.childList, true);
        assert.equal(options.subtree, true);
        observed += 1;
    }
}
let timerId = 0;
const context = {
    window: win, document: doc, frappe, $: jquery,
    __: (value) => value,
    MutationObserver: MutationObserverMock,
    setTimeout(fn, ms) {timers.push({id: ++timerId, fn, ms}); return timerId;},
    clearTimeout() {},
    console: {debug() {}},
};
vm.runInNewContext(source, context);
assert.equal(win.__saas_theme_ui_precision_v4__, true);
assert.equal(observed, 1);
assert.equal(repairPasses, 1, "startup must attempt to repair page headers");
assert.equal(afterAjax.length, 1, "late Frappe ajax work must be covered");
assert.equal(events.has("page-change.saas_ui_precision_v4"), true);
assert.equal(events.has("sidebar_setup.saas_ui_precision_v4"), true);
assert.equal(events.has("toolbar_setup.saas_ui_precision_v4"), true);
assert.equal(events.has("pageshow.saas_ui_precision_v4"), true);
assert.equal(events.has("resize.saas_ui_precision_v4"), true);

events.get("page-change.saas_ui_precision_v4")();
assert.equal(timers.at(-1).ms, 10, "route refresh retains original 10ms delay");
timers.at(-1).fn();
assert.ok(timers.some((item) => item.ms === 100));
assert.ok(timers.some((item) => item.ms === 350));
const before = timers.length;
observerCallback([{addedNodes: [{nodeType: 1, matches: () => true}]}]);
assert.equal(timers.length, before + 1);
assert.equal(timers.at(-1).ms, 30, "DOM refresh retains original 30ms debounce");
afterAjax[0]();
assert.equal(timers.at(-1).ms, 10, "after-Ajax refresh stays connected");

vm.runInNewContext(source, context);
assert.equal(observed, 1, "original sentinel prevents two observers");
assert.equal(afterAjax.length, 1, "original sentinel prevents duplicate listeners");

/* Verify original avatar output and XSS-safe initials fallback independently. */
const start = source.indexOf("\tfunction escape_html(");
const end = source.indexOf("\n\tfunction ensure_utility_container(", start);
assert.ok(start >= 0 && end > start);
const helpers = source.slice(start, end) + "\nprofile_avatar_html;";
const avatar = vm.runInNewContext(helpers, {frappe, __: (v) => v});
assert.equal(avatar(), '<span class="avatar">A</span>');
const fallback = vm.runInNewContext(helpers, {
    frappe: {
        avatar: () => null,
        session: {user: "<script@example.com>"},
        boot: {},
        utils: {escape_html: (s) => String(s).replace(/</g, "&lt;")},
    },
    __: (v) => v,
});
assert.match(fallback(), /&lt;/);
assert.ok(!fallback().includes("<script"));

for (const marker of [
    'frappe.app?.sidebar', 'sidebar.create_user_menu({',
    'if (!$profile.length)', 'if (!$button.length)',
    'frappe.session?.user === "Guest"',
    'st-v4-user-menu-ready', 'st-user-menu-ready',
    'appendTo($utilities)', 'visibility: "visible"',
]) {
    assert.ok(source.includes(marker), "Header/profile behavior lost: " + marker);
}
console.log("Phase 4F header/profile passes: startup, routes, observers, timing, avatar, dedup.");

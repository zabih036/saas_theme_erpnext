#!/usr/bin/env node
"use strict";

/*
 * Dependency-free smoke test for the late-loaded Frappe v16 stability controller.
 * Exercises startup, native sidebar patching, route event passes, and the
 * original 90ms / 320ms recovery schedule without a live ERPNext instance.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptPath = path.join(__dirname, "..", "saas_theme", "public", "js", "stability_refinement_v3.js");
const source = fs.readFileSync(scriptPath, "utf8");

function makeHarness(isMobile = false) {
    let now = 0;
    let nextTimer = 1;
    const timers = [];
    const handlers = new Map();
    const calls = [];
    const afterAjax = [];
    const log = (name) => calls.push([name, now]);
    const style = () => ({
        overflow: "hidden",
        overflowY: "hidden",
        removeProperty(property) {
            if (property === "overflow") this.overflow = "";
            if (property === "overflow-y") this.overflowY = "";
        },
    });

    const layout = { kind: "layout" };
    const main = { style: style() };
    const doc = {
        body: { style: style() },
        documentElement: { style: style() },
        querySelector() { return null; },
    };
    const win = { saas_theme: { mobile_shell: { refresh() { log("mobile_refresh"); } } } };
    const tabs = { length: 1, first() { return this; }, is() { return true; },
        find() { return { length: 1 }; } };

    function jquery(value) {
        if (typeof value === "function") {
            value();
            return;
        }
        if (value === doc || value === win) {
            return {
                off() { return this; },
                on(names, callback) {
                    for (const name of names.split(/\s+/)) handlers.set(name, callback);
                    return this;
                },
            };
        }
        if (value === layout) {
            return {
                find() { return tabs; },
                toggleClass(name, enabled) {
                    assert.equal(name, "st-section-card-form");
                    assert.equal(enabled, true);
                    log("classify");
                    return this;
                },
            };
        }
        if (value === ".form-layout") {
            return { each(callback) { callback.call(layout); return this; } };
        }
        if (value === ".main-section") {
            return { each(callback) { log("scroll_check"); callback.call(main); return this; } };
        }
        if (typeof value === "string" && value.startsWith(".page-head")) {
            const isHiddenControl = value.includes("sidebar-toggle-btn") || value.includes("more-button");
            return {
                attr() { return this; },
                hide() { if (isHiddenControl) log("header_hide"); return this; },
                css() { return this; },
                removeClass() { return this; },
            };
        }
        throw Error("Unexpected jQuery query: " + String(value));
    }

    function schedule(fn, delay) {
        const id = nextTimer++;
        timers.push({ id, at: now + delay, fn, canceled: false });
        return id;
    }
    function clear(id) {
        const item = timers.find((entry) => entry.id === id);
        if (item) item.canceled = true;
    }
    function advanceTo(target) {
        while (true) {
            const ready = timers.filter((entry) => !entry.canceled && entry.at <= target)
                .sort((a, b) => a.at - b.at || a.id - b.id)[0];
            if (!ready) break;
            ready.canceled = true;
            now = ready.at;
            ready.fn();
        }
        now = target;
    }

    function Sidebar() {}
    Sidebar.prototype.set_height = function () { log("set_height_original"); };
    Sidebar.prototype.prevent_scroll = function () { log("prevent_scroll_original"); };
    const frappe = {
        is_mobile() { return isMobile; },
        ui: { Sidebar },
        app: { sidebar: { sidebar_expanded: false } },
        after_ajax(callback) { afterAjax.push(callback); },
    };
    const context = {
        document: doc,
        window: win,
        frappe,
        $: jquery,
        setTimeout: schedule,
        clearTimeout: clear,
        setInterval() { return nextTimer++; },
        clearInterval() {},
    };

    vm.runInNewContext(source, context, { filename: scriptPath });
    return { context, win, doc, main, calls, handlers, afterAjax, advanceTo, Sidebar };
}

function times(harness, label) {
    return harness.calls.filter(([name]) => name === label).map(([, t]) => t);
}

const desktop = makeHarness();
assert.deepEqual(times(desktop, "classify"), [0], "startup should classify forms once");
assert.deepEqual(times(desktop, "scroll_check"), [0], "startup should inspect scroll locks once");
assert.equal(desktop.doc.body.style.overflow, "", "startup should release desktop scroll lock");
assert.equal(desktop.main.style.overflowY, "", "startup should release main-section lock");
assert.equal(typeof desktop.Sidebar.prototype.__saas_theme_scroll_stability_v3, "boolean");
assert.equal(desktop.Sidebar.prototype.__saas_theme_scroll_stability_v3, true);

const routeHandler = desktop.handlers.get("page-change.saas_stability_v3");
assert.equal(typeof routeHandler, "function", "page-change handler should remain wired");
routeHandler();
desktop.advanceTo(5);
desktop.advanceTo(95);
desktop.advanceTo(325);
assert.deepEqual(times(desktop, "classify"), [0, 5, 95, 325],
    "route refresh and both delayed passes must run at original times");
assert.deepEqual(times(desktop, "scroll_check"), [0, 5, 95, 325]);
assert.deepEqual(times(desktop, "header_hide"), [0, 0, 5, 5, 95, 95, 325, 325]);
assert.deepEqual(times(desktop, "mobile_refresh"), [0, 5, 95, 325]);

desktop.doc.body.style.overflow = "hidden";
desktop.Sidebar.prototype.prevent_scroll();
assert.equal(desktop.doc.body.style.overflow, "",
    "desktop patched prevent_scroll should not lock the body");
assert.equal(times(desktop, "prevent_scroll_original").length, 0,
    "desktop should preserve the deliberate bypass of Frappe prevent_scroll");
desktop.Sidebar.prototype.set_height();
assert.equal(times(desktop, "set_height_original").length, 1,
    "set_height must still call Frappe's original implementation");

const handlerCount = desktop.handlers.size;
vm.runInNewContext(source, desktop.context, { filename: scriptPath });
assert.equal(desktop.handlers.size, handlerCount,
    "repeat loading must be blocked by the existing sentinel");

const mobile = makeHarness(true);
mobile.Sidebar.prototype.prevent_scroll();
assert.equal(times(mobile, "prevent_scroll_original").length, 1,
    "mobile must still call Frappe's original prevent_scroll");
assert.equal(mobile.doc.body.style.overflow, "hidden",
    "mobile open drawer scroll lock must not be cleared");

console.log("Stability controller smoke tests passed (desktop, mobile, route, timers).");

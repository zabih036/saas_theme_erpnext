#!/usr/bin/env node
"use strict";
// Exercise the unchanged child-table controller as Frappe users encounter it:
// Configure Columns, child-row editor tags, route reopen, events and reinit.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const src = fs.readFileSync(
    path.join(__dirname, "../saas_theme/public/js/child_table_ui.js"), "utf8"
);
new vm.Script(src);

class FakeElement {
    constructor() {
        const flags = new Set();
        this.classList = {
            add: (name) => flags.add(name),
            contains: (name) => flags.has(name),
        };
        this.children = [];
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    matches() { return false; }
}
const header = new FakeElement();
header.classList.add("row");
const gridRow = new FakeElement();
const selected = new FakeElement();
selected.closest = (selector) => selector === ".form-group" ? { children: [header] } : null;
selected.querySelectorAll = (selector) => selector === ".fields_order" ? [gridRow] : [];
const title = { textContent: "Configure Columns" };
const dialog = new FakeElement();
dialog.querySelector = (selector) => selector === ".modal-title" ? title :
    selector === ".selected-fields" ? selected : null;
const unrelatedDialog = new FakeElement();
unrelatedDialog.querySelector = (selector) =>
    selector === ".modal-title" ? { textContent: "Purchase Invoice" } : null;
const editor = new FakeElement();
const doc = {
    body: {nodeType:1},
    querySelectorAll(selector) {
        if(selector === ".modal") return [dialog, unrelatedDialog];
        if(selector === ".grid-row-open .form-in-grid") return [editor];
        return [];
    }
};
const events = new Map();
let observer = null;
const scheduled = [];
const $ = (value) => {
    if(typeof value === "function") { value(); return; }
    return {
        off() { return this; },
        on(event, ...args) {
            events.set(event, args[args.length - 1]);
            return this;
        },
    };
};
class FakeObserver {
    constructor(fn) { this.fn = fn; observer = this; }
    observe(body, options) { this.body = body; this.options = options; }
}
const frappe = { after_ajax(fn) { this.callback = fn; } };
const window = {};
const context = {
    window, document: doc, Element: FakeElement, MutationObserver: FakeObserver,
    $, frappe, __: (v) => v,
    setTimeout: (fn, ms) => { scheduled.push({fn,ms}); return scheduled.length; },
    clearTimeout: () => {},
    console,
};
vm.createContext(context);
vm.runInContext(src, context);
assert.equal(window.__saas_theme_child_table_precision_v5__, true);
assert.equal(dialog.classList.contains("st-grid-config-modal"), true);
assert.equal(header.classList.contains("st-grid-config-header"), true);
assert.equal(gridRow.classList.contains("st-grid-config-row"), true);
assert.equal(editor.classList.contains("st-grid-row-editor"), true);
assert.equal(unrelatedDialog.classList.contains("st-grid-config-modal"), false);
assert.ok(observer && observer.options.subtree && observer.options.childList);
assert.ok(events.has("click.saas_child_table_v5"));
assert.ok(events.has("page-change.saas_child_table_v5"));
const click = events.get("click.saas_child_table_v5");
click();
assert.deepEqual(scheduled.slice(-3).map(x=>x.ms),[0,40,140]);
events.get("page-change.saas_child_table_v5")();
assert.equal(scheduled.at(-1).ms,20);
frappe.callback();
assert.equal(scheduled.at(-1).ms,10);
const added = new FakeElement();
added.matches = (selector) => selector.includes(".modal");
observer.fn([{type:"childList",addedNodes:[added]}]);
assert.equal(scheduled.at(-1).ms,0);
const before = scheduled.length;
vm.runInContext(src, context);
assert.equal(scheduled.length, before, "Duplicate controller injection must be a no-op");
console.log("Child-table runtime passed: Configure Columns, row editor, events, timing and init guard.");

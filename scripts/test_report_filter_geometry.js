#!/usr/bin/env node
"use strict";
/* Regression test: Frappe DataTable must own report filter-column widths. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "saas_theme/public/js/ui_precision_v6_2.js"), "utf8");
const css6 = fs.readFileSync(path.join(root, "saas_theme/public/css/control_search_report.css"), "utf8");
const css62 = fs.readFileSync(path.join(root, "saas_theme/public/css/ui_precision_v6_2.css"), "utf8");

function declarations(css, selector) {
    // Later scoped override wins; the earlier combined selector has no padding reset.
    const start = css.lastIndexOf(selector + " {");
    assert.ok(start >= 0, "Missing " + selector);
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    assert.ok(close > open, "Malformed " + selector);
    return css.slice(open + 1, close);
}
const contentSelector = "#page-query-report .report-wrapper .dt-row-filter .dt-cell__content";
for (const [name, css] of [["v6", css6], ["v6.2", css62]]) {
    assert.doesNotMatch(declarations(css, contentSelector),
        /(?:^|[;\n])\s*(?:min-width|max-width|width)\s*:/,
        name + " must not override native DataTable column widths");
}
// The same selector also appears in a combined dark-mode rule. Assert the
// explicit padding-reset declaration, not the first/last unrelated block.
assert.match(css62,
    /#page-query-report \.report-wrapper \.dt-row-filter > \.dt-cell\s*\{\s*padding\s*:\s*0\s*!important/,
    "Outer filter cell must have zero padding");
assert.ok(!js.includes("function sync_filter_cell("), "Old width synchronizer must not return");

const functionStart = js.indexOf("\tfunction restore_native_filter_geometry(");
const functionEnd = js.indexOf("\n\tfunction refresh()", functionStart);
assert.ok(functionStart > 0 && functionEnd > functionStart, "Report filter controller missing");
const implementation = js.slice(functionStart, functionEnd);

class FakeStyle {
    constructor(initial = {}) {
        this.values = new Map();
        this.writes = [];
        for (const [property, value] of Object.entries(initial)) {
            this.setProperty(property, value, "important");
        }
        this.writes = [];
    }
    setProperty(property, value, priority = "") {
        this.values.set(property, {value, priority});
        this.writes.push({property, value, priority});
    }
    getPropertyPriority(property) { return this.values.get(property)?.priority || ""; }
    removeProperty(property) { this.values.delete(property); }
}
function makeColumn(index, title, stale = true) {
    const cellStyle = new FakeStyle(stale ? {
        width: "130px", "min-width": "130px",
        "max-width": "130px", "flex-basis": "130px"
    } : {});
    const contentStyle = new FakeStyle(stale ? {
        width: "100%", "max-width": "100%", "box-sizing": "border-box"
    } : {});
    const inputStyle = new FakeStyle(stale ? {
        display: "block", width: "100%",
        "min-width": "0", "max-width": "none", "box-sizing": "border-box"
    } : {});
    const classes = new Set();
    const attributes = {"data-col-index": String(index)};
    const cell = {
        style: cellStyle,
        classList: {
            toggle(name, enabled) {
                if (enabled) classes.add(name);
                else classes.delete(name);
            }
        },
        querySelector(selector) {
            assert.equal(selector, ".dt-cell__content");
            return {style: contentStyle};
        }
    };
    const input = {
        style: inputStyle,
        getAttribute(name) { return attributes[name] ?? null; },
        setAttribute(name, value) { attributes[name] = String(value); },
        closest(selector) { assert.equal(selector, ".dt-cell"); return cell; }
    };
    const header = {
        textContent: title,
        getAttribute(name) {
            assert.equal(name, "data-col-index");
            return String(index);
        }
    };
    return {index, cell, input, header, classes, attributes, cellStyle, contentStyle, inputStyle};
}

const index = makeColumn(0, "#");
const date = makeColumn(1, "Date");
const item = makeColumn(2, "Item Name");
const warehouse = makeColumn(3, "Warehouse", false);
const headers = [warehouse.header, date.header, index.header, item.header];
const inputs = [item.input, index.input, warehouse.input, date.input];
const table = {
    querySelectorAll(selector) {
        if (selector === ".dt-row-header .dt-cell[data-col-index]") return headers;
        if (selector === ".dt-row-filter input.dt-filter[data-col-index]") return inputs;
        throw Error("Unexpected table selector: " + selector);
    }
};
const doc = {
    querySelectorAll(selector) {
        assert.equal(selector, "#page-query-report .report-wrapper .datatable");
        return [table];
    }
};
const context = {
    document: doc,
    clean_text: (str) => String(str).trim(),
    __: (text, args) => text.replace("{0}", args?.[0] ?? "")
};
vm.runInNewContext(implementation + "\nrepair_report_filter_row();", context);

for (const col of [date, item, index, warehouse]) {
    for (const prop of ["width", "min-width", "max-width", "flex-basis"]) {
        assert.equal(col.cellStyle.getPropertyPriority(prop), "",
            "Old outer-cell " + prop + " override remains in " + col.index);
    }
    for (const prop of ["width", "max-width", "box-sizing"]) {
        assert.equal(col.contentStyle.getPropertyPriority(prop), "",
            "Old content " + prop + " override remains in " + col.index);
    }
    for (const prop of ["width", "min-width", "max-width", "box-sizing", "display"]) {
        assert.equal(col.inputStyle.getPropertyPriority(prop), "",
            "Old input " + prop + " override remains in " + col.index);
    }
    assert.equal(col.cellStyle.writes.length, 0, "Unexpected fixed cell width");
    assert.equal(col.contentStyle.writes.length, 0, "Unexpected fixed content width");
    assert.equal(col.inputStyle.writes.length, 0, "Unexpected forced filter input style");
}
assert.ok(index.classes.has("st-v62-filter-utility"), "Utility filter must be hidden via CSS");
for (const col of [date, item, warehouse]) {
    assert.ok(!col.classes.has("st-v62-filter-utility"), "Real columns remain filterable");
    assert.equal(col.attributes.placeholder, "Filter");
    assert.equal(col.attributes["aria-label"], "Filter " + col.header.textContent);
}
vm.runInNewContext(implementation + "\nrepair_report_filter_row();", context);
assert.equal(date.cellStyle.writes.length, 0);
assert.equal(item.contentStyle.writes.length, 0);
console.log("Report filter geometry passed: native widths, no drift, correct filter targets.");

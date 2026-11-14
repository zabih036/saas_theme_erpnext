#!/usr/bin/env node
/* Native v16 Grid integration contract with mock Form/Grid controllers.
 * The new fallback adds the native .grid-row-check input only when absent.
 * It does NOT replace Frappe's delegated Grid.setup_check listener.
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(
	path.resolve(__dirname, "../saas_theme/public/js/grid_row_selection_repair.js"), "utf8"
);

function fixture({ editable = true, cannotDelete = false, existing = false } = {}) {
	const created = [];
	const mockClass = () => {
		const classes = new Set();
		return {
			add(name) { classes.add(name); },
			remove(name) { classes.delete(name); },
			contains(name) { return classes.has(name); },
		};
	};
	const makeCell = () => {
		let native = existing ? { className: "grid-row-check", type: "checkbox" } : null;
		const cell = {
			classList: { contains: () => false },
			querySelector(query) {
				if (query === "input.grid-row-check") return native;
				if (query === 'input[type="checkbox"]') return native;
				return null;
			},
			appendChild(input) { native = input; created.push(input); },
			get native() { return native; },
		};
		return cell;
	};
	const header = makeCell();
	const cell = makeCell();
	const doc = { name: "row-1", idx: 3, __checked: 1 };
	const row = {
		dataset: { name: "row-1" },
		getAttribute: name => ({ "data-name": "row-1", "data-idx": "3" })[name] || null,
		querySelector: selector => selector === ".data-row > .row-check:not(.search)" ? cell : null,
	};
	const control = { getAttribute: key => key === "data-fieldname" ? "children" : null };
	const formGrid = {
		classList: mockClass(),
		closest: () => control,
		querySelector: selector => selector === ".grid-heading-row .row-check:not(.search)" ? header : null,
		querySelectorAll: selector => selector === ".grid-body .grid-row[data-name]" ? [row] : [],
	};
	const grid = {
		is_editable: () => editable,
		df: { cannot_delete_rows: cannotDelete },
		display_status: "Write",
		wrapper: [{ contains: e => e === formGrid }],
		remove_rows_button: { length: 1 },
		grid_rows_by_docname: { "row-1": { doc, select(checked) { doc.__checked = checked ? 1 : 0; } } },
	};
	const $ = value => {
		if (typeof value === "function") { value(); return; }
		return {
			off() { return this; },
			on() { return this; },
		};
	};
	const document = {
		body: null, // no observer: exercise explicit refresh
		querySelectorAll: selector => selector === ".form-grid" ? [formGrid] : [],
		createElement: tag => ({
			tagName: tag.toUpperCase(),
			attrs: {},
			setAttribute(name, value) { this.attrs[name] = value; },
		}),
	};
	const frappe = {
		after_ajax: null,
		session: { user: "admin@example.com" },
	};
	const window = {
		cur_frm: { fields_dict: { children: { grid } } },
	};
	const ctx = { window, frappe, document, $, setTimeout, clearTimeout, console, __: (text, params) => text.replace("{0}", String(params?.[0] || "")) };
	new vm.Script(source, { filename: "grid_row_selection_repair.js" }).runInNewContext(ctx);
	const refresh = window.saas_theme.grid_row_selection.refresh;
	return { refresh, formGrid, grid, doc, header, cell, created };
}

const good = fixture();
good.refresh();
assert.equal(good.formGrid.classList.contains("st-grid-row-selection-ready"), true);
assert.equal(good.header.native.type, "checkbox", "header native select-all restored");
assert.equal(good.cell.native.type, "checkbox", "row native selector restored");
assert.equal(good.cell.native.className, "grid-row-check st-repaired-grid-row-check");
assert.equal(good.cell.native.checked, true, "native doc.__checked preserved");
assert.equal(good.cell.native.attrs["aria-label"], "Select row 3");
assert.equal(good.created.length, 2);
good.refresh();
assert.equal(good.created.length, 2, "repeat refresh does not duplicate native checkboxes");
good.grid.grid_rows_by_docname["row-1"].select(false);
assert.equal(good.doc.__checked, 0, "Frappe model selection still owned by native row");

const withNative = fixture({ existing: true });
withNative.refresh();
assert.equal(withNative.created.length, 0, "existing native checkboxes untouched");

const readonly = fixture({ editable: false });
readonly.refresh();
assert.equal(readonly.created.length, 0, "read-only Grid cannot get selectable controls");
assert.equal(readonly.formGrid.classList.contains("st-grid-row-selection-ready"), false);

const noDelete = fixture({ cannotDelete: true });
noDelete.refresh();
assert.equal(noDelete.created.length, 0, "cannot_delete_rows still restricts selection");

console.log("Frappe Grid native row selection fallback: read/write, permission, idempotence and model tests passed.");

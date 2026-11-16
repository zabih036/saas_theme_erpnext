#!/usr/bin/env node
"use strict";

// Regression coverage for Frappe v16 Journal Entry inline-grid Currency fields.
// Checks field visibility repair, permissions, scope, and idempotence without Frappe.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
	path.join(__dirname, "../saas_theme/public/js/interaction_finish_v2.js"),
	"utf8"
);
new vm.Script(source);

const name = "function repairJournalEntryAmountColumns() {";
const begin = source.indexOf(name);
const end = source.indexOf("\n\tfunction scan()", begin);
assert.ok(begin !== -1 && end > begin, "Expected the repair in the canonical interaction controller");
const implementation = source.slice(begin, end);

function simulate({
	doctype = "Journal Entry",
	docstatus = 0,
	reversal_of = "",
	editable = true,
	inline = true,
	visible = ["debit_in_account_currency", "credit_in_account_currency"],
	hidden = ["debit_in_account_currency", "credit_in_account_currency"],
	dependent = [],
	read_only = [],
} = {}) {
	const columns_list = visible.map((fieldname) => ({
		df: {
			fieldname,
			hidden: Number(hidden.includes(fieldname)),
			hidden_due_to_dependency: Number(dependent.includes(fieldname)),
			read_only: Number(read_only.includes(fieldname)),
		},
	}));
	const calls = [];
	const grid = {
		is_editable: () => editable,
		allow_on_grid_editing: () => inline,
		visible_columns: visible.map((fieldname) => [{ fieldname }, 100]),
		grid_rows: [{ doc: { name: "test-row" }, columns_list }],
		toggle_display(fieldname, show) {
			calls.push([fieldname, show]);
			columns_list
				.filter((column) => column.df.fieldname === fieldname)
				.forEach((column) => { column.df.hidden = Number(!show); });
		},
	};
	const sandbox = {
		window: {
			cur_frm: {
				doctype,
				doc: { docstatus, reversal_of },
				fields_dict: { accounts: { grid } },
			},
		},
	};
	vm.runInNewContext(
		implementation + "\nrepairJournalEntryAmountColumns();\nrepairJournalEntryAmountColumns();",
		sandbox
	);
	return calls;
}

const amounts = ["debit_in_account_currency", "credit_in_account_currency"];
assert.deepEqual(simulate(), amounts.map((field) => [field, true]), "Repair only once");
assert.deepEqual(simulate({ hidden: [] }), [], "Healthy grid is untouched");
assert.deepEqual(simulate({ doctype: "Purchase Invoice" }), [], "Other doctypes are untouched");
assert.deepEqual(simulate({ docstatus: 1 }), [], "Submitted documents are unchanged");
assert.deepEqual(simulate({ reversal_of: "ACC-JV-123" }), [], "Reversals remain locked");
assert.deepEqual(simulate({ editable: false }), [], "Grid permissions are respected");
assert.deepEqual(simulate({ inline: false }), [], "Inline-edit settings are respected");
assert.deepEqual(simulate({ visible: ["account"] }), [], "Hidden/unselected columns are respected");
assert.deepEqual(
	simulate({ hidden: [amounts[0]] }),
	[[amounts[0], true]],
	"Only the stale amount column is repaired"
);
assert.deepEqual(simulate({ dependent: amounts }), [], "Dependency-driven visibility is respected");
assert.deepEqual(simulate({ read_only: amounts }), [], "Read-only settings are respected");
console.log("Journal Entry amount-grid visibility regression checks passed.");

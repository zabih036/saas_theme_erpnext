/*
 * Frappe v16 Grid row-select visibility repair.
 *
 * Not a replacement selector or delete controller: the native delegated
 * Grid.setup_check() handler owns .grid-row-check, doc.__checked and the
 * Delete row / Delete N rows actions. We repair only missing checkbox
 * markup after a grid re-render, and never touch read-only/denied grids.
 */
(() => {
	"use strict";
	if (typeof frappe === "undefined" || window.__st_grid_row_selection_repair) return;
	window.__st_grid_row_selection_repair = true;

	const ELIGIBLE_FIELD = '.frappe-control[data-fieldtype="Table"], .frappe-control[data-fieldtype="Table MultiSelect"]';
	let observer = null;
	let pending = null;

	function eligibleGrid(element) {
		const control = element.closest(ELIGIBLE_FIELD);
		const fieldname = control?.getAttribute("data-fieldname");
		const frm = window.cur_frm;
		if (!control || !fieldname || !frm?.fields_dict) return null;
		const grid = frm.fields_dict[fieldname]?.grid;
		if (!grid || typeof grid.is_editable !== "function" || !grid.is_editable()) return null;
		if (grid.df?.cannot_delete_rows || grid.display_status !== "Write") return null;
		if (!grid.wrapper?.[0]?.contains(element)) return null;
		if (!grid.grid_rows_by_docname || !grid.remove_rows_button?.length) return null;
		return grid;
	}

	function ensureCheckbox(container, grid, row, label) {
		if (!container || container.querySelector("input.grid-row-check")) return false;
		// Never change a filter/search row, header placeholder, or a native
		// custom checkbox. Only fill a genuinely missing native selector.
		if (container.classList.contains("search") || container.querySelector('input[type="checkbox"]')) return false;
		const input = document.createElement("input");
		input.type = "checkbox";
		input.className = "grid-row-check st-repaired-grid-row-check";
		input.tabIndex = -1;
		if (row) {
			const docname = row.getAttribute("data-name");
			const nativeRow = grid.grid_rows_by_docname[docname];
			if (!docname || !nativeRow?.doc) return false;
			input.checked = !!nativeRow.doc.__checked;
			const number = row.getAttribute("data-idx") || nativeRow.doc.idx;
			input.setAttribute("aria-label", __("Select row {0}", [number]));
		} else {
			input.setAttribute("aria-label", __("Select all rows"));
		}
		// The wrapper already delegates input.grid-row-check clicks to
		// Grid.setup_check(); no additional click/selection/deletion handler.
		container.appendChild(input);
		return true;
	}

	function enhanceGrid(formGrid) {
		const grid = eligibleGrid(formGrid);
		if (!grid) {
			formGrid.classList.remove("st-grid-row-selection-ready");
			return;
		}

		formGrid.classList.add("st-grid-row-selection-ready");
		const heading = formGrid.querySelector(".grid-heading-row .row-check:not(.search)");
		if (heading) ensureCheckbox(heading, grid, null, "all");

		formGrid.querySelectorAll(".grid-body .grid-row[data-name]").forEach(row => {
			const nativeRow = grid.grid_rows_by_docname[row.dataset.name];
			if (!nativeRow?.doc) return;
			let cell = row.querySelector(".data-row > .row-check:not(.search)");
			if (!cell) cell = row.querySelector(".row-check:not(.search)");
			if (!cell) {
				const group = row.querySelector(".data-row");
				const index = group?.querySelector(".row-index");
				if (!group || !index) return; // Frappe's template-only row
				cell = document.createElement("div");
				cell.className = "row-check sortable-handle col";
				group.insertBefore(cell, index);
			}
			ensureCheckbox(cell, grid, row);
		});
	}

	function refresh() {
		document.querySelectorAll(".form-grid").forEach(enhanceGrid);
	}

	function schedule() {
		if (pending !== null) return;
		pending = setTimeout(() => {
			pending = null;
			refresh();
		}, 45);
	}

	function related(record) {
		const el = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
		if (!el?.closest?.(".form-grid")) {
			return Array.from(record.addedNodes || []).some(node =>
				node.nodeType === 1 && (node.matches?.(".form-grid") || node.querySelector?.(".form-grid"))
			);
		}
		// Inserting our own repaired checkbox is an expected, terminal
		// mutation. Do not schedule again for those nodes.
		return Array.from(record.addedNodes || []).some(node =>
			node.nodeType === 1 && !node.classList?.contains("st-repaired-grid-row-check")
		) || Array.from(record.removedNodes || []).some(node =>
			node.nodeType === 1 && !node.classList?.contains("st-repaired-grid-row-check")
		);
	}

	function start() {
		refresh();
		if (!observer && document.body && typeof MutationObserver !== "undefined") {
			observer = new MutationObserver(records => {
				if (records.some(related)) schedule();
			});
			observer.observe(document.body, { childList: true, subtree: true });
		}
	}

	$(document)
		.off("page-change.st-grid-row-selection sidebar_setup.st-grid-row-selection")
		.on("page-change.st-grid-row-selection sidebar_setup.st-grid-row-selection", schedule);
	$(function () {
		start();
		if (typeof frappe.after_ajax === "function") frappe.after_ajax(schedule);
	});

	// Explicit diagnostic to distinguish permission/read-only from a
	// missing rendered selector in the live browser.
	window.saas_theme = window.saas_theme || {};
	window.saas_theme.grid_row_selection = { refresh };
})();

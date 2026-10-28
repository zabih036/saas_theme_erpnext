/*
 * SaaS Theme — Child Table Precision v5 runtime helpers.
 *
 * Only tags Frappe's Configure Columns dialog and visible child-row editor so
 * the final CSS can be exact without touching unrelated dialogs/components.
 */
(function () {
	"use strict";

	if (window.__saas_theme_child_table_precision_v5__) return;
	window.__saas_theme_child_table_precision_v5__ = true;

	const state = {
		observer: null,
		timer: null,
	};

	function normalize_text(value) {
		return String(value || "")
			.replace(/\s+/g, " ")
			.trim();
	}

	function configure_columns_title() {
		try {
			return normalize_text(__("Configure Columns"));
		} catch (e) {
			return "Configure Columns";
		}
	}

	function tag_configure_columns_dialog(modal) {
		if (!(modal instanceof Element)) return;

		const title = normalize_text(modal.querySelector(".modal-title")?.textContent);
		const expected = configure_columns_title();
		if (title !== expected && title !== "Configure Columns") return;

		modal.classList.add("st-grid-config-modal");

		const selected_fields = modal.querySelector(".selected-fields");
		if (!selected_fields) return;

		const form_group = selected_fields.closest(".form-group");
		if (form_group) {
			const header = Array.from(form_group.children).find(
				(child) => child.classList?.contains("row")
			);
			header?.classList.add("st-grid-config-header");
		}

		selected_fields.querySelectorAll(".fields_order").forEach((row) => {
			row.classList.add("st-grid-config-row");
		});
	}

	function tag_grid_row_editors(root = document) {
		root.querySelectorAll?.(".grid-row-open .form-in-grid").forEach((editor) => {
			editor.classList.add("st-grid-row-editor");
		});
	}

	function refresh(root = document) {
		root.querySelectorAll?.(".modal").forEach(tag_configure_columns_dialog);
		tag_grid_row_editors(root);
		// A newly-added subtree may live under an existing modal/editor.
		if (root instanceof Element) {
			const modal = root.closest?.(".modal");
			if (modal) tag_configure_columns_dialog(modal);
			const editor = root.closest?.(".grid-row-open .form-in-grid");
			if (editor) editor.classList.add("st-grid-row-editor");
		}
	}

	function schedule(delay = 0) {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => refresh(document), delay);
	}

	function observe() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver((mutations) => {
			let needs_refresh = false;
			for (const mutation of mutations) {
				if (mutation.type !== "childList" || !mutation.addedNodes.length) continue;
				for (const node of mutation.addedNodes) {
					if (!(node instanceof Element)) continue;
					if (
						node.matches?.(".modal, .form-in-grid, .fields_order") ||
						node.querySelector?.(".modal, .form-in-grid, .fields_order")
					) {
						needs_refresh = true;
						break;
					}
				}
				if (needs_refresh) break;
			}
			if (needs_refresh) schedule(0);
		});
		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	$(document)
		.off("click.saas_child_table_v5")
		.on("click.saas_child_table_v5", ".grid-settings, .btn-open-row", () => {
			schedule(0);
			setTimeout(() => refresh(document), 40);
			setTimeout(() => refresh(document), 140);
		});

	$(document)
		.off("page-change.saas_child_table_v5")
		.on("page-change.saas_child_table_v5", () => schedule(20));

	$(function () {
		refresh(document);
		observe();
		if (typeof frappe !== "undefined" && typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule(10));
		}
	});
})();

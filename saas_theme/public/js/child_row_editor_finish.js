/*
 * SaaS Theme — Child Row Editor Finish helpers
 *
 * Keeps Frappe's Link Selector usable when it is launched from an expanded
 * child-table row and adds precise classes for the final theme layer.
 */
(function () {
	"use strict";

	if (window.__saas_theme_child_row_editor_finish__) return;
	window.__saas_theme_child_row_editor_finish__ = true;

	const state = {
		observer: null,
		install_timer: null,
	};

	function unwrap(value) {
		if (!value) return null;
		if (value.jquery) return value.get(0) || null;
		return value instanceof Element ? value : null;
	}

	function target_element(target) {
		return (
			unwrap(target?.$wrapper) ||
			unwrap(target?.wrapper) ||
			unwrap(target?.$input_area) ||
			unwrap(target?.input_area) ||
			unwrap(target?.$input)
		);
	}

	function target_is_in_open_grid_row(target) {
		const element = target_element(target);
		if (element?.closest?.(".grid-row-open .form-in-grid")) return true;

		// Grid-row controls have a child document with a parentfield. Keep this as
		// a fallback for controls whose wrapper is temporarily detached/rebuilt.
		return Boolean(
			target?.doc?.parentfield && document.querySelector(".grid-row-open .form-in-grid")
		);
	}

	function mark_latest_backdrop() {
		const backdrops = Array.from(document.querySelectorAll(".modal-backdrop.show"));
		const latest = backdrops[backdrops.length - 1];
		latest?.classList.add("st-grid-link-selector-backdrop");
	}

	function decorate_link_selector(selector) {
		if (!selector?.dialog || !target_is_in_open_grid_row(selector.target)) return;

		// Frappe Dialog normally closes any open grid-row form when the dialog is
		// hidden. A Link Selector launched from a field inside that row must instead
		// return the user to the same row after a value is selected.
		selector.dialog.keep_grid_form_open = true;

		const $wrapper = selector.dialog.$wrapper;
		if (!$wrapper?.length) return;

		$wrapper.addClass("st-grid-link-selector");
		$wrapper
			.off("shown.bs.modal.stGridLinkSelector")
			.on("shown.bs.modal.stGridLinkSelector", () => {
				$wrapper.addClass("st-grid-link-selector");
				mark_latest_backdrop();
			});

		// show() may already have started by the time the patched make() returns.
		// Mark the current backdrop immediately as well as on shown.bs.modal.
		mark_latest_backdrop();
	}

	function install_link_selector_patch() {
		const LinkSelector = window.frappe?.ui?.form?.LinkSelector;
		if (!LinkSelector?.prototype?.make) return false;
		if (LinkSelector.prototype.make.__saas_theme_grid_link_patch__) return true;

		const original_make = LinkSelector.prototype.make;

		function patched_make(...args) {
			const result = original_make.apply(this, args);
			decorate_link_selector(this);
			return result;
		}

		patched_make.__saas_theme_grid_link_patch__ = true;
		patched_make.__saas_theme_original__ = original_make;
		LinkSelector.prototype.make = patched_make;
		return true;
	}

	function tag_open_grid_editors(root = document) {
		root.querySelectorAll?.(".grid-row-open .form-in-grid").forEach((editor) => {
			editor.classList.add("st-grid-row-editor-finish");
		});

		if (root instanceof Element) {
			root.closest?.(".grid-row-open .form-in-grid")?.classList.add("st-grid-row-editor-finish");
		}
	}

	function refresh(root = document) {
		install_link_selector_patch();
		tag_open_grid_editors(root);
	}

	function schedule_install() {
		clearTimeout(state.install_timer);
		state.install_timer = setTimeout(() => {
			if (!install_link_selector_patch()) {
				schedule_install();
			}
		}, 120);
	}

	function observe() {
		if (state.observer || !document.body) return;

		state.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type !== "childList" || !mutation.addedNodes.length) continue;

				for (const node of mutation.addedNodes) {
					if (!(node instanceof Element)) continue;

					if (
						node.matches?.(".form-in-grid, .modal, .modal-backdrop") ||
						node.querySelector?.(".form-in-grid, .modal")
					) {
						refresh(node);
						return;
					}
				}
			}
		});

		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	$(function () {
		refresh(document);
		observe();
		if (!install_link_selector_patch()) schedule_install();

		$(document)
			.off("page-change.saasChildRowFinish")
			.on("page-change.saasChildRowFinish", () => setTimeout(() => refresh(document), 0));
	});
})();

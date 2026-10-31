/*
 * SaaS Theme — Interaction Finish v2
 *
 * Fixes two interaction problems that pure z-index overrides cannot solve:
 * 1) Frappe's child-row editor lives inside the grid, while #freeze.grid-form
 *    is attached to <body>. If any ancestor becomes a stacking context, the
 *    editor can be painted under the freeze layer and stop receiving clicks.
 * 2) The v16 view switcher menu is portaled to <body>; its gap from the trigger
 *    therefore needs to be configured on the Dropdown instance, not with a
 *    descendant selector.
 */
(function () {
	"use strict";

	if (window.__saas_theme_interaction_finish_v2__) return;
	window.__saas_theme_interaction_finish_v2__ = true;

	const state = {
		observer: null,
		timer: null,
		portals: new Map(),
	};

	function unwrap(value) {
		if (!value) return null;
		if (value.jquery) return value.get(0) || null;
		return value instanceof Element ? value : null;
	}

	function schedule(delay = 0) {
		clearTimeout(state.timer);
		state.timer = setTimeout(refresh, delay);
	}

	function is_visible(el) {
		if (!el?.isConnected) return false;
		const style = window.getComputedStyle(el);
		return style.display !== "none" && style.visibility !== "hidden";
	}

	function portalize_editor(editor) {
		if (!(editor instanceof Element)) return;
		if (editor.classList.contains("st-grid-row-portal")) return;

		const owner = editor.closest(".grid-row-open");
		const parent = editor.parentElement;
		if (!owner || !parent || parent === document.body) return;

		state.portals.set(editor, {
			parent,
			next: editor.nextSibling,
			owner,
		});

		owner.classList.add("st-grid-row-portal-owner");
		editor.classList.add("st-grid-row-portal", "st-grid-row-editor-v2");
		document.body.appendChild(editor);
		document.body.classList.add("st-grid-row-editor-open");
		document.querySelector("#freeze.grid-form")?.classList.add("st-grid-freeze-active");
	}

	function restore_editor(editor, meta) {
		if (!editor) return;

		meta?.owner?.classList.remove("st-grid-row-portal-owner");
		editor.classList.remove("st-grid-row-portal", "st-grid-row-editor-v2");

		if (meta?.parent?.isConnected) {
			if (meta.next?.parentNode === meta.parent) meta.parent.insertBefore(editor, meta.next);
			else meta.parent.appendChild(editor);
		} else {
			editor.remove();
		}

		state.portals.delete(editor);

		if (!document.querySelector(".st-grid-row-portal")) {
			document.body.classList.remove("st-grid-row-editor-open");
			document.querySelector("#freeze.grid-form")?.classList.remove("st-grid-freeze-active");
		}
	}

	function sync_grid_portals() {
		// Portal newly-opened row editors to body so they are siblings of #freeze.
		document.querySelectorAll(".grid-row-open .form-in-grid").forEach((editor) => {
			if (is_visible(editor)) portalize_editor(editor);
		});

		// Restore an editor as soon as Frappe closes its owning row.
		for (const [editor, meta] of Array.from(state.portals.entries())) {
			const owner_open = meta.owner?.isConnected && meta.owner.classList.contains("grid-row-open");
			if (!owner_open || !is_visible(editor)) restore_editor(editor, meta);
		}
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

	function target_is_in_portaled_grid_row(target) {
		const element = target_element(target);
		if (element?.closest?.(".st-grid-row-portal")) return true;
		return Boolean(target?.doc?.parentfield && document.querySelector(".st-grid-row-portal"));
	}

	function mark_latest_modal_backdrop() {
		const backdrops = Array.from(document.querySelectorAll("body > .modal-backdrop.show"));
		backdrops[backdrops.length - 1]?.classList.add("st-grid-link-selector-backdrop-v2");
	}

	function decorate_link_selector(selector) {
		if (!selector?.dialog || !target_is_in_portaled_grid_row(selector.target)) return;

		selector.dialog.keep_grid_form_open = true;
		const $wrapper = selector.dialog.$wrapper;
		if (!$wrapper?.length) return;

		$wrapper.addClass("st-grid-link-selector-v2");
		$wrapper
			.off("shown.bs.modal.stGridLinkSelectorV2")
			.on("shown.bs.modal.stGridLinkSelectorV2", () => {
				$wrapper.addClass("st-grid-link-selector-v2");
				mark_latest_modal_backdrop();
			});

		mark_latest_modal_backdrop();
	}

	function install_link_selector_patch() {
		const LinkSelector = window.frappe?.ui?.form?.LinkSelector;
		if (!LinkSelector?.prototype?.make) return false;
		if (LinkSelector.prototype.make.__saas_theme_grid_link_patch_v2__) return true;

		const original_make = LinkSelector.prototype.make;
		function patched_make(...args) {
			const result = original_make.apply(this, args);
			decorate_link_selector(this);
			return result;
		}
		patched_make.__saas_theme_grid_link_patch_v2__ = true;
		patched_make.__saas_theme_original__ = original_make;
		LinkSelector.prototype.make = patched_make;
		return true;
	}

	function decorate_view_switcher(instance) {
		const dropdown = instance?.dropdown;
		if (!dropdown || dropdown.__saas_theme_view_switcher_v2__) return;

		dropdown.__saas_theme_view_switcher_v2__ = true;
		// Frappe defaults to 4px. The requested UI needs a clearer visual gap.
		dropdown.offset = 10;

		const original_on_open = dropdown.opts.on_open;
		dropdown.opts.on_open = (...args) => {
			original_on_open?.apply(dropdown, args);
			const panel = dropdown.menu?.panels?.[0]?.panel;
			panel?.classList.add("st-view-switcher-menu-v2");
		};
	}

	function install_view_switcher_patch() {
		const ListViewSelect = window.frappe?.views?.ListViewSelect;
		if (!ListViewSelect?.prototype?.make_switcher) return false;
		if (ListViewSelect.prototype.make_switcher.__saas_theme_view_switcher_patch_v2__) return true;

		const original_make_switcher = ListViewSelect.prototype.make_switcher;
		function patched_make_switcher(...args) {
			const result = original_make_switcher.apply(this, args);
			decorate_view_switcher(this);
			return result;
		}
		patched_make_switcher.__saas_theme_view_switcher_patch_v2__ = true;
		patched_make_switcher.__saas_theme_original__ = original_make_switcher;
		ListViewSelect.prototype.make_switcher = patched_make_switcher;
		return true;
	}

	function tag_view_switcher_menu_fallback() {
		const trigger = document.querySelector('.view-switcher [aria-expanded="true"]');
		if (!trigger) return;

		const open_panels = Array.from(document.querySelectorAll("body > .es-menu[data-state='open']"));
		if (!open_panels.length) return;
		open_panels[0].classList.add("st-view-switcher-menu-v2");
	}

	function refresh() {
		install_link_selector_patch();
		install_view_switcher_patch();
		sync_grid_portals();
		tag_view_switcher_menu_fallback();
	}

	function observe() {
		if (state.observer || !document.body) return;

		state.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "childList" && mutation.addedNodes.length) {
					for (const node of mutation.addedNodes) {
						if (!(node instanceof Element)) continue;
						if (
							node.matches?.(".form-in-grid, .modal, .modal-backdrop, .es-menu") ||
							node.querySelector?.(".form-in-grid, .modal, .es-menu")
						) {
							schedule(0);
							return;
						}
					}
				}

				if (mutation.type === "attributes") {
					const target = mutation.target;
					if (
						target instanceof Element &&
						(target.matches(".grid-row, .form-in-grid, .view-switcher [aria-haspopup='menu']") ||
							target.closest?.(".grid-row"))
					) {
						schedule(0);
						return;
					}
				}
			}
		});

		state.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class", "style", "aria-expanded"],
		});
	}

	$(function () {
		refresh();
		observe();

		$(document)
			.off("page-change.saasInteractionFinishV2")
			.on("page-change.saasInteractionFinishV2", () => schedule(20));

		// Classes can load lazily in Desk bundles, so retry briefly after startup.
		[120, 350, 900, 1800].forEach((delay) => setTimeout(refresh, delay));
	});
})();

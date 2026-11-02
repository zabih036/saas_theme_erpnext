/*
 * SaaS Theme — List View behavior
 * Persistent visibility toggle for Frappe's complete List View filter panel.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined" || window.__saas_theme_list_filter_visibility_v2__) return;
	window.__saas_theme_list_filter_visibility_v2__ = true;

	const STORAGE_PREFIX = "saas_theme_list_filters_collapsed_v1";
	const BUTTON_CLASS = "st-list-filter-visibility-toggle";
	const TOOLBAR_CLASS = "st-list-filter-visibility-toolbar";
	let scheduled = false;

	function current_doctype() {
		const route = frappe.get_route?.() || [];
		if (route[0] !== "List" || !route[1]) return null;
		return String(route[1]);
	}

	function storage_key(doctype) {
		const user = frappe.session?.user || "Guest";
		return `${STORAGE_PREFIX}:${user}:${doctype}`;
	}

	function read_collapsed(doctype) {
		try {
			return window.localStorage.getItem(storage_key(doctype)) === "1";
		} catch (e) {
			return false;
		}
	}

	function write_collapsed(doctype, collapsed) {
		try {
			window.localStorage.setItem(storage_key(doctype), collapsed ? "1" : "0");
		} catch (e) {
			// Storage may be unavailable in private/restricted browser contexts.
		}
	}

	function filter_icon() {
		try {
			return frappe.utils.icon("filter", "xs");
		} catch (e) {
			return "";
		}
	}

	function update_button($button, collapsed) {
		const label = collapsed ? __("Show Filters") : __("Hide Filters");
		$button
			.attr({
				title: label,
				"aria-label": label,
				"aria-expanded": String(!collapsed),
			})
			.empty()
			.append(filter_icon())
			.append($("<span>").addClass("st-list-filter-toggle-label").text(label));
	}

	function active_list_form() {
		const $visible_list = $(".list-view:visible").last();
		if ($visible_list.length) {
			const $form = $visible_list.find(".page-form.list-page-form").first();
			if ($form.length) return $form;
		}

		// The form itself can be hidden by this controller, so never depend on
		// :visible for the form when restoring its state after route mutations.
		const $forms = $(".page-form.list-page-form");
		if (!$forms.length) return $();

		const $active_forms = $forms.filter(function () {
			const $page = $(this).closest(".page-container, .page-body, .list-view");
			return !$page.length || $page.is(":visible");
		});

		return ($active_forms.length ? $active_forms : $forms).last();
	}

	function toolbar_for($form) {
		return $form.prev(`.${TOOLBAR_CLASS}`).first();
	}

	function apply_state($form, doctype, collapsed, persist = false) {
		if (!$form.length) return;

		// Hide the complete List View filter panel. This intentionally includes
		// standard filters, Filter/Clear actions, sort direction and sort field.
		$form
			.toggleClass("st-list-filters-collapsed", collapsed)
			.prop("hidden", collapsed)
			.attr("aria-hidden", collapsed ? "true" : "false");

		const $button = toolbar_for($form).find(`.${BUTTON_CLASS}`).first();
		if ($button.length) update_button($button, collapsed);

		if (persist) write_collapsed(doctype, collapsed);
	}

	function ensure_toggle() {
		const doctype = current_doctype();
		if (!doctype) return;

		const $form = active_list_form();
		if (!$form.length) return;

		// Remove the PR #80 placement if an already-rendered route still carries
		// the old button inside the collapsible filter section.
		$form.find(`.${BUTTON_CLASS}`).remove();

		let $toolbar = toolbar_for($form);
		if (!$toolbar.length) {
			$toolbar = $(
				`<div class="${TOOLBAR_CLASS} level mb-2" role="toolbar"></div>`
			);
			$toolbar.append('<div class="level-left"></div>');
			$toolbar.append('<div class="level-right"></div>');
			$toolbar.insertBefore($form);
		}

		let $button = $toolbar.find(`.${BUTTON_CLASS}`).first();
		if (!$button.length) {
			$button = $(
				`<button type="button" class="btn btn-default btn-sm ${BUTTON_CLASS}"></button>`
			);
			$toolbar.find(".level-right").first().append($button);
		}

		$button
			.off("click.saasThemeListFilters")
			.on("click.saasThemeListFilters", (event) => {
				event.preventDefault();
				event.stopPropagation();
				const collapsed = !$form.hasClass("st-list-filters-collapsed");
				apply_state($form, doctype, collapsed, true);
			});

		apply_state($form, doctype, read_collapsed(doctype), false);
	}

	function schedule_setup() {
		if (scheduled) return;
		scheduled = true;
		window.requestAnimationFrame(() => {
			scheduled = false;
			ensure_toggle();
		});
	}

	if (frappe.router?.on) {
		frappe.router.on("change", () => {
			setTimeout(ensure_toggle, 0);
			setTimeout(ensure_toggle, 180);
			setTimeout(ensure_toggle, 500);
		});
	}

	const observer = new MutationObserver(schedule_setup);
	observer.observe(document.body, { childList: true, subtree: true });

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", ensure_toggle, { once: true });
	} else {
		setTimeout(ensure_toggle, 0);
	}
})();

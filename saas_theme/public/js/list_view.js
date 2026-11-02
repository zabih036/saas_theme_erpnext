/*
 * SaaS Theme — List View behavior
 * Persistent visibility toggle for Frappe's standard/quick filter row.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined" || window.__saas_theme_list_filter_visibility_v1__) return;
	window.__saas_theme_list_filter_visibility_v1__ = true;

	const STORAGE_PREFIX = "saas_theme_list_filters_collapsed_v1";
	const BUTTON_CLASS = "st-list-filter-visibility-toggle";
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

	function apply_state($form, doctype, collapsed, persist = false) {
		const $standard_filters = $form.children(".standard-filter-section").first();
		if (!$standard_filters.length) return;

		$form.toggleClass("st-list-filters-collapsed", collapsed);
		$standard_filters.toggle(!collapsed).attr("aria-hidden", collapsed ? "true" : "false");

		const $button = $form
			.children(".filter-section")
			.find(`.${BUTTON_CLASS}`)
			.first();
		if ($button.length) update_button($button, collapsed);

		if (persist) write_collapsed(doctype, collapsed);
	}

	function ensure_toggle() {
		const doctype = current_doctype();
		if (!doctype) return;

		const $form = $(".page-form.list-page-form:visible").last();
		if (!$form.length) return;

		const $standard_filters = $form.children(".standard-filter-section").first();
		const $filter_section = $form.children(".filter-section").first();
		if (!$standard_filters.length || !$filter_section.length) return;

		let $button = $filter_section.find(`.${BUTTON_CLASS}`).first();
		if (!$button.length) {
			$button = $(
				`<button type="button" class="btn btn-default btn-sm ${BUTTON_CLASS}"></button>`
			);

			const $filter_selector = $filter_section.find(".filter-selector").first();
			if ($filter_selector.length) {
				$button.insertBefore($filter_selector);
			} else {
				$filter_section.prepend($button);
			}

			$button.on("click.saasThemeListFilters", (event) => {
				event.preventDefault();
				event.stopPropagation();
				const collapsed = !$form.hasClass("st-list-filters-collapsed");
				apply_state($form, doctype, collapsed, true);
			});
		}

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

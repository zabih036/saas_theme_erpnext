/*
 * SaaS Theme — List View behavior
 * Persistent visibility toggle for Frappe's complete List View filter panel.
 * Uses Frappe's active cur_list/page API so cached List DOM cannot be targeted.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined" || window.__saas_theme_list_filter_visibility_v5__) return;
	window.__saas_theme_list_filter_visibility_v5__ = true;

	const STORAGE_PREFIX = "saas_theme_list_filters_collapsed_v1";
	const BUTTON_CLASS = "st-list-filter-visibility-toggle";
	const LEGACY_TOOLBAR_CLASS = "st-list-filter-visibility-toolbar";
	const BUTTON_OWNER = "v5-native-page";
	let scheduled = false;

	function current_list() {
		const route = frappe.get_route?.() || [];
		const view = String(route[2] || "List").toLowerCase();
		const list = window.cur_list;

		if (route[0] !== "List" || !route[1] || view !== "list") return null;
		if (!list || String(list.doctype) !== String(route[1])) return null;
		if (!list.page?.page_form?.length || !list.page?.icon_group?.length) return null;

		return list;
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

	function has_filter_panel(list) {
		return Boolean(
			list?.page?.page_form?.find(".standard-filter-section, .filter-section").length
		);
	}

	function button_for(list) {
		return list.page.icon_group.find(`.${BUTTON_CLASS}`).first();
	}

	function update_button($button, collapsed) {
		if (!$button?.length) return;
		const label = collapsed ? __("Show Filters") : __("Hide Filters");
		$button.attr({
			title: label,
			"data-original-title": label,
			"aria-label": label,
			"aria-expanded": String(!collapsed),
			"data-label": label,
		});
	}

	function apply_state(list, collapsed, persist = false) {
		if (!list?.page?.page_form?.length) return;

		const $form = list.page.page_form;
		$form.attr("aria-hidden", collapsed ? "true" : "false");

		if (collapsed) {
			$form.addClass("st-list-filters-collapsed");
			list.page.hide_form();
		} else {
			$form.removeClass("st-list-filters-collapsed");
			list.page.show_form();
		}

		update_button(button_for(list), collapsed);
		if (persist) write_collapsed(list.doctype, collapsed);
	}

	function toggle_current_list() {
		const list = current_list();
		if (!list || !has_filter_panel(list)) return;

		const collapsed = !list.page.page_form.hasClass("st-list-filters-collapsed");
		apply_state(list, collapsed, true);
	}

	function place_next_to_reload(list, $button) {
		let $reload = list.refresh_button?.jquery ? list.refresh_button : $(list.refresh_button || []);

		if (!$reload.length) {
			$reload = list.page.icon_group
				.find(".icon-btn")
				.filter(function () {
					if (this === $button.get(0)) return false;
					const $candidate = $(this);
					const label =
						$candidate.attr("title") ||
						$candidate.attr("data-original-title") ||
						$candidate.attr("aria-label");
					const has_refresh_icon = $candidate
						.find('use[href*="refresh-cw"], use[xlink\\:href*="refresh-cw"]')
						.length;
					return label === __("Reload List") || Boolean(has_refresh_icon);
				})
				.first();
		}

		if ($reload.length) {
			$button.insertAfter($reload);
		} else {
			list.page.icon_group.append($button);
		}
	}

	function ensure_native_button(list) {
		let $button = button_for(list);

		if ($button.length && $button.attr("data-st-filter-owner") !== BUTTON_OWNER) {
			$button.remove();
			$button = $();
		}

		if (!$button.length) {
			$button = list.page.add_action_icon(
				"filter",
				() => toggle_current_list(),
				BUTTON_CLASS,
				"Hide Filters"
			);
			$button.attr("data-st-filter-owner", BUTTON_OWNER);
		}

		place_next_to_reload(list, $button);
		return $button;
	}

	function ensure_toggle() {
		const list = current_list();
		if (!list || !has_filter_panel(list)) return;

		const $form = list.page.page_form;

		// Remove obsolete in-form / extra-row placements from the earlier versions.
		$form.find(`.${BUTTON_CLASS}`).remove();
		$form.parent().children(`.${LEGACY_TOOLBAR_CLASS}`).remove();

		const $button = ensure_native_button(list);
		const collapsed = read_collapsed(list.doctype);
		apply_state(list, collapsed, false);
		update_button($button, collapsed);
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

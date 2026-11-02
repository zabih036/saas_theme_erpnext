/*
 * SaaS Theme — List View behavior
 * Persistent visibility toggle for Frappe's complete List View filter panel.
 * The toggle lives in the native page icon group beside Reload List.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined" || window.__saas_theme_list_filter_visibility_v4__) return;
	window.__saas_theme_list_filter_visibility_v4__ = true;

	const STORAGE_PREFIX = "saas_theme_list_filters_collapsed_v1";
	const BUTTON_CLASS = "st-list-filter-visibility-toggle";
	const LEGACY_TOOLBAR_CLASS = "st-list-filter-visibility-toolbar";
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
			// Match frappe.ui.Page.add_action_icon() sizing exactly.
			return frappe.utils.icon("filter");
		} catch (e) {
			return "";
		}
	}

	function update_button($button, collapsed) {
		const label = collapsed ? __("Show Filters") : __("Hide Filters");
		$button.attr({
			title: label,
			"aria-label": label,
			"aria-expanded": String(!collapsed),
			"data-label": label,
		});
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

	function icon_group_for($form) {
		const $page = $form.closest(".page-container");
		let $group = $page.find(".page-head .page-actions .page-icon-group").first();

		if (!$group.length) {
			$group = $(".page-head:visible .page-actions .page-icon-group").last();
		}

		return $group;
	}

	function button_for($form) {
		return icon_group_for($form).find(`.${BUTTON_CLASS}`).first();
	}

	function apply_state($form, doctype, collapsed, persist = false) {
		if (!$form.length) return;

		// Hide the complete List View filter panel. This intentionally includes
		// standard filters, Filter/Clear actions, sort direction and sort field.
		$form
			.toggleClass("st-list-filters-collapsed", collapsed)
			.prop("hidden", collapsed)
			.attr("aria-hidden", collapsed ? "true" : "false");

		const $button = button_for($form);
		if ($button.length) update_button($button, collapsed);

		if (persist) write_collapsed(doctype, collapsed);
	}

	function place_next_to_reload($icon_group, $button) {
		const reload_label = __("Reload List");
		const $reload = $icon_group
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
				return label === reload_label || Boolean(has_refresh_icon);
			})
			.first();

		if ($reload.length) {
			$button.insertAfter($reload);
		} else {
			$icon_group.append($button);
		}
	}

	function handle_toggle_click(event) {
		event.preventDefault();
		event.stopPropagation();

		// Resolve the live route and filter form at click time. Frappe can rebuild
		// the List DOM/header independently, so a closure over an older $form can
		// leave a visible button pointing at a detached panel.
		const doctype = current_doctype();
		const $form = active_list_form();
		if (!doctype || !$form.length) return;

		const collapsed = !$form.hasClass("st-list-filters-collapsed");
		apply_state($form, doctype, collapsed, true);
		update_button($(event.currentTarget), collapsed);
	}

	function bind_delegated_toggle() {
		$(document)
			.off("click.saasThemeListFilters", `.${BUTTON_CLASS}`)
			.on("click.saasThemeListFilters", `.${BUTTON_CLASS}`, handle_toggle_click);
	}

	function ensure_toggle() {
		const doctype = current_doctype();
		if (!doctype) return;

		const $form = active_list_form();
		if (!$form.length) return;

		// Remove the older PR #80/PR #81 placements from already-rendered pages.
		$form.find(`.${BUTTON_CLASS}`).remove();
		$form.parent().children(`.${LEGACY_TOOLBAR_CLASS}`).remove();

		const $icon_group = icon_group_for($form);
		if (!$icon_group.length) return;

		// A cached/hidden list page may still own an old copy. Keep one button on
		// the active List page only; route changes recreate it when needed.
		$(`.${BUTTON_CLASS}`).not($icon_group.find(`.${BUTTON_CLASS}`)).remove();

		let $button = $icon_group.find(`.${BUTTON_CLASS}`).first();
		if (!$button.length) {
			$button = $(
				`<button type="button" class="text-muted btn btn-default icon-btn ${BUTTON_CLASS}"></button>`
			).append(filter_icon());
		}

		place_next_to_reload($icon_group, $button);
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

	bind_delegated_toggle();

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

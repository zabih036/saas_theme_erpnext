/*
 * SaaS Theme — Responsive Desk shell
 *
 * - mobile sidebar becomes a true off-canvas drawer instead of a permanent rail
 * - Search and Notifications are removed from the sidebar utility band
 * - Search, Notifications and User Profile are exposed in the page header
 * - Desktop Home reuses its native controls but keeps them grouped at top-right
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_mobile_shell__) return;
	window.__saas_theme_mobile_shell__ = true;

	frappe.provide("saas_theme.mobile_shell");

	const state = {
		observer: null,
		refresh_timer: null,
	};

	function icon(name, size = "sm") {
		try {
			return frappe.utils.icon(name, size, "", "", "current-color", true);
		} catch (e) {
			return "";
		}
	}

	function patch_mobile_sidebar_behavior() {
		const proto = frappe.ui?.Sidebar?.prototype;
		if (!proto || proto.__saas_theme_true_mobile_drawer) return;
		if (typeof proto.hides_when_collapsed !== "function") return;

		const original = proto.hides_when_collapsed;
		proto.hides_when_collapsed = function () {
			// Frappe v16 keeps a narrow rail on mobile. For a phone this consumes too
			// much horizontal space, so a collapsed mobile sidebar should disappear.
			if (frappe.is_mobile()) return true;
			return original.call(this);
		};
		proto.__saas_theme_true_mobile_drawer = true;

		const sidebar = frappe.app?.sidebar;
		if (sidebar?.wrapper && frappe.is_mobile() && !sidebar.sidebar_expanded) {
			sidebar.apply_expanded_state?.();
		}
	}

	function remove_sidebar_search_notifications() {
		$(".standard-items-band .navbar-modal-search-mobile, .standard-items-band .sidebar-notification")
			.each(function () {
				const $item = $(this).closest(
					".sidebar-item, .desk-sidebar-item, .standard-sidebar-item, .sidebar-item-container, [data-sidebar-item]"
				);
				($item.length ? $item : $(this)).addClass("st-sidebar-utility-hidden").hide();
			});

		$(".standard-items-band").each(function () {
			const $band = $(this);
			const visible_children = $band.children().filter(function () {
				return !$(this).hasClass("st-sidebar-utility-hidden") && $(this).css("display") !== "none";
			});
			$band.toggleClass("st-standard-items-empty", visible_children.length === 0);
		});
	}

	function notification_enabled() {
		return !!frappe.boot?.desk_settings?.notifications && frappe.session?.user !== "Guest";
	}

	function make_notification_button() {
		const $button = $(
			`<button type="button" class="btn-reset st-top-action st-top-notification" aria-label="${__(
				"Notifications"
			)}" title="${__("Notifications")}">
				<span class="st-top-action-icon" aria-hidden="true">${icon("bell", "sm")}</span>
				<span class="notification-count hidden" aria-live="polite"></span>
			</button>`
		);
		$button.on("click.saas_mobile_shell", (event) => {
			event.preventDefault();
			event.stopPropagation();
			frappe.ui?.sidebar_panels?.toggle?.("notifications");
		});
		return $button;
	}

	function make_profile_button() {
		const $parent = $('<div class="st-top-profile dropdown-navbar-user"></div>');
		const avatar = frappe.avatar?.(frappe.session.user, "avatar-medium") || "";
		const $button = $(
			`<button type="button" class="btn-reset st-top-profile-button" aria-label="${__(
				"User Menu"
			)}" title="${__("User Menu")}">${avatar}</button>`
		);
		$parent.append($button);

		const sidebar = frappe.app?.sidebar;
		if (sidebar?.create_user_menu && !$parent.data("st-user-menu-ready")) {
			sidebar.create_user_menu({
				parent: $parent,
				button: $button,
				side: "bottom",
				align: "end",
			});
			$parent.data("st-user-menu-ready", 1);
		}
		return $parent;
	}

	function ensure_page_head_actions() {
		$(".page-head:visible").each(function () {
			const $head = $(this);
			const $section = $head.find(".standard-items-section").first();
			if (!$section.length) return;

			let $actions = $section.children(".st-page-utility-actions").first();
			if (!$actions.length) {
				$actions = $('<div class="st-page-utility-actions"></div>');
				// Keep document actions (Save, Actions, etc.) together, then place the
				// global Search / Bell / Profile cluster at the far-right edge.
				$section.append($actions);
			}

			const $search = $section.find("#small-search-button").first();
			if ($search.length && !$search.parent().is($actions)) {
				$search
					.removeClass("hidden")
					.addClass("st-top-action st-top-search")
					.attr({ title: __("Search"), "aria-label": __("Search") })
					.prependTo($actions);
			}

			if (notification_enabled() && !$actions.children(".st-top-notification").length) {
				$actions.append(make_notification_button());
			}

			if (!$actions.children(".st-top-profile").length && frappe.app?.sidebar?.create_user_menu) {
				$actions.append(make_profile_button());
			}
		});
	}

	function ensure_desktop_home_actions() {
		$(".desktop-navbar").each(function () {
			const $nav = $(this);
			const $right = $nav.children(".flex").last();
			const $search = $nav.children(".search-widget-wrapper").first();
			if (!$right.length || !$search.length) return;

			$right.addClass("st-desktop-top-actions");
			$search.addClass("st-home-search-relocated");
			const $notifications = $right.find(".desktop-notifications").first();
			if ($notifications.length) $search.insertBefore($notifications);
			else $right.prepend($search);
		});
	}

	function sync_notification_count() {
		const $counts = $(".notification-count");
		if (!$counts.length) return;

		let best = "";
		$counts.each(function () {
			const text = String($(this).text() || "").trim();
			if (text) best = text;
		});

		if (!best) return;
		$counts
			.text(best)
			.removeClass("hidden")
			.attr("aria-label", __("{0} unread notifications", [best]));
	}

	function normalize_mobile_sidebar_state() {
		const sidebar = frappe.app?.sidebar;
		if (!sidebar || !frappe.is_mobile()) return;
		if (!sidebar.sidebar_expanded) sidebar.apply_expanded_state?.();
	}

	function refresh() {
		patch_mobile_sidebar_behavior();
		remove_sidebar_search_notifications();
		ensure_page_head_actions();
		ensure_desktop_home_actions();
		normalize_mobile_sidebar_state();
		sync_notification_count();
	}

	function schedule_refresh(delay = 20) {
		clearTimeout(state.refresh_timer);
		state.refresh_timer = setTimeout(refresh, delay);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver(() => schedule_refresh(30));
		state.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});
	}

	$(document)
		.off("page-change.saas_mobile_shell")
		.on("page-change.saas_mobile_shell", () => schedule_refresh(20));

	$(document)
		.off("sidebar_setup.saas_mobile_shell")
		.on("sidebar_setup.saas_mobile_shell", () => schedule_refresh(20));

	$(document)
		.off("desktop_screen.saas_mobile_shell")
		.on("desktop_screen.saas_mobile_shell", () => schedule_refresh(20));

	$(document)
		.off("toolbar_setup.saas_mobile_shell")
		.on("toolbar_setup.saas_mobile_shell", () => schedule_refresh(20));

	$(window)
		.off("resize.saas_mobile_shell orientationchange.saas_mobile_shell")
		.on("resize.saas_mobile_shell orientationchange.saas_mobile_shell", () => schedule_refresh(40));

	$(function () {
		refresh();
		setup_observer();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule_refresh(20));
		}
	});

	saas_theme.mobile_shell.refresh = refresh;
})();

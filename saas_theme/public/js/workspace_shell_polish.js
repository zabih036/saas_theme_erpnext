/*
 * SaaS Theme — Workspace / shell finishing layer
 *
 * - anchors the top notification panel to the top-right bell using Frappe's popover host
 * - disables the Frappe v16 Dock/App Rail so the customized sidebar is the only navigation rail
 * - keeps the behavior upgrade-safe and outside Frappe core
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_workspace_shell_polish__) return;
	window.__saas_theme_workspace_shell_polish__ = true;

	frappe.provide("saas_theme.workspace_shell_polish");

	const state = {
		observer: null,
		refresh_timer: null,
	};

	function disable_dock_api() {
		const proto = frappe.ui?.Sidebar?.prototype;
		if (proto && !proto.__saas_theme_dock_disabled) {
			proto.dock_enabled = function () {
				return false;
			};
			proto.__saas_theme_dock_disabled = true;
		}
	}

	function disable_live_dock() {
		disable_dock_api();

		const sidebar = frappe.app?.sidebar;
		const dock = sidebar?.dock;

		if (dock) {
			dock.enabled = false;
			dock.is_pinned = false;
			dock.is_open = false;
			dock.$dock
				?.addClass("hidden")
				.hide()
				.attr("aria-hidden", "true")
				.prop("inert", true);
		}

		$("body").removeClass("dock-active dock-open dock-pinned");
		$("#desk-dock, body > .dock").addClass("hidden").hide();

		// Let the sidebar recalculate its collapsed/expanded form without a dock beside it.
		if (sidebar?.refit_collapsed_sidebar) sidebar.refit_collapsed_sidebar();
	}

	function upgrade_notification_button($button) {
		if (!$button?.length || $button.data("st-popover-ready")) return;
		if (!frappe.ui?.Notifications) return;

		// Remove the earlier handler that opened the notification SidebarPanel on the
		// left. The same bell becomes the trigger of Frappe's native bottom/end popover.
		$button.off("click.saas_mobile_shell");
		$button
			.removeClass("st-top-notification")
			.addClass("st-top-notification-button desktop-notification-icon")
			.data("st-popover-ready", 1);

		let $host = $button.parent(".st-top-notification-host");
		if (!$host.length) {
			$button.wrap('<div class="st-top-notification st-top-notification-host"></div>');
			$host = $button.parent();
		}

		if ($host.data("st-notifications-instance")) return;

		try {
			const notifications = new frappe.ui.Notifications({
				popover: true,
				wrapper: $host,
			});
			$host.data("st-notifications-instance", notifications);
		} catch (error) {
			// Never break the page header if a future Frappe build changes the host API.
			console.warn("SaaS Theme: notification popover could not be initialized", error);
		}
	}

	function anchor_top_notifications() {
		$(".page-head:visible .st-page-utility-actions").each(function () {
			const $actions = $(this);

			// Current mobile_shell renders this as a direct button. Once wrapped, the host
			// itself carries st-top-notification so mobile_shell will not create duplicates.
			$actions.children("button.st-top-notification").each(function () {
				upgrade_notification_button($(this));
			});

			// Defensive support for a button already wrapped by a previous refresh.
			$actions
				.children(".st-top-notification-host")
				.find("button.st-top-notification-button")
				.each(function () {
					const $button = $(this);
					if (!$button.data("st-popover-ready")) upgrade_notification_button($button);
				});
		});
	}

	function refresh() {
		disable_live_dock();
		anchor_top_notifications();
	}

	function schedule_refresh(delay = 25) {
		clearTimeout(state.refresh_timer);
		state.refresh_timer = setTimeout(refresh, delay);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver(() => schedule_refresh(35));
		state.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	$(document)
		.off("page-change.saas_workspace_shell_polish")
		.on("page-change.saas_workspace_shell_polish", () => schedule_refresh(15));

	$(document)
		.off("sidebar_setup.saas_workspace_shell_polish")
		.on("sidebar_setup.saas_workspace_shell_polish", () => schedule_refresh(15));

	$(document)
		.off("toolbar_setup.saas_workspace_shell_polish")
		.on("toolbar_setup.saas_workspace_shell_polish", () => schedule_refresh(15));

	$(document)
		.off("desktop_screen.saas_workspace_shell_polish")
		.on("desktop_screen.saas_workspace_shell_polish", () => schedule_refresh(15));

	$(function () {
		refresh();
		setup_observer();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule_refresh(15));
		}
	});

	saas_theme.workspace_shell_polish.refresh = refresh;
})();

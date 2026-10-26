/* SaaS Theme — final shell cleanup */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_final_shell_cleanup__) return;
	window.__saas_theme_final_shell_cleanup__ = true;

	frappe.provide("saas_theme.final_shell_cleanup");

	const state = { observer: null, timer: null };
	const HIDDEN_MENU_LABELS = new Set(["Modules", "Apps", "Manage Dock"]);

	function patch_list_documentation() {
		const proto = frappe.views?.ListView?.prototype;
		if (!proto || proto.__saas_theme_no_documentation || typeof proto.get_no_result_message !== "function") {
			return;
		}

		const original = proto.get_no_result_message;
		proto.get_no_result_message = function () {
			const meta = this.meta;
			const documentation = meta?.documentation;
			if (meta) meta.documentation = null;
			try {
				return original.apply(this, arguments);
			} finally {
				if (meta) meta.documentation = documentation;
			}
		};
		proto.__saas_theme_no_documentation = true;
	}

	function remove_rendered_documentation() {
		$(".list-view, .layout-main-section, .no-result, .empty-state").each(function () {
			$(this)
				.find("a, button")
				.filter(function () {
					return String($(this).text() || "").trim() === __("Documentation");
				})
				.remove();
		});
	}

	function remove_menu_items() {
		const $menus = $(
			'.dropdown-menu, .popover, .es-popover, [role="menu"], .menu, .sidebar-menu, .sidebar-menu-wrapper'
		);

		$menus.each(function () {
			$(this)
				.find('a, button, [role="menuitem"], .dropdown-item, .menu-item, li')
				.each(function () {
					const $item = $(this);
					const text = String($item.clone().children().remove().end().text() || $item.text() || "")
						.replace(/\s+/g, " ")
						.trim();

					if (HIDDEN_MENU_LABELS.has(text)) {
						const $row = $item.closest('[role="menuitem"], .dropdown-item, .menu-item, li');
						($row.length ? $row : $item).remove();
					}
				});
		});
	}

	function ensure_notification_popover(button) {
		const $button = $(button);
		if (!$button.length || !frappe.ui?.Notifications) return;

		$button.off("click.saas_mobile_shell");
		$button.removeClass("st-top-notification").addClass("st-top-notification-button desktop-notification-icon");

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
			$button.data("st-popover-ready", 1);
		} catch (error) {
			console.warn("SaaS Theme: notification popover initialization failed", error);
		}
	}

	function prepare_notification_buttons() {
		$(".page-head:visible .st-page-utility-actions").each(function () {
			$(this)
				.find("button.st-top-notification, button.st-top-notification-button")
				.each(function () {
					ensure_notification_popover(this);
				});
		});
	}

	function refresh() {
		patch_list_documentation();
		remove_rendered_documentation();
		remove_menu_items();
		prepare_notification_buttons();
	}

	function schedule(delay = 10) {
		clearTimeout(state.timer);
		state.timer = setTimeout(refresh, delay);
	}

	// Pointer-down fires before click. This guarantees that the native popover owns
	// the first click instead of the old sidebar-panel handler.
	$(document)
		.off("pointerdown.saas_final_notification")
		.on(
			"pointerdown.saas_final_notification",
			"button.st-top-notification, button.st-top-notification-button",
			function () {
				ensure_notification_popover(this);
			}
		);

	$(document)
		.off("page-change.saas_final_shell sidebar_setup.saas_final_shell toolbar_setup.saas_final_shell")
		.on(
			"page-change.saas_final_shell sidebar_setup.saas_final_shell toolbar_setup.saas_final_shell",
			() => schedule(5)
		);

	$(function () {
		refresh();
		state.observer = new MutationObserver(() => schedule(5));
		state.observer.observe(document.body, { childList: true, subtree: true });
		if (typeof frappe.after_ajax === "function") frappe.after_ajax(() => schedule(5));
	});

	saas_theme.final_shell_cleanup.refresh = refresh;
})();

/* SaaS Theme — final shell cleanup */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_final_shell_cleanup__) return;
	window.__saas_theme_final_shell_cleanup__ = true;

	frappe.provide("saas_theme.final_shell_cleanup");

	const state = { observer: null, timer: null };
	const HIDDEN_MENU_LABELS = new Set([
		"Modules",
		"Apps",
		"Manage Dock",
		"Edit Sidebar",
		"Delete Demo Data",
	]);
	const HIDDEN_MENU_NAMES = new Set([
		"switch-module",
		"switch-app",
		"workspace-selector",
		"edit-sidebar",
		"delete-demo-data",
	]);
	const STYLE_ID = "st-home-navigation-style";

	function ensure_styles() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			.st-page-home-button {
				width: 34px !important;
				height: 34px !important;
				min-width: 34px !important;
				display: inline-flex !important;
				align-items: center !important;
				justify-content: center !important;
				margin: 0 7px 0 0 !important;
				padding: 0 !important;
				border: 1px solid #E5E5E5 !important;
				border-radius: 9px !important;
				background: #FFFFFF !important;
				color: #14213D !important;
				box-shadow: 0 1px 2px rgba(20, 33, 61, .04), 0 4px 10px rgba(20, 33, 61, .035) !important;
				transition: transform .14s ease, border-color .14s ease, color .14s ease, background .14s ease, box-shadow .14s ease;
			}
			.st-page-home-button:hover {
				transform: translateY(-1px);
				border-color: rgba(6, 74, 219, .35) !important;
				background: #F5F8FF !important;
				color: #064ADB !important;
				box-shadow: 0 5px 14px rgba(20, 33, 61, .08) !important;
			}
			.st-page-home-button svg,
			.st-page-home-button .icon {
				width: 17px !important;
				height: 17px !important;
				color: currentColor !important;
				stroke: currentColor !important;
			}
			.sidebar-header.st-sidebar-home-header {
				cursor: pointer !important;
			}
			.sidebar-header.st-sidebar-home-header .drop-icon {
				display: none !important;
			}
			.sidebar-header.st-sidebar-home-header:hover {
				background: rgba(6, 74, 219, .045) !important;
			}
			.sidebar-header.st-sidebar-home-header .header-logo,
			.sidebar-header.st-sidebar-home-header .header-title {
				pointer-events: none !important;
			}
			[data-theme="dark"] .st-page-home-button {
				background: #111827 !important;
				border-color: #2A3A52 !important;
				color: #E5E7EB !important;
				box-shadow: 0 4px 12px rgba(0, 0, 0, .18) !important;
			}
			[data-theme="dark"] .st-page-home-button:hover {
				background: #172033 !important;
				border-color: rgba(79, 140, 255, .48) !important;
				color: #4F8CFF !important;
			}
			[data-theme="dark"] .sidebar-header.st-sidebar-home-header:hover {
				background: rgba(79, 140, 255, .08) !important;
			}
			@media (max-width: 767px) {
				.st-page-home-button {
					width: 32px !important;
					height: 32px !important;
					min-width: 32px !important;
					margin-right: 5px !important;
				}
			}
		`;
		document.head.appendChild(style);
	}

	function desk_home_url() {
		return window.location.pathname.startsWith("/app") ? "/app" : "/desk";
	}

	function go_home(event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
			if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
		}
		window.location.assign(desk_home_url());
	}

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

	function patch_sidebar_header_menu() {
		const proto = frappe.ui?.SidebarHeader?.prototype;
		if (!proto || proto.__saas_theme_home_menu || typeof proto.menu_items !== "function") return;

		const original = proto.menu_items;
		proto.menu_items = function () {
			const groups = original.apply(this, arguments) || [];
			return groups
				.map((group) => {
					const options = (group?.options || []).filter((item) => {
						const name = String(item?.name || "").trim().toLowerCase();
						const label = String(item?.label || "").trim();
						return !HIDDEN_MENU_NAMES.has(name) && !HIDDEN_MENU_LABELS.has(label);
					});
					return { ...group, options };
				})
				.filter((group) => group.options?.length);
		};
		proto.__saas_theme_home_menu = true;
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

	function ensure_page_home_button() {
		const route = frappe.get_route?.() || [];
		const on_home = route.length === 0 || route[0] === "desktop";

		if (on_home) {
			$(".st-page-home-button").remove();
			return;
		}

		$(".page-head:visible .page-title").each(function () {
			const $title = $(this);
			if ($title.children(".st-page-home-button").length) return;

			const icon = frappe.utils?.icon
				? frappe.utils.icon("home", "sm", "", "", "current-color", true)
				: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"></path><path d="M5 10v10h14V10"></path></svg>';
			const $button = $(
				`<button type="button" class="btn-reset st-page-home-button" title="${__("Home")}" aria-label="${__("Home")}">${icon}</button>`
			);
			$button.on("click.saas_home", go_home);

			const $sidebar_toggle = $title.children(".sidebar-toggle-btn").first();
			if ($sidebar_toggle.length) $button.insertAfter($sidebar_toggle);
			else $title.prepend($button);
		});
	}

	function make_sidebar_header_home() {
		$(".sidebar-header").each(function () {
			const $header = $(this);
			$header
				.addClass("st-sidebar-home-header")
				.attr({ role: "button", tabindex: "0", title: __("Home"), "aria-label": __("Home") });
			$header.find(".drop-icon").hide();
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
		ensure_styles();
		patch_list_documentation();
		patch_sidebar_header_menu();
		remove_rendered_documentation();
		remove_menu_items();
		ensure_page_home_button();
		make_sidebar_header_home();
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

	// The sidebar header is now a direct Home control instead of a configuration menu.
	document.addEventListener(
		"click",
		(event) => {
			if (!event.target?.closest?.(".sidebar-header.st-sidebar-home-header")) return;
			go_home(event);
		},
		true
	);

	document.addEventListener(
		"keydown",
		(event) => {
			const header = event.target?.closest?.(".sidebar-header.st-sidebar-home-header");
			if (!header || (event.key !== "Enter" && event.key !== " ")) return;
			go_home(event);
		},
		true
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
	saas_theme.final_shell_cleanup.go_home = go_home;
})();

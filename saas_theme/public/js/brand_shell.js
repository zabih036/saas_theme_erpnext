/*
 * SaaS Theme — Company branding and desk shell cleanup
 *
 * Keeps the customization outside Frappe core:
 * - uses the default Company's Company Logo for desk branding
 * - removes Frappe Support from the desktop avatar menu
 * - removes Help from the workspace/sidebar header menu
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;

	frappe.provide("saas_theme.brand_shell");

	const state = {
		logo: undefined,
		logo_promise: null,
		observer: null,
	};

	async function resolve_company_logo() {
		if (state.logo !== undefined) return state.logo;
		if (state.logo_promise) return state.logo_promise;

		state.logo_promise = (async () => {
			let logo = "";

			try {
				const response = await frappe.call({
					method: "saas_theme.branding.get_company_branding",
					type: "GET",
				});
				logo = response?.message?.company_logo || "";
			} catch (e) {
				// Branding must never block Desk startup. When no company logo can be
				// resolved, Frappe's current site/app logo remains untouched.
			}

			state.logo = typeof logo === "string" ? logo : "";
			return state.logo;
		})();

		try {
			return await state.logo_promise;
		} finally {
			state.logo_promise = null;
		}
	}

	function apply_logo_url(logo) {
		if (!logo) return;

		$(".desktop-wrapper #brand-logo").each(function () {
			$(this)
				.attr("src", logo)
				.attr("alt", __("Company Logo"))
				.addClass("st-company-logo");
			$(this).closest(".navbar-home").addClass("st-company-brand");
		});

		$(".navbar-brand .app-logo").each(function () {
			const $logo = $(this);
			const $image = $logo.is("img") ? $logo : $logo.find("img").first();

			if ($image.length) {
				$image
					.attr("src", logo)
					.attr("alt", __("Company Logo"))
					.addClass("st-company-logo");
			} else {
				// Keep the original .app-logo node so Frappe's click handler that toggles
				// the sidebar remains attached. Only its visual contents are replaced.
				$logo.addClass("st-company-logo-host");
				if (!$logo.children(".st-company-logo-image").length) {
					$logo.append(
						$("<img>", {
							class: "st-company-logo-image",
							src: logo,
							alt: __("Company Logo"),
						})
					);
				} else {
					$logo.children(".st-company-logo-image").attr("src", logo);
				}
			}

			$logo.closest(".navbar-brand").addClass("st-company-brand");
		});
	}

	async function apply_company_logo() {
		const logo = await resolve_company_logo();
		apply_logo_url(logo);
	}

	function normalized_text(element) {
		return String($(element).text() || "")
			.replace(/\s+/g, " ")
			.trim()
			.toLowerCase();
	}

	function remove_row(element) {
		const $element = $(element);
		const $row = $element.closest(
			".dropdown-menu-item, .dropdown-item, li, [role='menuitem']"
		);
		($row.length ? $row : $element).remove();
	}

	function candidates(root, selector) {
		const $root = root ? $(root) : $(document);
		return $root.filter(selector).add($root.find(selector));
	}

	function remove_frappe_support(root) {
		const support_label = String(__("Frappe Support") || "Frappe Support").toLowerCase();
		const selector =
			".dropdown-menu-item, .dropdown-item, .dropdown-menu a, [role='menuitem'], a[href*='support.frappe.io']";

		candidates(root, selector).each(function () {
			const text = normalized_text(this);
			const href = String($(this).attr("href") || "").toLowerCase();
			if (
				text === "frappe support" ||
				text === support_label ||
				href.includes("support.frappe.io")
			) {
				remove_row(this);
			}
		});
	}

	function remove_open_sidebar_help(root) {
		const help_label = String(__("Help") || "Help").toLowerCase();

		candidates(root, ".sidebar-header-menu").each(function () {
			$(this)
				.find(".dropdown-menu-item, .dropdown-item, [role='menuitem'], a")
				.each(function () {
					const text = normalized_text(this);
					if (text === "help" || text === help_label) remove_row(this);
				});
		});
	}

	function patch_sidebar_help_menu() {
		const proto = frappe.ui?.SidebarHeader?.prototype;
		if (!proto || proto.__saas_theme_help_removed || typeof proto.system_items !== "function") {
			return;
		}

		const original_system_items = proto.system_items;
		proto.system_items = function () {
			const items = original_system_items.call(this) || [];
			const help_label = String(__("Help") || "Help").toLowerCase();
			return items.filter((item) => {
				const name = String(item?.name || "").toLowerCase();
				const label = String(item?.label || "").trim().toLowerCase();
				return name !== "help" && label !== "help" && label !== help_label;
			});
		};
		proto.__saas_theme_help_removed = true;
	}

	function clean_menus(root) {
		patch_sidebar_help_menu();
		remove_frappe_support(root);
		remove_open_sidebar_help(root);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;

		state.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes || []) {
					if (node.nodeType !== Node.ELEMENT_NODE) continue;
					clean_menus(node);

					const $node = $(node);
					if (
						$node.is("#brand-logo, .navbar-brand, .desktop-navbar, .navbar") ||
						$node.find("#brand-logo, .navbar-brand .app-logo").length
					) {
						apply_company_logo();
					}
				}
			}
		});

		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	function refresh() {
		patch_sidebar_help_menu();
		apply_company_logo();
		clean_menus(document);
		setup_observer();
	}

	// Public helpers are useful for troubleshooting from the browser console.
	saas_theme.brand_shell.refresh = refresh;
	saas_theme.brand_shell.apply_company_logo = apply_company_logo;

	$(document)
		.off("desktop_screen.saas_brand_shell")
		.on("desktop_screen.saas_brand_shell", () => setTimeout(refresh, 20));

	$(document)
		.off("sidebar_setup.saas_brand_shell")
		.on("sidebar_setup.saas_brand_shell", () => setTimeout(refresh, 20));

	$(document)
		.off("toolbar_setup.saas_brand_shell")
		.on("toolbar_setup.saas_brand_shell", () => setTimeout(refresh, 20));

	$(document)
		.off("page-change.saas_brand_shell")
		.on("page-change.saas_brand_shell", () => setTimeout(refresh, 40));

	$(function () {
		refresh();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => setTimeout(refresh, 20));
		}
	});
})();

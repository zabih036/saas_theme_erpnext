/*
 * SaaS Theme — Company branding and desk shell cleanup
 *
 * Keeps the customization outside Frappe core:
 * - uses the default Company's Company Logo for desk branding
 * - removes Frappe Support and About from desktop profile menus
 * - removes Help from the workspace/sidebar header menu
 * - adds a persistent bottom sidebar collapse/expand control
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
			".es-menu__item, .dropdown-menu-item, .dropdown-item, li, [role='menuitem']"
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
			".es-menu__item, .dropdown-menu-item, .dropdown-item, .dropdown-menu a, [role='menuitem'], a[href*='support.frappe.io']";

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

	function remove_desktop_about(root) {
		if (!$(".desktop-wrapper").length && !$("body").hasClass("desktop-page")) return;

		const edit_profile = String(__("Edit Profile") || "Edit Profile").toLowerCase();
		const toggle_theme = String(__("Toggle Theme") || "Toggle Theme").toLowerCase();
		const about_label = String(__("About") || "About").toLowerCase();
		const $root = root ? $(root) : $(document);
		const $menus = $root
			.filter(".es-menu, .dropdown-menu")
			.add($root.find(".es-menu, .dropdown-menu"))
			.add($root.closest(".es-menu, .dropdown-menu"));

		$menus.each(function () {
			const $menu = $(this);
			const labels = $menu
				.find(".es-menu__item, .dropdown-menu-item, .dropdown-item, [role='menuitem']")
				.map(function () {
					return normalized_text(this);
				})
				.get();

			// The desktop avatar menu is identified by two stable built-in rows so an
			// unrelated menu with an "About" item is never modified.
			if (!labels.includes(edit_profile) || !labels.includes(toggle_theme)) return;

			$menu
				.find(".es-menu__item, .dropdown-menu-item, .dropdown-item, [role='menuitem']")
				.each(function () {
					const text = normalized_text(this);
					if (text === "about" || text === about_label) remove_row(this);
				});
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

	function patch_sidebar_collapse_behavior() {
		const proto = frappe.ui?.Sidebar?.prototype;
		if (
			!proto ||
			proto.__saas_theme_persistent_icon_rail ||
			typeof proto.hides_when_collapsed !== "function"
		) {
			return;
		}

		const original_hides_when_collapsed = proto.hides_when_collapsed;
		proto.hides_when_collapsed = function () {
			// On desktop, keep a narrow icon rail visible after collapse so the user
			// always has a visible control to expand it again. Mobile keeps Frappe's
			// normal drawer behavior.
			if (!frappe.is_mobile()) return false;
			return original_hides_when_collapsed.call(this);
		};
		proto.__saas_theme_persistent_icon_rail = true;

		const sidebar = frappe.app?.sidebar;
		if (sidebar?.wrapper && !sidebar.sidebar_expanded) {
			if (typeof sidebar.refit_collapsed_sidebar === "function") {
				sidebar.refit_collapsed_sidebar();
			} else if (typeof sidebar.apply_expanded_state === "function") {
				sidebar.apply_expanded_state();
			}
		}
	}

	function update_sidebar_toggle() {
		const sidebar = frappe.app?.sidebar;
		const $toggle = $(".st-sidebar-persist-toggle");
		if (!$toggle.length || !sidebar) return;

		const expanded = sidebar.sidebar_expanded !== false;
		const label = expanded ? __("Collapse menu") : __("Expand menu");
		const icon = expanded ? "chevron-left" : "chevron-right";

		$toggle.attr({ title: label, "aria-label": label });
		$toggle.find(".st-sidebar-persist-toggle-icon").html(
			frappe.utils.icon(icon, "sm", "", "", "current-color", true)
		);
		$toggle.find(".st-sidebar-persist-toggle-label").text(label);
		$toggle.toggleClass("is-collapsed", !expanded);
	}

	function ensure_sidebar_toggle() {
		const sidebar = frappe.app?.sidebar;
		const $bottom = $(".body-sidebar .body-sidebar-bottom").first();
		if (!sidebar || !$bottom.length || frappe.is_mobile()) return;

		let $toggle = $bottom.children(".st-sidebar-persist-toggle").first();
		if (!$toggle.length) {
			$toggle = $(
				`<button type="button" class="btn-reset st-sidebar-persist-toggle">
					<span class="st-sidebar-persist-toggle-icon" aria-hidden="true"></span>
					<span class="st-sidebar-persist-toggle-label"></span>
				</button>`
			);

			const $user = $bottom.children(".dropdown-navbar-user").first();
			if ($user.length) $toggle.insertBefore($user);
			else $bottom.append($toggle);

			$toggle.on("click.saas_brand_shell", (event) => {
				event.preventDefault();
				event.stopPropagation();
				frappe.app?.sidebar?.toggle_width?.();
				setTimeout(update_sidebar_toggle, 0);
			});
		}

		update_sidebar_toggle();
	}

	function clean_menus(root) {
		patch_sidebar_help_menu();
		remove_frappe_support(root);
		remove_desktop_about(root);
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

					if (
						$node.is(".body-sidebar, .body-sidebar-bottom") ||
						$node.find(".body-sidebar-bottom").length
					) {
						ensure_sidebar_toggle();
					}
				}
			}
		});

		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	function refresh() {
		patch_sidebar_help_menu();
		patch_sidebar_collapse_behavior();
		apply_company_logo();
		clean_menus(document);
		ensure_sidebar_toggle();
		setup_observer();
	}

	// Public helpers are useful for troubleshooting from the browser console.
	saas_theme.brand_shell.refresh = refresh;
	saas_theme.brand_shell.apply_company_logo = apply_company_logo;
	saas_theme.brand_shell.update_sidebar_toggle = update_sidebar_toggle;

	$(document)
		.off("desktop_screen.saas_brand_shell")
		.on("desktop_screen.saas_brand_shell", () => setTimeout(refresh, 20));

	$(document)
		.off("sidebar_setup.saas_brand_shell")
		.on("sidebar_setup.saas_brand_shell", () => setTimeout(refresh, 20));

	$(document)
		.off("sidebar-expand.saas_brand_shell")
		.on("sidebar-expand.saas_brand_shell", () => setTimeout(update_sidebar_toggle, 0));

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

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
		language_dialog: null,
		language_loading: false,
		language_saving: false,
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


	/* Both language entry points use the same self-service User.language API.
	   Frappe reboots translated labels and RTL direction on full-page reload. */
	function language_icon() {
		return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
	}

	function current_language() {
		const code = String(frappe.boot?.lang || frappe.boot?.user?.language || "en");
		return /^[a-z]{2,3}(?:[-_][A-Za-z]{2,4})?$/.test(code) ? code : "en";
	}

	async function save_user_language(language) {
		const response = await frappe.call({
			method: "saas_theme.language.set_user_language",
			args: { language },
		});
		if (response?.message?.language !== language) {
			throw new Error("Language preference was not confirmed");
		}
		// Reloading, rather than updating only labels, lets Frappe recreate
		// translated boot data, menus, formatters, text direction and layout.
		window.location.reload();
	}

	async function open_language_picker() {
		if (state.language_loading || state.language_dialog || state.language_saving) return;
		state.language_loading = true;
		try {
			const response = await frappe.call({
				method: "saas_theme.language.get_available_languages",
				type: "GET",
			});
			const current = String(response?.message?.current || current_language());
			const enabled = response?.message?.languages;
			if (!Array.isArray(enabled)) throw new Error("Languages are unavailable");
			const seen = new Set();
			const languages = enabled.filter((language) => {
				const code = language?.code;
				if (typeof code !== "string" || !code || seen.has(code)) return false;
				seen.add(code);
				return true;
			});
			if (!languages.length) throw new Error("No enabled languages");

			const dialog = new frappe.ui.Dialog({
				title: __("Choose Language"),
				size: "small",
				fields: [{ fieldtype: "HTML", fieldname: "language_picker" }],
			});
			state.language_dialog = dialog;
			dialog.$wrapper.addClass("st-language-dialog");
			dialog.$wrapper.on("hidden.bs.modal", () => {
				if (state.language_dialog === dialog) state.language_dialog = null;
			});

			const root = dialog.fields_dict.language_picker.$wrapper[0];
			const picker = document.createElement("div");
			picker.className = "st-language-picker";

			const intro = document.createElement("p");
			intro.className = "st-language-picker-help";
			intro.textContent = __("Select a language to update your Desk. The page will reload.");
			picker.appendChild(intro);

			const search = document.createElement("input");
			search.className = "form-control st-language-picker-search";
			search.type = "search";
			search.placeholder = __("Search languages");
			search.setAttribute("aria-label", __("Search languages"));
			picker.appendChild(search);

			const list = document.createElement("div");
			list.className = "st-language-picker-options";
			list.setAttribute("role", "group");
			list.setAttribute("aria-label", __("Available languages"));
			const buttons = [];

			for (const language of languages) {
				const code = language.code;
				const label = String(language.name || code);
				const button = document.createElement("button");
				button.type = "button";
				button.className = "st-language-picker-option";
				button.dataset.language = code;
				button.dataset.search = (label + " " + code).toLocaleLowerCase();
				if (code === current) {
					button.classList.add("is-current");
					button.setAttribute("aria-current", "true");
				}

				const name = document.createElement("span");
				name.className = "st-language-picker-name";
				name.textContent = label;
				name.dir = "auto";
				const tag = document.createElement("span");
				tag.className = "st-language-picker-code";
				tag.textContent = code.toUpperCase();
				const status = document.createElement("span");
				status.className = "st-language-picker-status";
				status.textContent = code === current ? __("Current") : "";
				button.append(name, tag, status);

				button.addEventListener("click", async () => {
					if (state.language_saving) return;
					if (code === current) {
						dialog.hide();
						return;
					}
					state.language_saving = true;
					buttons.forEach((item) => { item.disabled = true; });
					status.textContent = __("Applying...");
					try {
						await save_user_language(code);
					} catch (error) {
						state.language_saving = false;
						buttons.forEach((item) => { item.disabled = false; });
						status.textContent = "";
						frappe.msgprint(__("Could not change your language. Please try again."));
					}
				});
				buttons.push(button);
				list.appendChild(button);
			}

			search.addEventListener("input", () => {
				const term = String(search.value || "").trim().toLocaleLowerCase();
				buttons.forEach((button) => {
					button.hidden = !!term && !button.dataset.search.includes(term);
				});
			});

			picker.appendChild(list);
			root.appendChild(picker);
			dialog.show();
		} catch (error) {
			frappe.msgprint(__("Could not load available languages. Please try again."));
		} finally {
			state.language_loading = false;
		}
	}

	function ensure_home_language_button() {
		if (!frappe.session?.user || frappe.session.user === "Guest") return;
		document.querySelectorAll(".desktop-wrapper .desktop-navbar").forEach((header) => {
			if (header.querySelector(".st-home-language-button")) return;
			const notification = header.querySelector(".st-desktop-top-actions .desktop-notification-icon");
			if (!notification) return;
			const button = document.createElement("button");
			button.type = "button";
			button.className = "st-home-language-button";
			button.setAttribute("aria-label", __("Change Language"));
			button.title = __("Change Language");
			const icon = document.createElement("span");
			icon.className = "st-home-language-icon";
			icon.innerHTML = language_icon();
			const code = document.createElement("span");
			code.className = "st-home-language-code";
			code.textContent = current_language().toUpperCase();
			button.append(icon, code);
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				open_language_picker();
			});
			notification.insertAdjacentElement("beforebegin", button);
		});
	}

	function ensure_user_language_menu(root) {
		const $root = root ? $(root) : $(document);
		const $menus = $root.filter(".es-menu")
			.add($root.find(".es-menu"))
			.add($root.closest(".es-menu"));
		$menus.each(function () {
			const menu = this;
			if (menu.querySelector(".st-language-user-menu-item")) return;
			const rows = Array.from(menu.querySelectorAll(".es-menu__item"));
			const settings = String(__("Settings")).trim();
			const reload = String(__("Reload")).trim();
			const logout = String(__("Logout")).trim();
			const labels = rows.map((row) => String(
				row.querySelector(".es-menu__label")?.textContent || row.textContent || ""
			).replace(/\s+/g, " ").trim());
			if (!labels.includes(settings) || !labels.includes(reload) || !labels.includes(logout)) {
				return; // Never insert into an unrelated Frappe menu.
			}
			const settings_row = rows[labels.indexOf(settings)];
			const row = document.createElement("button");
			row.type = "button";
			row.className = "es-menu__item st-language-user-menu-item";
			row.setAttribute("role", "menuitem");
			const icon = document.createElement("span");
			icon.className = "st-language-user-menu-icon";
			icon.innerHTML = language_icon();
			const label = document.createElement("span");
			label.className = "es-menu__label";
			label.textContent = __("Language");
			row.append(icon, label);
			row.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				open_language_picker();
			});
			settings_row.insertAdjacentElement("afterend", row);
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
		const rtl = document.documentElement?.dir === "rtl" ||
			["ps", "fa", "ar", "ur"].some(code =>
				String(document.documentElement?.lang || "").toLowerCase().startsWith(code)
			);
		const icon = expanded ? (rtl ? "chevron-right" : "chevron-left")
			: (rtl ? "chevron-left" : "chevron-right");

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
		if (!sidebar || !$bottom.length) return;

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
		ensure_user_language_menu(root);
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
					// Desktop toolbar is recreated on route changes. Reattach
					// the language button beside the actual notification control.
					if (
						$node.is(".desktop-navbar, .st-desktop-top-actions, .desktop-notification-icon") ||
						$node.find(".desktop-navbar, .st-desktop-top-actions, .desktop-notification-icon").length
					) {
						ensure_home_language_button();
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
		ensure_home_language_button();
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

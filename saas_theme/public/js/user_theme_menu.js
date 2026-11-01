/* SaaS Theme — restore Toggle Theme in the Frappe v16 sidebar user menu. */
(function () {
	"use strict";

	/* Final stability layer is loaded here so it runs after the older theme passes. */
	(function load_stability_assets() {
		if (!document.getElementById("st-stability-refinement-v3-css")) {
			const link = document.createElement("link");
			link.id = "st-stability-refinement-v3-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/stability_refinement_v3.css?v=2";
			document.head.appendChild(link);
		}

		if (!document.getElementById("st-stability-refinement-v3-js")) {
			const script = document.createElement("script");
			script.id = "st-stability-refinement-v3-js";
			script.src = "/assets/saas_theme/js/stability_refinement_v3.js?v=2";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* Precision v4 corrects header/report/typography regressions without touching
	   the broader theme layers that already look good. */
	(function load_precision_v4_assets() {
		if (!document.getElementById("st-ui-precision-v4-css")) {
			const link = document.createElement("link");
			link.id = "st-ui-precision-v4-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/ui_precision_v4.css?v=1";
			document.head.appendChild(link);
		}

		if (!document.getElementById("st-ui-precision-v4-js")) {
			const script = document.createElement("script");
			script.id = "st-ui-precision-v4-js";
			script.src = "/assets/saas_theme/js/ui_precision_v4.js?v=1";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* Precision v5 is deliberately loaded after v4 and is scoped only to form
	   controls + child tables, Configure Columns and the fixed row editor. */
	(function load_child_table_precision_v5_assets() {
		if (!document.getElementById("st-child-table-precision-v5-css")) {
			const link = document.createElement("link");
			link.id = "st-child-table-precision-v5-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/child_table_precision_v5.css?v=1";
			document.head.appendChild(link);
		}

		if (!document.getElementById("st-child-table-precision-v5-js")) {
			const script = document.createElement("script");
			script.id = "st-child-table-precision-v5-js";
			script.src = "/assets/saas_theme/js/child_table_precision_v5.js?v=1";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* Precision v6 runs last and fixes only the latest checkbox/search/report
	   issues without changing the established child-table/form work. */
	(function load_ui_precision_v6_assets() {
		if (!document.getElementById("st-ui-precision-v6-css")) {
			const link = document.createElement("link");
			link.id = "st-ui-precision-v6-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/ui_precision_v6.css?v=2";
			document.head.appendChild(link);
		}

		if (!document.getElementById("st-ui-precision-v6-js")) {
			const script = document.createElement("script");
			script.id = "st-ui-precision-v6-js";
			script.src = "/assets/saas_theme/js/ui_precision_v6.js?v=2";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* Precision v6.2 owns the final inline-search interaction and exact report
	   filter-cell sizing. It waits for v6 before applying its overrides. */
	(function load_ui_precision_v6_2_assets() {
		if (!document.getElementById("st-ui-precision-v6-2-js")) {
			const script = document.createElement("script");
			script.id = "st-ui-precision-v6-2-js";
			script.src = "/assets/saas_theme/js/ui_precision_v6_2.js?v=1";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_user_theme_menu__) return;
	window.__saas_theme_user_theme_menu__ = true;

	const state = { observer: null, timer: null };

	function label_for(row) {
		return String(
			row?.querySelector?.(".es-menu__label")?.textContent || row?.textContent || ""
		)
			.replace(/\s+/g, " ")
			.trim();
	}

	function make_theme_row() {
		const is_dark = document.documentElement.getAttribute("data-theme") === "dark";
		const row = document.createElement("button");
		row.type = "button";
		row.className = "es-menu__item st-theme-toggle-menu-item";
		row.setAttribute("role", "menuitem");
		row.setAttribute("tabindex", "-1");

		try {
			row.insertAdjacentHTML(
				"beforeend",
				frappe.utils.icon(is_dark ? "sun" : "moon", "sm", "", "", "current-color", true)
			);
		} catch (e) {
			// The label still provides a usable action if an icon cannot be rendered.
		}

		const label = document.createElement("span");
		label.className = "es-menu__label";
		label.textContent = __("Toggle Theme");
		row.appendChild(label);

		row.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();

			const trigger = document.querySelector(
				'.st-top-profile-button[aria-expanded="true"], .sidebar-user-button[aria-expanded="true"], .desktop-avatar[aria-expanded="true"]'
			);
			if (trigger) trigger.click();

			setTimeout(() => {
				try {
					new frappe.ui.ThemeSwitcher().show();
				} catch (error) {
					console.warn("SaaS Theme: could not open Theme Switcher", error);
				}
			}, 20);
		});

		return row;
	}

	function ensure_theme_row(menu) {
		if (!(menu instanceof Element) || !menu.matches('.es-menu[role="menu"], .es-menu')) return;

		const rows = Array.from(menu.querySelectorAll(".es-menu__item"));
		if (!rows.length) return;

		const labels = new Set(rows.map(label_for));
		const settings = __("Settings");
		const reload = __("Reload");
		const logout = __("Logout");
		const toggle = __("Toggle Theme");

		if (!labels.has(settings) || !labels.has(reload) || !labels.has(logout)) return;
		if (labels.has(toggle)) return;

		const reload_row = rows.find((row) => label_for(row) === reload);
		if (!reload_row?.parentElement) return;

		reload_row.insertAdjacentElement("beforebegin", make_theme_row());
	}

	function refresh() {
		document.querySelectorAll('.es-menu[role="menu"], .es-menu').forEach(ensure_theme_row);
	}

	function schedule(delay = 0) {
		clearTimeout(state.timer);
		state.timer = setTimeout(refresh, delay);
	}

	$(function () {
		refresh();
		if (!document.body) return;
		state.observer = new MutationObserver(() => schedule(0));
		state.observer.observe(document.body, { childList: true, subtree: true });
	});

	$(document)
		.off("page-change.saas_theme_menu sidebar_setup.saas_theme_menu")
		.on("page-change.saas_theme_menu sidebar_setup.saas_theme_menu", () => schedule(10));
})();

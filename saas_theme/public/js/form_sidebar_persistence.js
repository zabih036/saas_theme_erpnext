(() => {
	"use strict";

	const STORAGE_KEY = "saas_theme.form_sidebar_collapsed";
	const ROOT_CLASS = "st-form-sidebar-pref-collapsed";
	const BODY_CLASS = "st-form-sidebar-collapsed";
	const BUTTON_CLASS = "st-form-sidebar-toggle";

	let preferred_collapsed = read_state();
	let apply_timer = null;
	let observer = null;
	let applying = false;

	function t(message) {
		return typeof window.__ === "function" ? window.__(message) : message;
	}

	function read_state() {
		try {
			return window.localStorage.getItem(STORAGE_KEY) === "1";
		} catch (error) {
			return false;
		}
	}

	function write_state(collapsed) {
		try {
			window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
		} catch (error) {
			// localStorage may be unavailable in restricted browser contexts.
		}
	}

	function sync_root_preference_class() {
		document.documentElement?.classList.toggle(ROOT_CLASS, preferred_collapsed);
	}

	// Apply the saved preference before the form DOM is painted. The CSS that
	// consumes this class is route-scoped, so it is harmless on non-form pages.
	sync_root_preference_class();

	function is_form_route() {
		const body_route = document.body?.dataset?.route || "";
		if (body_route.startsWith("Form")) return true;

		try {
			return window.frappe?.get_route?.()?.[0] === "Form";
		} catch (error) {
			return false;
		}
	}

	function get_active_page() {
		const pages = Array.from(document.querySelectorAll(".page-container"));
		for (let index = pages.length - 1; index >= 0; index -= 1) {
			const page = pages[index];
			if (page.offsetParent !== null && !page.classList.contains("hide")) return page;
		}
		return document.querySelector(".page-container:not(.hide)");
	}

	function attachment_preview_open(page) {
		const preview = page?.querySelector(
			".layout-side-section .attachment-preview:not(.hidden)"
		);
		return Boolean(preview && preview.offsetParent !== null);
	}

	function get_icon(collapsed) {
		if (collapsed) {
			return `
				<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/>
					<path d="M15 4v16" stroke="currentColor" stroke-width="1.7"/>
					<path d="m10 9-3 3 3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>`;
		}

		return `
			<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/>
				<path d="M15 4v16" stroke="currentColor" stroke-width="1.7"/>
				<path d="m8 9 3 3-3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`;
	}

	function update_button(button, effective_collapsed, preview_open) {
		const visual_state = `${effective_collapsed ? "collapsed" : "expanded"}:${preview_open ? "preview" : "normal"}`;
		if (button.dataset.visualState !== visual_state) {
			button.dataset.visualState = visual_state;
			button.dataset.collapsed = effective_collapsed ? "true" : "false";
			button.setAttribute("aria-pressed", effective_collapsed ? "true" : "false");
			button.innerHTML = get_icon(effective_collapsed);
		}

		button.disabled = preview_open;
		const label = preview_open
			? t("Close attachment preview before hiding the details sidebar")
			: effective_collapsed
				? t("Show details sidebar")
				: t("Hide details sidebar");
		button.setAttribute("aria-label", label);
		button.title = label;
	}

	function set_preference(collapsed) {
		preferred_collapsed = Boolean(collapsed);
		write_state(preferred_collapsed);
		sync_root_preference_class();
		apply_state();
	}

	function create_button(page) {
		const actions = page?.querySelector(".page-head .page-actions, .page-actions");
		if (!actions) return null;

		let button = actions.querySelector(`.${BUTTON_CLASS}`);
		if (button) return button;

		button = document.createElement("button");
		button.type = "button";
		button.className = `btn btn-default icon-btn ${BUTTON_CLASS}`;
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (button.disabled) return;
			set_preference(!preferred_collapsed);
		});

		actions.appendChild(button);
		return button;
	}

	function remove_stale_buttons(active_page) {
		document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((button) => {
			if (!active_page || !active_page.contains(button)) button.remove();
		});
	}

	function apply_state() {
		if (applying) return;
		applying = true;

		try {
			const page = get_active_page();
			const form_route = is_form_route();
			remove_stale_buttons(page);

			if (!form_route || !page || !page.querySelector(".form-sidebar")) {
				document.body?.classList.remove(BODY_CLASS);
				return;
			}

			const preview_open = attachment_preview_open(page);
			const effective_collapsed = preferred_collapsed && !preview_open;
			document.body?.classList.toggle(BODY_CLASS, effective_collapsed);

			const button = create_button(page);
			if (button) update_button(button, effective_collapsed, preview_open);
		} finally {
			applying = false;
		}
	}

	function schedule_apply(delay = 0) {
		window.clearTimeout(apply_timer);
		apply_timer = window.setTimeout(apply_state, delay);
	}

	function setup_router_listener() {
		try {
			if (window.frappe?.router?.on && !window.__saas_theme_form_sidebar_router_bound__) {
				window.__saas_theme_form_sidebar_router_bound__ = true;
				window.frappe.router.on("change", () => schedule_apply(0));
			}
		} catch (error) {
			// The router may initialize after this asset; the delayed setup below retries it.
		}
	}

	function setup_observer() {
		if (observer || !window.MutationObserver) return;
		const target = document.querySelector(".main-section") || document.body;
		if (!target) return;

		observer = new MutationObserver((mutations) => {
			const relevant = mutations.some((mutation) => {
				if (mutation.type !== "childList") return false;
				return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0;
			});
			if (relevant) schedule_apply(20);
		});
		observer.observe(target, { childList: true, subtree: true });
	}

	window.addEventListener("storage", (event) => {
		if (event.key !== STORAGE_KEY) return;
		preferred_collapsed = read_state();
		sync_root_preference_class();
		schedule_apply(0);
	});

	if (window.jQuery) {
		window.jQuery(document)
			.off("page-change.saas_form_sidebar_persistence")
			.on("page-change.saas_form_sidebar_persistence", () => schedule_apply(0));
	}

	function init() {
		setup_router_listener();
		setup_observer();
		schedule_apply(0);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}

	// Frappe can initialize its router after custom assets execute.
	window.setTimeout(setup_router_listener, 350);
	window.setTimeout(() => schedule_apply(0), 450);
})();

/* Load the final inline-grid popup anchor after the base theme assets. */
(() => {
	"use strict";
	if (window.__saas_theme_inline_grid_popup_loader_v5__) return;
	window.__saas_theme_inline_grid_popup_loader_v5__ = true;

	const cssId = "saas-theme-inline-grid-popup-v5-css";
	if (!document.getElementById(cssId)) {
		const link = document.createElement("link");
		link.id = cssId;
		link.rel = "stylesheet";
		link.href = "/assets/saas_theme/css/inline_grid_link_popup_anchor_v5.css?v=5";
		document.head.appendChild(link);
	}

	const scriptId = "saas-theme-inline-grid-popup-v5-js";
	if (!document.getElementById(scriptId)) {
		const script = document.createElement("script");
		script.id = scriptId;
		script.src = "/assets/saas_theme/js/inline_grid_link_popup_anchor_v5.js?v=5";
		script.async = false;
		document.head.appendChild(script);
	}
})();

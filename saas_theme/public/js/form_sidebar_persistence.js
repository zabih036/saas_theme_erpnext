(() => {
	const STORAGE_KEY = "saas_theme.form_sidebar_collapsed";
	const BUTTON_CLASS = "st-form-sidebar-toggle";
	let apply_timer = null;

	function is_form_route() {
		const body_route = document.body?.dataset?.route || "";
		if (body_route.startsWith("Form")) return true;

		try {
			return window.frappe?.get_route?.()?.[0] === "Form";
		} catch (error) {
			return false;
		}
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

	function get_active_page() {
		const pages = Array.from(document.querySelectorAll(".page-container"));
		for (let index = pages.length - 1; index >= 0; index -= 1) {
			const page = pages[index];
			if (page.offsetParent !== null && !page.classList.contains("hide")) {
				return page;
			}
		}
		return document.querySelector(".page-container:not(.hide)");
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

	function attachment_preview_open(page) {
		const preview = page?.querySelector(
			".layout-side-section .attachment-preview:not(.hidden)"
		);
		return Boolean(preview && preview.offsetParent !== null);
	}

	function update_button(button, collapsed) {
		button.dataset.collapsed = collapsed ? "true" : "false";
		button.setAttribute("aria-pressed", collapsed ? "true" : "false");
		button.setAttribute(
			"aria-label",
			collapsed ? __("Show details sidebar") : __("Hide details sidebar")
		);
		button.title = collapsed ? __("Show details sidebar") : __("Hide details sidebar");
		button.innerHTML = get_icon(collapsed);
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

			const next_state = !read_state();
			write_state(next_state);
			apply_state();
		});

		actions.appendChild(button);
		return button;
	}

	function remove_stale_buttons(active_page) {
		document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((button) => {
			if (!active_page || !active_page.contains(button)) {
				button.remove();
			}
		});
	}

	function apply_state() {
		const form_route = is_form_route();
		const page = get_active_page();
		remove_stale_buttons(page);

		if (!form_route || !page || !page.querySelector(".form-sidebar")) {
			document.body.classList.remove("st-form-sidebar-collapsed");
			return;
		}

		const collapsed = read_state();
		const preview_open = attachment_preview_open(page);
		const effective_collapsed = collapsed && !preview_open;

		document.body.classList.toggle("st-form-sidebar-collapsed", effective_collapsed);

		const button = create_button(page);
		if (button) {
			update_button(button, effective_collapsed);
			button.disabled = preview_open;
			if (preview_open) {
				button.title = __("Close attachment preview before hiding the details sidebar");
			}
		}
	}

	function schedule_apply(delay = 80) {
		window.clearTimeout(apply_timer);
		apply_timer = window.setTimeout(apply_state, delay);
	}

	function setup_router_listener() {
		try {
			if (window.frappe?.router?.on) {
				window.frappe.router.on("change", () => schedule_apply(120));
			}
		} catch (error) {
			// Older/newer Frappe shells may initialize the router later.
		}
	}

	function setup_observer() {
		const target = document.querySelector(".main-section") || document.body;
		if (!target || !window.MutationObserver) return;

		const observer = new MutationObserver(() => schedule_apply(80));
		observer.observe(target, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class", "data-route"],
		});
	}

	window.addEventListener("storage", (event) => {
		if (event.key === STORAGE_KEY) schedule_apply(0);
	});

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			setup_router_listener();
			setup_observer();
			schedule_apply(120);
		});
	} else {
		setup_router_listener();
		setup_observer();
		schedule_apply(120);
	}

	// Frappe can initialize the router after custom assets execute.
	window.setTimeout(setup_router_listener, 700);
	window.setTimeout(() => schedule_apply(0), 800);
})();

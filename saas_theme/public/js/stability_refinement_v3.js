/*
 * SaaS Theme — Stability Refinement v3
 * Conservative runtime fixes for Frappe v16.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_stability_v3__) return;
	window.__saas_theme_stability_v3__ = true;

	const state = {
		timer: null,
		patched_sidebar: false,
	};

	function blocking_layer_is_open() {
		return !!document.querySelector(
			'.modal.show, .modal.in, .modal-backdrop.show, .offcanvas.show, [role="dialog"][aria-modal="true"]:not([aria-hidden="true"]), #st-login-loader.is-visible'
		);
	}

	function mobile_sidebar_is_open() {
		try {
			return !!(frappe.is_mobile?.() && frappe.app?.sidebar?.sidebar_expanded);
		} catch (e) {
			return false;
		}
	}

	function release_stale_scroll_lock() {
		if (!document.body || blocking_layer_is_open() || mobile_sidebar_is_open()) return;

		if (document.body.style.overflow === "hidden") {
			document.body.style.removeProperty("overflow");
		}
		if (document.body.style.overflowY === "hidden") {
			document.body.style.removeProperty("overflow-y");
		}
		if (document.documentElement.style.overflow === "hidden") {
			document.documentElement.style.removeProperty("overflow");
		}
		if (document.documentElement.style.overflowY === "hidden") {
			document.documentElement.style.removeProperty("overflow-y");
		}

		$(".main-section").each(function () {
			if (this.style.overflow === "hidden") this.style.removeProperty("overflow");
			if (this.style.overflowY === "hidden") this.style.removeProperty("overflow-y");
		});
	}

	function patch_sidebar_scroll_helpers() {
		const proto = frappe.ui?.Sidebar?.prototype;
		if (!proto || proto.__saas_theme_scroll_stability_v3) return false;

		const original_set_height = proto.set_height;
		const original_prevent_scroll = proto.prevent_scroll;

		if (typeof original_set_height === "function") {
			proto.set_height = function () {
				const result = original_set_height.apply(this, arguments);
				if (!frappe.is_mobile?.()) {
					document.body?.style.removeProperty("overflow");
					document.documentElement?.style.removeProperty("overflow");
				}
				return result;
			};
		}

		if (typeof original_prevent_scroll === "function") {
			proto.prevent_scroll = function () {
				if (frappe.is_mobile?.()) {
					return original_prevent_scroll.apply(this, arguments);
				}
				$(".main-section").css({ overflow: "", overflowY: "" });
				document.body?.style.removeProperty("overflow");
				document.body?.style.removeProperty("overflow-y");
			};
		}

		proto.__saas_theme_scroll_stability_v3 = true;
		state.patched_sidebar = true;
		return true;
	}

	function classify_form_layouts() {
		$(".form-layout").each(function () {
			const $layout = $(this);
			const $tab_list = $layout.find("> .form-page > .form-tabs-list").first();
			let visible_tabs = 0;

			if ($tab_list.length && $tab_list.is(":visible")) {
				visible_tabs = $tab_list.find(".nav-link:visible").length;
			}

			/*
			 * A form with zero or one visible tab behaves as one continuous surface.
			 * Mark only those forms for section cards. Multi-tab forms keep their
			 * existing theme treatment so good layouts are not restyled again.
			 */
			$layout.toggleClass("st-section-card-form", visible_tabs <= 1);
		});
	}

	function repair_page_header() {
		/* Home replaces the native hamburger. */
		$(".page-head .sidebar-toggle-btn.navbar-brand").attr("aria-hidden", "true").hide();

		/* Remove only the ellipsis immediately beside the title/breadcrumb. */
		$(".page-head .page-title .title-area > .more-button")
			.attr("aria-hidden", "true")
			.hide();

		/*
		 * Re-run the existing theme shell once the page actions exist. This is the
		 * source of Search / Notifications / Profile and avoids cloning or replacing
		 * Frappe controls ourselves.
		 */
		try {
			window.saas_theme?.mobile_shell?.refresh?.();
		} catch (e) {
			// Header is still usable even if the shell is not initialized yet.
		}

		$(".page-head:visible .st-page-utility-actions")
			.css({ visibility: "visible", opacity: "1" })
			.removeClass("hidden");
		$(".page-head:visible .st-top-profile, .page-head:visible .st-top-profile-button")
			.css({ visibility: "visible", opacity: "1" })
			.removeClass("hidden");
	}

	function refresh() {
		patch_sidebar_scroll_helpers();
		repair_page_header();
		classify_form_layouts();
		release_stale_scroll_lock();
	}

	function schedule(delay = 10) {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => {
			refresh();
			/* Catch controls added slightly after Frappe's route render. */
			setTimeout(() => {
				repair_page_header();
				classify_form_layouts();
				release_stale_scroll_lock();
			}, 90);
			setTimeout(() => {
				repair_page_header();
				classify_form_layouts();
				release_stale_scroll_lock();
			}, 320);
		}, delay);
	}

	$(document)
		.off("page-change.saas_stability_v3 sidebar_setup.saas_stability_v3 toolbar_setup.saas_stability_v3")
		.on(
			"page-change.saas_stability_v3 sidebar_setup.saas_stability_v3 toolbar_setup.saas_stability_v3",
			() => schedule(5)
		);

	$(window)
		.off("pageshow.saas_stability_v3 resize.saas_stability_v3")
		.on("pageshow.saas_stability_v3 resize.saas_stability_v3", () => schedule(20));

	$(function () {
		refresh();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule(10));
		}
	});

	/* Sidebar may initialize after theme assets; patch for a short bounded window. */
	let tries = 0;
	const patch_timer = setInterval(() => {
		tries += 1;
		if (patch_sidebar_scroll_helpers() || tries >= 24) {
			clearInterval(patch_timer);
		}
	}, 250);
})();

/*
 * SaaS Theme — Stability Refinement v3
 * Prevent Frappe's desktop sidebar height/toggle helpers from leaving the Desk
 * body or main section scroll-locked after route changes.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_stability_v3__) return;
	window.__saas_theme_stability_v3__ = true;

	const state = { timer: null, patched: false };

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

		/* Frappe Sidebar.set_height() writes overflow:hidden directly to body. */
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

		/* Frappe Sidebar.prevent_scroll() writes overflow:hidden to .main-section. */
		$(".main-section").each(function () {
			const node = this;
			if (node.style.overflow === "hidden") node.style.removeProperty("overflow");
			if (node.style.overflowY === "hidden") node.style.removeProperty("overflow-y");
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
				/* The body lock is useful for a mobile drawer, but not a desktop sidebar. */
				if (!frappe.is_mobile?.()) {
					document.body?.style.removeProperty("overflow");
				}
				return result;
			};
		}

		if (typeof original_prevent_scroll === "function") {
			proto.prevent_scroll = function () {
				if (frappe.is_mobile?.()) {
					return original_prevent_scroll.apply(this, arguments);
				}
				$(".main-section").css("overflow", "");
				document.body?.style.removeProperty("overflow");
			};
		}

		proto.__saas_theme_scroll_stability_v3 = true;
		state.patched = true;
		return true;
	}

	function cleanup_page_header() {
		/* The theme Home button replaces this native hamburger in the page title. */
		$(".page-head .sidebar-toggle-btn.navbar-brand").attr("aria-hidden", "true").hide();
	}

	function refresh() {
		patch_sidebar_scroll_helpers();
		cleanup_page_header();
		release_stale_scroll_lock();
	}

	function schedule() {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => {
			refresh();
			/* Catch locks applied slightly after route rendering. */
			setTimeout(release_stale_scroll_lock, 80);
			setTimeout(release_stale_scroll_lock, 320);
		}, 10);
	}

	$(document)
		.off("page-change.saas_stability_v3 sidebar_setup.saas_stability_v3 toolbar_setup.saas_stability_v3")
		.on(
			"page-change.saas_stability_v3 sidebar_setup.saas_stability_v3 toolbar_setup.saas_stability_v3",
			schedule
		);

	$(window)
		.off("pageshow.saas_stability_v3 resize.saas_stability_v3")
		.on("pageshow.saas_stability_v3 resize.saas_stability_v3", schedule);

	$(function () {
		refresh();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(schedule);
		}
	});

	/* Sidebar can initialize after theme assets; patch for a short bounded window. */
	let tries = 0;
	const patch_timer = setInterval(() => {
		tries += 1;
		if (patch_sidebar_scroll_helpers() || tries >= 24) {
			clearInterval(patch_timer);
		}
	}, 250);
})();

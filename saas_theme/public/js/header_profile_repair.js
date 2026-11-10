/*
 * SaaS Theme — UI Precision v4
 * Focused runtime repair for the page-header utility cluster.
 * The profile avatar is rendered independently from the dropdown binding so it
 * never disappears when Frappe's Sidebar API initializes later than the page.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_ui_precision_v4__) return;
	window.__saas_theme_ui_precision_v4__ = true;

	const state = {
		timer: null,
		observer: null,
	};

	function escape_html(value) {
		const text = String(value || "");
		try {
			return frappe.utils.escape_html(text);
		} catch (e) {
			return text.replace(/[&<>'"]/g, (char) => ({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"'": "&#39;",
				'"': "&quot;",
			}[char]));
		}
	}

	function profile_avatar_html() {
		try {
			const avatar = frappe.avatar?.(frappe.session?.user, "avatar-medium");
			if (avatar) return avatar;
		} catch (e) {
			// Fall through to initials.
		}

		const full_name =
			frappe.boot?.user?.full_name ||
			frappe.boot?.user_info?.[frappe.session?.user]?.fullname ||
			frappe.session?.user ||
			__("User");
		const initial = String(full_name).trim().charAt(0).toUpperCase() || "U";
		return `<span class="st-profile-fallback-avatar" aria-hidden="true">${escape_html(initial)}</span>`;
	}

	function ensure_utility_container($head) {
		const $section = $head.find(".standard-items-section").first();
		if (!$section.length) return $();

		let $utilities = $section.children(".st-page-utility-actions").first();
		if (!$utilities.length) {
			$utilities = $('<div class="st-page-utility-actions" aria-label="Page utilities"></div>');
			$section.append($utilities);
		}

		// The utility cluster must always be the last child so profile remains at
		// the far-right even when Frappe rebuilds page actions.
		if (!$utilities.is($section.children().last())) {
			$utilities.appendTo($section);
		}

		return $utilities;
	}

	function bind_profile_menu($profile, $button) {
		if (!$profile.length || !$button.length) return;
		if ($profile.data("st-user-menu-ready") || $profile.data("st-v4-user-menu-ready")) return;

		const sidebar = frappe.app?.sidebar;
		if (!sidebar || typeof sidebar.create_user_menu !== "function") return;

		try {
			sidebar.create_user_menu({
				parent: $profile,
				button: $button,
				side: "bottom",
				align: "end",
			});
			$profile.data("st-v4-user-menu-ready", 1);
		} catch (error) {
			// Avatar stays visible; a later refresh will retry menu binding.
			console.debug("SaaS Theme: profile menu binding will retry", error);
		}
	}

	function ensure_profile($head) {
		const $utilities = ensure_utility_container($head);
		if (!$utilities.length || frappe.session?.user === "Guest") return;

		let $profile = $utilities.children(".st-top-profile").first();
		if (!$profile.length) {
			$profile = $('<div class="st-top-profile dropdown-navbar-user"></div>');
			$utilities.append($profile);
		}

		let $button = $profile.children(".st-top-profile-button").first();
		if (!$button.length) {
			$button = $(
				`<button type="button" class="btn-reset st-top-profile-button" aria-label="${escape_html(
					__("User Menu")
				)}" title="${escape_html(__("User Menu"))}"></button>`
			);
			$profile.prepend($button);
		}

		// If an earlier render produced an empty button, restore its avatar.
		if (!$button.find(".avatar, .avatar-frame, img, .st-profile-fallback-avatar").length) {
			$button.empty().append(profile_avatar_html());
		}

		$profile
			.removeClass("hidden hide")
			.attr("aria-hidden", "false")
			.css({ display: "inline-flex", visibility: "visible", opacity: "1" });
		$button
			.removeClass("hidden hide")
			.attr("aria-hidden", "false")
			.css({ display: "inline-flex", visibility: "visible", opacity: "1" });

		// Keep profile last even if another utility was inserted after it.
		$profile.appendTo($utilities);
		bind_profile_menu($profile, $button);
	}

	function repair_headers() {
		$(".page-head:visible").each(function () {
			const $head = $(this);
			ensure_profile($head);
		});
	}

	function schedule(delay = 20) {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => {
			repair_headers();
			// Frappe may rebuild standard actions shortly after route render.
			setTimeout(repair_headers, 100);
			setTimeout(repair_headers, 350);
		}, delay);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver((mutations) => {
			const relevant = mutations.some((mutation) =>
				Array.from(mutation.addedNodes || []).some(
					(node) => node.nodeType === 1 && (node.matches?.(".page-head, .standard-items-section") || node.querySelector?.(".page-head, .standard-items-section"))
				)
			);
			if (relevant) schedule(30);
		});
		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	$(document)
		.off("page-change.saas_ui_precision_v4 sidebar_setup.saas_ui_precision_v4 toolbar_setup.saas_ui_precision_v4")
		.on(
			"page-change.saas_ui_precision_v4 sidebar_setup.saas_ui_precision_v4 toolbar_setup.saas_ui_precision_v4",
			() => schedule(10)
		);

	$(window)
		.off("pageshow.saas_ui_precision_v4 resize.saas_ui_precision_v4")
		.on("pageshow.saas_ui_precision_v4 resize.saas_ui_precision_v4", () => schedule(30));

	$(function () {
		repair_headers();
		setup_observer();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule(10));
		}
	});
})();

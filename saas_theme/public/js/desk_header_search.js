/*
 * SaaS Theme — Desk-only header command search cleanup.
 *
 * Frappe v16's native AwesomeBar and this theme's late-loaded header
 * embellishments can independently produce a centered "Search or type a
 * command" control. We suppress ONLY the redundant Desk page-header
 * entry point; the global search engine, Ctrl+K fallback, Sidebar Search,
 * filters and the Desktop Home search remain untouched.
 */
(() => {
	"use strict";

	if (window.__st_desk_header_search_scope_v1__) return;
	window.__st_desk_header_search_scope_v1__ = true;

	const HEADER = ".page-container .page-head";
	const CLASS = "st-desk-command-search-hidden";
	const DIRECT = [
		"#full-search-button",             // Frappe AwesomeBar.setup_correct_button()
		"#small-search-button",            // Frappe ui/page.html, desktop only
		".navbar-search-bar",
		".search-widget-wrapper",
		".st-top-search",
		".st-header-search-shell",
		".st-header-search-slot",
		".st-v62-search-trigger",
	].join(", ");
	const saved = new WeakMap();
	let timer = null;
	let observer = null;

	const desktop = () => !window.matchMedia?.("(max-width: 767px)")?.matches;
	const label = () => {
		const translated = typeof window.__ === "function" ? __("Search or type a command") : "";
		return ["search or type a command", translated].filter(Boolean)
			.map(value => String(value).trim().toLocaleLowerCase());
	};
	const isHome = header => !!header.closest?.(".desktop-wrapper, .desktop-navbar");

	function suppress(el) {
		if (!el || isHome(el)) return;
		if (!saved.has(el)) {
			saved.set(el, {
				display: el.style?.getPropertyValue("display") || "",
				priority: el.style?.getPropertyPriority("display") || "",
				aria: el.getAttribute?.("aria-hidden"),
			});
		}
		el.classList.add(CLASS);
		el.style?.setProperty("display", "none", "important");
		el.setAttribute?.("aria-hidden", "true");
	}

	function restore(el) {
		const original = saved.get(el);
		if (!original) return;
		el.classList.remove(CLASS);
		if (original.display) {
			el.style?.setProperty("display", original.display, original.priority);
		} else {
			el.style?.removeProperty("display");
		}
		if (original.aria === null || original.aria === undefined) {
			el.removeAttribute?.("aria-hidden");
		} else {
			el.setAttribute?.("aria-hidden", original.aria);
		}
		saved.delete(el);
	}

	function searchControl(el) {
		// Some Frappe installations render the entire command search as
		// a custom button/label rather than #full-search-button. Find the
		// exact control by its text or placeholder, never a document filter.
		const values = [
			el.getAttribute?.("placeholder"),
			el.getAttribute?.("aria-label"),
			el.getAttribute?.("title"),
			el.textContent,
		].filter(Boolean).map(v => String(v).trim().toLocaleLowerCase());
		if (!values.some(value => label().some(needle => value.includes(needle)))) return null;
		if (el.matches?.("input")) {
			const shell = el.closest?.(
				".st-header-search-shell, .st-header-search-slot, .navbar-search-bar, .search-widget-wrapper, .search-bar, label, button"
			);
			return shell && shell.closest?.(HEADER) ? shell : el;
		}
		return el.closest?.(
			".st-header-search-shell, .st-header-search-slot, .navbar-search-bar, .search-widget-wrapper, .search-bar"
		) || el;
	}

	function refresh() {
		const headers = document.querySelectorAll(HEADER);
		for (const header of headers) {
			if (isHome(header)) continue;
			if (!desktop()) {
				header.querySelectorAll("." + CLASS).forEach(restore);
				continue;
			}
			// Native Frappe and prior theme shell owners may insert either
			// an identified search widget or a plain clickable field.
			header.querySelectorAll(DIRECT).forEach(suppress);
			header.querySelectorAll(
				'input[placeholder], button, [role="button"], [role="searchbox"], [tabindex]'
			).forEach(el => {
				if (el.closest?.(".st-sidebar-search, .st-page-utility-actions .st-top-profile, .st-top-notification-host")) return;
				const control = searchControl(el);
				if (control) suppress(control);
			});
		}
	}

	function schedule(delay = 25) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			refresh();
		}, delay);
	}

	function relevant(record) {
		if (record.target?.nodeType === 1 && record.target.closest?.(HEADER)) {
			return record.addedNodes.length > 0;
		}
		return Array.from(record.addedNodes).some(node =>
			node.nodeType === 1 &&
			(node.matches?.(HEADER) || node.querySelector?.(HEADER))
		);
	}

	function start() {
		refresh();
		if (!observer && document.body && typeof MutationObserver === "function") {
			observer = new MutationObserver(records => {
				if (records.some(relevant)) schedule(30);
			});
			observer.observe(document.body, {childList: true, subtree: true});
		}
	}

	if (typeof window.$ === "function") {
		$(document).on(
			"page-change.st_desk_header_search form-refresh.st_desk_header_search toolbar_setup.st_desk_header_search",
			() => {
				schedule(15);
				setTimeout(refresh, 140);
				setTimeout(refresh, 380);
			}
		);
		$(start);
	} else if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, {once: true});
	} else {
		start();
	}

	window.addEventListener("resize", () => schedule(80), {passive: true});
})();

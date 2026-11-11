/*
 * SaaS Theme — modern Frappe v16 navigation sidebar.
 * This owner adds one accessible global Search entry and visual scope; it never
 * moves or clones Frappe's native navbar search, sidebar items or event handlers.
 * The real Frappe SearchDialog owns results, permissions, shortcuts and focus.
 */
(() => {
	"use strict";
	if (window.__st_modern_sidebar_v1__) return;
	window.__st_modern_sidebar_v1__ = true;

	const ROOT = ".body-sidebar-container";
	const SEARCH_CLASS = "st-sidebar-search-control";
	let refreshTimer = null;
	let observer = null;
	const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.9" cy="10.9" r="6.7"/><path d="m16.1 16.1 4.5 4.5"/></svg>';

	function label(text) {
		return typeof window.__ === "function" ? __(text) : text;
	}

	function isMobile() {
		// Frappe's breakpoint also controls the native sidebar drawer.
		if (window.frappe && typeof frappe.is_mobile === "function") {
			return frappe.is_mobile();
		}
		return !!window.matchMedia?.("(max-width: 767px)").matches;
	}

	function visible(node) {
		return !!(node && node.isConnected && node.getClientRects().length);
	}

	function openSearch() {
		const search = window.frappe?.searchdialog?.search;
		if (typeof search?.open_global_search_dialog === "function") {
			search.open_global_search_dialog();
			return true;
		}
		if (typeof search?.init_search === "function") {
			search.init_search("", "global_search");
			return true;
		}
		// Keep the native search usable if a Frappe build changes SearchDialog.
		const native = document.querySelector(
			".desktop-navbar .search-widget-button, .desktop-navbar .search-widget-wrapper button, #small-search-button"
		);
		if (native) {
			native.click();
			return true;
		}
		return false;
	}

	function ensureSearch(panel) {
		const sidebar = panel.querySelector(".body-sidebar");
		if (!sidebar) return;
		panel.classList.add("st-sidebar-modern");
		let shell = sidebar.querySelector(":scope > .st-sidebar-search");
		if (!shell) {
			shell = document.createElement("div");
			shell.className = "st-sidebar-search";
			const button = document.createElement("button");
			button.type = "button";
			button.className = SEARCH_CLASS;
			button.setAttribute("aria-label", label("Search"));
			button.setAttribute("title", label("Search"));
			const icon = document.createElement("span");
			icon.className = "st-sidebar-search-icon";
			icon.setAttribute("aria-hidden", "true");
			icon.innerHTML = searchIcon;
			const caption = document.createElement("span");
			caption.className = "st-sidebar-search-caption";
			caption.textContent = label("Search");
			const shortcut = document.createElement("kbd");
			shortcut.className = "st-sidebar-search-shortcut";
			shortcut.setAttribute("aria-hidden", "true");
			shortcut.textContent = "/";
			button.append(icon, caption, shortcut);
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				openSearch();
			});
			shell.appendChild(button);
		}
		// SidebarHeader is inserted dynamically by Frappe; keep our search
		// just below it and above the scrolling navigation, without touching
		// the native standard-items-band or native sidebar item hierarchy.
		const header = sidebar.querySelector(":scope > .sidebar-header");
		const standard = sidebar.querySelector(":scope > .standard-items-band");
		const scroller = sidebar.querySelector(":scope > .body-sidebar-top");
		const anchor = header || standard || scroller;
		if (header) {
			if (header.nextElementSibling !== shell) header.after(shell);
		} else if (anchor && anchor !== shell && anchor.previousElementSibling !== shell) {
			anchor.before(shell);
		} else if (!shell.isConnected) {
			sidebar.prepend(shell);
		}
	}

	function refresh() {
		let available = false;
		document.querySelectorAll(ROOT).forEach((panel) => {
			ensureSearch(panel);
			if (visible(panel) && panel.classList.contains("expanded") &&
				!panel.classList.contains("sidebar-hidden") &&
				!isMobile()) {
				available = true;
			}
		});
		// Hide only the top search on desktop, and only when the sidebar
		// replacement is actually available. Collapsed/sidebar-free pages
		// and mobile retain their original Frappe search entry.
		document.body.classList.toggle("st-sidebar-search-available", available);
	}

	function schedule(delay = 25) {
		clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => {
			refreshTimer = null;
			refresh();
		}, delay);
	}

	function isRelevantMutation(record) {
		const target = record.target;
		if (target?.nodeType === 1 && target.closest?.(ROOT)) {
			// Ignore our own decoration being inserted; no repeated search UI.
			return Array.from(record.addedNodes).some((node) =>
				node.nodeType === 1 && !node.classList?.contains("st-sidebar-search")
			) || Array.from(record.removedNodes).some((node) =>
				node.nodeType === 1 && !node.classList?.contains("st-sidebar-search")
			);
		}
		return [...record.addedNodes, ...record.removedNodes].some((node) =>
			node.nodeType === 1 && (
				node.matches?.(ROOT) || node.querySelector?.(ROOT)
			)
		);
	}

	function start() {
		refresh();
		if (!observer && document.body && typeof MutationObserver === "function") {
			observer = new MutationObserver((records) => {
				if (records.some(isRelevantMutation)) schedule(35);
			});
			observer.observe(document.body, {childList: true, subtree: true});
		}
	}

	document.addEventListener("keydown", (event) => {
		if (event.defaultPrevented || event.key !== "/" || event.ctrlKey ||
			event.altKey || event.metaKey || isMobile() ||
			!document.body.classList.contains("st-sidebar-search-available")) return;
		const target = event.target;
		if (target?.isContentEditable || target?.closest?.("input, textarea, select, [contenteditable], [role='textbox']")) return;
		if (openSearch()) event.preventDefault();
	});

	if (typeof window.$ === "function") {
		$(document).on(
			"page-change.st_sidebar_modern sidebar_setup.st_sidebar_modern sidebar-expand.st_sidebar_modern desktop_screen.st_sidebar_modern",
			() => schedule(25)
		);
		$(start);
	} else if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, {once: true});
	} else {
		start();
	}
	window.addEventListener("resize", () => schedule(90), {passive: true});
})();

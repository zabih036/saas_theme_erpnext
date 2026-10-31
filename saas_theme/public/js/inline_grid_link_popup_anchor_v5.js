/*
 * SaaS Theme — Inline Grid Link Popup Anchor v5
 *
 * CSS-only `top: 100%` positioning is unreliable inside Frappe editable grid
 * rows because the Awesomplete wrapper can inherit grid/table geometry that is
 * taller than the visible input. This module portals only OPEN inline-grid
 * Awesomplete lists to <body> and positions them from the real input rectangle.
 *
 * Scope: editable child-table rows only. Normal form Link fields and Awesome
 * Bar are intentionally untouched.
 */
(function () {
	"use strict";

	if (window.__saas_theme_inline_grid_popup_v5__) return;
	window.__saas_theme_inline_grid_popup_v5__ = true;

	const OPEN_CLASS = "st-inline-grid-link-popup-v5";
	const portals = new Map();
	let raf = 0;
	let observer = null;

	function is_inline_grid_input(input) {
		return Boolean(
			input instanceof HTMLInputElement &&
			input.closest(".form-grid .editable-row") &&
			input.parentElement?.classList.contains("awesomplete")
		);
	}

	function find_local_list(input) {
		const wrapper = input?.parentElement;
		if (!wrapper?.classList.contains("awesomplete")) return null;

		return Array.from(wrapper.children).find(
			(child) => child.matches?.("ul, [role='listbox']")
		) || null;
	}

	function is_open(list) {
		if (!(list instanceof Element) || !list.isConnected) return false;
		if (list.hidden || list.hasAttribute("hidden")) return false;
		const style = window.getComputedStyle(list);
		return style.display !== "none" && style.visibility !== "hidden";
	}

	function set_important(el, prop, value) {
		el.style.setProperty(prop, value, "important");
	}

	function clear_position(el) {
		[
			"position",
			"top",
			"left",
			"right",
			"bottom",
			"width",
			"min-width",
			"max-width",
			"max-height",
			"transform",
			"translate",
			"margin",
		].forEach((prop) => el.style.removeProperty(prop));
	}

	function position_portal(list, meta) {
		const input = meta?.input;
		if (!input?.isConnected || !is_open(list)) return;

		const rect = input.getBoundingClientRect();
		if (!rect.width || !rect.height) return;

		const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
		const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
		const gap = 6;
		const edge = 10;
		const width = Math.max(180, Math.round(rect.width));
		const left = Math.max(edge, Math.min(rect.left, viewportWidth - width - edge));
		const availableBelow = Math.max(96, viewportHeight - rect.bottom - gap - edge);
		const maxHeight = Math.min(300, availableBelow);

		set_important(list, "position", "fixed");
		set_important(list, "top", `${Math.round(rect.bottom + gap)}px`);
		set_important(list, "left", `${Math.round(left)}px`);
		set_important(list, "right", "auto");
		set_important(list, "bottom", "auto");
		set_important(list, "width", `${width}px`);
		set_important(list, "min-width", `${width}px`);
		set_important(list, "max-width", `${Math.min(width, viewportWidth - edge * 2)}px`);
		set_important(list, "max-height", `${Math.round(maxHeight)}px`);
		set_important(list, "transform", "none");
		set_important(list, "translate", "none");
		set_important(list, "margin", "0");
	}

	function portalize(input, list) {
		if (!is_inline_grid_input(input) || !is_open(list)) return;

		if (portals.has(list)) {
			position_portal(list, portals.get(list));
			return;
		}

		const parent = list.parentNode;
		if (!parent) return;

		const marker = document.createComment("saas-theme-inline-grid-popup-v5");
		parent.insertBefore(marker, list);

		const meta = { input, parent, marker };
		portals.set(list, meta);
		list.classList.add(OPEN_CLASS);
		document.body.appendChild(list);
		position_portal(list, meta);
	}

	function restore(list) {
		const meta = portals.get(list);
		if (!meta) return;

		list.classList.remove(OPEN_CLASS);
		clear_position(list);

		if (meta.parent?.isConnected) {
			if (meta.marker?.parentNode === meta.parent) {
				meta.parent.insertBefore(list, meta.marker);
				meta.marker.remove();
			} else {
				meta.parent.appendChild(list);
			}
		} else {
			meta.marker?.remove();
			list.remove();
		}

		portals.delete(list);
	}

	function cleanup_closed() {
		for (const [list, meta] of Array.from(portals.entries())) {
			if (!meta.input?.isConnected || !is_open(list)) restore(list);
		}
	}

	function scan_open_inline_grid_popups() {
		document
			.querySelectorAll(".form-grid .editable-row .awesomplete > input")
			.forEach((input) => {
				const list = find_local_list(input);
				if (list && is_open(list)) portalize(input, list);
			});

		cleanup_closed();
	}

	function schedule_scan() {
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			raf = 0;
			scan_open_inline_grid_popups();
		});
	}

	function reposition_open() {
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			raf = 0;
			for (const [list, meta] of portals.entries()) {
				if (is_open(list) && meta.input?.isConnected) position_portal(list, meta);
			}
		});
	}

	function restore_all() {
		for (const list of Array.from(portals.keys())) restore(list);
	}

	document.addEventListener("focusin", (event) => {
		if (is_inline_grid_input(event.target)) {
			requestAnimationFrame(schedule_scan);
			setTimeout(schedule_scan, 40);
		}
	}, true);

	document.addEventListener("input", (event) => {
		if (is_inline_grid_input(event.target)) {
			requestAnimationFrame(schedule_scan);
			setTimeout(schedule_scan, 40);
		}
	}, true);

	document.addEventListener("awesomplete-open", (event) => {
		if (!is_inline_grid_input(event.target)) return;
		requestAnimationFrame(schedule_scan);
	}, true);

	document.addEventListener("awesomplete-close", () => {
		setTimeout(cleanup_closed, 0);
	}, true);

	window.addEventListener("resize", reposition_open, { passive: true });
	window.addEventListener("scroll", reposition_open, { passive: true, capture: true });

	if (document.body) {
		observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "attributes" ||
					mutation.addedNodes.length ||
					mutation.removedNodes.length
				) {
					schedule_scan();
					break;
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["hidden", "class", "style"],
		});
	}

	if (window.jQuery) {
		$(document)
			.off("page-change.saasInlineGridPopupV5")
			.on("page-change.saasInlineGridPopupV5", restore_all);
	}
})();

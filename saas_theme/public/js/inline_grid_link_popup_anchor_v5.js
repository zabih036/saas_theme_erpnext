/*
 * SaaS Theme — v7 inline-grid popup geometry correction.
 *
 * The v7 interaction controller remains the single owner of popup discovery,
 * portal/restore lifecycle and stacking. This compatibility asset is already
 * loaded by the historical theme bootstrap; it only corrects the final
 * geometry of the popup after v7 has portaled it to <body>.
 *
 * This preserves the exact PR #49 theme/loading behavior while fixing the
 * narrow Item / Default Warehouse Link dropdown reported after PR #49.
 */
(function () {
	"use strict";

	if (window.__saas_theme_inline_grid_popup_width_fix_v5__) return;
	window.__saas_theme_inline_grid_popup_width_fix_v5__ = true;

	let frame = 0;

	function fieldType(input) {
		return String(
			input?.dataset?.fieldtype ||
			input?.getAttribute?.("data-fieldtype") ||
			input?.closest?.("[data-fieldtype]")?.getAttribute?.("data-fieldtype") ||
			""
		);
	}

	function isActiveInlineLink(input) {
		return Boolean(
			input instanceof HTMLInputElement &&
			input.closest(".form-grid .editable-row") &&
			input.closest(".grid-static-col, .grid-field") &&
			["Link", "Dynamic Link", "Autocomplete"].includes(fieldType(input))
		);
	}

	function popupIsVisible(list) {
		if (!(list instanceof Element) || !list.isConnected || list.hidden) return false;
		const style = window.getComputedStyle(list);
		return style.display !== "none" && style.visibility !== "hidden";
	}

	function anchorRect(input) {
		const candidates = [
			input.closest(".control-input-wrapper"),
			input.closest(".frappe-control"),
			input.closest(".grid-field"),
			input.closest(".grid-static-col"),
			input,
		].filter(Boolean);

		// A tiny hidden/icon input was the cause of the narrow vertical popup.
		// Prefer the visible field/cell rectangle and reject suspiciously small
		// anchors while keeping the same v7 portal and stacking behavior.
		for (const element of candidates) {
			const rect = element.getBoundingClientRect();
			if (rect.width >= 160 && rect.height > 0 && rect.height < 140) return rect;
		}

		return input.getBoundingClientRect();
	}

	function correctGeometry() {
		frame = 0;

		const input = document.activeElement;
		if (!isActiveInlineLink(input)) return;

		const list = document.querySelector("body > .st-v7-inline-grid-popup");
		if (!popupIsVisible(list)) return;

		const rect = anchorRect(input);
		if (!rect.width || !rect.height) return;

		const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
		const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
		const edge = 10;
		const gap = 5;
		const width = Math.max(180, Math.round(rect.width));
		const left = Math.max(edge, Math.min(Math.round(rect.left), viewportWidth - width - edge));
		const maxHeight = Math.min(
			300,
			Math.max(100, Math.floor(viewportHeight - rect.bottom - gap - edge))
		);

		list.style.setProperty("position", "fixed", "important");
		list.style.setProperty("top", `${Math.round(rect.bottom + gap)}px`, "important");
		list.style.setProperty("left", `${left}px`, "important");
		list.style.setProperty("right", "auto", "important");
		list.style.setProperty("bottom", "auto", "important");
		list.style.setProperty("width", `${width}px`, "important");
		list.style.setProperty("min-width", `${width}px`, "important");
		list.style.setProperty("max-width", `${width}px`, "important");
		list.style.setProperty("max-height", `${maxHeight}px`, "important");
		list.style.setProperty("transform", "none", "important");
		list.style.setProperty("translate", "none", "important");
		list.style.setProperty("margin", "0", "important");
	}

	function runAfterCurrentEvent() {
		// v7 also listens to scroll/resize and may recalculate the popup from the
		// raw input width. Correct once now, then once again in the microtask queue
		// so our final geometry wins before the browser paints the next frame.
		correctGeometry();
		if (typeof window.queueMicrotask === "function") {
			window.queueMicrotask(correctGeometry);
		} else {
			Promise.resolve().then(correctGeometry);
		}
	}

	function scheduleCorrection() {
		if (frame) cancelAnimationFrame(frame);

		// Opening/focusing can involve several Frappe DOM passes. Keep one final
		// animation-frame correction for that lifecycle, while scroll uses the
		// synchronous/microtask path below so width never visibly collapses.
		frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(correctGeometry);
		});
	}

	document.addEventListener(
		"focusin",
		(event) => {
			if (!isActiveInlineLink(event.target)) return;
			runAfterCurrentEvent();
			scheduleCorrection();
			setTimeout(scheduleCorrection, 40);
			setTimeout(scheduleCorrection, 100);
		},
		true
	);

	document.addEventListener(
		"input",
		(event) => {
			if (!isActiveInlineLink(event.target)) return;
			runAfterCurrentEvent();
			scheduleCorrection();
			setTimeout(scheduleCorrection, 40);
		},
		true
	);

	document.addEventListener(
		"awesomplete-open",
		() => {
			runAfterCurrentEvent();
			scheduleCorrection();
			setTimeout(scheduleCorrection, 50);
		},
		true
	);

	window.addEventListener("resize", runAfterCurrentEvent, { passive: true });
	window.addEventListener("scroll", runAfterCurrentEvent, { passive: true, capture: true });

	if (window.MutationObserver && document.body) {
		const observer = new MutationObserver((mutations) => {
			const popupChanged = mutations.some((mutation) =>
				Array.from(mutation.addedNodes || []).some(
					(node) =>
						node.nodeType === 1 &&
						(node.matches?.(".st-v7-inline-grid-popup") ||
							node.querySelector?.(".st-v7-inline-grid-popup"))
				)
			);
			if (popupChanged) {
				runAfterCurrentEvent();
				scheduleCorrection();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}
})();

/* SaaS Theme — Consolidated UI Interaction Controller v7 */
(function () {
	"use strict";
	if (window.__saas_theme_ui_consolidation_v7__) return;
	window.__saas_theme_ui_consolidation_v7__ = true;

	const STYLE_ID = "st-ui-consolidation-v7-css";
	const STYLE_HREF = "/assets/saas_theme/css/ui_consolidation_v7.css?v=7";
	const GRID_EDITOR_CLASS = "st-v7-grid-editor";
	const GRID_OWNER_CLASS = "st-v7-grid-owner";
	const GRID_POPUP_CLASS = "st-v7-inline-grid-popup";
	const editorPortals = new Map();
	const popupPortals = new Map();
	let scanRaf = 0;
	let headTimer = 0;
	let bodyObserver = null;
	let headObserver = null;

	function ensureStyleLast() {
		if (!document.head) return;
		let link = document.getElementById(STYLE_ID);
		if (!link) {
			link = document.createElement("link");
			link.id = STYLE_ID;
			link.rel = "stylesheet";
			link.href = STYLE_HREF;
			document.head.appendChild(link);
			return;
		}
		if (document.head.lastElementChild !== link) document.head.appendChild(link);
	}

	function scheduleStyleLast(delay = 0) {
		clearTimeout(headTimer);
		headTimer = setTimeout(ensureStyleLast, delay);
	}

	function setupStyleOrderGuard() {
		ensureStyleLast();
		if (!document.head || headObserver) return;
		headObserver = new MutationObserver((mutations) => {
			const addedStyle = mutations.some((mutation) =>
				Array.from(mutation.addedNodes || []).some(
					(node) =>
						node.nodeType === 1 &&
						node.id !== STYLE_ID &&
						(node.tagName === "STYLE" || (node.tagName === "LINK" && node.rel === "stylesheet"))
				)
			);
			if (addedStyle) scheduleStyleLast(0);
		});
		headObserver.observe(document.head, { childList: true });
	}

	function isVisible(element) {
		if (!(element instanceof Element) || !element.isConnected) return false;
		if (element.hidden || element.classList.contains("hide")) return false;
		const style = window.getComputedStyle(element);
		return style.display !== "none" && style.visibility !== "hidden";
	}

	/* Expanded child-row editor: move the SAME Frappe node above #freeze. */
	function portalEditor(editor) {
		if (!(editor instanceof Element) || editorPortals.has(editor) || !isVisible(editor)) return;
		const owner = editor.closest(".grid-row");
		const parent = editor.parentNode;
		if (!owner || !parent) return;
		const marker = document.createComment("saas-theme-v7-grid-editor");
		parent.insertBefore(marker, editor);
		editorPortals.set(editor, { owner, parent, marker });
		owner.classList.add(GRID_OWNER_CLASS);
		editor.classList.add(GRID_EDITOR_CLASS);
		document.body.appendChild(editor);
		document.body.classList.add("st-v7-grid-editor-open");
		syncModalLayers();
	}

	function restoreEditor(editor) {
		const meta = editorPortals.get(editor);
		if (!meta) return;
		editor.classList.remove(GRID_EDITOR_CLASS);
		meta.owner?.classList.remove(GRID_OWNER_CLASS);
		if (meta.parent?.isConnected) {
			if (meta.marker?.parentNode === meta.parent) {
				meta.parent.insertBefore(editor, meta.marker);
				meta.marker.remove();
			} else meta.parent.appendChild(editor);
		} else {
			meta.marker?.remove();
			editor.remove();
		}
		editorPortals.delete(editor);
		if (!editorPortals.size) document.body.classList.remove("st-v7-grid-editor-open");
	}

	function scanEditors() {
		document.querySelectorAll(".grid-row.grid-row-open .form-in-grid").forEach(portalEditor);
		for (const [editor, meta] of Array.from(editorPortals.entries())) {
			if (!meta.owner?.isConnected || !meta.owner.classList.contains("grid-row-open") || !editor.isConnected || !isVisible(editor)) {
				restoreEditor(editor);
			}
		}
	}

	function restoreAllEditors() {
		for (const editor of Array.from(editorPortals.keys())) restoreEditor(editor);
	}

	/* Link Selector from a child-row editor must not close the row on dialog hide. */
	function selectorComesFromOpenGrid(target) {
		const row = window.frappe?.ui?.form?.get_open_grid_form?.();
		if (!row) return false;
		if (target?.doc?.name && row.doc?.name && target.doc.name === row.doc.name) return true;
		const input = target?.$input?.get?.(0) || target?.input;
		if (input instanceof Element && input.closest(`body > .form-in-grid.${GRID_EDITOR_CLASS}`)) return true;
		return Boolean(document.querySelector(`body > .form-in-grid.${GRID_EDITOR_CLASS}`));
	}

	function tagGridSelector(selector) {
		const dialog = selector?.dialog;
		if (!dialog) return;
		dialog.keep_grid_form_open = true;
		const wrapper = dialog.$wrapper?.get?.(0) || dialog.wrapper;
		if (wrapper instanceof Element) wrapper.classList.add("st-v7-grid-link-selector");
		setTimeout(syncModalLayers, 0);
		setTimeout(syncModalLayers, 50);
	}

	function patchLinkSelector() {
		const proto = window.frappe?.ui?.form?.LinkSelector?.prototype;
		if (!proto || proto.__stV7Patched || typeof proto.make !== "function") return;
		const originalMake = proto.make;
		proto.make = function () {
			const fromGrid = selectorComesFromOpenGrid(this.target);
			const result = originalMake.apply(this, arguments);
			if (fromGrid) tagGridSelector(this);
			return result;
		};
		proto.__stV7Patched = true;
	}

	function syncModalLayers() {
		const backdrops = Array.from(document.querySelectorAll("body > .modal-backdrop.show"));
		const modals = Array.from(document.querySelectorAll("body > .modal.show, body > .modal.fade.show"));
		backdrops.forEach((backdrop) => backdrop.classList.remove("st-v7-awesomebar-backdrop"));
		const awesome = modals.find((modal) => modal.querySelector(".navbar-modal-wrapper"));
		if (awesome && backdrops.length) backdrops[backdrops.length - 1].classList.add("st-v7-awesomebar-backdrop");
	}

	/* Inline editable-grid Link popup. Frappe v16 moves the UL to .grid-field,
	   so resolve the REAL list there, then anchor it to input.getBoundingClientRect(). */
	function isInlineGridInput(input) {
		return Boolean(input instanceof HTMLInputElement && input.closest(".form-grid .editable-row") && input.closest(".grid-static-col, .grid-field"));
	}

	function listIsOpen(list) {
		return isVisible(list) && !list.hasAttribute("hidden");
	}

	function findGridPopup(input) {
		if (!isInlineGridInput(input)) return null;
		const controlsId = input.getAttribute("aria-controls");
		if (controlsId) {
			const controlled = document.getElementById(controlsId);
			if (controlled?.matches?.("ul, [role='listbox']")) return controlled;
		}
		const ownWrapper = input.parentElement?.classList.contains("awesomplete") ? input.parentElement : null;
		const own = ownWrapper ? Array.from(ownWrapper.children).find((node) => node.matches?.("ul, [role='listbox']")) : null;
		if (own) return own;
		const scope = input.closest(".grid-field") || input.closest(".grid-static-col");
		if (scope) {
			const candidates = Array.from(scope.querySelectorAll(".awesomplete > ul, .awesomplete > [role='listbox']"));
			return candidates.find(listIsOpen) || (candidates.length === 1 ? candidates[0] : null);
		}
		return null;
	}

	function setImportant(element, property, value) {
		element.style.setProperty(property, value, "important");
	}

	function clearPopupPosition(list) {
		["position", "top", "left", "right", "bottom", "width", "min-width", "max-width", "max-height", "transform", "translate", "margin"].forEach((property) => list.style.removeProperty(property));
	}

	function positionGridPopup(list, meta) {
		const input = meta?.input;
		if (!input?.isConnected || !listIsOpen(list)) return;
		const rect = input.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
		const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
		const gap = 5;
		const edge = 10;
		const width = Math.max(1, Math.round(rect.width));
		const left = Math.max(edge, Math.min(Math.round(rect.left), viewportWidth - width - edge));
		const maxHeight = Math.min(300, Math.max(100, Math.floor(viewportHeight - rect.bottom - gap - edge)));
		setImportant(list, "position", "fixed");
		setImportant(list, "top", `${Math.round(rect.bottom + gap)}px`);
		setImportant(list, "left", `${left}px`);
		setImportant(list, "right", "auto");
		setImportant(list, "bottom", "auto");
		setImportant(list, "width", `${width}px`);
		setImportant(list, "min-width", `${width}px`);
		setImportant(list, "max-width", `${width}px`);
		setImportant(list, "max-height", `${maxHeight}px`);
		setImportant(list, "transform", "none");
		setImportant(list, "translate", "none");
		setImportant(list, "margin", "0");
	}

	function portalGridPopup(input, list) {
		if (!isInlineGridInput(input) || !listIsOpen(list)) return;
		if (popupPortals.has(list)) {
			positionGridPopup(list, popupPortals.get(list));
			return;
		}
		const parent = list.parentNode;
		if (!parent) return;
		const marker = document.createComment("saas-theme-v7-grid-popup");
		parent.insertBefore(marker, list);
		const meta = { input, parent, marker };
		popupPortals.set(list, meta);
		list.classList.add(GRID_POPUP_CLASS);
		document.body.appendChild(list);
		positionGridPopup(list, meta);
	}

	function restoreGridPopup(list) {
		const meta = popupPortals.get(list);
		if (!meta) return;
		list.classList.remove(GRID_POPUP_CLASS);
		clearPopupPosition(list);
		if (meta.parent?.isConnected) {
			if (meta.marker?.parentNode === meta.parent) {
				meta.parent.insertBefore(list, meta.marker);
				meta.marker.remove();
			} else meta.parent.appendChild(list);
		} else {
			meta.marker?.remove();
			list.remove();
		}
		popupPortals.delete(list);
	}

	function scanGridPopups() {
		document.querySelectorAll(".form-grid .editable-row input").forEach((input) => {
			if (!isInlineGridInput(input)) return;
			const list = findGridPopup(input);
			if (list && listIsOpen(list)) portalGridPopup(input, list);
		});
		for (const [list, meta] of Array.from(popupPortals.entries())) {
			if (!meta.input?.isConnected || !list.isConnected || !listIsOpen(list)) restoreGridPopup(list);
		}
	}

	function repositionGridPopups() {
		for (const [list, meta] of popupPortals.entries()) if (listIsOpen(list) && meta.input?.isConnected) positionGridPopup(list, meta);
	}

	function restoreAllGridPopups() {
		for (const list of Array.from(popupPortals.keys())) restoreGridPopup(list);
	}

	/* Frappe listens to .main-section but reads document scrollTop. Reset stale
	   sticky classes using the actual scroll container when the user returns top. */
	function actualScrollTop() {
		const mainTop = Array.from(document.querySelectorAll(".main-section")).reduce((max, node) => Math.max(max, Number(node.scrollTop || 0)), 0);
		return Math.max(mainTop, Number(document.scrollingElement?.scrollTop || 0), Number(window.scrollY || 0));
	}

	function mainFormTabs() {
		return Array.from(document.querySelectorAll(".form-page > .form-tabs-list, .form-layout .form-tabs-list")).filter((tabs) => !tabs.closest(".form-in-grid"));
	}

	function syncTabsAtTop() {
		const atTop = actualScrollTop() <= 2;
		mainFormTabs().forEach((tabs) => {
			if (atTop) {
				tabs.classList.remove("form-tabs-sticky-up", "form-tabs-sticky-down", "show-navbar");
				tabs.classList.add("st-v7-tabs-at-top");
				tabs.style.removeProperty("top");
			} else tabs.classList.remove("st-v7-tabs-at-top");
		});
	}

	function bindScrollContainers() {
		document.querySelectorAll(".main-section").forEach((main) => {
			if (main.dataset.stV7ScrollBound === "1") return;
			main.dataset.stV7ScrollBound = "1";
			main.addEventListener("scroll", () => {
				syncTabsAtTop();
				repositionGridPopups();
				if (actualScrollTop() <= 2) setTimeout(syncTabsAtTop, 540);
			}, { passive: true });
		});
	}

	function scan() {
		scanRaf = 0;
		patchLinkSelector();
		scanEditors();
		scanGridPopups();
		bindScrollContainers();
		syncTabsAtTop();
		syncModalLayers();
		scheduleStyleLast(0);
	}

	function scheduleScan() {
		if (!scanRaf) scanRaf = requestAnimationFrame(scan);
	}

	function setupBodyObserver() {
		if (!document.body || bodyObserver) return;
		bodyObserver = new MutationObserver((mutations) => {
			const relevant = mutations.some((mutation) => {
				if (mutation.type === "childList") return mutation.addedNodes.length || mutation.removedNodes.length;
				if (mutation.type === "attributes") {
					const target = mutation.target;
					return target?.classList?.contains("grid-row") || target?.classList?.contains("form-tabs-list") || target?.matches?.("ul, [role='listbox'], .modal, .modal-backdrop");
				}
				return false;
			});
			if (relevant) scheduleScan();
		});
		bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
	}

	document.addEventListener("focusin", (event) => {
		if (!isInlineGridInput(event.target)) return;
		scheduleScan();
		setTimeout(scheduleScan, 20);
		setTimeout(scheduleScan, 80);
	}, true);
	document.addEventListener("input", (event) => {
		if (!isInlineGridInput(event.target)) return;
		scheduleScan();
		setTimeout(scheduleScan, 30);
	}, true);
	document.addEventListener("awesomplete-open", scheduleScan, true);
	document.addEventListener("awesomplete-close", () => setTimeout(scheduleScan, 0), true);
	window.addEventListener("resize", () => { repositionGridPopups(); syncTabsAtTop(); }, { passive: true });
	window.addEventListener("scroll", repositionGridPopups, { passive: true, capture: true });

	if (window.jQuery) {
		window.jQuery(document).off("page-change.saasUiV7").on("page-change.saasUiV7", () => {
			restoreAllGridPopups();
			restoreAllEditors();
			setTimeout(scheduleScan, 0);
			setTimeout(scheduleScan, 120);
		});
	}

	function init() {
		document.getElementById("saas-theme-inline-grid-popup-v5-css")?.remove();
		setupStyleOrderGuard();
		setupBodyObserver();
		scan();
		setTimeout(scan, 120);
		setTimeout(scan, 500);
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
	else init();
})();

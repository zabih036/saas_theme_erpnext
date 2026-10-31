/*
 * SaaS Theme — Project Customizations
 * Permanent interaction layer for this repository.
 *
 * IMPORTANT:
 * - Keep all future Desk interaction fixes in this file.
 * - Do not add numbered/versioned/final/followup JS patch files.
 * - Base upstream theme remains in saas_theme.js.
 */
(function () {
	"use strict";

	if (window.__saas_theme_project_custom__) return;
	window.__saas_theme_project_custom__ = true;

	const INLINE_POPUP_CLASS = "st-inline-link-popup";
	const GRID_EDITOR_CLASS = "st-grid-editor";
	const GRID_OWNER_CLASS = "st-grid-editor-owner";
	const SIDEBAR_STORAGE_KEY = "saas_theme.form_sidebar_collapsed";

	const state = {
		observer: null,
		timer: null,
		editors: new Map(),
		popups: new Map(),
		sidebarCollapsed: readSidebarPreference(),
	};

	function t(message) {
		return typeof window.__ === "function" ? window.__(message) : message;
	}

	function schedule(delay = 0) {
		clearTimeout(state.timer);
		state.timer = setTimeout(refresh, delay);
	}

	function isVisible(element) {
		if (!(element instanceof Element) || !element.isConnected) return false;
		if (element.hidden || element.classList.contains("hide")) return false;
		const style = window.getComputedStyle(element);
		return style.display !== "none" && style.visibility !== "hidden";
	}

	/* ======================================================
	   HEADER SEARCH — native Frappe Awesome Bar, styled as a
	   centered search input instead of another search engine.
	   ====================================================== */
	function openAwesomeBar() {
		try {
			if (window.frappe?.app?.awesome_bar?.open) {
				window.frappe.app.awesome_bar.open();
				return;
			}
		} catch (error) {
			console.debug("SaaS Theme: native Awesome Bar open failed", error);
		}

		const nativeTrigger = document.querySelector(
			".navbar-search-bar, .navbar-modal-search, [data-original-title='Search']"
		);
		nativeTrigger?.click?.();
	}

	function ensureHeaderSearch() {
		const pageHead = document.querySelector(".page-head");
		const content = pageHead?.querySelector(".page-head-content") || pageHead;
		if (!content || content.querySelector(".st-header-search-shell")) return;

		const shell = document.createElement("div");
		shell.className = "st-header-search-shell";

		const button = document.createElement("button");
		button.type = "button";
		button.className = "st-header-search-button";
		button.setAttribute("aria-label", t("Search or type a command"));

		const label = document.createElement("span");
		label.className = "st-search-label";
		label.textContent = t("Search or type a command");

		const shortcut = document.createElement("span");
		shortcut.className = "st-search-shortcut";
		shortcut.textContent = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘ K" : "Ctrl K";

		button.append(label, shortcut);
		button.addEventListener("click", openAwesomeBar);
		shell.appendChild(button);
		content.appendChild(shell);
	}

	/* ======================================================
	   USER MENU — restore Toggle Theme without loading any
	   additional CSS/JS assets dynamically.
	   ====================================================== */
	function menuLabel(row) {
		return String(row?.querySelector?.(".es-menu__label")?.textContent || row?.textContent || "")
			.replace(/\s+/g, " ")
			.trim();
	}

	function makeThemeMenuRow() {
		const dark = document.documentElement.getAttribute("data-theme") === "dark";
		const row = document.createElement("button");
		row.type = "button";
		row.className = "es-menu__item st-theme-toggle-menu-item";
		row.setAttribute("role", "menuitem");
		row.setAttribute("tabindex", "-1");

		try {
			row.insertAdjacentHTML(
				"beforeend",
				window.frappe?.utils?.icon?.(dark ? "sun" : "moon", "sm", "", "", "current-color", true) || ""
			);
		} catch (error) {
			// Label is enough if an icon cannot be created.
		}

		const label = document.createElement("span");
		label.className = "es-menu__label";
		label.textContent = t("Toggle Theme");
		row.appendChild(label);

		row.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			try {
				new window.frappe.ui.ThemeSwitcher().show();
			} catch (error) {
				console.debug("SaaS Theme: Theme Switcher unavailable", error);
			}
		});

		return row;
	}

	function ensureThemeMenuRows() {
		document.querySelectorAll('.es-menu[role="menu"], .es-menu').forEach((menu) => {
			const rows = Array.from(menu.querySelectorAll(".es-menu__item"));
			if (!rows.length) return;
			const labels = new Set(rows.map(menuLabel));
			if (!labels.has(t("Settings")) || !labels.has(t("Logout"))) return;
			if (labels.has(t("Toggle Theme"))) return;

			const reloadRow = rows.find((row) => menuLabel(row) === t("Reload"));
			if (reloadRow?.parentElement) reloadRow.insertAdjacentElement("beforebegin", makeThemeMenuRow());
		});
	}

	/* ======================================================
	   FORM SIDEBAR PREFERENCE
	   ====================================================== */
	function readSidebarPreference() {
		try {
			return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
		} catch (error) {
			return false;
		}
	}

	function writeSidebarPreference() {
		try {
			window.localStorage.setItem(SIDEBAR_STORAGE_KEY, state.sidebarCollapsed ? "1" : "0");
		} catch (error) {
			// Ignore unavailable localStorage.
		}
	}

	function currentPage() {
		const pages = Array.from(document.querySelectorAll(".page-container:not(.hide)"));
		return pages.reverse().find((page) => page.offsetParent !== null) || null;
	}

	function isFormRoute() {
		try {
			return window.frappe?.get_route?.()?.[0] === "Form";
		} catch (error) {
			return false;
		}
	}

	function ensureSidebarToggle() {
		const page = currentPage();
		const hasSidebar = page?.querySelector(".form-sidebar");
		if (!isFormRoute() || !page || !hasSidebar) {
			document.body?.classList.remove("st-form-sidebar-collapsed");
			document.querySelectorAll(".st-form-sidebar-toggle").forEach((button) => button.remove());
			return;
		}

		document.body?.classList.toggle("st-form-sidebar-collapsed", state.sidebarCollapsed);
		const actions = page.querySelector(".page-head .page-actions, .page-actions");
		if (!actions) return;

		let button = actions.querySelector(".st-form-sidebar-toggle");
		if (!button) {
			button = document.createElement("button");
			button.type = "button";
			button.className = "btn btn-default icon-btn st-form-sidebar-toggle";
			button.addEventListener("click", (event) => {
				event.preventDefault();
				state.sidebarCollapsed = !state.sidebarCollapsed;
				writeSidebarPreference();
				ensureSidebarToggle();
			});
			actions.appendChild(button);
		}

		button.setAttribute("aria-pressed", state.sidebarCollapsed ? "true" : "false");
		button.title = state.sidebarCollapsed ? t("Show details sidebar") : t("Hide details sidebar");
		try {
			button.innerHTML = window.frappe?.utils?.icon?.("sidebar-right", "sm") || "⋮";
		} catch (error) {
			button.textContent = "⋮";
		}
	}

	/* ======================================================
	   EXPANDED CHILD ROW — portal the same Frappe node above
	   #freeze. Event handlers and model bindings remain intact.
	   ====================================================== */
	function portalEditor(editor) {
		if (!(editor instanceof Element) || state.editors.has(editor) || !isVisible(editor)) return;
		const owner = editor.closest(".grid-row");
		const parent = editor.parentNode;
		if (!owner || !parent) return;

		const marker = document.createComment("saas-theme-grid-editor");
		parent.insertBefore(marker, editor);
		state.editors.set(editor, { owner, parent, marker });
		owner.classList.add(GRID_OWNER_CLASS);
		editor.classList.add(GRID_EDITOR_CLASS);
		document.body.appendChild(editor);
	}

	function restoreEditor(editor) {
		const meta = state.editors.get(editor);
		if (!meta) return;
		editor.classList.remove(GRID_EDITOR_CLASS);
		meta.owner?.classList.remove(GRID_OWNER_CLASS);

		if (meta.parent?.isConnected) {
			if (meta.marker?.parentNode === meta.parent) {
				meta.parent.insertBefore(editor, meta.marker);
				meta.marker.remove();
			} else {
				meta.parent.appendChild(editor);
			}
		} else {
			meta.marker?.remove();
			editor.remove();
		}
		state.editors.delete(editor);
	}

	function syncEditors() {
		document.querySelectorAll(".grid-row.grid-row-open .form-in-grid").forEach(portalEditor);
		for (const [editor, meta] of Array.from(state.editors.entries())) {
			const open = meta.owner?.isConnected && meta.owner.classList.contains("grid-row-open");
			if (!open || !editor.isConnected || !isVisible(editor)) restoreEditor(editor);
		}
	}

	function restoreAllEditors() {
		for (const editor of Array.from(state.editors.keys())) restoreEditor(editor);
	}

	/* Keep child row open while its Link Selector dialog is used. */
	function selectorBelongsToOpenGrid(target) {
		const openRow = window.frappe?.ui?.form?.get_open_grid_form?.();
		if (!openRow) return false;
		if (target?.doc?.name && openRow.doc?.name && target.doc.name === openRow.doc.name) return true;
		const input = target?.$input?.get?.(0) || target?.input;
		if (input instanceof Element && input.closest(`body > .form-in-grid.${GRID_EDITOR_CLASS}`)) return true;
		return Boolean(document.querySelector(`body > .form-in-grid.${GRID_EDITOR_CLASS}`));
	}

	function patchLinkSelector() {
		const proto = window.frappe?.ui?.form?.LinkSelector?.prototype;
		if (!proto || proto.__saasThemeProjectPatched || typeof proto.make !== "function") return;

		const originalMake = proto.make;
		proto.make = function () {
			const fromGrid = selectorBelongsToOpenGrid(this.target);
			const result = originalMake.apply(this, arguments);
			if (fromGrid && this.dialog) {
				this.dialog.keep_grid_form_open = true;
				const wrapper = this.dialog.$wrapper?.get?.(0) || this.dialog.wrapper;
				if (wrapper instanceof Element) wrapper.classList.add("st-grid-link-selector");
				setTimeout(syncModalLayers, 0);
			}
			return result;
		};
		proto.__saasThemeProjectPatched = true;
	}

	/* ======================================================
	   INLINE GRID LINK POPUP
	   IMPORTANT: only the ACTIVE Link input owns a popup.
	   This fixes the narrow/wrong-width dropdown caused by
	   scanning every input in the row.
	   ====================================================== */
	function fieldTypeForInput(input) {
		return (
			input?.dataset?.fieldtype ||
			input?.getAttribute?.("data-fieldtype") ||
			input?.closest?.("[data-fieldtype]")?.getAttribute?.("data-fieldtype") ||
			""
		);
	}

	function isInlineLinkInput(input) {
		if (!(input instanceof HTMLInputElement)) return false;
		if (!input.closest(".form-grid .editable-row")) return false;
		return ["Link", "Dynamic Link", "Autocomplete"].includes(fieldTypeForInput(input));
	}

	function activeInlineLinkInput() {
		const input = document.activeElement;
		return isInlineLinkInput(input) ? input : null;
	}

	function popupIsOpen(list) {
		return isVisible(list) && !list.hasAttribute("hidden");
	}

	function findPopupForInput(input) {
		if (!isInlineLinkInput(input)) return null;

		if (input.awesomplete?.ul instanceof Element) return input.awesomplete.ul;

		const controlsId = input.getAttribute("aria-controls");
		if (controlsId) {
			const controlled = document.getElementById(controlsId);
			if (controlled?.matches?.("ul, [role='listbox']")) return controlled;
		}

		const ownAwesomplete = input.closest(".awesomplete");
		const ownList = ownAwesomplete?.querySelector(":scope > ul, :scope > [role='listbox']");
		if (ownList) return ownList;

		/* Frappe v16 can move the result UL to a separate .awesomplete wrapper
		   under the current grid field. Search only THIS field/cell, never the row. */
		const field = input.closest(".grid-field");
		const cell = input.closest(".grid-static-col");
		for (const scope of [field, cell]) {
			if (!scope) continue;
			const lists = Array.from(scope.querySelectorAll(".awesomplete > ul, .awesomplete > [role='listbox']"));
			const open = lists.find(popupIsOpen);
			if (open) return open;
			if (lists.length === 1) return lists[0];
		}
		return null;
	}

	function popupAnchorRect(input) {
		const candidates = [
			input.closest(".control-input-wrapper"),
			input.closest(".frappe-control"),
			input.closest(".grid-field"),
			input.closest(".grid-static-col"),
			input,
		].filter(Boolean);

		/* Prefer the visible control/cell width. Reject tiny icon/hidden-input
		   rectangles, which caused the narrow popup in the reported screenshot. */
		for (const element of candidates) {
			const rect = element.getBoundingClientRect();
			if (rect.width >= 160 && rect.height > 0 && rect.height < 140) return rect;
		}
		return input.getBoundingClientRect();
	}

	function setImportant(element, property, value) {
		element.style.setProperty(property, value, "important");
	}

	function positionInlinePopup(list, meta) {
		if (!meta?.input?.isConnected || !popupIsOpen(list)) return;
		const rect = popupAnchorRect(meta.input);
		if (!rect.width || !rect.height) return;

		const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
		const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
		const edge = 10;
		const gap = 5;
		const width = Math.max(180, Math.round(rect.width));
		const left = Math.max(edge, Math.min(Math.round(rect.left), viewportWidth - width - edge));
		const roomBelow = viewportHeight - rect.bottom - gap - edge;
		const maxHeight = Math.min(300, Math.max(120, Math.floor(roomBelow)));

		setImportant(list, "position", "fixed");
		setImportant(list, "top", `${Math.round(rect.bottom + gap)}px`);
		setImportant(list, "left", `${left}px`);
		setImportant(list, "right", "auto");
		setImportant(list, "bottom", "auto");
		setImportant(list, "width", `${width}px`);
		setImportant(list, "min-width", `${width}px`);
		setImportant(list, "max-width", `${width}px`);
		setImportant(list, "max-height", `${maxHeight}px`);
		setImportant(list, "margin", "0");
		setImportant(list, "transform", "none");
		setImportant(list, "translate", "none");
	}

	function portalInlinePopup(input, list) {
		if (!isInlineLinkInput(input) || !popupIsOpen(list)) return;
		if (state.popups.has(list)) {
			const meta = state.popups.get(list);
			meta.input = input;
			positionInlinePopup(list, meta);
			return;
		}

		const parent = list.parentNode;
		if (!parent) return;
		const marker = document.createComment("saas-theme-inline-link-popup");
		parent.insertBefore(marker, list);
		const meta = { input, parent, marker };
		state.popups.set(list, meta);
		list.classList.add(INLINE_POPUP_CLASS);
		document.body.appendChild(list);
		positionInlinePopup(list, meta);
	}

	function clearPopupStyles(list) {
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
			"margin",
			"transform",
			"translate",
		].forEach((property) => list.style.removeProperty(property));
	}

	function restoreInlinePopup(list) {
		const meta = state.popups.get(list);
		if (!meta) return;
		list.classList.remove(INLINE_POPUP_CLASS);
		clearPopupStyles(list);

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
		state.popups.delete(list);
	}

	function syncInlinePopup() {
		const active = activeInlineLinkInput();
		if (active) {
			const list = findPopupForInput(active);
			if (list && popupIsOpen(list)) portalInlinePopup(active, list);
		}

		for (const [list, meta] of Array.from(state.popups.entries())) {
			if (!list.isConnected || !meta.input?.isConnected || !popupIsOpen(list)) {
				restoreInlinePopup(list);
			}
		}
	}

	function repositionInlinePopups() {
		for (const [list, meta] of state.popups.entries()) {
			if (popupIsOpen(list) && meta.input?.isConnected) positionInlinePopup(list, meta);
		}
	}

	function restoreAllInlinePopups() {
		for (const list of Array.from(state.popups.keys())) restoreInlinePopup(list);
	}

	/* ======================================================
	   FORM TABS — use the actual Desk scroll container.
	   ====================================================== */
	function actualScrollTop() {
		const mainTop = Array.from(document.querySelectorAll(".main-section")).reduce(
			(max, node) => Math.max(max, Number(node.scrollTop || 0)),
			0
		);
		return Math.max(mainTop, Number(document.scrollingElement?.scrollTop || 0), Number(window.scrollY || 0));
	}

	function mainFormTabs() {
		return Array.from(document.querySelectorAll(".form-page > .form-tabs-list, .form-layout .form-tabs-list"))
			.filter((tabs) => !tabs.closest(".form-in-grid"));
	}

	function syncTabs() {
		const atTop = actualScrollTop() <= 2;
		mainFormTabs().forEach((tabs) => {
			if (atTop) {
				tabs.classList.remove("form-tabs-sticky-up", "form-tabs-sticky-down", "show-navbar");
				tabs.classList.add("st-tabs-at-top");
				tabs.style.removeProperty("top");
			} else {
				tabs.classList.remove("st-tabs-at-top");
			}
		});
	}

	function bindScrollContainers() {
		document.querySelectorAll(".main-section").forEach((main) => {
			if (main.dataset.saasThemeScrollBound === "1") return;
			main.dataset.saasThemeScrollBound = "1";
			main.addEventListener(
				"scroll",
				() => {
					syncTabs();
					repositionInlinePopups();
					if (actualScrollTop() <= 2) setTimeout(syncTabs, 540);
				},
				{ passive: true }
			);
		});
	}

	/* ======================================================
	   QUERY REPORT FILTER GEOMETRY
	   ====================================================== */
	function repairReportFilters() {
		document.querySelectorAll("#page-query-report .report-wrapper .datatable").forEach((table) => {
			const headers = new Map();
			table.querySelectorAll(".dt-row-header .dt-cell[data-col-index]").forEach((header) => {
				headers.set(String(header.getAttribute("data-col-index")), header);
			});

			table.querySelectorAll(".dt-row-filter input[data-col-index]").forEach((input) => {
				const index = String(input.getAttribute("data-col-index"));
				const header = headers.get(index);
				const cell = input.closest(".dt-cell");
				if (!header || !cell) return;

				const headerText = String(header.textContent || "").replace(/\s+/g, " ").trim();
				if (!headerText || /^(no\.?|#|sr\.?|select)$/i.test(headerText)) {
					input.style.setProperty("display", "none", "important");
					return;
				}

				const width = Math.round(header.getBoundingClientRect().width);
				if (width > 0) {
					["width", "min-width", "max-width", "flex-basis"].forEach((property) => {
						cell.style.setProperty(property, `${width}px`, "important");
					});
				}
				input.setAttribute("placeholder", t("Filter"));
				input.setAttribute("aria-label", `${t("Filter")} ${headerText}`);
			});
		});
	}

	/* ======================================================
	   OVERLAY LAYERS
	   ====================================================== */
	function syncModalLayers() {
		const backdrops = Array.from(document.querySelectorAll("body > .modal-backdrop.show"));
		const modals = Array.from(document.querySelectorAll("body > .modal.show, body > .modal.fade.show"));
		backdrops.forEach((backdrop) => backdrop.classList.remove("st-awesomebar-backdrop"));
		const awesome = modals.find((modal) => modal.querySelector(".navbar-modal-wrapper"));
		if (awesome && backdrops.length) backdrops[backdrops.length - 1].classList.add("st-awesomebar-backdrop");
	}

	/* ======================================================
	   MAIN REFRESH / OBSERVER
	   ====================================================== */
	function refresh() {
		patchLinkSelector();
		ensureHeaderSearch();
		ensureThemeMenuRows();
		ensureSidebarToggle();
		syncEditors();
		syncInlinePopup();
		bindScrollContainers();
		syncTabs();
		repairReportFilters();
		syncModalLayers();
	}

	function observe() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver((mutations) => {
			const relevant = mutations.some((mutation) => {
				if (mutation.type === "childList") return mutation.addedNodes.length || mutation.removedNodes.length;
				if (mutation.type === "attributes") {
					const target = mutation.target;
					return (
						target?.classList?.contains("grid-row") ||
						target?.classList?.contains("form-tabs-list") ||
						target?.matches?.("ul, [role='listbox'], .modal, .modal-backdrop")
					);
				}
				return false;
			});
			if (relevant) schedule(0);
		});
		state.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class", "hidden", "aria-expanded"],
		});
	}

	document.addEventListener(
		"focusin",
		(event) => {
			if (!isInlineLinkInput(event.target)) return;
			schedule(0);
			setTimeout(() => schedule(0), 25);
			setTimeout(() => schedule(0), 90);
		},
		true
	);

	document.addEventListener(
		"input",
		(event) => {
			if (!isInlineLinkInput(event.target)) return;
			schedule(0);
			setTimeout(() => schedule(0), 30);
		},
		true
	);

	document.addEventListener("awesomplete-open", () => schedule(0), true);
	document.addEventListener("awesomplete-close", () => setTimeout(() => schedule(0), 0), true);

	window.addEventListener(
		"resize",
		() => {
			repositionInlinePopups();
			syncTabs();
			repairReportFilters();
		},
		{ passive: true }
	);

	window.addEventListener("scroll", repositionInlinePopups, { passive: true, capture: true });
	window.addEventListener("storage", (event) => {
		if (event.key !== SIDEBAR_STORAGE_KEY) return;
		state.sidebarCollapsed = readSidebarPreference();
		ensureSidebarToggle();
	});

	if (window.jQuery) {
		window.jQuery(document)
			.off("page-change.saasThemeProject toolbar_setup.saasThemeProject")
			.on("page-change.saasThemeProject toolbar_setup.saasThemeProject", () => {
				restoreAllInlinePopups();
				restoreAllEditors();
				schedule(0);
				setTimeout(() => schedule(0), 120);
			});
	}

	function start() {
		refresh();
		observe();
		[120, 400, 900].forEach((delay) => setTimeout(refresh, delay));
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, { once: true });
	} else {
		start();
	}
})();

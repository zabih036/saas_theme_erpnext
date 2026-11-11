/*
 * SaaS Theme — Frappe v16 native sidebar search, inline autocomplete.
 * Owns only .body-sidebar-container and this file's st-sidebar-search classes.
 * No SearchDialog/awesome-bar modal interception, app route rewrites or
 * replacement of Frappe's Sidebar nav handlers / permissions.
 */
(() => {
	"use strict";
	if (window.__st_sidebar_inline_search_v2__) return;
	window.__st_sidebar_inline_search_v2__ = true;

	const ROOT = ".body-sidebar-container";
	const MIN_QUERY = 2;
	const LIMIT = 9;
	const states = new WeakMap();
	const magnifier = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.9" cy="10.9" r="6.7"/><path d="m16 16 4.6 4.6"/></svg>';
	let refreshTimer = null;
	let observer = null;
	let uid = 0;

	const translate = s => typeof window.__ === "function" ? __(s) : s;
	const isMobile = () => typeof window.frappe?.is_mobile === "function"
		? frappe.is_mobile() : !!window.matchMedia?.("(max-width: 767px)")?.matches;
	const visible = node => !!(node && node.isConnected && node.getClientRects().length);
	const ownLabel = (node) => (node?.textContent || "").trim();

	function routeTo(option) {
		if (option.element && typeof option.element.click === "function") {
			// Delegate to the original Frappe sidebar anchor; it owns the router.
			option.element.click();
		} else if (typeof option.onclick === "function") {
			option.onclick();
		} else if (Array.isArray(option.route) && typeof frappe.set_route === "function") {
			frappe.set_route(...option.route);
		} else if (typeof option.route === "string" && typeof frappe.set_route === "function") {
			frappe.set_route(option.route);
		}
	}

	function unique(options, max = LIMIT) {
		const keys = new Set();
		return options.filter(o => {
			if (!o.label || !o.route && !o.link && !o.onclick && !o.element) return false;
			const key = String(o.link || (o.route || []).toString() || o.label);
			if (keys.has(key)) return false;
			keys.add(key);
			return true;
		}).slice(0, max);
	}

	function sidebarLinks(panel, query = "") {
		return Array.from(panel.querySelectorAll(".sidebar-items a.item-anchor[href]"))
			.filter(a => visible(a) && !(a.closest(".hidden, [hidden]")))
			.map(a => ({
				label: ownLabel(a.querySelector(".sidebar-item-label")) || ownLabel(a),
				link: a.getAttribute("href"),
				element: a,
				type: translate("Navigation"),
			}))
			.filter(o => !query || o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
	}

	function permissionSafeOptions(query) {
		const u = window.frappe?.search?.utils;
		if (!u || query.length < MIN_QUERY) return [];
		let results = [];
		for (const [method, type] of [
			["get_doctypes", translate("DocType")],
			["get_reports", translate("Report")],
			["get_workspaces", translate("Workspace")],
			["get_dashboards", translate("Dashboard")],
		]) {
			if (typeof u[method] !== "function") continue;
			try {
				const values = u[method](query) || [];
				for (const option of values) {
					if (!option.route && !option.onclick) continue;
					results.push({
						label: String(option.value || option.match || "").trim(),
						type: option.type || type,
						route: option.route,
						onclick: option.onclick,
					});
				}
			} catch (error) {
				// Frappe may initialize modules after Sidebar; still show module links.
				console.debug("Sidebar autocomplete source not ready:", method, error);
			}
		}
		return results;
	}

	function close(state) {
		state.open = false;
		state.active = -1;
		state.popover.hidden = true;
		state.input.setAttribute("aria-expanded", "false");
		state.input.removeAttribute("aria-activedescendant");
	}

	function render(state, items, status = "") {
		if (!state.shell.isConnected) return;
		state.results = unique(items);
		state.list.replaceChildren();
		state.active = -1;
		const hasResults = state.results.length > 0;
		if (!hasResults) {
			const message = document.createElement("div");
			message.className = "st-sidebar-search-empty";
			message.textContent = status || translate("No results found");
			state.list.appendChild(message);
		} else {
			state.results.forEach((item, index) => {
				const row = document.createElement("button");
				row.type = "button";
				row.className = "st-sidebar-search-option";
				row.id = state.list.id + "-option-" + index;
				row.setAttribute("role", "option");
				row.setAttribute("aria-selected", "false");
				const name = document.createElement("span");
				name.className = "st-sidebar-search-option-name";
				name.textContent = item.label;
				const type = document.createElement("span");
				type.className = "st-sidebar-search-option-type";
				type.textContent = item.type || translate("Navigation");
				row.append(name, type);
				row.addEventListener("pointerdown", e => e.preventDefault());
				row.addEventListener("click", () => choose(state, index));
				state.list.appendChild(row);
			});
		}
		state.open = true;
		state.popover.hidden = false;
		state.input.setAttribute("aria-expanded", "true");
	}

	function choose(state, index) {
		const item = state.results[index];
		if (!item) return;
		close(state);
		state.input.value = "";
		routeTo(item);
	}

	function select(state, index) {
		const rows = Array.from(state.list.querySelectorAll(".st-sidebar-search-option"));
		if (!rows.length) return;
		const next = (index + rows.length) % rows.length;
		rows.forEach((row, idx) => {
			const active = idx === next;
			row.classList.toggle("is-selected", active);
			row.setAttribute("aria-selected", String(active));
		});
		state.active = next;
		state.input.setAttribute("aria-activedescendant", rows[next].id);
		rows[next].scrollIntoView?.({block: "nearest"});
	}

	function localResults(state, query) {
		const nav = sidebarLinks(state.panel, query);
		const system = permissionSafeOptions(query);
		return unique([...nav, ...system], LIMIT);
	}

	function update(state, value) {
		clearTimeout(state.timer);
		state.version += 1;
		const token = state.version;
		const query = value.trim();
		const local = localResults(state, query);
		render(state, local, query ? translate("No results found") : translate("No available shortcuts"));
		if (query.length < MIN_QUERY || !state.open) return;
		const getGlobal = window.frappe?.search?.utils?.get_global_results;
		if (typeof getGlobal !== "function") return;
		// Use Frappe's permission-aware Global Search endpoint, never raw SQL
		// or broad doctype queries. Results are always rendered as plain text.
		state.timer = setTimeout(() => {
			Promise.resolve().then(() => getGlobal.call(frappe.search.utils, query, 0, 10))
				.then(groups => {
					if (token !== state.version || !state.open || state.input.value.trim() !== query) return;
					const docs = (Array.isArray(groups) ? groups : []).flatMap(group =>
						(Array.isArray(group.results) ? group.results : []).map(item => ({
							label: String(item.label || item.value || "").trim(),
							route: item.route,
							type: group.title || translate("Document"),
						}))
					);
					render(state, unique([...local, ...docs], LIMIT));
				})
				.catch(error => {
					// Offline / server search errors must not erase local results.
					console.debug("Sidebar autocomplete global results unavailable", error);
				});
		}, 220);
	}

	function focusInput(state) {
		const panel = state.panel;
		if (!panel.classList.contains("expanded")) {
			if (typeof window.frappe?.app?.sidebar?.open === "function") {
				window.frappe.app.sidebar.open();
			}
			setTimeout(() => { if (state.input.isConnected) state.input.focus(); }, 90);
			return;
		}
		state.input.focus();
	}

	function makeSearch(panel) {
		const shell = document.createElement("div");
		shell.className = "st-sidebar-search";
		const control = document.createElement("div");
		control.className = "st-sidebar-search-control";
		const trigger = document.createElement("button");
		trigger.type = "button";
		trigger.className = "st-sidebar-search-trigger";
		trigger.setAttribute("aria-label", translate("Search"));
		trigger.setAttribute("title", translate("Search"));
		trigger.innerHTML = magnifier;
		const input = document.createElement("input");
		input.type = "search";
		input.className = "st-sidebar-search-input";
		input.placeholder = translate("Search");
		input.autocomplete = "off";
		input.spellcheck = false;
		input.setAttribute("role", "combobox");
		input.setAttribute("aria-autocomplete", "list");
		input.setAttribute("aria-haspopup", "listbox");
		input.setAttribute("aria-expanded", "false");
		input.setAttribute("aria-label", translate("Search"));
		const shortcut = document.createElement("kbd");
		shortcut.className = "st-sidebar-search-shortcut";
		shortcut.setAttribute("aria-hidden", "true");
		shortcut.textContent = "/";
		const popover = document.createElement("div");
		popover.className = "st-sidebar-search-dropdown";
		popover.hidden = true;
		const list = document.createElement("div");
		list.className = "st-sidebar-search-list";
		list.id = "st-sidebar-search-list-" + (++uid);
		list.setAttribute("role", "listbox");
		list.setAttribute("aria-label", translate("Search results"));
		input.setAttribute("aria-controls", list.id);
		popover.appendChild(list);
		control.append(trigger, input, shortcut);
		shell.append(control, popover);
		const state = {
			panel, shell, trigger, control, input, shortcut, popover, list,
			results: [], active: -1, version: 0, open: false, timer: null,
		};
		trigger.addEventListener("click", event => {
			event.preventDefault();
			focusInput(state);
		});
		input.addEventListener("focus", () => update(state, input.value));
		input.addEventListener("input", () => update(state, input.value));
		input.addEventListener("keydown", event => {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				if (!state.open) update(state, input.value);
				select(state, state.active + (event.key === "ArrowDown" ? 1 : -1));
			} else if (event.key === "Enter" && state.open && state.results.length) {
				event.preventDefault();
				choose(state, state.active === -1 ? 0 : state.active);
			} else if (event.key === "Escape") {
				if (state.open) {
					event.preventDefault();
					close(state);
				} else if (input.value) {
					input.value = "";
				}
			}
		});
		states.set(panel, state);
		return state;
	}

	function refresh() {
		let available = false;
		document.querySelectorAll(ROOT).forEach(panel => {
			const sidebar = panel.querySelector(".body-sidebar");
			if (!sidebar) return;
			panel.classList.add("st-sidebar-modern");
			let state = states.get(panel);
			if (!state || !state.shell.isConnected) {
				// Reuse search input when Frappe redraws only sidebar links;
				// new complete Sidebar instances get one new state, not clones.
				state = makeSearch(panel);
			}
			const header = sidebar.querySelector(":scope > .sidebar-header");
			const anchor = sidebar.querySelector(":scope > .standard-items-band, :scope > .body-sidebar-top");
			if (header && header.nextElementSibling !== state.shell) {
				header.after(state.shell);
			} else if (!header && anchor && anchor.previousElementSibling !== state.shell) {
				anchor.before(state.shell);
			} else if (!state.shell.isConnected) {
				sidebar.prepend(state.shell);
			}
			if (visible(panel) && !panel.classList.contains("sidebar-hidden") && !isMobile()) {
				available = true;
			}
			if (!visible(panel) && state.open) close(state);
		});
		document.body.classList.toggle("st-sidebar-search-available", available);
	}

	function schedule(delay = 25) {
		clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => {refreshTimer = null; refresh();}, delay);
	}

	function relevant(record) {
		const target = record.target;
		if (target?.nodeType === 1 && target.closest?.(ROOT)) {
			return [...record.addedNodes, ...record.removedNodes].some(node =>
				node.nodeType === 1 &&
				!node.classList?.contains("st-sidebar-search") &&
				!node.closest?.(".st-sidebar-search")
			);
		}
		return [...record.addedNodes, ...record.removedNodes].some(node =>
			node.nodeType === 1 && (node.matches?.(ROOT) || node.querySelector?.(ROOT))
		);
	}

	function start() {
		refresh();
		if (!observer && document.body && typeof MutationObserver === "function") {
			observer = new MutationObserver(records => {
				if (records.some(relevant)) schedule(35);
			});
			observer.observe(document.body, {childList: true, subtree: true});
		}
	}

	document.addEventListener("pointerdown", event => {
		document.querySelectorAll(ROOT).forEach(panel => {
			const state = states.get(panel);
			if (state?.open && !state.shell.contains(event.target)) close(state);
		});
	});
	document.addEventListener("keydown", event => {
		if (event.defaultPrevented || event.key !== "/" || event.ctrlKey || event.altKey ||
			event.metaKey || isMobile() || !document.body.classList.contains("st-sidebar-search-available")) return;
		const target = event.target;
		if (target?.isContentEditable || target?.closest?.("input, textarea, select, [contenteditable], [role='textbox']")) return;
		const panel = Array.from(document.querySelectorAll(ROOT)).find(el =>
			visible(el) && !el.classList.contains("sidebar-hidden"));
		const state = panel && states.get(panel);
		if (!state) return;
		event.preventDefault();
		focusInput(state);
	});
	if (typeof window.$ === "function") {
		$(document).on(
			"page-change.st_sidebar_modern sidebar_setup.st_sidebar_modern sidebar-expand.st_sidebar_modern desktop_screen.st_sidebar_modern toolbar_setup.st_sidebar_modern",
			() => schedule(30)
		);
		$(start);
	} else if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, {once: true});
	} else {
		start();
	}
	window.addEventListener("resize", () => schedule(90), {passive: true});
})();

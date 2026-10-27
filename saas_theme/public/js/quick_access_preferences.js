/*
 * SaaS Theme — user configurable Quick Access workspaces.
 * Keeps the default ERP shortcuts until the user explicitly customizes them.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_quick_access_preferences__) return;
	window.__saas_theme_quick_access_preferences__ = true;

	const STORAGE_PREFIX = "saas_theme.quick_access_workspaces_v2";
	const MAX_ITEMS = 8;
	let refresh_timer = null;
	let observer = null;
	let applying = false;

	function esc(value) {
		const text = value == null ? "" : String(value);
		return frappe.utils?.escape_html
			? frappe.utils.escape_html(text)
			: $("<div>").text(text).html();
	}

	function storage_key() {
		return `${STORAGE_PREFIX}:${frappe.session?.user || "Guest"}`;
	}

	function read_selection() {
		try {
			const raw = localStorage.getItem(storage_key());
			if (raw === null) return null;
			const value = JSON.parse(raw);
			return Array.isArray(value) ? value.filter(Boolean).slice(0, MAX_ITEMS) : null;
		} catch (error) {
			return null;
		}
	}

	function write_selection(names) {
		try {
			localStorage.setItem(storage_key(), JSON.stringify(names.slice(0, MAX_ITEMS)));
		} catch (error) {
			// Quick Access remains usable with defaults when storage is unavailable.
		}
	}

	function clear_selection() {
		try {
			localStorage.removeItem(storage_key());
		} catch (error) {
			// Ignore storage failures and keep the current DOM state.
		}
	}

	function get_workspaces() {
		try {
			return saas_theme.professional_ui?.get_workspaces?.() || [];
		} catch (error) {
			return [];
		}
	}

	function visible_workspaces(items) {
		const pages = frappe.boot?.workspaces?.pages || [];
		const hidden = new Set();

		pages.forEach((page) => {
			if (!page || (page.hidden !== 1 && page.is_hidden !== 1 && page.hide_custom !== 1)) return;
			[page.name, page.title, page.label]
				.filter(Boolean)
				.forEach((value) => hidden.add(String(value)));
		});

		const seen = new Set();
		return (items || []).filter((item) => {
			if (!item?.name || !item?.route) return false;
			if (hidden.has(String(item.name)) || hidden.has(String(item.title || ""))) return false;
			if (seen.has(item.name)) return false;
			seen.add(item.name);
			return true;
		});
	}

	function icon(name, fallback = "layout-grid") {
		try {
			return frappe.utils.icon(name || fallback, "md");
		} catch (error) {
			try {
				return frappe.utils.icon(fallback, "md");
			} catch (ignored) {
				return "";
			}
		}
	}

	function arrow() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>`;
	}

	function edit_icon() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>`;
	}

	function search_icon() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.6-3.6"></path></svg>`;
	}

	function quick_card(workspace) {
		return `<a class="st-hub-quick-card" href="${esc(workspace.route)}" data-workspace-name="${esc(workspace.name)}"><span class="st-hub-quick-icon">${icon(workspace.icon)}</span><span class="st-hub-quick-copy"><strong>${esc(__(workspace.title || workspace.name))}</strong><small>${esc(__(workspace.module || __("Workspace")))}</small></span><span class="st-hub-quick-arrow">${arrow()}</span></a>`;
	}

	function recommended_names(items) {
		const aliases = [
			["buying", "purchase"],
			["selling", "sales"],
			["assets", "asset"],
			["payments", "payment"],
			["accounting", "accounts"],
			["stock", "inventory"],
		];
		const chosen = [];
		const used = new Set();

		aliases.forEach((group) => {
			const workspace = items.find((item) => {
				if (used.has(item.name)) return false;
				const haystack = [item.name, item.title, item.module]
					.filter(Boolean)
					.map((value) => String(value).toLowerCase());
				return group.some((needle) => haystack.some((value) => value === needle || value.includes(needle)));
			});
			if (workspace) {
				used.add(workspace.name);
				chosen.push(workspace.name);
			}
		});

		for (const item of items) {
			if (chosen.length >= 6) break;
			if (used.has(item.name)) continue;
			used.add(item.name);
			chosen.push(item.name);
		}
		return chosen.slice(0, MAX_ITEMS);
	}

	function selected_items(items, names) {
		const by_name = new Map(items.map((item) => [item.name, item]));
		return (names || []).map((name) => by_name.get(name)).filter(Boolean).slice(0, MAX_ITEMS);
	}

	function ensure_edit_button($section) {
		const $head = $section.find(".st-hub-section-head").first();
		if (!$head.length) return;

		$head.find("p").first().text(__("Choose the workspaces you use most"));
		if ($head.children(".st-quick-access-edit").length) return;

		const $button = $(`<button type="button" class="st-quick-access-edit"><span>${edit_icon()}</span><strong>${__("Customize")}</strong></button>`);
		$button.on("click.saas_quick_access", (event) => {
			event.preventDefault();
			event.stopPropagation();
			open_picker($section.closest(".st-home-dashboard"));
		});
		$head.append($button);
	}

	function render_selection($section, items) {
		const $grid = $section.find(".st-hub-quick-grid").first();
		if (!$grid.length) return;

		if (!$grid.data("st-default-quick-html")) {
			$grid.data("st-default-quick-html", $grid.html());
		}

		const saved = read_selection();
		if (saved === null) {
			if ($grid.attr("data-st-quick-mode") === "custom") {
				$grid.html($grid.data("st-default-quick-html") || "");
			}
			$grid.attr("data-st-quick-mode", "default").removeAttr("data-st-quick-signature");
			return;
		}

		const chosen = selected_items(items, saved);
		if (!chosen.length) {
			clear_selection();
			$grid.html($grid.data("st-default-quick-html") || "");
			$grid.attr("data-st-quick-mode", "default").removeAttr("data-st-quick-signature");
			return;
		}

		const signature = chosen.map((item) => item.name).join("|");
		if ($grid.attr("data-st-quick-signature") === signature) return;
		$grid.html(chosen.map(quick_card).join(""));
		$grid.attr("data-st-quick-mode", "custom").attr("data-st-quick-signature", signature);
	}

	function picker_html(items, current_names) {
		const current = new Set(current_names || []);
		const options = [...items].sort((a, b) => {
			const a_selected = current.has(a.name) ? 0 : 1;
			const b_selected = current.has(b.name) ? 0 : 1;
			if (a_selected !== b_selected) return a_selected - b_selected;
			return String(__(a.title || a.name)).localeCompare(String(__(b.title || b.name)));
		});

		const rows = options.map((item) => {
			const checked = current.has(item.name) ? " checked" : "";
			const search = esc(`${item.title || item.name} ${item.module || ""}`.toLowerCase());
			return `<label class="st-quick-picker-option" data-search="${search}"><input type="checkbox" class="st-quick-picker-check" value="${esc(item.name)}"${checked}><span class="st-quick-picker-icon">${icon(item.icon)}</span><span class="st-quick-picker-copy"><strong>${esc(__(item.title || item.name))}</strong><small>${esc(__(item.module || __("Workspace")))}</small></span></label>`;
		}).join("");

		return `<div class="st-quick-picker"><div class="st-quick-picker-toolbar"><label class="st-quick-picker-search"><span>${search_icon()}</span><input type="search" class="form-control" autocomplete="off" placeholder="${esc(__("Search workspaces"))}"></label><button type="button" class="btn btn-default st-quick-picker-reset">${__("Recommended")}</button></div><div class="st-quick-picker-meta"><span>${__("Select up to {0} workspaces", [MAX_ITEMS])}</span><strong class="st-quick-picker-count"></strong></div><div class="st-quick-picker-options">${rows}</div></div>`;
	}

	function open_picker($home) {
		const items = visible_workspaces(get_workspaces());
		if (!items.length) {
			frappe.msgprint(__("No visible workspaces are available for Quick Access."));
			return;
		}

		const saved = read_selection();
		const current = saved === null ? recommended_names(items) : saved;
		const dialog = new frappe.ui.Dialog({
			title: __("Customize Quick Access"),
			fields: [{ fieldtype: "HTML", fieldname: "quick_access_picker" }],
			primary_action_label: __("Save"),
			primary_action: () => {
				const names = dialog.$wrapper
					.find(".st-quick-picker-check:checked")
					.map(function () { return String(this.value || ""); })
					.get()
					.filter(Boolean)
					.slice(0, MAX_ITEMS);

				if (!names.length) {
					frappe.msgprint(__("Select at least one workspace for Quick Access."));
					return;
				}

				write_selection(names);
				dialog.hide();
				enhance_quick_access();
			},
		});

		dialog.$wrapper.addClass("st-quick-access-dialog");
		dialog.fields_dict.quick_access_picker.$wrapper.html(picker_html(items, current));

		const $wrapper = dialog.$wrapper;
		const $checks = $wrapper.find(".st-quick-picker-check");
		const $count = $wrapper.find(".st-quick-picker-count");
		const update_count = () => {
			const count = $checks.filter(":checked").length;
			$count.text(`${count} / ${MAX_ITEMS}`);
			$checks.not(":checked").prop("disabled", count >= MAX_ITEMS);
		};

		$wrapper.find(".st-quick-picker-search input").on("input", function () {
			const query = String($(this).val() || "").trim().toLowerCase();
			$wrapper.find(".st-quick-picker-option").each(function () {
				$(this).toggle(!query || String($(this).data("search") || "").includes(query));
			});
		});

		$checks.on("change", update_count);
		$wrapper.find(".st-quick-picker-reset").on("click", () => {
			const recommended = new Set(recommended_names(items));
			$checks.each(function () { this.checked = recommended.has(String(this.value || "")); });
			$wrapper.find(".st-quick-picker-search input").val("").trigger("input");
			update_count();
		});

		update_count();
		dialog.show();
	}

	function enhance_quick_access() {
		if (applying) return;
		const $home = $(".st-home-dashboard").last();
		if (!$home.length) return;

		const $section = $home.find(".st-hub-quick-section").first();
		if (!$section.length) return;

		applying = true;
		try {
			const items = visible_workspaces(get_workspaces());
			ensure_edit_button($section);
			render_selection($section, items);
		} finally {
			applying = false;
		}
	}

	function schedule(delay = 320) {
		clearTimeout(refresh_timer);
		refresh_timer = setTimeout(enhance_quick_access, delay);
	}

	$(document)
		.off("desktop_screen.saas_quick_access_preferences")
		.on("desktop_screen.saas_quick_access_preferences", () => schedule(320));

	$(document)
		.off("page-change.saas_quick_access_preferences")
		.on("page-change.saas_quick_access_preferences", function () {
			const route = frappe.get_route?.() || [];
			if (route[0] === "desktop" || route.length === 0) schedule(320);
		});

	function setup_observer() {
		if (observer || !window.MutationObserver || !document.body) return;
		observer = new MutationObserver((mutations) => {
			if (applying) return;
			const relevant = mutations.some((mutation) =>
				Array.from(mutation.addedNodes || []).some((node) =>
					node.nodeType === 1 && (node.matches?.(".st-home-dashboard") || node.querySelector?.(".st-home-dashboard"))
				)
			);
			if (relevant) schedule(340);
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	$(function () {
		setup_observer();
		[340, 650].forEach((delay) => setTimeout(enhance_quick_access, delay));
	});
})();

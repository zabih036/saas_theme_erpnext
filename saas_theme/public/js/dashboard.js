/*
 * SaaS Theme — Home Dashboard
 * Navigation-first landing page for Frappe's Apps desktop.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;

	frappe.provide("saas_theme.home_dashboard");

	const RECENT_KEY = "saas_theme_recent_workspaces_v1";
	const FAVORITES_KEY = "saas_theme_favorite_workspaces_v1";
	const MAX_RECENT = 6;
	const MAX_QUICK = 8;
	let clock_timer = null;

	function escape_html(value) {
		const text = value == null ? "" : String(value);
		return frappe.utils?.escape_html ? frappe.utils.escape_html(text) : $("<div>").text(text).html();
	}

	function slug(value) {
		const text = value == null ? "" : String(value);
		if (frappe.router?.slug) return frappe.router.slug(text);
		return text.trim().toLowerCase().replace(/&/g, " and ").replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
	}

	function icon_html(icon_name, fallback = "layout-grid") {
		const icon = icon_name || fallback;
		if (typeof icon === "string" && icon.trim().startsWith("<")) return icon;
		try {
			return frappe.utils.icon(icon, "md");
		} catch (e) {
			try {
				return frappe.utils.icon(fallback, "md");
			} catch (ignored) {
				return "";
			}
		}
	}

	function arrow_icon() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>`;
	}

	function star_icon(filled = false) {
		return `<svg viewBox="0 0 24 24" ${filled ? 'fill="currentColor"' : 'fill="none"'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2.8 2.84 5.75 6.35.92-4.6 4.48 1.09 6.32L12 17.28l-5.68 2.99 1.09-6.32-4.6-4.48 6.35-.92L12 2.8Z"></path></svg>`;
	}

	function search_icon() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`;
	}

	function get_workspaces() {
		const provider = saas_theme.professional_ui?.get_workspaces;
		if (typeof provider !== "function") return [];
		try {
			return provider() || [];
		} catch (e) {
			return [];
		}
	}

	function read_json(key, fallback = []) {
		try {
			const value = JSON.parse(localStorage.getItem(key) || "null");
			return Array.isArray(value) ? value : fallback;
		} catch (e) {
			return fallback;
		}
	}

	function get_recent() {
		return read_json(RECENT_KEY, []).slice(0, MAX_RECENT);
	}

	function get_favorites() {
		return read_json(FAVORITES_KEY, []).filter(Boolean);
	}

	function is_favorite(name) {
		return get_favorites().includes(name);
	}

	function toggle_favorite(name) {
		if (!name) return;
		try {
			const favorites = get_favorites();
			const next = favorites.includes(name) ? favorites.filter((item) => item !== name) : [name, ...favorites];
			localStorage.setItem(FAVORITES_KEY, JSON.stringify(next.slice(0, 24)));
		} catch (e) {
			// Favorites are optional; navigation continues if storage is unavailable.
		}
	}

	function save_recent(workspace) {
		if (!workspace?.name) return;
		try {
			const next = get_recent().filter((item) => item.name !== workspace.name);
			next.unshift({ name: workspace.name, title: workspace.title, module: workspace.module, icon: workspace.icon, route: workspace.route });
			localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, MAX_RECENT)));
		} catch (e) {
			// Recent navigation is optional.
		}
	}

	function list_route(doctype) {
		const prefix = window.location.pathname.startsWith("/app") ? "/app" : "/desk";
		return `${prefix}/${slug(doctype)}`;
	}

	function get_user_name() {
		let full_name = "";
		try {
			full_name = frappe.user?.full_name?.() || "";
		} catch (e) {
			full_name = "";
		}
		full_name = full_name || frappe.boot?.user?.full_name || frappe.session?.user || __("User");
		return String(full_name).split(/\s+/).filter(Boolean)[0] || __("User");
	}

	function get_time_zone() {
		return frappe.boot?.user?.time_zone || frappe.sys_defaults?.time_zone || frappe.boot?.sysdefaults?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	}

	function date_parts(date = new Date()) {
		const time_zone = get_time_zone();
		const locale = document.documentElement.lang || navigator.language || "en";
		const make = (options) => {
			try {
				return new Intl.DateTimeFormat(locale, { ...options, timeZone: time_zone }).format(date);
			} catch (e) {
				return new Intl.DateTimeFormat(locale, options).format(date);
			}
		};

		let hour = date.getHours();
		try {
			hour = Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZone: time_zone }).format(date));
		} catch (e) {
			// Browser-local hour is the fallback.
		}

		return {
			time: make({ hour: "2-digit", minute: "2-digit", hour12: true }),
			weekday: make({ weekday: "long" }),
			date: make({ day: "2-digit", month: "long", year: "numeric" }),
			time_zone,
			hour,
		};
	}

	function greeting_for_hour(hour) {
		if (hour < 12) return __("Good morning");
		if (hour < 17) return __("Good afternoon");
		return __("Good evening");
	}

	function map_recent_to_workspaces(workspaces) {
		const by_name = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
		return get_recent().map((item) => by_name.get(item.name) || item).filter((item) => item?.name && item?.route);
	}

	function get_quick_access(workspaces) {
		const by_name = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
		const picked = [];
		const seen = new Set();
		const push = (workspace) => {
			if (!workspace?.name || !workspace?.route || seen.has(workspace.name)) return;
			seen.add(workspace.name);
			picked.push(workspace);
		};
		get_favorites().forEach((name) => push(by_name.get(name)));
		map_recent_to_workspaces(workspaces).forEach(push);
		workspaces.forEach(push);
		return picked.slice(0, MAX_QUICK);
	}

	function quick_card(workspace) {
		return `<a class="st-hub-quick-card" href="${escape_html(workspace.route)}" data-workspace-name="${escape_html(workspace.name)}"><span class="st-hub-quick-icon">${icon_html(workspace.icon)}</span><span class="st-hub-quick-copy"><strong>${escape_html(__(workspace.title || workspace.name))}</strong><small>${escape_html(__(workspace.module || __("Workspace")))}</small></span><span class="st-hub-quick-arrow">${arrow_icon()}</span></a>`;
	}

	function workspace_card(workspace) {
		const favorite = is_favorite(workspace.name);
		const searchable = escape_html(`${workspace.title || ""} ${workspace.module || ""}`.toLowerCase());
		return `<a class="st-hub-workspace-card" href="${escape_html(workspace.route)}" data-workspace-name="${escape_html(workspace.name)}" data-module="${escape_html(workspace.module || "")}" data-search="${searchable}"><button class="st-hub-favorite${favorite ? " active" : ""}" type="button" aria-label="${escape_html(favorite ? __("Remove from favorites") : __("Add to favorites"))}" data-favorite-name="${escape_html(workspace.name)}">${star_icon(favorite)}</button><span class="st-hub-workspace-icon">${icon_html(workspace.icon)}</span><strong class="st-hub-workspace-title">${escape_html(__(workspace.title || workspace.name))}</strong><span class="st-hub-workspace-module">${escape_html(__(workspace.module || __("General")))}</span><span class="st-hub-workspace-arrow">${arrow_icon()}</span></a>`;
	}

	function recent_list(workspaces) {
		const recent = map_recent_to_workspaces(workspaces).slice(0, 5);
		if (!recent.length) return `<div class="st-hub-recent-empty">${__("Your recently opened workspaces will appear here.")}</div>`;
		return recent.map((item) => `<a class="st-hub-recent-item" href="${escape_html(item.route)}" data-workspace-name="${escape_html(item.name)}"><span class="st-hub-recent-icon">${icon_html(item.icon)}</span><span class="st-hub-recent-copy"><strong>${escape_html(__(item.title || item.name))}</strong><small>${escape_html(__(item.module || __("Workspace")))}</small></span><span class="st-hub-recent-arrow">${arrow_icon()}</span></a>`).join("");
	}

	function metric_card({ key, label, value, caption, icon, href = "" }) {
		const tag = href ? "a" : "div";
		const href_attr = href ? ` href="${escape_html(href)}"` : "";
		return `<${tag} class="st-hub-metric"${href_attr} data-metric="${escape_html(key)}"><span class="st-hub-metric-icon">${icon_html(icon)}</span><span class="st-hub-metric-copy"><small>${escape_html(label)}</small><strong data-metric-value="${escape_html(key)}">${escape_html(value)}</strong><span>${escape_html(caption)}</span></span></${tag}>`;
	}

	function update_metric($home, key, value) {
		$home.find(`[data-metric-value="${key}"]`).text(value == null ? "—" : value);
	}

	async function refresh_personal_metrics($home) {
		const user = frappe.session?.user;
		if (!user) return;

		const count = async (doctype, filters) => {
			try {
				const response = await frappe.call({ method: "frappe.client.get_count", args: { doctype, filters } });
				return Number(response?.message ?? 0);
			} catch (e) {
				return null;
			}
		};

		const [tasks, unread] = await Promise.all([
			count("ToDo", { allocated_to: user, status: "Open" }),
			count("Notification Log", { for_user: user, read: 0 }),
		]);

		if (!$home.closest("body").length) return;
		update_metric($home, "tasks", tasks);
		update_metric($home, "notifications", unread);
	}

	function start_clock($home) {
		if (clock_timer) clearInterval(clock_timer);
		const update = () => {
			const parts = date_parts();
			$home.find(".st-hub-clock-time").text(parts.time);
			$home.find(".st-hub-clock-weekday").text(parts.weekday);
			$home.find(".st-hub-clock-date").text(parts.date);
			$home.find(".st-hub-clock-zone").text(parts.time_zone);
			$home.find(".st-hub-greeting").text(greeting_for_hour(parts.hour));
		};
		update();
		clock_timer = setInterval(update, 30000);
	}

	function render_home_dashboard(desktop) {
		if (frappe.boot?.desktop_page === "Desktop Icons") return;
		const $wrapper = $(".desktop-wrapper").last();
		const $container = $wrapper.find(".desktop-container").first();
		if (!$container.length) return;

		const workspaces = get_workspaces();
		if (!workspaces.length) return;

		$container.find(".icons-container, .st-workspace-home, .st-home-dashboard").remove();
		$container.addClass("st-workspace-home-active st-home-dashboard-active");

		const modules = [...new Set(workspaces.map((workspace) => workspace.module).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }));
		const quick = get_quick_access(workspaces);
		const initial_unread = Number(frappe.boot?.notification_unread_count ?? 0);
		const name = get_user_name();
		const parts = date_parts();

		const chips = [`<button class="st-hub-chip active" type="button" data-module="all">${__("All")}</button>`, ...modules.map((module) => `<button class="st-hub-chip" type="button" data-module="${escape_html(module)}">${escape_html(__(module))}</button>`)].join("");

		const metrics = [
			{ key: "tasks", label: __("Open Assignments"), value: "…", caption: __("Items assigned to you"), icon: "check", href: list_route("ToDo") },
			{ key: "notifications", label: __("Unread Notifications"), value: initial_unread, caption: __("Needs your attention"), icon: "bell", href: list_route("Notification Log") },
			{ key: "workspaces", label: __("Workspaces"), value: workspaces.length, caption: __("Available to your account"), icon: "layout-grid" },
			{ key: "modules", label: __("Modules"), value: modules.length, caption: __("Navigation groups"), icon: "folder-normal" },
		];

		const $home = $(`<div class="st-home-dashboard"><header class="st-hub-welcome"><div><div class="st-hub-eyebrow">${__("Workspace Home")}</div><h1><span class="st-hub-greeting">${escape_html(greeting_for_hour(parts.hour))}</span>, ${escape_html(name)}</h1><p>${__("Everything you need to continue your work, in one place.")}</p></div><div class="st-hub-workspace-total"><span>${workspaces.length}</span><small>${workspaces.length === 1 ? __("workspace") : __("workspaces")}</small></div></header><div class="st-hub-metrics">${metrics.map(metric_card).join("")}</div><div class="st-hub-layout"><aside class="st-hub-sidebar"><section class="st-hub-clock-card"><div class="st-hub-clock-top"><span class="st-hub-clock-weekday">${escape_html(parts.weekday)}</span><span class="st-hub-live-dot"><i></i>${__("Live")}</span></div><div class="st-hub-clock-time">${escape_html(parts.time)}</div><div class="st-hub-clock-date">${escape_html(parts.date)}</div><div class="st-hub-clock-zone">${escape_html(parts.time_zone)}</div></section><section class="st-hub-side-card"><div class="st-hub-side-head"><div><span>${__("Recent")}</span><small>${__("Continue where you left off")}</small></div></div><div class="st-hub-recent-list">${recent_list(workspaces)}</div></section></aside><main class="st-hub-main"><section class="st-hub-section st-hub-quick-section"><div class="st-hub-section-head"><div><h2>${__("Quick Access")}</h2><p>${__("Favorites and recently used workspaces")}</p></div></div><div class="st-hub-quick-grid">${quick.map(quick_card).join("")}</div></section><section class="st-hub-section st-hub-workspaces-section"><div class="st-hub-section-head st-hub-workspaces-head"><div><h2>${__("All Workspaces")}</h2><p>${__("Navigate to modules, reports and transactions")}</p></div><span class="st-hub-visible-count">${workspaces.length}</span></div><div class="st-hub-search-row"><label class="st-hub-search"><span>${search_icon()}</span><input type="search" autocomplete="off" spellcheck="false" placeholder="${escape_html(__("Search workspaces..."))}"></label></div><div class="st-hub-chips">${chips}</div><div class="st-hub-workspace-grid">${workspaces.map(workspace_card).join("")}</div><div class="st-hub-empty"><span>${icon_html("search")}</span><strong>${__("No matching workspaces")}</strong><small>${__("Try a different search or module filter.")}</small></div></section></main></div></div>`);

		$container.append($home);
		start_clock($home);
		refresh_personal_metrics($home);

		let active_module = "all";
		const $search = $home.find(".st-hub-search input");
		const $cards = $home.find(".st-hub-workspace-card");
		const $empty = $home.find(".st-hub-empty");
		const $count = $home.find(".st-hub-visible-count");

		const apply_filters = () => {
			const query = String($search.val() || "").trim().toLowerCase();
			let visible = 0;
			$cards.each(function () {
				const $card = $(this);
				const module_name = String($card.data("module") || "");
				const searchable = String($card.attr("data-search") || "");
				const show = (active_module === "all" || module_name === active_module) && (!query || searchable.includes(query));
				$card.toggle(show);
				if (show) visible++;
			});
			$count.text(visible);
			$empty.toggleClass("visible", visible === 0);
		};

		$search.on("input", apply_filters);
		$home.on("click", ".st-hub-chip", function () {
			active_module = String($(this).data("module") || "all");
			$home.find(".st-hub-chip").removeClass("active");
			$(this).addClass("active");
			apply_filters();
		});
		$home.on("click", ".st-hub-favorite", function (event) {
			event.preventDefault();
			event.stopPropagation();
			toggle_favorite(String($(this).data("favorite-name") || ""));
			setTimeout(() => render_home_dashboard(desktop), 0);
		});
		$home.on("click", ".st-hub-workspace-card, .st-hub-quick-card, .st-hub-recent-item", function () {
			const name = String($(this).data("workspace-name") || "");
			const workspace = workspaces.find((item) => item.name === name);
			if (workspace) save_recent(workspace);
		});

		if (desktop) desktop.st_home_dashboard_rendered = true;
	}

	saas_theme.home_dashboard.render = render_home_dashboard;

	$(document).off("desktop_screen.saas_home_dashboard").on("desktop_screen.saas_home_dashboard", function (_event, payload) {
		setTimeout(() => render_home_dashboard(payload?.desktop), 80);
	});

	$(document).off("page-change.saas_home_dashboard").on("page-change.saas_home_dashboard", function () {
		const route = frappe.get_route?.() || [];
		if (route[0] === "desktop" || route.length === 0) setTimeout(() => render_home_dashboard(frappe.pages?.desktop?.desktop_page), 150);
	});

	$(function () {
		const route = frappe.get_route?.() || [];
		if (route[0] === "desktop" || route.length === 0) setTimeout(() => render_home_dashboard(frappe.pages?.desktop?.desktop_page), 220);
	});
})();

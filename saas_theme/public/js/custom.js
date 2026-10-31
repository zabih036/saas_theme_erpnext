/*
 * SaaS Theme — Complete Project Interactions
 * Mechanically consolidated from merged working commit 041900291b68052807bb1b6c98d116b58a9f50e0.
 * Historical execution order is preserved. Future Desk JS changes belong in this file.
 */

/* ===== BEGIN HISTORICAL CONTROLLER: professional_ui.js ===== */
/*
 * SaaS Theme — Professional UI Refresh
 *
 * Adds a native-data workspace home to Frappe v16's Apps desktop screen.
 * No Frappe core templates are replaced and no server-side data is invented:
 * only workspaces already present in frappe.boot are rendered.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;

	frappe.provide("saas_theme.professional_ui");

	const RECENT_KEY = "saas_theme_recent_workspaces_v1";
	const MAX_RECENT = 6;

	function escape_html(value) {
		const text = value == null ? "" : String(value);
		return frappe.utils?.escape_html ? frappe.utils.escape_html(text) : $("<div>").text(text).html();
	}

	function slug(value) {
		const text = value == null ? "" : String(value);
		if (frappe.router?.slug) return frappe.router.slug(text);
		return text
			.trim()
			.toLowerCase()
			.replace(/&/g, " and ")
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9_-]/g, "");
	}

	function icon_html(icon_name, fallback = "layout-grid") {
		let icon = icon_name || fallback;
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

	function is_private_workspace(workspace) {
		return workspace?.public === 0 || workspace?.public === false || workspace?.is_private === 1;
	}

	function find_workspace_page(name) {
		const pages = frappe.boot?.workspaces?.pages || [];
		return pages.find((page) => page.name === name || page.title === name);
	}

	function sidebar_for_module(module_name) {
		if (!module_name) return null;

		if (typeof frappe.utils?.sidebar_for_module === "function") {
			const sidebar = frappe.utils.sidebar_for_module(module_name);
			if (sidebar) return sidebar;
		}

		const sidebars = frappe.boot?.module_sidebars || {};
		if (sidebars[module_name]) {
			return { name: module_name, ...sidebars[module_name] };
		}

		for (const [name, sidebar] of Object.entries(sidebars)) {
			if (sidebar?.module === module_name || sidebar?.label === module_name) {
				return { name, ...sidebar };
			}
		}

		return null;
	}

	function workspace_route(workspace, shell_hint = null) {
		if (workspace?.route && String(workspace.route).startsWith("/")) return workspace.route;

		const workspace_name = workspace?.name || workspace?.title || workspace?.label;
		if (!workspace_name) return "/desk";

		const module_name = workspace?.module || workspace?.module_name || workspace?.app || "";
		const sidebar = shell_hint || sidebar_for_module(module_name);
		const shell = sidebar?.name || sidebar?.title || sidebar?.module || module_name || null;

		if (frappe.ui?.sidebar_item?.get_route) {
			const item = {
				type: "Link",
				link_type: "Workspace",
				link_to: workspace_name,
				route: workspace.route || undefined,
			};
			try {
				const resolved = frappe.ui.sidebar_item.get_route(item, false, shell);
				if (resolved) return resolved;
			} catch (e) {
				// Older v16 builds may not initialize frappe.workspaces on the Apps screen.
				// Fall through to the version-compatible route builder below.
			}
		}

		const legacy_app_prefix = window.location.pathname.startsWith("/app") ? "/app" : "/desk";
		if (legacy_app_prefix === "/app") {
			return `${legacy_app_prefix}/${slug(workspace_name)}`;
		}

		if (is_private_workspace(workspace)) {
			return `/desk/private/${slug(workspace.title || workspace_name)}`;
		}

		const workspace_slug = slug(workspace_name);
		const shell_slug = shell ? slug(shell) : "";
		if (shell_slug && shell_slug !== workspace_slug) {
			return `/desk/${shell_slug}/${workspace_slug}`;
		}
		return `/desk/${workspace_slug}`;
	}

	function nested_items(items) {
		const output = [];
		(items || []).forEach((item) => {
			if (!item) return;
			output.push(item);
			if (Array.isArray(item.nested_items)) output.push(...nested_items(item.nested_items));
			if (Array.isArray(item.items)) output.push(...nested_items(item.items));
		});
		return output;
	}

	function workspace_icon(workspace) {
		if (workspace.icon) return workspace.icon;

		const module_name = workspace.module || workspace.module_name;
		if (module_name && typeof frappe.get_module_icon === "function") {
			const module_icon = frappe.get_module_icon(module_name);
			if (module_icon) return module_icon;
		}

		const sidebar = sidebar_for_module(module_name);
		return sidebar?.header_icon || "layout-grid";
	}

	function workspace_description(workspace) {
		const module_name = workspace.module || workspace.module_name || workspace.app;
		if (workspace.description) return workspace.description;
		if (module_name) {
			return __("Open {0} tools, reports and daily transactions.", [__(module_name)]);
		}
		return __("Open tools, reports and daily transactions in this workspace.");
	}

	function normalize_workspace(workspace, shell_hint = null) {
		const name = workspace.name || workspace.title || workspace.label || workspace.link_to;
		const title = workspace.title || workspace.label || workspace.link_to || workspace.name;
		const module_name =
			workspace.module ||
			workspace.module_name ||
			shell_hint?.module ||
			shell_hint?.label ||
			shell_hint?.name ||
			__("General");

		return {
			name,
			title,
			module: module_name,
			public: workspace.public,
			is_private: workspace.is_private,
			icon: workspace.icon || shell_hint?.header_icon || workspace_icon(workspace),
			description: workspace_description({ ...workspace, module: module_name }),
			route: workspace_route({ ...workspace, name, title, module: module_name }, shell_hint),
		};
	}

	function from_boot_workspace_pages() {
		const pages = frappe.boot?.workspaces?.pages || [];
		const can_manage_workspaces = !!frappe.boot?.workspaces?.has_access;

		return pages
			.filter((workspace) => {
				if (!workspace || !workspace.name) return false;
				// Frappe intentionally keeps hidden pages in a Workspace Manager's boot payload so
				// they remain discoverable/manageable. Preserve that native permission behavior.
				if (!can_manage_workspaces && (workspace.hidden === 1 || workspace.is_hidden === 1)) {
					return false;
				}
				return workspace.hide_custom !== 1;
			})
			.map((workspace) => normalize_workspace(workspace));
	}

	function from_module_sidebars() {
		const sidebars = frappe.boot?.module_sidebars || {};
		const output = [];

		for (const [shell_name, raw_sidebar] of Object.entries(sidebars)) {
			const sidebar = { name: shell_name, ...(raw_sidebar || {}) };
			const links = nested_items(sidebar.items).filter(
				(item) => item.type === "Link" && item.link_type === "Workspace" && item.link_to
			);

			links.forEach((item) => {
				const page = find_workspace_page(item.link_to) || {};
				output.push(
					normalize_workspace(
						{
							...page,
							name: page.name || item.link_to,
							title: page.title || item.label || item.link_to,
							icon: page.icon || item.icon,
							module: page.module || sidebar.module || shell_name,
							route: (() => {
								if (!frappe.ui?.sidebar_item?.get_route) return item.route;
								try {
									return frappe.ui.sidebar_item.get_route(item, false, shell_name) || item.route;
								} catch (e) {
									return item.route;
								}
							})(),
						},
						sidebar
					)
				);
			});
		}

		return output;
	}

	function from_legacy_sidebars() {
		const sidebars = frappe.boot?.workspace_sidebar_item || {};
		const output = [];

		for (const [key, raw_sidebar] of Object.entries(sidebars)) {
			const sidebar = { name: raw_sidebar?.name || raw_sidebar?.label || key, ...(raw_sidebar || {}) };
			const links = nested_items(sidebar.items || sidebar.sidebar_items || []).filter(
				(item) => item.link_type === "Workspace" && item.link_to
			);

			links.forEach((item) => {
				const page = find_workspace_page(item.link_to) || {};
				output.push(
					normalize_workspace(
						{
							...page,
							name: page.name || item.link_to,
							title: page.title || item.label || item.link_to,
							icon: page.icon || item.icon,
							module: page.module || sidebar.module || sidebar.label || sidebar.name,
						},
						sidebar
					)
				);
			});
		}

		return output;
	}

	function fallback_sidebar_landings() {
		const output = [];

		const modern = frappe.boot?.module_sidebars || {};
		for (const [shell_name, raw_sidebar] of Object.entries(modern)) {
			const sidebar = { name: shell_name, ...(raw_sidebar || {}) };
			let route = null;
			if (frappe.app?.sidebar?.module_landing_route) {
				route = frappe.app.sidebar.module_landing_route(shell_name);
			}
			output.push({
				name: shell_name,
				title: sidebar.label || sidebar.title || shell_name,
				module: sidebar.app || sidebar.module || __("Workspace"),
				icon: sidebar.header_icon || "layout-grid",
				description: __("Open the {0} workspace and its navigation.", [__(sidebar.label || shell_name)]),
				route: route || `/desk/${slug(shell_name)}`,
			});
		}

		if (output.length) return output;

		const legacy = frappe.boot?.desktop_icons || [];
		return legacy
			.filter((icon) => icon.hidden !== 1 && icon.link_type === "Workspace Sidebar")
			.map((icon) => {
				const legacy_sidebar =
					frappe.boot?.workspace_sidebar_item?.[String(icon.label || "").toLowerCase()] || {};
				return {
					name: icon.label,
					title: icon.label,
					module: icon.module || __("Workspace"),
					icon: legacy_sidebar.header_icon || icon.icon || "layout-grid",
					description: __("Open the {0} workspace and its navigation.", [__(icon.label)]),
					route: `/app/${slug(icon.label)}`,
				};
			});
	}

	function unique_workspaces(workspaces) {
		const seen = new Set();
		return workspaces.filter((workspace) => {
			if (!workspace?.name || !workspace?.route) return false;
			const key = `${workspace.name}::${workspace.route}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	function get_workspaces() {
		let workspaces = from_boot_workspace_pages();

		// If pages have no useful module placement, the resolved sidebars are a better
		// representation of what the current user can really navigate to.
		if (!workspaces.length) workspaces = from_module_sidebars();
		if (!workspaces.length) workspaces = from_legacy_sidebars();
		if (!workspaces.length) workspaces = fallback_sidebar_landings();

		return unique_workspaces(workspaces).sort((a, b) =>
			String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" })
		);
	}

	function get_recent() {
		try {
			const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
			return Array.isArray(recent) ? recent : [];
		} catch (e) {
			return [];
		}
	}

	function save_recent(workspace) {
		try {
			const next = get_recent().filter((item) => item.name !== workspace.name);
			next.unshift({
				name: workspace.name,
				title: workspace.title,
				module: workspace.module,
				icon: workspace.icon,
				route: workspace.route,
			});
			localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, MAX_RECENT)));
		} catch (e) {
			// localStorage can be unavailable in hardened browser contexts; navigation still works.
		}
	}

	function arrow_icon() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>
		</svg>`;
	}

	function search_icon() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>
		</svg>`;
	}

	function lock_icon() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<rect width="18" height="11" x="3" y="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
		</svg>`;
	}

	function workspace_card(workspace) {
		const private_label = is_private_workspace(workspace)
			? `<span class="st-workspace-private">${lock_icon()}${__("Private")}</span>`
			: "";

		const search_value = escape_html(
			`${workspace.title || ""} ${workspace.module || ""}`.toLowerCase()
		);

		return `
			<a class="st-workspace-card"
				href="${escape_html(workspace.route)}"
				data-workspace-name="${escape_html(workspace.name)}"
				data-module="${escape_html(workspace.module || "")}"
				data-search="${search_value}">
				<div class="st-workspace-card-top">
					<div class="st-workspace-card-icon">${icon_html(workspace.icon)}</div>
					<span class="st-workspace-card-arrow">${arrow_icon()}</span>
				</div>
				<div class="st-workspace-card-title" title="${escape_html(workspace.title)}">
					${escape_html(__(workspace.title))}
				</div>
				<div class="st-workspace-card-description">
					${escape_html(workspace.description)}
				</div>
				<div class="st-workspace-card-footer">
					<span class="st-workspace-module">${escape_html(__(workspace.module || __("General")))}</span>
					${private_label}
				</div>
			</a>`;
	}

	function recent_html(workspaces) {
		const by_name = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
		const items = get_recent()
			.map((item) => by_name.get(item.name) || item)
			.filter((item) => item?.route)
			.slice(0, MAX_RECENT);

		if (!items.length) return "";

		return `
			<section class="st-workspace-section st-workspace-recent-section">
				<div class="st-workspace-section-head">
					<h2 class="st-workspace-section-title">${__("Recent")}</h2>
					<span class="st-workspace-section-count">${__("Your recently opened workspaces")}</span>
				</div>
				<div class="st-workspace-recent">
					${items
						.map(
							(item) => `
								<a class="st-workspace-recent-item" href="${escape_html(item.route)}"
									data-workspace-name="${escape_html(item.name)}">
									<span class="st-workspace-recent-icon">${icon_html(item.icon)}</span>
									<span class="st-workspace-recent-copy">
										<span class="st-workspace-recent-title">${escape_html(__(item.title || item.name))}</span>
										<span class="st-workspace-recent-module">${escape_html(__(item.module || __("Workspace")))}</span>
									</span>
								</a>`
						)
						.join("")}
				</div>
			</section>`;
	}

	function render_workspace_home(desktop) {
		if (frappe.boot?.desktop_page === "Desktop Icons") return;

		const $wrapper = $(".desktop-wrapper").last();
		const $container = $wrapper.find(".desktop-container").first();
		if (!$container.length) return;

		const workspaces = get_workspaces();
		if (!workspaces.length) return;

		// DesktopPage.make() recreates this container every time the route is shown,
		// so replacing the native Apps grid here is deterministic and does not patch core.
		$container.find(".icons-container").remove();
		$container.find(".st-workspace-home").remove();
		$container.addClass("st-workspace-home-active");

		const modules = [...new Set(workspaces.map((workspace) => workspace.module).filter(Boolean))].sort(
			(a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" })
		);

		const chips = [
			`<button class="st-workspace-chip active" type="button" data-module="all">${__("All")}</button>`,
			...modules.map(
				(module) =>
					`<button class="st-workspace-chip" type="button" data-module="${escape_html(module)}">${escape_html(
						__(module)
					)}</button>`
			),
		].join("");

		const $home = $(`
			<div class="st-workspace-home">
				<header class="st-workspace-home-header">
					<div class="st-workspace-home-copy">
						<h1 class="st-workspace-home-title">${__("Workspaces")}</h1>
						<p class="st-workspace-home-subtitle">
							${__("Open the workspace you need and continue directly to its tools, reports and transactions.")}
						</p>
					</div>
					<div class="st-workspace-home-meta">
						<span>${workspaces.length}</span>
						<span>${workspaces.length === 1 ? __("workspace") : __("workspaces")}</span>
					</div>
				</header>

				${recent_html(workspaces)}

				<section class="st-workspace-section st-workspace-all-section">
					<div class="st-workspace-section-head">
						<h2 class="st-workspace-section-title">${__("All Workspaces")}</h2>
						<span class="st-workspace-section-count st-workspace-visible-count">${workspaces.length}</span>
					</div>

					<div class="st-workspace-toolbar">
						<label class="st-workspace-search">
							<span class="st-workspace-search-icon">${search_icon()}</span>
							<input type="search" autocomplete="off" spellcheck="false"
								placeholder="${escape_html(__("Search workspaces..."))}">
						</label>
					</div>

					<div class="st-workspace-filter-chips">${chips}</div>

					<div class="st-workspace-grid">
						${workspaces.map(workspace_card).join("")}
					</div>

					<div class="st-workspace-empty">
						<div class="st-workspace-empty-icon">${icon_html("search")}</div>
						<div>${__("No workspaces match your search.")}</div>
					</div>
				</section>
			</div>
		`);

		$container.append($home);

		let active_module = "all";
		const $search = $home.find(".st-workspace-search input");
		const $cards = $home.find(".st-workspace-card");
		const $empty = $home.find(".st-workspace-empty");
		const $count = $home.find(".st-workspace-visible-count");

		const apply_filters = () => {
			const query = String($search.val() || "").trim().toLowerCase();
			let visible = 0;

			$cards.each(function () {
				const $card = $(this);
				const module_name = String($card.data("module") || "");
				const searchable = String($card.attr("data-search") || "");
				const module_match = active_module === "all" || module_name === active_module;
				const query_match = !query || searchable.includes(query);
				const show = module_match && query_match;
				$card.toggle(show);
				if (show) visible++;
			});

			$count.text(visible);
			$empty.toggleClass("visible", visible === 0);
		};

		$search.on("input", apply_filters);

		$home.find(".st-workspace-chip").on("click", function () {
			active_module = String($(this).data("module") || "all");
			$home.find(".st-workspace-chip").removeClass("active");
			$(this).addClass("active");
			apply_filters();
		});

		$home.on("click", ".st-workspace-card, .st-workspace-recent-item", function () {
			const name = String($(this).data("workspace-name") || "");
			const workspace = workspaces.find((item) => item.name === name);
			if (workspace) save_recent(workspace);
		});

		// Keep the native DesktopPage object intact; only its visual body is replaced.
		if (desktop) desktop.st_workspace_home_rendered = true;
	}

	saas_theme.professional_ui.render_workspace_home = render_workspace_home;
	saas_theme.professional_ui.get_workspaces = get_workspaces;

	$(document)
		.off("desktop_screen.saas_professional_ui")
		.on("desktop_screen.saas_professional_ui", function (_event, payload) {
			setTimeout(() => render_workspace_home(payload?.desktop), 0);
		});

	// Some v16 builds fire the custom event before an app's include file has completed.
	// Re-check when the page changes; the renderer is idempotent.
	$(document)
		.off("page-change.saas_professional_ui")
		.on("page-change.saas_professional_ui", function () {
			const route = frappe.get_route?.() || [];
			if (route[0] === "desktop" || route.length === 0) {
				setTimeout(() => render_workspace_home(frappe.pages?.desktop?.desktop_page), 60);
			}
		});

	$(function () {
		const route = frappe.get_route?.() || [];
		if (route[0] === "desktop" || route.length === 0) {
			setTimeout(() => render_workspace_home(frappe.pages?.desktop?.desktop_page), 120);
		}
	});
})();

/* ===== END HISTORICAL CONTROLLER: professional_ui.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: home_dashboard.js ===== */
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

/* ===== END HISTORICAL CONTROLLER: home_dashboard.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: home_analytics.js ===== */
/*
 * SaaS Theme — ERP Home Analytics
 * Refines the home dashboard with fixed core navigation and real ERP analytics.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;

	const MONTHS = 6;
	const LIMIT = 400;
	let enhance_token = 0;

	function esc(value) {
		const text = value == null ? "" : String(value);
		return frappe.utils?.escape_html ? frappe.utils.escape_html(text) : $("<div>").text(text).html();
	}

	function slug(value) {
		if (frappe.router?.slug) return frappe.router.slug(value);
		return String(value || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
	}

	function list_route(doctype) {
		return `${window.location.pathname.startsWith("/app") ? "/app" : "/desk"}/${slug(doctype)}`;
	}

	function icon(name, fallback = "layout-grid") {
		try { return frappe.utils.icon(name || fallback, "md"); } catch (e) {
			try { return frappe.utils.icon(fallback, "md"); } catch (ignored) { return ""; }
		}
	}

	function arrow() {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>`;
	}

	function workspaces() {
		try { return saas_theme.professional_ui?.get_workspaces?.() || []; } catch (e) { return []; }
	}

	function visible_workspaces(items) {
		const pages = frappe.boot?.workspaces?.pages || [];
		const hidden = new Set();
		pages.forEach((page) => {
			if (!page || (page.hidden !== 1 && page.is_hidden !== 1 && page.hide_custom !== 1)) return;
			[page.name, page.title, page.label].filter(Boolean).forEach((value) => hidden.add(String(value)));
		});
		return (items || []).filter((item) => item?.name && item?.route && !hidden.has(String(item.name)) && !hidden.has(String(item.title || "")));
	}

	function find_workspace(items, aliases) {
		const needles = aliases.map((value) => value.toLowerCase());
		return items.find((item) => {
			const hay = [item.name, item.title, item.module].filter(Boolean).map((value) => String(value).toLowerCase());
			return needles.some((needle) => hay.some((value) => value === needle || value.includes(needle)));
		});
	}

	function quick_items(items) {
		return [
			{ title: __("Buying"), aliases: ["buying", "purchase"], icon: "shopping-cart", fallback: list_route("Purchase Order") },
			{ title: __("Sales"), aliases: ["selling", "sales"], icon: "selling", fallback: list_route("Sales Invoice") },
			{ title: __("Assets"), aliases: ["assets", "asset"], icon: "assets", fallback: list_route("Asset") },
			{ title: __("Payments"), aliases: ["payments", "payment"], icon: "payment", fallback: list_route("Payment Entry") },
			{ title: __("Accounting"), aliases: ["accounting", "accounts"], icon: "accounting", fallback: list_route("Journal Entry") },
			{ title: __("Stock"), aliases: ["stock", "inventory"], icon: "stock", fallback: list_route("Stock Entry") },
		].map((definition) => {
			const workspace = find_workspace(items, definition.aliases);
			return {
				...definition,
				name: workspace?.name || "",
				route: workspace?.route || definition.fallback,
				icon: workspace?.icon || definition.icon,
			};
		});
	}

	function quick_html(item) {
		const workspace_attr = item.name ? ` data-workspace-name="${esc(item.name)}"` : "";
		return `<a class="st-hub-quick-card" href="${esc(item.route)}"${workspace_attr}><span class="st-hub-quick-icon">${icon(item.icon)}</span><span class="st-hub-quick-copy"><strong>${esc(item.title)}</strong><small>${__("Open module")}</small></span><span class="st-hub-quick-arrow">${arrow()}</span></a>`;
	}

	function workspace_navigation_html(items) {
		const visible = visible_workspaces(items);
		if (!visible.length) return "";
		const rows = visible.map((item) => `<a class="st-hub-recent-item st-hub-workspace-nav-item" href="${esc(item.route)}" data-workspace-name="${esc(item.name)}"><span class="st-hub-recent-icon">${icon(item.icon)}</span><span class="st-hub-recent-copy"><strong>${esc(__(item.title || item.name))}</strong><small>${esc(__(item.module || __("Workspace")))}</small></span><span class="st-hub-recent-arrow">${arrow()}</span></a>`).join("");
		return `<section class="st-hub-side-card st-hub-workspace-nav"><div class="st-hub-side-head"><div><span>${__("Workspaces")}</span><small>${__("Navigate to available work areas")}</small></div></div><div class="st-hub-recent-list st-hub-workspace-nav-list" style="max-height:min(430px,44vh);overflow-y:auto;overscroll-behavior:contain;padding-right:2px;">${rows}</div></section>`;
	}

	function metric_html(key, title, icon_name, route) {
		return `<a class="st-hub-metric st-hub-business-metric" href="${esc(route)}" data-business-metric="${key}"><span class="st-hub-metric-icon">${icon(icon_name)}</span><span class="st-hub-metric-copy"><small>${esc(title)}</small><strong data-business-value="${key}">…</strong><span data-business-caption="${key}">${__("Loading current month")}</span></span></a>`;
	}

	function analytics_html() {
		return `<div class="st-hub-section-head st-analytics-head"><div><h2>${__("Business Overview")}</h2><p>${__("Sales, purchases, payments and stock activity for the last 6 months")}</p></div><span class="st-analytics-updated">${__("Loading analytics…")}</span></div>
		<div class="st-analytics-kpis">
			${kpi("sales", __("Sales Invoices"), "selling", list_route("Sales Invoice"))}
			${kpi("purchases", __("Purchase Invoices"), "shopping-cart", list_route("Purchase Invoice"))}
			${kpi("payments", __("Payment Entries"), "payment", list_route("Payment Entry"))}
			${kpi("stock", __("Stock Activity"), "stock", list_route("Stock Entry"))}
		</div>
		<div class="st-analytics-grid">
			<article class="st-analytics-card st-analytics-card-wide"><div class="st-analytics-card-head"><strong>${__("Sales vs Purchases")}</strong><small>${__("Submitted invoice value by month")}</small></div><div class="st-analytics-chart st-finance-chart">${empty_chart(__("Loading chart…"))}</div></article>
			<article class="st-analytics-card"><div class="st-analytics-card-head"><strong>${__("Payment Activity")}</strong><small>${__("Submitted payment value by month")}</small></div><div class="st-analytics-chart st-payments-chart">${empty_chart(__("Loading chart…"))}</div></article>
			<article class="st-analytics-card"><div class="st-analytics-card-head"><strong>${__("Stock Transactions")}</strong><small>${__("Submitted stock entries by month")}</small></div><div class="st-analytics-chart st-stock-chart">${empty_chart(__("Loading chart…"))}</div></article>
		</div>`;
	}

	function kpi(key, title, icon_name, route) {
		return `<a class="st-analytics-kpi" href="${esc(route)}"><span class="st-analytics-kpi-icon">${icon(icon_name)}</span><span><small>${esc(title)}</small><strong data-analytics-value="${key}">—</strong><em data-analytics-note="${key}">${__("Loading…")}</em></span>${arrow()}</a>`;
	}

	function empty_chart(message) {
		return `<div class="st-analytics-empty">${esc(message)}</div>`;
	}

	function currency() {
		return frappe.boot?.sysdefaults?.currency || frappe.sys_defaults?.currency || frappe.defaults?.get_default?.("currency") || "";
	}

	function amount(value) {
		if (value == null || Number.isNaN(Number(value))) return "—";
		const number = Number(value);
		const code = currency();
		try {
			return new Intl.NumberFormat(document.documentElement.lang || navigator.language || "en", {
				style: code ? "currency" : "decimal",
				currency: code || undefined,
				notation: Math.abs(number) >= 1000000 ? "compact" : "standard",
				maximumFractionDigits: Math.abs(number) >= 100000 ? 1 : 0,
			}).format(number);
		} catch (e) { return `${code ? code + " " : ""}${Math.round(number).toLocaleString()}`; }
	}

	function qty(value) {
		if (value == null || Number.isNaN(Number(value))) return "—";
		return new Intl.NumberFormat(document.documentElement.lang || navigator.language || "en", { notation: Math.abs(value) >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value));
	}

	function iso(date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	}

	function period() {
		const now = new Date();
		return {
			start: iso(new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1)),
			current: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
			end: iso(now),
		};
	}

	function buckets() {
		const now = new Date();
		const locale = document.documentElement.lang || navigator.language || "en";
		return Array.from({ length: MONTHS }, (_, index) => {
			const date = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - index), 1);
			return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat(locale, { month: "short" }).format(date) };
		});
	}

	async function get_list(doctype, fields, filters, group_by = "") {
		try {
			const response = await frappe.call({ method: "frappe.client.get_list", args: { doctype, fields, filters, group_by: group_by || undefined, order_by: "posting_date asc", limit_page_length: LIMIT } });
			return Array.isArray(response?.message) ? response.message : [];
		} catch (e) { return null; }
	}

	function total(rows, field, absolute = false) {
		return (rows || []).reduce((sum, row) => sum + (absolute ? Math.abs(Number(row[field] || 0)) : Number(row[field] || 0)), 0);
	}

	function monthly(rows, field, absolute = false) {
		const months = buckets();
		const values = Object.fromEntries(months.map((month) => [month.key, 0]));
		(rows || []).forEach((row) => {
			const key = String(row.posting_date || "").slice(0, 7);
			if (!(key in values)) return;
			const value = Number(row[field] || 0);
			values[key] += absolute ? Math.abs(value) : value;
		});
		return { labels: months.map((month) => month.label), values: months.map((month) => values[month.key]) };
	}

	function line_chart(labels, series) {
		if (!series.some((item) => item.values.some((value) => Number(value) > 0))) return empty_chart(__("No data available for this period."));
		const width = 700, height = 230, left = 44, right = 14, top = 18, bottom = 34;
		const plot_w = width - left - right, plot_h = height - top - bottom;
		const max = Math.max(1, ...series.flatMap((item) => item.values));
		const x = (i) => left + (labels.length <= 1 ? plot_w / 2 : (i * plot_w) / (labels.length - 1));
		const y = (value) => top + plot_h - (Number(value || 0) / max) * plot_h;
		const grid = [0, .5, 1].map((ratio) => { const yy = top + plot_h - ratio * plot_h; return `<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" class="st-chart-grid"/><text x="${left-7}" y="${yy+3}" text-anchor="end" class="st-chart-label">${esc(amount(max*ratio))}</text>`; }).join("");
		const lines = series.map((item, s) => `<polyline points="${item.values.map((value, i) => `${x(i)},${y(value)}`).join(" ")}" class="st-chart-line st-chart-series-${s}"/>${item.values.map((value, i) => `<circle cx="${x(i)}" cy="${y(value)}" r="3" class="st-chart-dot st-chart-series-${s}"/>`).join("")}`).join("");
		const xlabels = labels.map((label, i) => `<text x="${x(i)}" y="${height-9}" text-anchor="middle" class="st-chart-label">${esc(label)}</text>`).join("");
		const legend = series.map((item, s) => `<span><i class="st-chart-series-${s}"></i>${esc(item.label)}</span>`).join("");
		return `<div class="st-chart-wrap"><div class="st-chart-legend">${legend}</div><svg viewBox="0 0 ${width} ${height}" class="st-chart-svg">${grid}${lines}${xlabels}</svg></div>`;
	}

	function bar_chart(labels, values, formatter, class_name) {
		if (!values.some((value) => Number(value) > 0)) return empty_chart(__("No data available for this period."));
		const width = 700, height = 215, left = 44, right = 14, top = 16, bottom = 34;
		const plot_w = width - left - right, plot_h = height - top - bottom, max = Math.max(1, ...values), slot = plot_w / labels.length, bar_w = Math.min(48, slot * .52);
		const grid = [0, .5, 1].map((ratio) => { const yy = top + plot_h - ratio * plot_h; return `<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" class="st-chart-grid"/><text x="${left-7}" y="${yy+3}" text-anchor="end" class="st-chart-label">${esc(formatter(max*ratio))}</text>`; }).join("");
		const bars = values.map((value, i) => { const h = (Number(value || 0) / max) * plot_h, xx = left + i*slot + (slot-bar_w)/2, yy = top + plot_h - h; return `<rect x="${xx}" y="${yy}" width="${bar_w}" height="${Math.max(2,h)}" rx="6" class="st-chart-bar ${class_name}"><title>${esc(`${labels[i]}: ${formatter(value)}`)}</title></rect><text x="${left+i*slot+slot/2}" y="${height-9}" text-anchor="middle" class="st-chart-label">${esc(labels[i])}</text>`; }).join("");
		return `<div class="st-chart-wrap"><svg viewBox="0 0 ${width} ${height}" class="st-chart-svg">${grid}${bars}</svg></div>`;
	}

	function set_business_metric($home, key, value, caption) {
		$home.find(`[data-business-value="${key}"]`).text(value == null ? "—" : value);
		$home.find(`[data-business-caption="${key}"]`).text(caption || __("No data available"));
	}

	function set_kpi($home, key, value, note) {
		$home.find(`[data-analytics-value="${key}"]`).text(value == null ? "—" : value);
		$home.find(`[data-analytics-note="${key}"]`).text(note || __("No data available"));
	}

	async function load_analytics($home, token) {
		const range = period();
		const submitted = [["docstatus", "=", 1], ["posting_date", ">=", range.start], ["posting_date", "<=", range.end]];
		const sum_field = (field, alias = "value") => ({ SUM: field, as: alias });
		const count_field = (field = "name", alias = "count") => ({ COUNT: field, as: alias });
		const [sales, purchases, primary_payments, stock] = await Promise.all([
			get_list("Sales Invoice", ["posting_date", sum_field("base_grand_total"), count_field()], submitted, "posting_date"),
			get_list("Purchase Invoice", ["posting_date", sum_field("base_grand_total"), count_field()], submitted, "posting_date"),
			get_list("Payment Entry", ["posting_date", sum_field("base_paid_amount"), count_field()], submitted, "posting_date"),
			get_list("Stock Entry", ["posting_date", count_field("name", "value")], submitted, "posting_date"),
		]);
		let payments = primary_payments;
		if (payments === null) { payments = await get_list("Payment Entry", ["posting_date", sum_field("paid_amount"), count_field()], submitted, "posting_date"); }
		if (token !== enhance_token || !$home.closest("body").length) return;

		const sales_current = (sales || []).filter((row) => String(row.posting_date || "") >= range.current);
		const purchase_current = (purchases || []).filter((row) => String(row.posting_date || "") >= range.current);
		const row_count = (rows) => total(rows || [], "count");
		set_business_metric($home, "sales", sales === null ? null : amount(total(sales_current, "value")), sales === null ? __("No access") : __("{0} submitted invoices", [row_count(sales_current)]));
		set_business_metric($home, "purchases", purchases === null ? null : amount(total(purchase_current, "value")), purchases === null ? __("No access") : __("{0} submitted invoices", [row_count(purchase_current)]));

		set_kpi($home, "sales", sales === null ? null : amount(total(sales, "value")), sales === null ? __("No access") : __("{0} invoices · 6 months", [row_count(sales)]));
		set_kpi($home, "purchases", purchases === null ? null : amount(total(purchases, "value")), purchases === null ? __("No access") : __("{0} invoices · 6 months", [row_count(purchases)]));
		set_kpi($home, "payments", payments === null ? null : amount(total(payments, "value")), payments === null ? __("No access") : __("{0} entries · 6 months", [row_count(payments)]));
		set_kpi($home, "stock", stock === null ? null : qty(total(stock, "value")), stock === null ? __("No access") : __("{0} submitted stock entries", [total(stock || [], "value")]));

		const s = monthly(sales || [], "value"), p = monthly(purchases || [], "value"), pay = monthly(payments || [], "value"), st = monthly(stock || [], "value");
		$home.find(".st-finance-chart").html(line_chart(s.labels, [{ label: __("Sales"), values: s.values }, { label: __("Purchases"), values: p.values }]));
		$home.find(".st-payments-chart").html(bar_chart(pay.labels, pay.values, amount, "st-chart-series-0"));
		$home.find(".st-stock-chart").html(bar_chart(st.labels, st.values, qty, "st-chart-series-2"));
		$home.find(".st-analytics-updated").text(__("Updated just now"));
	}

	function enhance() {
		const $home = $(".st-home-dashboard").last();
		if (!$home.length || $home.hasClass("st-analytics-enhanced")) return;
		$home.addClass("st-analytics-enhanced");
		const token = ++enhance_token;
		const items = workspaces();

		$home.find(".st-hub-workspace-total").remove();
		const $metrics = $home.find(".st-hub-metrics");
		$metrics.find(".st-hub-metric").slice(2).remove();
		$metrics.append(metric_html("sales", __("Sales This Month"), "selling", list_route("Sales Invoice")));
		$metrics.append(metric_html("purchases", __("Purchases This Month"), "shopping-cart", list_route("Purchase Invoice")));

		$home.find(".st-hub-quick-section .st-hub-section-head p").text(__("Buying, sales, assets, payments, accounting and stock"));
		$home.find(".st-hub-quick-grid").html(quick_items(items).map(quick_html).join(""));

		const $sidebar = $home.find(".st-hub-sidebar");
		$sidebar.find(".st-hub-workspace-nav").remove();
		$sidebar.append(workspace_navigation_html(items));

		const $workspace_section = $home.find(".st-hub-workspaces-section");
		$workspace_section.removeClass("st-hub-workspaces-section").addClass("st-hub-analytics-section").html(analytics_html());
		load_analytics($home, token);
	}

	function schedule() {
		[40, 120, 260].forEach((delay) => setTimeout(enhance, delay));
	}

	$(document).off("desktop_screen.saas_home_analytics").on("desktop_screen.saas_home_analytics", schedule);
	$(document).off("page-change.saas_home_analytics").on("page-change.saas_home_analytics", function () {
		const route = frappe.get_route?.() || [];
		if (route[0] === "desktop" || route.length === 0) schedule();
	});
	$(schedule);
})();

/* ===== END HISTORICAL CONTROLLER: home_analytics.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: brand_shell.js ===== */
/*
 * SaaS Theme — Company branding and desk shell cleanup
 *
 * Keeps the customization outside Frappe core:
 * - uses the default Company's Company Logo for desk branding
 * - removes Frappe Support and About from desktop profile menus
 * - removes Help from the workspace/sidebar header menu
 * - adds a persistent bottom sidebar collapse/expand control
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;

	frappe.provide("saas_theme.brand_shell");

	const state = {
		logo: undefined,
		logo_promise: null,
		observer: null,
	};

	async function resolve_company_logo() {
		if (state.logo !== undefined) return state.logo;
		if (state.logo_promise) return state.logo_promise;

		state.logo_promise = (async () => {
			let logo = "";

			try {
				const response = await frappe.call({
					method: "saas_theme.branding.get_company_branding",
					type: "GET",
				});
				logo = response?.message?.company_logo || "";
			} catch (e) {
				// Branding must never block Desk startup. When no company logo can be
				// resolved, Frappe's current site/app logo remains untouched.
			}

			state.logo = typeof logo === "string" ? logo : "";
			return state.logo;
		})();

		try {
			return await state.logo_promise;
		} finally {
			state.logo_promise = null;
		}
	}

	function apply_logo_url(logo) {
		if (!logo) return;

		$(".desktop-wrapper #brand-logo").each(function () {
			$(this)
				.attr("src", logo)
				.attr("alt", __("Company Logo"))
				.addClass("st-company-logo");
			$(this).closest(".navbar-home").addClass("st-company-brand");
		});

		$(".navbar-brand .app-logo").each(function () {
			const $logo = $(this);
			const $image = $logo.is("img") ? $logo : $logo.find("img").first();

			if ($image.length) {
				$image
					.attr("src", logo)
					.attr("alt", __("Company Logo"))
					.addClass("st-company-logo");
			} else {
				// Keep the original .app-logo node so Frappe's click handler that toggles
				// the sidebar remains attached. Only its visual contents are replaced.
				$logo.addClass("st-company-logo-host");
				if (!$logo.children(".st-company-logo-image").length) {
					$logo.append(
						$("<img>", {
							class: "st-company-logo-image",
							src: logo,
							alt: __("Company Logo"),
						})
					);
				} else {
					$logo.children(".st-company-logo-image").attr("src", logo);
				}
			}

			$logo.closest(".navbar-brand").addClass("st-company-brand");
		});
	}

	async function apply_company_logo() {
		const logo = await resolve_company_logo();
		apply_logo_url(logo);
	}

	function normalized_text(element) {
		return String($(element).text() || "")
			.replace(/\s+/g, " ")
			.trim()
			.toLowerCase();
	}

	function remove_row(element) {
		const $element = $(element);
		const $row = $element.closest(
			".es-menu__item, .dropdown-menu-item, .dropdown-item, li, [role='menuitem']"
		);
		($row.length ? $row : $element).remove();
	}

	function candidates(root, selector) {
		const $root = root ? $(root) : $(document);
		return $root.filter(selector).add($root.find(selector));
	}

	function remove_frappe_support(root) {
		const support_label = String(__("Frappe Support") || "Frappe Support").toLowerCase();
		const selector =
			".es-menu__item, .dropdown-menu-item, .dropdown-item, .dropdown-menu a, [role='menuitem'], a[href*='support.frappe.io']";

		candidates(root, selector).each(function () {
			const text = normalized_text(this);
			const href = String($(this).attr("href") || "").toLowerCase();
			if (
				text === "frappe support" ||
				text === support_label ||
				href.includes("support.frappe.io")
			) {
				remove_row(this);
			}
		});
	}

	function remove_desktop_about(root) {
		if (!$(".desktop-wrapper").length && !$("body").hasClass("desktop-page")) return;

		const edit_profile = String(__("Edit Profile") || "Edit Profile").toLowerCase();
		const toggle_theme = String(__("Toggle Theme") || "Toggle Theme").toLowerCase();
		const about_label = String(__("About") || "About").toLowerCase();
		const $root = root ? $(root) : $(document);
		const $menus = $root
			.filter(".es-menu, .dropdown-menu")
			.add($root.find(".es-menu, .dropdown-menu"))
			.add($root.closest(".es-menu, .dropdown-menu"));

		$menus.each(function () {
			const $menu = $(this);
			const labels = $menu
				.find(".es-menu__item, .dropdown-menu-item, .dropdown-item, [role='menuitem']")
				.map(function () {
					return normalized_text(this);
				})
				.get();

			// The desktop avatar menu is identified by two stable built-in rows so an
			// unrelated menu with an "About" item is never modified.
			if (!labels.includes(edit_profile) || !labels.includes(toggle_theme)) return;

			$menu
				.find(".es-menu__item, .dropdown-menu-item, .dropdown-item, [role='menuitem']")
				.each(function () {
					const text = normalized_text(this);
					if (text === "about" || text === about_label) remove_row(this);
				});
		});
	}

	function remove_open_sidebar_help(root) {
		const help_label = String(__("Help") || "Help").toLowerCase();

		candidates(root, ".sidebar-header-menu").each(function () {
			$(this)
				.find(".dropdown-menu-item, .dropdown-item, [role='menuitem'], a")
				.each(function () {
					const text = normalized_text(this);
					if (text === "help" || text === help_label) remove_row(this);
				});
		});
	}

	function patch_sidebar_help_menu() {
		const proto = frappe.ui?.SidebarHeader?.prototype;
		if (!proto || proto.__saas_theme_help_removed || typeof proto.system_items !== "function") {
			return;
		}

		const original_system_items = proto.system_items;
		proto.system_items = function () {
			const items = original_system_items.call(this) || [];
			const help_label = String(__("Help") || "Help").toLowerCase();
			return items.filter((item) => {
				const name = String(item?.name || "").toLowerCase();
				const label = String(item?.label || "").trim().toLowerCase();
				return name !== "help" && label !== "help" && label !== help_label;
			});
		};
		proto.__saas_theme_help_removed = true;
	}

	function patch_sidebar_collapse_behavior() {
		const proto = frappe.ui?.Sidebar?.prototype;
		if (
			!proto ||
			proto.__saas_theme_persistent_icon_rail ||
			typeof proto.hides_when_collapsed !== "function"
		) {
			return;
		}

		const original_hides_when_collapsed = proto.hides_when_collapsed;
		proto.hides_when_collapsed = function () {
			// On desktop, keep a narrow icon rail visible after collapse so the user
			// always has a visible control to expand it again. Mobile keeps Frappe's
			// normal drawer behavior.
			if (!frappe.is_mobile()) return false;
			return original_hides_when_collapsed.call(this);
		};
		proto.__saas_theme_persistent_icon_rail = true;

		const sidebar = frappe.app?.sidebar;
		if (sidebar?.wrapper && !sidebar.sidebar_expanded) {
			if (typeof sidebar.refit_collapsed_sidebar === "function") {
				sidebar.refit_collapsed_sidebar();
			} else if (typeof sidebar.apply_expanded_state === "function") {
				sidebar.apply_expanded_state();
			}
		}
	}

	function update_sidebar_toggle() {
		const sidebar = frappe.app?.sidebar;
		const $toggle = $(".st-sidebar-persist-toggle");
		if (!$toggle.length || !sidebar) return;

		const expanded = sidebar.sidebar_expanded !== false;
		const label = expanded ? __("Collapse menu") : __("Expand menu");
		const icon = expanded ? "chevron-left" : "chevron-right";

		$toggle.attr({ title: label, "aria-label": label });
		$toggle.find(".st-sidebar-persist-toggle-icon").html(
			frappe.utils.icon(icon, "sm", "", "", "current-color", true)
		);
		$toggle.find(".st-sidebar-persist-toggle-label").text(label);
		$toggle.toggleClass("is-collapsed", !expanded);
	}

	function ensure_sidebar_toggle() {
		const sidebar = frappe.app?.sidebar;
		const $bottom = $(".body-sidebar .body-sidebar-bottom").first();
		if (!sidebar || !$bottom.length || frappe.is_mobile()) return;

		let $toggle = $bottom.children(".st-sidebar-persist-toggle").first();
		if (!$toggle.length) {
			$toggle = $(
				`<button type="button" class="btn-reset st-sidebar-persist-toggle">
					<span class="st-sidebar-persist-toggle-icon" aria-hidden="true"></span>
					<span class="st-sidebar-persist-toggle-label"></span>
				</button>`
			);

			const $user = $bottom.children(".dropdown-navbar-user").first();
			if ($user.length) $toggle.insertBefore($user);
			else $bottom.append($toggle);

			$toggle.on("click.saas_brand_shell", (event) => {
				event.preventDefault();
				event.stopPropagation();
				frappe.app?.sidebar?.toggle_width?.();
				setTimeout(update_sidebar_toggle, 0);
			});
		}

		update_sidebar_toggle();
	}

	function clean_menus(root) {
		patch_sidebar_help_menu();
		remove_frappe_support(root);
		remove_desktop_about(root);
		remove_open_sidebar_help(root);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;

		state.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes || []) {
					if (node.nodeType !== Node.ELEMENT_NODE) continue;
					clean_menus(node);

					const $node = $(node);
					if (
						$node.is("#brand-logo, .navbar-brand, .desktop-navbar, .navbar") ||
						$node.find("#brand-logo, .navbar-brand .app-logo").length
					) {
						apply_company_logo();
					}

					if (
						$node.is(".body-sidebar, .body-sidebar-bottom") ||
						$node.find(".body-sidebar-bottom").length
					) {
						ensure_sidebar_toggle();
					}
				}
			}
		});

		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	function refresh() {
		patch_sidebar_help_menu();
		patch_sidebar_collapse_behavior();
		apply_company_logo();
		clean_menus(document);
		ensure_sidebar_toggle();
		setup_observer();
	}

	// Public helpers are useful for troubleshooting from the browser console.
	saas_theme.brand_shell.refresh = refresh;
	saas_theme.brand_shell.apply_company_logo = apply_company_logo;
	saas_theme.brand_shell.update_sidebar_toggle = update_sidebar_toggle;

	$(document)
		.off("desktop_screen.saas_brand_shell")
		.on("desktop_screen.saas_brand_shell", () => setTimeout(refresh, 20));

	$(document)
		.off("sidebar_setup.saas_brand_shell")
		.on("sidebar_setup.saas_brand_shell", () => setTimeout(refresh, 20));

	$(document)
		.off("sidebar-expand.saas_brand_shell")
		.on("sidebar-expand.saas_brand_shell", () => setTimeout(update_sidebar_toggle, 0));

	$(document)
		.off("toolbar_setup.saas_brand_shell")
		.on("toolbar_setup.saas_brand_shell", () => setTimeout(refresh, 20));

	$(document)
		.off("page-change.saas_brand_shell")
		.on("page-change.saas_brand_shell", () => setTimeout(refresh, 40));

	$(function () {
		refresh();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => setTimeout(refresh, 20));
		}
	});
})();

/* ===== END HISTORICAL CONTROLLER: brand_shell.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: ui_finish.js ===== */
/*
 * SaaS Theme — Dashboard icon reliability and chart refinement
 * Provides consistent inline SVG icons when Frappe returns empty or broken icon references,
 * and upgrades analytics charts after they render.
 */
(function () {
	"use strict";

	const STYLE_ID = "st-navigation-chart-refinement";
	const STYLE_TEXT = `
		/* Sticky form tabs: opaque surface so form content never bleeds through while scrolling. */
		.form-page .form-tabs-list,
		.std-form-layout .form-tabs-list,
		.form-tabs-list {
			z-index: 45 !important;
			isolation: isolate !important;
			background: #FFFFFF !important;
			border-color: #E5E5E5 !important;
			box-shadow: 0 1px 0 #E5E5E5, 0 7px 18px rgba(20, 33, 61, 0.07) !important;
			opacity: 1 !important;
		}

		.form-page .form-tabs-list .form-tabs,
		.std-form-layout .form-tabs-list .form-tabs,
		.form-tabs-list .form-tabs {
			background: #F4F7FC !important;
			border-radius: 8px !important;
			padding: 5px !important;
		}

		.form-page .form-tabs-list .nav-link,
		.std-form-layout .form-tabs-list .nav-link,
		.form-tabs-list .nav-link {
			position: relative !important;
			z-index: 2 !important;
		}

		.form-page .form-tabs-list .nav-link.active,
		.std-form-layout .form-tabs-list .nav-link.active,
		.form-tabs-list .nav-link.active {
			background: #064ADB !important;
			color: #FFFFFF !important;
			box-shadow: 0 3px 10px rgba(6, 74, 219, 0.22) !important;
		}

		/* Modern analytics presentation. */
		.st-analytics-card {
			overflow: hidden !important;
			border: 1px solid #D9E0EA !important;
			box-shadow: 0 5px 18px rgba(20, 33, 61, 0.055) !important;
		}

		.st-analytics-card-head {
			background: linear-gradient(180deg, #FFFFFF 0%, #FCFDFE 100%) !important;
		}

		.st-finance-chart .st-chart-svg {
			display: block !important;
			width: 100% !important;
			height: clamp(245px, 24vw, 315px) !important;
		}

		.st-payments-chart .st-chart-svg,
		.st-stock-chart .st-chart-svg {
			display: block !important;
			width: 100% !important;
			height: clamp(205px, 19vw, 245px) !important;
		}

		.st-chart-smooth-line {
			fill: none !important;
			stroke-width: 3.2 !important;
			stroke-linecap: round !important;
			stroke-linejoin: round !important;
			filter: drop-shadow(0 2px 3px rgba(20, 33, 61, 0.08));
		}

		.st-chart-area {
			pointer-events: none !important;
		}

		.st-chart-area-1 {
			opacity: 0.72 !important;
		}

		.st-chart-grid {
			stroke: rgba(20, 33, 61, 0.095) !important;
			stroke-dasharray: 4 6 !important;
		}

		.st-chart-label {
			fill: #667085 !important;
			font-size: 8.25px !important;
			font-weight: 500 !important;
		}

		.st-chart-legend {
			gap: 14px !important;
			color: #475467 !important;
			font-weight: 600 !important;
		}

		.st-chart-dot {
			filter: drop-shadow(0 2px 4px rgba(20, 33, 61, 0.14));
		}

		.st-chart-bar {
			opacity: 1 !important;
			filter: drop-shadow(0 4px 6px rgba(20, 33, 61, 0.08)) !important;
		}

		.st-payments-chart .st-chart-bar {
			fill: #064ADB !important;
			stroke: #064ADB !important;
		}

		.st-stock-chart .st-chart-bar {
			fill: #14213D !important;
			stroke: #14213D !important;
		}

		/* Collapsed sidebar: every native item sits on the same centered 44px icon rail. */
		@media (min-width: 768px) {
			.body-sidebar-container:not(.expanded) .body-sidebar {
				display: flex !important;
				flex-direction: column !important;
				align-items: center !important;
			}

			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-items,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-menu,
			.body-sidebar-container:not(.expanded) .body-sidebar .standard-sidebar,
			.body-sidebar-container:not(.expanded) .body-sidebar .body-sidebar-menu {
				width: 100% !important;
				align-items: center !important;
			}

			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item,
			.body-sidebar-container:not(.expanded) .body-sidebar .desk-sidebar-item,
			.body-sidebar-container:not(.expanded) .body-sidebar .standard-sidebar-item,
			.body-sidebar-container:not(.expanded) .body-sidebar .body-sidebar-item,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item-container,
			.body-sidebar-container:not(.expanded) .body-sidebar [data-sidebar-item] {
				box-sizing: border-box !important;
				width: 44px !important;
				min-width: 44px !important;
				max-width: 44px !important;
				height: 44px !important;
				min-height: 44px !important;
				margin: 3px auto !important;
				padding: 0 !important;
				display: flex !important;
				align-items: center !important;
				justify-content: center !important;
				gap: 0 !important;
				text-align: center !important;
			}

			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item-icon,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-icon,
			.body-sidebar-container:not(.expanded) .body-sidebar .icon,
			.body-sidebar-container:not(.expanded) .body-sidebar svg {
				position: static !important;
				inset: auto !important;
				transform: none !important;
				margin: 0 auto !important;
				flex: 0 0 auto !important;
			}

			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item-icon,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-icon {
				width: 20px !important;
				height: 20px !important;
				display: inline-flex !important;
				align-items: center !important;
				justify-content: center !important;
			}

			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item-icon svg,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-icon svg,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item > svg,
			.body-sidebar-container:not(.expanded) .body-sidebar .desk-sidebar-item > svg {
				width: 18px !important;
				height: 18px !important;
			}

			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item-label,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-label,
			.body-sidebar-container:not(.expanded) .body-sidebar .item-label,
			.body-sidebar-container:not(.expanded) .body-sidebar .item-title,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item-text,
			.body-sidebar-container:not(.expanded) .body-sidebar .sidebar-item-control {
				display: none !important;
			}

			.body-sidebar-container:not(.expanded) .body-sidebar .st-sidebar-persist-toggle {
				width: 44px !important;
				min-width: 44px !important;
				max-width: 44px !important;
				height: 44px !important;
				margin-left: auto !important;
				margin-right: auto !important;
			}
		}

		[data-theme="dark"] .form-page .form-tabs-list,
		[data-theme="dark"] .std-form-layout .form-tabs-list,
		[data-theme="dark"] .form-tabs-list {
			background: #161C24 !important;
			border-color: #334155 !important;
		}

		[data-theme="dark"] .form-page .form-tabs-list .form-tabs,
		[data-theme="dark"] .std-form-layout .form-tabs-list .form-tabs,
		[data-theme="dark"] .form-tabs-list .form-tabs {
			background: #111821 !important;
		}
	`;

	function ensure_styles() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = STYLE_TEXT;
		document.head.appendChild(style);
	}

	function svg(name) {
		const common = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
		const icons = {
			sales: `<svg ${common}><path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-7"></path><path d="M22 19H2"></path><path d="m4 7 5-3 5 4 6-5"></path></svg>`,
			buying: `<svg ${common}><circle cx="9" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H7"></path></svg>`,
			payment: `<svg ${common}><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18"></path><path d="M7 15h4"></path></svg>`,
			accounting: `<svg ${common}><path d="M3 10h18"></path><path d="M5 10V8l7-4 7 4v2"></path><path d="M6 10v8"></path><path d="M10 10v8"></path><path d="M14 10v8"></path><path d="M18 10v8"></path><path d="M3 20h18"></path></svg>`,
			stock: `<svg ${common}><path d="m12 3 8 4-8 4-8-4 8-4Z"></path><path d="m4 7 8 4 8-4"></path><path d="M4 7v10l8 4 8-4V7"></path><path d="M12 11v10"></path></svg>`,
			assets: `<svg ${common}><rect x="4" y="6" width="16" height="14" rx="2"></rect><path d="M8 6V4h8v2"></path><path d="M4 11h16"></path></svg>`,
			bell: `<svg ${common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>`,
			check: `<svg ${common}><path d="m5 12 4 4L19 6"></path></svg>`,
			grid: `<svg ${common}><rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect></svg>`,
		};
		return icons[name] || icons.grid;
	}

	function kind_for(node) {
		const metric = node.closest("[data-business-metric]");
		if (metric) {
			const key = metric.getAttribute("data-business-metric");
			if (key === "sales") return "sales";
			if (key === "purchases") return "buying";
		}

		const link = node.closest("a");
		const href = String(link?.getAttribute("href") || "").toLowerCase();
		const text = String(link?.textContent || "").toLowerCase();
		const source = `${href} ${text}`;
		if (source.includes("sales") || source.includes("selling")) return "sales";
		if (source.includes("purchase") || source.includes("buying")) return "buying";
		if (source.includes("payment")) return "payment";
		if (source.includes("account") || source.includes("journal")) return "accounting";
		if (source.includes("stock") || source.includes("inventory")) return "stock";
		if (source.includes("asset")) return "assets";
		if (source.includes("notification")) return "bell";
		if (source.includes("assignment") || source.includes("todo")) return "check";
		return "grid";
	}

	function replace_icon(node, force) {
		if (!node) return;
		if (!force && (node.querySelector("svg, .icon, use") || node.textContent.trim())) return;
		node.innerHTML = svg(kind_for(node));
		node.setAttribute("data-st-fallback-icon", "1");
	}

	function apply_icons(root) {
		const scope = root || document;

		scope.querySelectorAll("[data-business-metric] .st-hub-metric-icon, .st-analytics-kpi .st-analytics-kpi-icon")
			.forEach((node) => replace_icon(node, true));

		scope.querySelectorAll(".st-hub-quick-icon, .st-hub-recent-icon")
			.forEach((node) => replace_icon(node, false));
	}

	function parse_points(polyline) {
		return String(polyline.getAttribute("points") || "")
			.trim()
			.split(/\s+/)
			.map((pair) => pair.split(",").map(Number))
			.filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
			.map(([x, y]) => ({ x, y }));
	}

	function smooth_path(points) {
		if (!points.length) return "";
		if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

		let d = `M ${points[0].x} ${points[0].y}`;
		for (let i = 0; i < points.length - 1; i++) {
			const p0 = points[i - 1] || points[i];
			const p1 = points[i];
			const p2 = points[i + 1];
			const p3 = points[i + 2] || p2;
			const c1x = p1.x + (p2.x - p0.x) / 6;
			const c1y = p1.y + (p2.y - p0.y) / 6;
			const c2x = p2.x - (p3.x - p1.x) / 6;
			const c2y = p2.y - (p3.y - p1.y) / 6;
			d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x} ${p2.y}`;
		}
		return d;
	}

	function ensure_gradient(svg_el, index) {
		const ns = "http://www.w3.org/2000/svg";
		const id = `st-chart-gradient-${index}`;
		if (svg_el.querySelector(`#${id}`)) return id;

		let defs = svg_el.querySelector("defs");
		if (!defs) {
			defs = document.createElementNS(ns, "defs");
			svg_el.insertBefore(defs, svg_el.firstChild);
		}

		const gradient = document.createElementNS(ns, "linearGradient");
		gradient.setAttribute("id", id);
		gradient.setAttribute("x1", "0");
		gradient.setAttribute("y1", "0");
		gradient.setAttribute("x2", "0");
		gradient.setAttribute("y2", "1");

		const colors = [
			["#064ADB", "0.18"],
			["#14213D", "0.09"],
		];
		const [color, opacity] = colors[index] || ["#064ADB", "0.08"];

		const stop1 = document.createElementNS(ns, "stop");
		stop1.setAttribute("offset", "0%");
		stop1.setAttribute("stop-color", color);
		stop1.setAttribute("stop-opacity", opacity);

		const stop2 = document.createElementNS(ns, "stop");
		stop2.setAttribute("offset", "100%");
		stop2.setAttribute("stop-color", color);
		stop2.setAttribute("stop-opacity", "0");

		gradient.append(stop1, stop2);
		defs.appendChild(gradient);
		return id;
	}

	function modernize_line_chart(svg_el) {
		if (!svg_el || svg_el.dataset.stModernChart === "1") return;
		const polylines = [...svg_el.querySelectorAll("polyline.st-chart-line")];
		if (!polylines.length) return;

		const ns = "http://www.w3.org/2000/svg";
		const all_points = polylines.flatMap(parse_points);
		const baseline = all_points.length ? Math.max(...all_points.map((point) => point.y)) : null;

		polylines.forEach((polyline, index) => {
			const points = parse_points(polyline);
			if (points.length < 2) return;

			const classes = polyline.getAttribute("class") || "st-chart-line";
			const path_d = smooth_path(points);

			if (baseline != null && index < 2) {
				const gradient_id = ensure_gradient(svg_el, index);
				const area = document.createElementNS(ns, "path");
				const first = points[0];
				const last = points[points.length - 1];
				area.setAttribute("d", `${path_d} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`);
				area.setAttribute("class", `st-chart-area st-chart-area-${index}`);
				area.setAttribute("fill", `url(#${gradient_id})`);
				area.setAttribute("aria-hidden", "true");
				polyline.parentNode.insertBefore(area, polyline);
			}

			const path = document.createElementNS(ns, "path");
			path.setAttribute("d", path_d);
			path.setAttribute("class", `${classes} st-chart-smooth-line`);
			path.setAttribute("fill", "none");
			polyline.parentNode.insertBefore(path, polyline);
			polyline.remove();
		});

		svg_el.querySelectorAll("circle.st-chart-dot").forEach((dot) => {
			dot.setAttribute("r", "4");
		});
		svg_el.dataset.stModernChart = "1";
	}

	function modernize_charts(root) {
		const scope = root || document;
		scope.querySelectorAll(".st-finance-chart .st-chart-svg").forEach(modernize_line_chart);
		scope.querySelectorAll(".st-analytics-chart .st-chart-bar").forEach((bar) => {
			bar.setAttribute("rx", "8");
			bar.setAttribute("ry", "8");
		});
	}

	let timer = null;
	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			ensure_styles();
			apply_icons(document);
			modernize_charts(document);
		}, 35);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", schedule, { once: true });
	} else {
		schedule();
	}

	const observer = new MutationObserver(schedule);
	observer.observe(document.documentElement, { childList: true, subtree: true });

	if (typeof $ !== "undefined") {
		$(document).off("desktop_screen.saas_ui_finish").on("desktop_screen.saas_ui_finish", schedule);
		$(document).off("page-change.saas_ui_finish").on("page-change.saas_ui_finish", schedule);
	}
})();

/* ===== END HISTORICAL CONTROLLER: ui_finish.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: route_loader.js ===== */
/*
 * SaaS Theme — Route/Login loader
 * Lightweight top progress for Desk navigation and a compact blocking state for login.
 */
(function () {
	"use strict";

	if (window.__saas_theme_route_loader__) return;
	window.__saas_theme_route_loader__ = true;

	const STYLE_ID = "st-route-loader-style";
	const BAR_ID = "st-route-loader";
	const LOGIN_ID = "st-login-loader";
	let failSafe = null;
	let hideTimer = null;

	function ensure_style() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			#${BAR_ID} {
				position: fixed;
				inset: 0 0 auto 0;
				height: 3px;
				z-index: 2147483000;
				pointer-events: none;
				opacity: 0;
				transition: opacity .12s ease;
			}
			#${BAR_ID}.is-visible { opacity: 1; }
			#${BAR_ID} .st-route-loader-bar {
				height: 100%;
				width: 0;
				border-radius: 0 3px 3px 0;
				background: linear-gradient(90deg, #064ADB 0%, #2F6FE7 58%, #14213D 100%);
				box-shadow: 0 0 10px rgba(6, 74, 219, .28);
				transition: width 1.35s cubic-bezier(.2,.8,.2,1);
			}
			#${BAR_ID}.is-done .st-route-loader-bar {
				transition-duration: .16s;
			}
			#${LOGIN_ID} {
				position: fixed;
				inset: 0;
				z-index: 2147482990;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 20px;
				background: rgba(248, 250, 252, .76);
				backdrop-filter: blur(3px);
				-webkit-backdrop-filter: blur(3px);
				opacity: 0;
				visibility: hidden;
				transition: opacity .15s ease, visibility .15s ease;
			}
			#${LOGIN_ID}.is-visible {
				opacity: 1;
				visibility: visible;
			}
			#${LOGIN_ID} .st-login-loader-card {
				display: flex;
				align-items: center;
				gap: 12px;
				min-width: 176px;
				padding: 13px 16px;
				border: 1px solid #E5E5E5;
				border-radius: 11px;
				background: #FFFFFF;
				color: #14213D;
				font: 600 13px/1.25 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				box-shadow: 0 16px 44px rgba(20, 33, 61, .14), 0 3px 10px rgba(20, 33, 61, .06);
			}
			#${LOGIN_ID} .st-login-loader-spinner {
				width: 20px;
				height: 20px;
				flex: 0 0 20px;
				border: 2px solid rgba(6, 74, 219, .16);
				border-top-color: #064ADB;
				border-radius: 50%;
				animation: st-route-spin .68s linear infinite;
			}
			@keyframes st-route-spin { to { transform: rotate(360deg); } }
			@media (prefers-reduced-motion: reduce) {
				#${BAR_ID} .st-route-loader-bar { transition-duration: .01ms !important; }
				#${LOGIN_ID} .st-login-loader-spinner { animation-duration: 1.5s; }
			}
			[data-theme="dark"] #${LOGIN_ID} { background: rgba(15, 20, 27, .72); }
			[data-theme="dark"] #${LOGIN_ID} .st-login-loader-card {
				background: #161C24;
				border-color: #334155;
				color: #E8EEF8;
			}
		`;
		document.head.appendChild(style);
	}

	function ensure_nodes() {
		ensure_style();

		let loader = document.getElementById(BAR_ID);
		if (!loader) {
			loader = document.createElement("div");
			loader.id = BAR_ID;
			loader.setAttribute("aria-hidden", "true");
			loader.innerHTML = '<div class="st-route-loader-bar"></div>';
			document.body.appendChild(loader);
		}

		let login = document.getElementById(LOGIN_ID);
		if (!login) {
			login = document.createElement("div");
			login.id = LOGIN_ID;
			login.setAttribute("aria-hidden", "true");
			login.innerHTML = `
				<div class="st-login-loader-card" role="status" aria-live="polite">
					<span class="st-login-loader-spinner" aria-hidden="true"></span>
					<span class="st-login-loader-text">Signing in…</span>
				</div>`;
			document.body.appendChild(login);
		}
		return { loader, login };
	}

	function start(options) {
		const opts = typeof options === "object" && options ? options : {};
		const { loader, login } = ensure_nodes();
		const bar = loader.querySelector(".st-route-loader-bar");

		clearTimeout(hideTimer);
		clearTimeout(failSafe);
		loader.classList.remove("is-done");
		loader.classList.add("is-visible");
		bar.style.width = "9%";
		requestAnimationFrame(() => requestAnimationFrame(() => {
			bar.style.width = opts.blocking ? "82%" : "72%";
		}));

		if (opts.blocking) {
			const text = login.querySelector(".st-login-loader-text");
			if (text) text.textContent = opts.text || "Signing in…";
			login.classList.add("is-visible");
			login.setAttribute("aria-hidden", "false");
		}

		failSafe = setTimeout(done, opts.blocking ? 12000 : 5000);
	}

	function done() {
		const loader = document.getElementById(BAR_ID);
		const login = document.getElementById(LOGIN_ID);
		clearTimeout(failSafe);

		if (login) {
			login.classList.remove("is-visible");
			login.setAttribute("aria-hidden", "true");
		}

		if (!loader) return;
		const bar = loader.querySelector(".st-route-loader-bar");
		loader.classList.add("is-done", "is-visible");
		if (bar) bar.style.width = "100%";

		hideTimer = setTimeout(() => {
			loader.classList.remove("is-visible", "is-done");
			if (bar) bar.style.width = "0";
		}, 190);
	}

	function is_internal_navigation(anchor, event) {
		if (!anchor || !anchor.href) return false;
		if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false;
		if (anchor.target && anchor.target !== "_self") return false;
		if (anchor.hasAttribute("download")) return false;
		if (anchor.getAttribute("href") === "#") return false;

		try {
			const url = new URL(anchor.href, window.location.href);
			if (url.origin !== window.location.origin) return false;
			if (url.href === window.location.href) return false;
			return url.pathname.startsWith("/app") || url.hash || document.body.classList.contains("desk");
		} catch (e) {
			return false;
		}
	}

	function patch_frappe_route() {
		if (!window.frappe || typeof frappe.set_route !== "function" || frappe.set_route.__st_loader_wrapped) return;
		const original = frappe.set_route;
		const wrapped = function () {
			start();
			return original.apply(this, arguments);
		};
		wrapped.__st_loader_wrapped = true;
		frappe.set_route = wrapped;
	}

	document.addEventListener("click", (event) => {
		const anchor = event.target.closest && event.target.closest("a[href]");
		if (is_internal_navigation(anchor, event)) start();

		const loginButton = event.target.closest && event.target.closest(".btn-login");
		if (loginButton) start({ blocking: true, text: "Signing in…" });
	}, true);

	document.addEventListener("submit", (event) => {
		const form = event.target;
		if (form && form.matches && form.matches("form.form-login, .for-login form")) {
			start({ blocking: true, text: "Signing in…" });
		}
	}, true);

	window.addEventListener("hashchange", () => start());
	window.addEventListener("popstate", () => start());
	window.addEventListener("pageshow", done);
	window.addEventListener("load", done);

	if (typeof $ !== "undefined") {
		$(document)
			.off("page-change.saas_route_loader")
			.on("page-change.saas_route_loader", () => setTimeout(done, 40));
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			ensure_nodes();
			patch_frappe_route();
		}, { once: true });
	} else {
		ensure_nodes();
		patch_frappe_route();
	}

	/* Frappe may initialize after app assets; retry briefly without a permanent timer. */
	let tries = 0;
	const patchTimer = setInterval(() => {
		patch_frappe_route();
		tries += 1;
		if (tries > 20 || (window.frappe && frappe.set_route && frappe.set_route.__st_loader_wrapped)) {
			clearInterval(patchTimer);
		}
	}, 250);

	window.saasThemeLoader = { start, done };
})();

/* ===== END HISTORICAL CONTROLLER: route_loader.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: mobile_shell.js ===== */
/*
 * SaaS Theme — Responsive Desk shell
 *
 * - mobile sidebar becomes a true off-canvas drawer instead of a permanent rail
 * - Search and Notifications are removed from the sidebar utility band
 * - Search, Notifications and User Profile are exposed in the page header
 * - Desktop Home reuses its native controls but keeps them grouped at top-right
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_mobile_shell__) return;
	window.__saas_theme_mobile_shell__ = true;

	frappe.provide("saas_theme.mobile_shell");

	const state = {
		observer: null,
		refresh_timer: null,
	};

	function icon(name, size = "sm") {
		try {
			return frappe.utils.icon(name, size, "", "", "current-color", true);
		} catch (e) {
			return "";
		}
	}

	function patch_mobile_sidebar_behavior() {
		const proto = frappe.ui?.Sidebar?.prototype;
		if (!proto || proto.__saas_theme_true_mobile_drawer) return;
		if (typeof proto.hides_when_collapsed !== "function") return;

		const original = proto.hides_when_collapsed;
		proto.hides_when_collapsed = function () {
			// Frappe v16 keeps a narrow rail on mobile. For a phone this consumes too
			// much horizontal space, so a collapsed mobile sidebar should disappear.
			if (frappe.is_mobile()) return true;
			return original.call(this);
		};
		proto.__saas_theme_true_mobile_drawer = true;

		const sidebar = frappe.app?.sidebar;
		if (sidebar?.wrapper && frappe.is_mobile() && !sidebar.sidebar_expanded) {
			sidebar.apply_expanded_state?.();
		}
	}

	function remove_sidebar_search_notifications() {
		$(".standard-items-band .navbar-modal-search-mobile, .standard-items-band .sidebar-notification")
			.each(function () {
				const $item = $(this).closest(
					".sidebar-item, .desk-sidebar-item, .standard-sidebar-item, .sidebar-item-container, [data-sidebar-item]"
				);
				($item.length ? $item : $(this)).addClass("st-sidebar-utility-hidden").hide();
			});

		$(".standard-items-band").each(function () {
			const $band = $(this);
			const visible_children = $band.children().filter(function () {
				return !$(this).hasClass("st-sidebar-utility-hidden") && $(this).css("display") !== "none";
			});
			$band.toggleClass("st-standard-items-empty", visible_children.length === 0);
		});
	}

	function notification_enabled() {
		return !!frappe.boot?.desk_settings?.notifications && frappe.session?.user !== "Guest";
	}

	function make_notification_button() {
		const $button = $(
			`<button type="button" class="btn-reset st-top-action st-top-notification" aria-label="${__(
				"Notifications"
			)}" title="${__("Notifications")}">
				<span class="st-top-action-icon" aria-hidden="true">${icon("bell", "sm")}</span>
				<span class="notification-count hidden" aria-live="polite"></span>
			</button>`
		);
		$button.on("click.saas_mobile_shell", (event) => {
			event.preventDefault();
			event.stopPropagation();
			frappe.ui?.sidebar_panels?.toggle?.("notifications");
		});
		return $button;
	}

	function make_profile_button() {
		const $parent = $('<div class="st-top-profile dropdown-navbar-user"></div>');
		const avatar = frappe.avatar?.(frappe.session.user, "avatar-medium") || "";
		const $button = $(
			`<button type="button" class="btn-reset st-top-profile-button" aria-label="${__(
				"User Menu"
			)}" title="${__("User Menu")}">${avatar}</button>`
		);
		$parent.append($button);

		const sidebar = frappe.app?.sidebar;
		if (sidebar?.create_user_menu && !$parent.data("st-user-menu-ready")) {
			sidebar.create_user_menu({
				parent: $parent,
				button: $button,
				side: "bottom",
				align: "end",
			});
			$parent.data("st-user-menu-ready", 1);
		}
		return $parent;
	}

	function ensure_page_head_actions() {
		$(".page-head:visible").each(function () {
			const $head = $(this);
			const $section = $head.find(".standard-items-section").first();
			if (!$section.length) return;

			let $actions = $section.children(".st-page-utility-actions").first();
			if (!$actions.length) {
				$actions = $('<div class="st-page-utility-actions"></div>');
				// Keep document actions (Save, Actions, etc.) together, then place the
				// global Search / Bell / Profile cluster at the far-right edge.
				$section.append($actions);
			}

			const $search = $section.find("#small-search-button").first();
			if ($search.length && !$search.parent().is($actions)) {
				$search
					.removeClass("hidden")
					.addClass("st-top-action st-top-search")
					.attr({ title: __("Search"), "aria-label": __("Search") })
					.prependTo($actions);
			}

			if (notification_enabled() && !$actions.children(".st-top-notification").length) {
				$actions.append(make_notification_button());
			}

			if (!$actions.children(".st-top-profile").length && frappe.app?.sidebar?.create_user_menu) {
				$actions.append(make_profile_button());
			}
		});
	}

	function ensure_desktop_home_actions() {
		$(".desktop-navbar").each(function () {
			const $nav = $(this);
			const $right = $nav.children(".flex").last();
			const $search = $nav.children(".search-widget-wrapper").first();
			if (!$right.length || !$search.length) return;

			$right.addClass("st-desktop-top-actions");
			$search.addClass("st-home-search-relocated");
			const $notifications = $right.find(".desktop-notifications").first();
			if ($notifications.length) $search.insertBefore($notifications);
			else $right.prepend($search);
		});
	}

	function sync_notification_count() {
		const $counts = $(".notification-count");
		if (!$counts.length) return;

		let best = "";
		$counts.each(function () {
			const text = String($(this).text() || "").trim();
			if (text) best = text;
		});

		if (!best) return;
		$counts
			.text(best)
			.removeClass("hidden")
			.attr("aria-label", __("{0} unread notifications", [best]));
	}

	function normalize_mobile_sidebar_state() {
		const sidebar = frappe.app?.sidebar;
		if (!sidebar || !frappe.is_mobile()) return;
		if (!sidebar.sidebar_expanded) sidebar.apply_expanded_state?.();
	}

	function refresh() {
		patch_mobile_sidebar_behavior();
		remove_sidebar_search_notifications();
		ensure_page_head_actions();
		ensure_desktop_home_actions();
		normalize_mobile_sidebar_state();
		sync_notification_count();
	}

	function schedule_refresh(delay = 20) {
		clearTimeout(state.refresh_timer);
		state.refresh_timer = setTimeout(refresh, delay);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver(() => schedule_refresh(30));
		state.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});
	}

	$(document)
		.off("page-change.saas_mobile_shell")
		.on("page-change.saas_mobile_shell", () => schedule_refresh(20));

	$(document)
		.off("sidebar_setup.saas_mobile_shell")
		.on("sidebar_setup.saas_mobile_shell", () => schedule_refresh(20));

	$(document)
		.off("desktop_screen.saas_mobile_shell")
		.on("desktop_screen.saas_mobile_shell", () => schedule_refresh(20));

	$(document)
		.off("toolbar_setup.saas_mobile_shell")
		.on("toolbar_setup.saas_mobile_shell", () => schedule_refresh(20));

	$(window)
		.off("resize.saas_mobile_shell orientationchange.saas_mobile_shell")
		.on("resize.saas_mobile_shell orientationchange.saas_mobile_shell", () => schedule_refresh(40));

	$(function () {
		refresh();
		setup_observer();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule_refresh(20));
		}
	});

	saas_theme.mobile_shell.refresh = refresh;
})();

/* ===== END HISTORICAL CONTROLLER: mobile_shell.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: workspace_shell_polish.js ===== */
/*
 * SaaS Theme — Workspace / shell finishing layer
 *
 * - anchors the top notification panel to the top-right bell using Frappe's popover host
 * - disables the Frappe v16 Dock/App Rail so the customized sidebar is the only navigation rail
 * - keeps the behavior upgrade-safe and outside Frappe core
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_workspace_shell_polish__) return;
	window.__saas_theme_workspace_shell_polish__ = true;

	frappe.provide("saas_theme.workspace_shell_polish");

	const state = {
		observer: null,
		refresh_timer: null,
	};

	function disable_dock_api() {
		const proto = frappe.ui?.Sidebar?.prototype;
		if (proto && !proto.__saas_theme_dock_disabled) {
			proto.dock_enabled = function () {
				return false;
			};
			proto.__saas_theme_dock_disabled = true;
		}
	}

	function disable_live_dock() {
		disable_dock_api();

		const sidebar = frappe.app?.sidebar;
		const dock = sidebar?.dock;

		if (dock) {
			dock.enabled = false;
			dock.is_pinned = false;
			dock.is_open = false;
			dock.$dock
				?.addClass("hidden")
				.hide()
				.attr("aria-hidden", "true")
				.prop("inert", true);
		}

		$("body").removeClass("dock-active dock-open dock-pinned");
		$("#desk-dock, body > .dock").addClass("hidden").hide();

		// Let the sidebar recalculate its collapsed/expanded form without a dock beside it.
		if (sidebar?.refit_collapsed_sidebar) sidebar.refit_collapsed_sidebar();
	}

	function upgrade_notification_button($button) {
		if (!$button?.length || $button.data("st-popover-ready")) return;
		if (!frappe.ui?.Notifications) return;

		// Remove the earlier handler that opened the notification SidebarPanel on the
		// left. The same bell becomes the trigger of Frappe's native bottom/end popover.
		$button.off("click.saas_mobile_shell");
		$button
			.removeClass("st-top-notification")
			.addClass("st-top-notification-button desktop-notification-icon")
			.data("st-popover-ready", 1);

		let $host = $button.parent(".st-top-notification-host");
		if (!$host.length) {
			$button.wrap('<div class="st-top-notification st-top-notification-host"></div>');
			$host = $button.parent();
		}

		if ($host.data("st-notifications-instance")) return;

		try {
			const notifications = new frappe.ui.Notifications({
				popover: true,
				wrapper: $host,
			});
			$host.data("st-notifications-instance", notifications);
		} catch (error) {
			// Never break the page header if a future Frappe build changes the host API.
			console.warn("SaaS Theme: notification popover could not be initialized", error);
		}
	}

	function anchor_top_notifications() {
		$(".page-head:visible .st-page-utility-actions").each(function () {
			const $actions = $(this);

			// Current mobile_shell renders this as a direct button. Once wrapped, the host
			// itself carries st-top-notification so mobile_shell will not create duplicates.
			$actions.children("button.st-top-notification").each(function () {
				upgrade_notification_button($(this));
			});

			// Defensive support for a button already wrapped by a previous refresh.
			$actions
				.children(".st-top-notification-host")
				.find("button.st-top-notification-button")
				.each(function () {
					const $button = $(this);
					if (!$button.data("st-popover-ready")) upgrade_notification_button($button);
				});
		});
	}

	function refresh() {
		disable_live_dock();
		anchor_top_notifications();
	}

	function schedule_refresh(delay = 25) {
		clearTimeout(state.refresh_timer);
		state.refresh_timer = setTimeout(refresh, delay);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver(() => schedule_refresh(35));
		state.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	$(document)
		.off("page-change.saas_workspace_shell_polish")
		.on("page-change.saas_workspace_shell_polish", () => schedule_refresh(15));

	$(document)
		.off("sidebar_setup.saas_workspace_shell_polish")
		.on("sidebar_setup.saas_workspace_shell_polish", () => schedule_refresh(15));

	$(document)
		.off("toolbar_setup.saas_workspace_shell_polish")
		.on("toolbar_setup.saas_workspace_shell_polish", () => schedule_refresh(15));

	$(document)
		.off("desktop_screen.saas_workspace_shell_polish")
		.on("desktop_screen.saas_workspace_shell_polish", () => schedule_refresh(15));

	$(function () {
		refresh();
		setup_observer();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule_refresh(15));
		}
	});

	saas_theme.workspace_shell_polish.refresh = refresh;
})();

/* ===== END HISTORICAL CONTROLLER: workspace_shell_polish.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: final_shell_cleanup.js ===== */
/* SaaS Theme — final shell cleanup */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_final_shell_cleanup__) return;
	window.__saas_theme_final_shell_cleanup__ = true;

	frappe.provide("saas_theme.final_shell_cleanup");

	const state = { observer: null, timer: null };
	const HIDDEN_MENU_LABELS = new Set([
		"Modules",
		"Apps",
		"Manage Dock",
		"Edit Sidebar",
		"Delete Demo Data",
	]);
	const HIDDEN_MENU_NAMES = new Set([
		"switch-module",
		"switch-app",
		"workspace-selector",
		"edit-sidebar",
		"delete-demo-data",
	]);
	const STYLE_ID = "st-home-navigation-style";

	function ensure_styles() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			.st-page-home-button {
				width: 34px !important;
				height: 34px !important;
				min-width: 34px !important;
				display: inline-flex !important;
				align-items: center !important;
				justify-content: center !important;
				margin: 0 7px 0 0 !important;
				padding: 0 !important;
				border: 1px solid #E5E5E5 !important;
				border-radius: 9px !important;
				background: #FFFFFF !important;
				color: #14213D !important;
				box-shadow: 0 1px 2px rgba(20, 33, 61, .04), 0 4px 10px rgba(20, 33, 61, .035) !important;
				transition: transform .14s ease, border-color .14s ease, color .14s ease, background .14s ease, box-shadow .14s ease;
			}
			.st-page-home-button:hover {
				transform: translateY(-1px);
				border-color: rgba(6, 74, 219, .35) !important;
				background: #F5F8FF !important;
				color: #064ADB !important;
				box-shadow: 0 5px 14px rgba(20, 33, 61, .08) !important;
			}
			.st-page-home-button svg,
			.st-page-home-button .icon {
				width: 17px !important;
				height: 17px !important;
				color: currentColor !important;
				stroke: currentColor !important;
			}
			.sidebar-header.st-sidebar-home-header {
				cursor: pointer !important;
			}
			.sidebar-header.st-sidebar-home-header .drop-icon {
				display: none !important;
			}
			.sidebar-header.st-sidebar-home-header:hover {
				background: rgba(6, 74, 219, .045) !important;
			}
			.sidebar-header.st-sidebar-home-header .header-logo,
			.sidebar-header.st-sidebar-home-header .header-title {
				pointer-events: none !important;
			}
			[data-theme="dark"] .st-page-home-button {
				background: #111827 !important;
				border-color: #2A3A52 !important;
				color: #E5E7EB !important;
				box-shadow: 0 4px 12px rgba(0, 0, 0, .18) !important;
			}
			[data-theme="dark"] .st-page-home-button:hover {
				background: #172033 !important;
				border-color: rgba(79, 140, 255, .48) !important;
				color: #4F8CFF !important;
			}
			[data-theme="dark"] .sidebar-header.st-sidebar-home-header:hover {
				background: rgba(79, 140, 255, .08) !important;
			}
			@media (max-width: 767px) {
				.st-page-home-button {
					width: 32px !important;
					height: 32px !important;
					min-width: 32px !important;
					margin-right: 5px !important;
				}
			}
		`;
		document.head.appendChild(style);
	}

	function desk_home_url() {
		return window.location.pathname.startsWith("/app") ? "/app" : "/desk";
	}

	function go_home(event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
			if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
		}
		window.location.assign(desk_home_url());
	}

	function patch_list_documentation() {
		const proto = frappe.views?.ListView?.prototype;
		if (!proto || proto.__saas_theme_no_documentation || typeof proto.get_no_result_message !== "function") {
			return;
		}

		const original = proto.get_no_result_message;
		proto.get_no_result_message = function () {
			const meta = this.meta;
			const documentation = meta?.documentation;
			if (meta) meta.documentation = null;
			try {
				return original.apply(this, arguments);
			} finally {
				if (meta) meta.documentation = documentation;
			}
		};
		proto.__saas_theme_no_documentation = true;
	}

	function patch_sidebar_header_menu() {
		const proto = frappe.ui?.SidebarHeader?.prototype;
		if (!proto || proto.__saas_theme_home_menu || typeof proto.menu_items !== "function") return;

		const original = proto.menu_items;
		proto.menu_items = function () {
			const groups = original.apply(this, arguments) || [];
			return groups
				.map((group) => {
					const options = (group?.options || []).filter((item) => {
						const name = String(item?.name || "").trim().toLowerCase();
						const label = String(item?.label || "").trim();
						return !HIDDEN_MENU_NAMES.has(name) && !HIDDEN_MENU_LABELS.has(label);
					});
					return { ...group, options };
				})
				.filter((group) => group.options?.length);
		};
		proto.__saas_theme_home_menu = true;
	}

	function remove_rendered_documentation() {
		$(".list-view, .layout-main-section, .no-result, .empty-state").each(function () {
			$(this)
				.find("a, button")
				.filter(function () {
					return String($(this).text() || "").trim() === __("Documentation");
				})
				.remove();
		});
	}

	function remove_menu_items() {
		const $menus = $(
			'.dropdown-menu, .popover, .es-popover, [role="menu"], .menu, .sidebar-menu, .sidebar-menu-wrapper'
		);

		$menus.each(function () {
			$(this)
				.find('a, button, [role="menuitem"], .dropdown-item, .menu-item, li')
				.each(function () {
					const $item = $(this);
					const text = String($item.clone().children().remove().end().text() || $item.text() || "")
						.replace(/\s+/g, " ")
						.trim();

					if (HIDDEN_MENU_LABELS.has(text)) {
						const $row = $item.closest('[role="menuitem"], .dropdown-item, .menu-item, li');
						($row.length ? $row : $item).remove();
					}
				});
		});
	}

	function ensure_page_home_button() {
		const route = frappe.get_route?.() || [];
		const on_home = route.length === 0 || route[0] === "desktop";

		if (on_home) {
			$(".st-page-home-button").remove();
			return;
		}

		$(".page-head:visible .page-title").each(function () {
			const $title = $(this);
			if ($title.children(".st-page-home-button").length) return;

			const icon = frappe.utils?.icon
				? frappe.utils.icon("home", "sm", "", "", "current-color", true)
				: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"></path><path d="M5 10v10h14V10"></path></svg>';
			const $button = $(
				`<button type="button" class="btn-reset st-page-home-button" title="${__("Home")}" aria-label="${__("Home")}">${icon}</button>`
			);
			$button.on("click.saas_home", go_home);

			const $sidebar_toggle = $title.children(".sidebar-toggle-btn").first();
			if ($sidebar_toggle.length) $button.insertAfter($sidebar_toggle);
			else $title.prepend($button);
		});
	}

	function make_sidebar_header_home() {
		$(".sidebar-header").each(function () {
			const $header = $(this);
			$header
				.addClass("st-sidebar-home-header")
				.attr({ role: "button", tabindex: "0", title: __("Home"), "aria-label": __("Home") });
			$header.find(".drop-icon").hide();
		});
	}

	function ensure_notification_popover(button) {
		const $button = $(button);
		if (!$button.length || !frappe.ui?.Notifications) return;

		$button.off("click.saas_mobile_shell");
		$button.removeClass("st-top-notification").addClass("st-top-notification-button desktop-notification-icon");

		let $host = $button.parent(".st-top-notification-host");
		if (!$host.length) {
			$button.wrap('<div class="st-top-notification st-top-notification-host"></div>');
			$host = $button.parent();
		}

		if ($host.data("st-notifications-instance")) return;

		try {
			const notifications = new frappe.ui.Notifications({
				popover: true,
				wrapper: $host,
			});
			$host.data("st-notifications-instance", notifications);
			$button.data("st-popover-ready", 1);
		} catch (error) {
			console.warn("SaaS Theme: notification popover initialization failed", error);
		}
	}

	function prepare_notification_buttons() {
		$(".page-head:visible .st-page-utility-actions").each(function () {
			$(this)
				.find("button.st-top-notification, button.st-top-notification-button")
				.each(function () {
					ensure_notification_popover(this);
				});
		});
	}

	function refresh() {
		ensure_styles();
		patch_list_documentation();
		patch_sidebar_header_menu();
		remove_rendered_documentation();
		remove_menu_items();
		ensure_page_home_button();
		make_sidebar_header_home();
		prepare_notification_buttons();
	}

	function schedule(delay = 10) {
		clearTimeout(state.timer);
		state.timer = setTimeout(refresh, delay);
	}

	// Pointer-down fires before click. This guarantees that the native popover owns
	// the first click instead of the old sidebar-panel handler.
	$(document)
		.off("pointerdown.saas_final_notification")
		.on(
			"pointerdown.saas_final_notification",
			"button.st-top-notification, button.st-top-notification-button",
			function () {
				ensure_notification_popover(this);
			}
		);

	// The sidebar header is now a direct Home control instead of a configuration menu.
	document.addEventListener(
		"click",
		(event) => {
			if (!event.target?.closest?.(".sidebar-header.st-sidebar-home-header")) return;
			go_home(event);
		},
		true
	);

	document.addEventListener(
		"keydown",
		(event) => {
			const header = event.target?.closest?.(".sidebar-header.st-sidebar-home-header");
			if (!header || (event.key !== "Enter" && event.key !== " ")) return;
			go_home(event);
		},
		true
	);

	$(document)
		.off("page-change.saas_final_shell sidebar_setup.saas_final_shell toolbar_setup.saas_final_shell")
		.on(
			"page-change.saas_final_shell sidebar_setup.saas_final_shell toolbar_setup.saas_final_shell",
			() => schedule(5)
		);

	$(function () {
		refresh();
		state.observer = new MutationObserver(() => schedule(5));
		state.observer.observe(document.body, { childList: true, subtree: true });
		if (typeof frappe.after_ajax === "function") frappe.after_ajax(() => schedule(5));
	});

	saas_theme.final_shell_cleanup.refresh = refresh;
	saas_theme.final_shell_cleanup.go_home = go_home;
})();

/* ===== END HISTORICAL CONTROLLER: final_shell_cleanup.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: user_theme_menu.js ===== */
/* SaaS Theme — restore Toggle Theme in the Frappe v16 sidebar user menu. */
(function () {
	"use strict";

	/* Final stability layer is loaded here so it runs after the older theme passes. */
	(function load_stability_assets() {
		if (!document.getElementById("st-stability-refinement-v3-css")) {
			const link = document.createElement("link");
			link.id = "st-stability-refinement-v3-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/stability_refinement_v3.css?v=2";
			document.head.appendChild(link);
		}

		if (!document.getElementById("st-stability-refinement-v3-js")) {
			const script = document.createElement("script");
			script.id = "st-stability-refinement-v3-js";
			script.src = "/assets/saas_theme/js/stability_refinement_v3.js?v=2";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* Precision v4 corrects header/report/typography regressions without touching
	   the broader theme layers that already look good. */
	(function load_precision_v4_assets() {
		if (!document.getElementById("st-ui-precision-v4-css")) {
			const link = document.createElement("link");
			link.id = "st-ui-precision-v4-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/ui_precision_v4.css?v=1";
			document.head.appendChild(link);
		}

		if (!document.getElementById("st-ui-precision-v4-js")) {
			const script = document.createElement("script");
			script.id = "st-ui-precision-v4-js";
			script.src = "/assets/saas_theme/js/ui_precision_v4.js?v=1";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* Precision v5 is deliberately loaded after v4 and is scoped only to form
	   controls + child tables, Configure Columns and the fixed row editor. */
	(function load_child_table_precision_v5_assets() {
		if (!document.getElementById("st-child-table-precision-v5-css")) {
			const link = document.createElement("link");
			link.id = "st-child-table-precision-v5-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/child_table_precision_v5.css?v=1";
			document.head.appendChild(link);
		}

		if (!document.getElementById("st-child-table-precision-v5-js")) {
			const script = document.createElement("script");
			script.id = "st-child-table-precision-v5-js";
			script.src = "/assets/saas_theme/js/child_table_precision_v5.js?v=1";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* Precision v6 runs last and fixes only the latest checkbox/search/report
	   issues without changing the established child-table/form work. */
	(function load_ui_precision_v6_assets() {
		if (!document.getElementById("st-ui-precision-v6-css")) {
			const link = document.createElement("link");
			link.id = "st-ui-precision-v6-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/ui_precision_v6.css?v=2";
			document.head.appendChild(link);
		}

		if (!document.getElementById("st-ui-precision-v6-js")) {
			const script = document.createElement("script");
			script.id = "st-ui-precision-v6-js";
			script.src = "/assets/saas_theme/js/ui_precision_v6.js?v=2";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* Precision v6.2 owns the final inline-search interaction and exact report
	   filter-cell sizing. It waits for v6 before applying its overrides. */
	(function load_ui_precision_v6_2_assets() {
		if (!document.getElementById("st-ui-precision-v6-2-js")) {
			const script = document.createElement("script");
			script.id = "st-ui-precision-v6-2-js";
			script.src = "/assets/saas_theme/js/ui_precision_v6_2.js?v=1";
			script.defer = true;
			document.head.appendChild(script);
		}
	})();

	/* v6.5 is intentionally CSS-only and scoped to Frappe's tagged child-row
	   editor. It removes the remaining chaotic section/card styling without
	   touching the working v6.2 search/dropdown behavior. */
	(function load_child_row_editor_v65() {
		if (!document.getElementById("st-child-row-editor-v65-css")) {
			const link = document.createElement("link");
			link.id = "st-child-row-editor-v65-css";
			link.rel = "stylesheet";
			link.href = "/assets/saas_theme/css/child_row_editor_refinement_v65.css?v=1";
			document.head.appendChild(link);
		}
	})();

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_user_theme_menu__) return;
	window.__saas_theme_user_theme_menu__ = true;

	const state = { observer: null, timer: null };

	function label_for(row) {
		return String(
			row?.querySelector?.(".es-menu__label")?.textContent || row?.textContent || ""
		)
			.replace(/\s+/g, " ")
			.trim();
	}

	function make_theme_row() {
		const is_dark = document.documentElement.getAttribute("data-theme") === "dark";
		const row = document.createElement("button");
		row.type = "button";
		row.className = "es-menu__item st-theme-toggle-menu-item";
		row.setAttribute("role", "menuitem");
		row.setAttribute("tabindex", "-1");

		try {
			row.insertAdjacentHTML(
				"beforeend",
				frappe.utils.icon(is_dark ? "sun" : "moon", "sm", "", "", "current-color", true)
			);
		} catch (e) {
			// The label still provides a usable action if an icon cannot be rendered.
		}

		const label = document.createElement("span");
		label.className = "es-menu__label";
		label.textContent = __("Toggle Theme");
		row.appendChild(label);

		row.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();

			const trigger = document.querySelector(
				'.st-top-profile-button[aria-expanded="true"], .sidebar-user-button[aria-expanded="true"], .desktop-avatar[aria-expanded="true"]'
			);
			if (trigger) trigger.click();

			setTimeout(() => {
				try {
					new frappe.ui.ThemeSwitcher().show();
				} catch (error) {
					console.warn("SaaS Theme: could not open Theme Switcher", error);
				}
			}, 20);
		});

		return row;
	}

	function ensure_theme_row(menu) {
		if (!(menu instanceof Element) || !menu.matches('.es-menu[role="menu"], .es-menu')) return;

		const rows = Array.from(menu.querySelectorAll(".es-menu__item"));
		if (!rows.length) return;

		const labels = new Set(rows.map(label_for));
		const settings = __("Settings");
		const reload = __("Reload");
		const logout = __("Logout");
		const toggle = __("Toggle Theme");

		if (!labels.has(settings) || !labels.has(reload) || !labels.has(logout)) return;
		if (labels.has(toggle)) return;

		const reload_row = rows.find((row) => label_for(row) === reload);
		if (!reload_row?.parentElement) return;

		reload_row.insertAdjacentElement("beforebegin", make_theme_row());
	}

	function refresh() {
		document.querySelectorAll('.es-menu[role="menu"], .es-menu').forEach(ensure_theme_row);
	}

	function schedule(delay = 0) {
		clearTimeout(state.timer);
		state.timer = setTimeout(refresh, delay);
	}

	$(function () {
		refresh();
		if (!document.body) return;
		state.observer = new MutationObserver(() => schedule(0));
		state.observer.observe(document.body, { childList: true, subtree: true });
	});

	$(document)
		.off("page-change.saas_theme_menu sidebar_setup.saas_theme_menu")
		.on("page-change.saas_theme_menu sidebar_setup.saas_theme_menu", () => schedule(10));
})();
/* ===== END HISTORICAL CONTROLLER: user_theme_menu.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: form_sidebar_persistence.js ===== */
(() => {
	"use strict";

	const STORAGE_KEY = "saas_theme.form_sidebar_collapsed";
	const ROOT_CLASS = "st-form-sidebar-pref-collapsed";
	const BODY_CLASS = "st-form-sidebar-collapsed";
	const BUTTON_CLASS = "st-form-sidebar-toggle";

	let preferred_collapsed = read_state();
	let apply_timer = null;
	let observer = null;
	let applying = false;

	function t(message) {
		return typeof window.__ === "function" ? window.__(message) : message;
	}

	function read_state() {
		try {
			return window.localStorage.getItem(STORAGE_KEY) === "1";
		} catch (error) {
			return false;
		}
	}

	function write_state(collapsed) {
		try {
			window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
		} catch (error) {
			// localStorage may be unavailable in restricted browser contexts.
		}
	}

	function sync_root_preference_class() {
		document.documentElement?.classList.toggle(ROOT_CLASS, preferred_collapsed);
	}

	// Apply the saved preference before the form DOM is painted. The CSS that
	// consumes this class is route-scoped, so it is harmless on non-form pages.
	sync_root_preference_class();

	function is_form_route() {
		const body_route = document.body?.dataset?.route || "";
		if (body_route.startsWith("Form")) return true;

		try {
			return window.frappe?.get_route?.()?.[0] === "Form";
		} catch (error) {
			return false;
		}
	}

	function get_active_page() {
		const pages = Array.from(document.querySelectorAll(".page-container"));
		for (let index = pages.length - 1; index >= 0; index -= 1) {
			const page = pages[index];
			if (page.offsetParent !== null && !page.classList.contains("hide")) return page;
		}
		return document.querySelector(".page-container:not(.hide)");
	}

	function attachment_preview_open(page) {
		const preview = page?.querySelector(
			".layout-side-section .attachment-preview:not(.hidden)"
		);
		return Boolean(preview && preview.offsetParent !== null);
	}

	function get_icon(collapsed) {
		if (collapsed) {
			return `
				<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/>
					<path d="M15 4v16" stroke="currentColor" stroke-width="1.7"/>
					<path d="m10 9-3 3 3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>`;
		}

		return `
			<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/>
				<path d="M15 4v16" stroke="currentColor" stroke-width="1.7"/>
				<path d="m8 9 3 3-3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`;
	}

	function update_button(button, effective_collapsed, preview_open) {
		const visual_state = `${effective_collapsed ? "collapsed" : "expanded"}:${preview_open ? "preview" : "normal"}`;
		if (button.dataset.visualState !== visual_state) {
			button.dataset.visualState = visual_state;
			button.dataset.collapsed = effective_collapsed ? "true" : "false";
			button.setAttribute("aria-pressed", effective_collapsed ? "true" : "false");
			button.innerHTML = get_icon(effective_collapsed);
		}

		button.disabled = preview_open;
		const label = preview_open
			? t("Close attachment preview before hiding the details sidebar")
			: effective_collapsed
				? t("Show details sidebar")
				: t("Hide details sidebar");
		button.setAttribute("aria-label", label);
		button.title = label;
	}

	function set_preference(collapsed) {
		preferred_collapsed = Boolean(collapsed);
		write_state(preferred_collapsed);
		sync_root_preference_class();
		apply_state();
	}

	function create_button(page) {
		const actions = page?.querySelector(".page-head .page-actions, .page-actions");
		if (!actions) return null;

		let button = actions.querySelector(`.${BUTTON_CLASS}`);
		if (button) return button;

		button = document.createElement("button");
		button.type = "button";
		button.className = `btn btn-default icon-btn ${BUTTON_CLASS}`;
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (button.disabled) return;
			set_preference(!preferred_collapsed);
		});

		actions.appendChild(button);
		return button;
	}

	function remove_stale_buttons(active_page) {
		document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((button) => {
			if (!active_page || !active_page.contains(button)) button.remove();
		});
	}

	function apply_state() {
		if (applying) return;
		applying = true;

		try {
			const page = get_active_page();
			const form_route = is_form_route();
			remove_stale_buttons(page);

			if (!form_route || !page || !page.querySelector(".form-sidebar")) {
				document.body?.classList.remove(BODY_CLASS);
				return;
			}

			const preview_open = attachment_preview_open(page);
			const effective_collapsed = preferred_collapsed && !preview_open;
			document.body?.classList.toggle(BODY_CLASS, effective_collapsed);

			const button = create_button(page);
			if (button) update_button(button, effective_collapsed, preview_open);
		} finally {
			applying = false;
		}
	}

	function schedule_apply(delay = 0) {
		window.clearTimeout(apply_timer);
		apply_timer = window.setTimeout(apply_state, delay);
	}

	function setup_router_listener() {
		try {
			if (window.frappe?.router?.on && !window.__saas_theme_form_sidebar_router_bound__) {
				window.__saas_theme_form_sidebar_router_bound__ = true;
				window.frappe.router.on("change", () => schedule_apply(0));
			}
		} catch (error) {
			// The router may initialize after this asset; the delayed setup below retries it.
		}
	}

	function setup_observer() {
		if (observer || !window.MutationObserver) return;
		const target = document.querySelector(".main-section") || document.body;
		if (!target) return;

		observer = new MutationObserver((mutations) => {
			const relevant = mutations.some((mutation) => {
				if (mutation.type !== "childList") return false;
				return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0;
			});
			if (relevant) schedule_apply(20);
		});
		observer.observe(target, { childList: true, subtree: true });
	}

	window.addEventListener("storage", (event) => {
		if (event.key !== STORAGE_KEY) return;
		preferred_collapsed = read_state();
		sync_root_preference_class();
		schedule_apply(0);
	});

	if (window.jQuery) {
		window.jQuery(document)
			.off("page-change.saas_form_sidebar_persistence")
			.on("page-change.saas_form_sidebar_persistence", () => schedule_apply(0));
	}

	function init() {
		setup_router_listener();
		setup_observer();
		schedule_apply(0);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}

	// Frappe can initialize its router after custom assets execute.
	window.setTimeout(setup_router_listener, 350);
	window.setTimeout(() => schedule_apply(0), 450);
})();

/* Load the final inline-grid popup anchor after the base theme assets. */
(() => {
	"use strict";
	if (window.__saas_theme_inline_grid_popup_loader_v5__) return;
	window.__saas_theme_inline_grid_popup_loader_v5__ = true;

	const cssId = "saas-theme-inline-grid-popup-v5-css";
	if (!document.getElementById(cssId)) {
		const link = document.createElement("link");
		link.id = cssId;
		link.rel = "stylesheet";
		link.href = "/assets/saas_theme/css/inline_grid_link_popup_anchor_v5.css?v=5";
		document.head.appendChild(link);
	}

	const scriptId = "saas-theme-inline-grid-popup-v5-js";
	if (!document.getElementById(scriptId)) {
		const script = document.createElement("script");
		script.id = scriptId;
		script.src = "/assets/saas_theme/js/inline_grid_link_popup_anchor_v5.js?v=5";
		script.async = false;
		document.head.appendChild(script);
	}
})();

/* ===== END HISTORICAL CONTROLLER: form_sidebar_persistence.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: quick_access_preferences.js ===== */
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

/* ===== END HISTORICAL CONTROLLER: quick_access_preferences.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: child_row_editor_finish.js ===== */
/*
 * SaaS Theme — legacy child-row interaction shim retired in v7.
 *
 * Child-row portal, Link Selector keep-open behavior, overlay stacking and
 * autocomplete positioning are now owned by interaction_finish_v2.js
 * (Consolidated UI Interaction Controller v7).
 *
 * This file intentionally remains as a no-op because it is still referenced by
 * hooks.py on existing installations; keeping the asset avoids a 404 while
 * removing the duplicate monkey-patching that caused conflicting behavior.
 */
(function () {
	"use strict";
	window.__saas_theme_child_row_editor_finish_retired_v7__ = true;
})();

/* ===== END HISTORICAL CONTROLLER: child_row_editor_finish.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: stability_refinement_v3.js ===== */
/*
 * SaaS Theme — Stability Refinement v3
 * Conservative runtime fixes for Frappe v16.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_stability_v3__) return;
	window.__saas_theme_stability_v3__ = true;

	const state = {
		timer: null,
		patched_sidebar: false,
	};

	function blocking_layer_is_open() {
		return !!document.querySelector(
			'.modal.show, .modal.in, .modal-backdrop.show, .offcanvas.show, [role="dialog"][aria-modal="true"]:not([aria-hidden="true"]), #st-login-loader.is-visible'
		);
	}

	function mobile_sidebar_is_open() {
		try {
			return !!(frappe.is_mobile?.() && frappe.app?.sidebar?.sidebar_expanded);
		} catch (e) {
			return false;
		}
	}

	function release_stale_scroll_lock() {
		if (!document.body || blocking_layer_is_open() || mobile_sidebar_is_open()) return;

		if (document.body.style.overflow === "hidden") {
			document.body.style.removeProperty("overflow");
		}
		if (document.body.style.overflowY === "hidden") {
			document.body.style.removeProperty("overflow-y");
		}
		if (document.documentElement.style.overflow === "hidden") {
			document.documentElement.style.removeProperty("overflow");
		}
		if (document.documentElement.style.overflowY === "hidden") {
			document.documentElement.style.removeProperty("overflow-y");
		}

		$(".main-section").each(function () {
			if (this.style.overflow === "hidden") this.style.removeProperty("overflow");
			if (this.style.overflowY === "hidden") this.style.removeProperty("overflow-y");
		});
	}

	function patch_sidebar_scroll_helpers() {
		const proto = frappe.ui?.Sidebar?.prototype;
		if (!proto || proto.__saas_theme_scroll_stability_v3) return false;

		const original_set_height = proto.set_height;
		const original_prevent_scroll = proto.prevent_scroll;

		if (typeof original_set_height === "function") {
			proto.set_height = function () {
				const result = original_set_height.apply(this, arguments);
				if (!frappe.is_mobile?.()) {
					document.body?.style.removeProperty("overflow");
					document.documentElement?.style.removeProperty("overflow");
				}
				return result;
			};
		}

		if (typeof original_prevent_scroll === "function") {
			proto.prevent_scroll = function () {
				if (frappe.is_mobile?.()) {
					return original_prevent_scroll.apply(this, arguments);
				}
				$(".main-section").css({ overflow: "", overflowY: "" });
				document.body?.style.removeProperty("overflow");
				document.body?.style.removeProperty("overflow-y");
			};
		}

		proto.__saas_theme_scroll_stability_v3 = true;
		state.patched_sidebar = true;
		return true;
	}

	function classify_form_layouts() {
		$(".form-layout").each(function () {
			const $layout = $(this);
			const $tab_list = $layout.find("> .form-page > .form-tabs-list").first();
			let visible_tabs = 0;

			if ($tab_list.length && $tab_list.is(":visible")) {
				visible_tabs = $tab_list.find(".nav-link:visible").length;
			}

			$layout.toggleClass("st-section-card-form", visible_tabs <= 1);
		});
	}

	function repair_page_header() {
		$(".page-head .sidebar-toggle-btn.navbar-brand").attr("aria-hidden", "true").hide();

		$(".page-head .page-title .title-area > .more-button")
			.attr("aria-hidden", "true")
			.hide();

		try {
			window.saas_theme?.mobile_shell?.refresh?.();
		} catch (e) {
			// Header is still usable even if the shell is not initialized yet.
		}

		$(".page-head:visible .st-page-utility-actions")
			.css({ visibility: "visible", opacity: "1" })
			.removeClass("hidden");
		$(".page-head:visible .st-top-profile, .page-head:visible .st-top-profile-button")
			.css({ visibility: "visible", opacity: "1" })
			.removeClass("hidden");
	}

	function refresh() {
		patch_sidebar_scroll_helpers();
		repair_page_header();
		classify_form_layouts();
		release_stale_scroll_lock();
	}

	function schedule(delay = 10) {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => {
			refresh();
			setTimeout(() => {
				repair_page_header();
				classify_form_layouts();
				release_stale_scroll_lock();
			}, 90);
			setTimeout(() => {
				repair_page_header();
				classify_form_layouts();
				release_stale_scroll_lock();
			}, 320);
		}, delay);
	}

	$(document)
		.off("page-change.saas_stability_v3 sidebar_setup.saas_stability_v3 toolbar_setup.saas_stability_v3")
		.on(
			"page-change.saas_stability_v3 sidebar_setup.saas_stability_v3 toolbar_setup.saas_stability_v3",
			() => schedule(5)
		);

	$(window)
		.off("pageshow.saas_stability_v3 resize.saas_stability_v3")
		.on("pageshow.saas_stability_v3 resize.saas_stability_v3", () => schedule(20));

	$(function () {
		refresh();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule(10));
		}
	});

	let tries = 0;
	const patch_timer = setInterval(() => {
		tries += 1;
		if (patch_sidebar_scroll_helpers() || tries >= 24) {
			clearInterval(patch_timer);
		}
	}, 250);
})();

/* ===== END HISTORICAL CONTROLLER: stability_refinement_v3.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: ui_precision_v4.js ===== */
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

/* ===== END HISTORICAL CONTROLLER: ui_precision_v4.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: child_table_precision_v5.js ===== */
/*
 * SaaS Theme — Child Table Precision v5 runtime helpers.
 *
 * Only tags Frappe's Configure Columns dialog and visible child-row editor so
 * the final CSS can be exact without touching unrelated dialogs/components.
 */
(function () {
	"use strict";

	if (window.__saas_theme_child_table_precision_v5__) return;
	window.__saas_theme_child_table_precision_v5__ = true;

	const state = {
		observer: null,
		timer: null,
	};

	function normalize_text(value) {
		return String(value || "")
			.replace(/\s+/g, " ")
			.trim();
	}

	function configure_columns_title() {
		try {
			return normalize_text(__("Configure Columns"));
		} catch (e) {
			return "Configure Columns";
		}
	}

	function tag_configure_columns_dialog(modal) {
		if (!(modal instanceof Element)) return;

		const title = normalize_text(modal.querySelector(".modal-title")?.textContent);
		const expected = configure_columns_title();
		if (title !== expected && title !== "Configure Columns") return;

		modal.classList.add("st-grid-config-modal");

		const selected_fields = modal.querySelector(".selected-fields");
		if (!selected_fields) return;

		const form_group = selected_fields.closest(".form-group");
		if (form_group) {
			const header = Array.from(form_group.children).find(
				(child) => child.classList?.contains("row")
			);
			header?.classList.add("st-grid-config-header");
		}

		selected_fields.querySelectorAll(".fields_order").forEach((row) => {
			row.classList.add("st-grid-config-row");
		});
	}

	function tag_grid_row_editors(root = document) {
		root.querySelectorAll?.(".grid-row-open .form-in-grid").forEach((editor) => {
			editor.classList.add("st-grid-row-editor");
		});
	}

	function refresh(root = document) {
		root.querySelectorAll?.(".modal").forEach(tag_configure_columns_dialog);
		tag_grid_row_editors(root);
		// A newly-added subtree may live under an existing modal/editor.
		if (root instanceof Element) {
			const modal = root.closest?.(".modal");
			if (modal) tag_configure_columns_dialog(modal);
			const editor = root.closest?.(".grid-row-open .form-in-grid");
			if (editor) editor.classList.add("st-grid-row-editor");
		}
	}

	function schedule(delay = 0) {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => refresh(document), delay);
	}

	function observe() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver((mutations) => {
			let needs_refresh = false;
			for (const mutation of mutations) {
				if (mutation.type !== "childList" || !mutation.addedNodes.length) continue;
				for (const node of mutation.addedNodes) {
					if (!(node instanceof Element)) continue;
					if (
						node.matches?.(".modal, .form-in-grid, .fields_order") ||
						node.querySelector?.(".modal, .form-in-grid, .fields_order")
					) {
						needs_refresh = true;
						break;
					}
				}
				if (needs_refresh) break;
			}
			if (needs_refresh) schedule(0);
		});
		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	$(document)
		.off("click.saas_child_table_v5")
		.on("click.saas_child_table_v5", ".grid-settings, .btn-open-row", () => {
			schedule(0);
			setTimeout(() => refresh(document), 40);
			setTimeout(() => refresh(document), 140);
		});

	$(document)
		.off("page-change.saas_child_table_v5")
		.on("page-change.saas_child_table_v5", () => schedule(20));

	$(function () {
		refresh(document);
		observe();
		if (typeof frappe !== "undefined" && typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule(10));
		}
	});
})();

/* ===== END HISTORICAL CONTROLLER: child_table_precision_v5.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: inline_grid_link_popup_anchor_v5.js ===== */
/*
 * SaaS Theme — legacy inline-grid popup controller retired in v7.
 *
 * Frappe v16 moves editable-grid Awesomplete lists into .grid-field. The v7
 * consolidated controller resolves that real list and owns portal/positioning.
 * Keeping this asset as a no-op preserves compatibility with the existing
 * dynamic loader without running a second competing popup controller.
 */
(function () {
	"use strict";
	window.__saas_theme_inline_grid_popup_v5_retired_v7__ = true;
})();

/* ===== END HISTORICAL CONTROLLER: inline_grid_link_popup_anchor_v5.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: ui_precision_v6.js ===== */
/*
 * SaaS Theme — UI Precision v6.1
 * Targeted runtime repairs for:
 * - one reliable checkbox visual per Check field
 * - a truly inline AwesomeBar search (no modal on normal use)
 * - report filter-grid structure and searchable DataTable columns
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_ui_precision_v6_1__) return;
	window.__saas_theme_ui_precision_v6_1__ = true;

	const state = {
		timer: null,
		observer: null,
		search_seq: 0,
		shortcut_bound: false,
	};

	function shortcut_label() {
		try {
			return frappe.utils.is_mac?.() ? "⌘K" : "Ctrl K";
		} catch (e) {
			return "Ctrl K";
		}
	}

	function clean_text(value) {
		return String(value || "").replace(/\s+/g, " ").trim();
	}

	function inline_search_available() {
		return !!(
			frappe.app?.awesome_bar &&
			typeof frappe.app.awesome_bar.get_options === "function" &&
			typeof frappe.app.awesome_bar.open_option === "function" &&
			typeof window.Awesomplete !== "undefined"
		);
	}

	function render_search_item(option) {
		const label = option?.label || option?.value || "";
		const description =
			option?.description && option.description !== option.value ? option.description : "";
		return `
			<div class="st-inline-result-main">${label}</div>
			${description ? `<div class="st-inline-result-description">${description}</div>` : ""}
		`;
	}

	function setup_inline_awesomplete(input) {
		if (!input || input.dataset.stInlineSearchReady === "1") return input?.awesomplete || null;
		if (!inline_search_available()) return null;

		const awesomebar = frappe.app.awesome_bar;
		let current_options = [];
		let input_seq = 0;

		const awesomplete = new Awesomplete(input, {
			minChars: 0,
			maxItems: 30,
			autoFirst: true,
			list: [],
			filter: function () {
				return true;
			},
			data: function (item) {
				return {
					label: item?.index || 0,
					value: item?.value || item?.label || "",
				};
			},
			item: function (item) {
				const option = current_options.find((entry) => entry?.value === item.value) || {
					label: item.value,
					value: item.value,
				};
				return $("<li class='st-inline-search-result'></li>")
					.data("item.autocomplete", option)
					.html(render_search_item(option))
					.get(0);
			},
			sort: function (a, b) {
				return Number(b.label || 0) - Number(a.label || 0);
			},
			container: function (search_input) {
				const container = document.createElement("div");
				container.className = "awesomplete st-inline-awesomebar";
				search_input.parentNode.insertBefore(container, search_input);
				container.appendChild(search_input);
				return container;
			},
		});

		input.awesomplete = awesomplete;
		input.dataset.stInlineSearchReady = "1";

		const set_options = (options) => {
			current_options = Array.isArray(options) ? options : [];
			awesomplete.options_with_desc =
				typeof awesomebar.create_options_with_descriptions === "function"
					? awesomebar.create_options_with_descriptions(current_options)
					: {};
			awesomplete.list = current_options;
			$(awesomplete.ul).toggleClass("st-inline-search-empty", current_options.length === 0);
		};

		const update_options = frappe.utils.debounce(function () {
			const txt = clean_text(input.value);
			const seq = ++input_seq;
			state.search_seq += 1;

			let options = [];
			try {
				options = awesomebar.get_options(txt) || [];
			} catch (error) {
				console.debug("SaaS Theme: inline AwesomeBar options unavailable", error);
			}
			set_options(options);

			if (
				txt.length > 1 &&
				frappe.boot?.has_awesomebar_search &&
				typeof awesomebar.get_hook_results === "function"
			) {
				awesomebar
					.get_hook_results(txt)
					.then((results) => {
						if (seq !== input_seq || !Array.isArray(results) || !results.length) return;
						const merged =
							typeof awesomebar.merge_hook_results === "function"
								? awesomebar.merge_hook_results(options, results)
								: options.concat(results);
						set_options(merged);
					})
					.catch(() => {});
			}
		}, 55);

		$(input)
			.off(".saas_v6 .saas_inline_v6")
			.on("input.saas_inline_v6", update_options)
			.on("focus.saas_inline_v6", function () {
				update_options();
				setTimeout(() => {
					if (!awesomplete.opened) awesomplete.open();
				}, 20);
			})
			.on("awesomplete-select.saas_inline_v6", function (event) {
				const original = event.originalEvent;
				const value = original?.text?.value;
				const option = current_options.find((entry) => entry?.value === value);
				if (!option) return;

				original.preventDefault?.();
				try {
					awesomebar.open_option(option, original.originalEvent || original);
				} finally {
					input.value = "";
					awesomplete.close();
					input.blur();
				}
			})
			.on("awesomplete-selectcomplete.saas_inline_v6", function () {
				input.value = "";
			})
			.on("keydown.saas_inline_v6", function (event) {
				if (event.key === "Escape") {
					awesomplete.close();
					input.value = "";
					input.blur();
				}
			});

		return awesomplete;
	}

	function build_header_search() {
		const $slot = $(
			'<div class="st-header-search-slot" data-st-search-version="7" role="search"></div>'
		);
		const $shell = $('<div class="st-header-search-shell"></div>');
		const $input = $(
			`<input type="text" class="st-header-search-input" autocomplete="off" spellcheck="false" aria-label="${__(
				"Search or type a command"
			)}" placeholder="${__("Search or type a command")}">`
		);
		const $shortcut = $(
			'<span class="st-header-search-shortcut" aria-hidden="true"></span>'
		).text(shortcut_label());

		$shell.append($input, $shortcut);
		$slot.append($shell);
		setup_inline_awesomplete($input.get(0));
		return $slot;
	}

	function ensure_header_search($head) {
		const $content = $head.find(".page-head-content").first();
		if (!$content.length) return;

		let $slot = $content.children('.st-header-search-slot[data-st-search-version="7"]').first();
		if (!$slot.length) {
			$content.children(".st-header-search-slot").remove();
			$slot = build_header_search();
			const $actions = $content.children(".standard-items-section").first();
			if ($actions.length) $slot.insertBefore($actions);
			else $content.append($slot);
		}

		$content.addClass("st-inline-search-active");
		const input = $slot.find(".st-header-search-input").get(0);
		if (input && input.dataset.stInlineSearchReady !== "1") {
			setup_inline_awesomplete(input);
		}

		$head.find("#small-search-button, .st-top-search").attr("aria-hidden", "true");
	}

	function bind_search_shortcut() {
		if (state.shortcut_bound) return;
		state.shortcut_bound = true;

		document.addEventListener(
			"keydown",
			(event) => {
				if (!(event.ctrlKey || event.metaKey) || String(event.key).toLowerCase() !== "k") return;
				if (window.innerWidth <= 980) return;

				const input = $(".page-head:visible .st-header-search-input").first().get(0);
				if (!input) return;

				event.preventDefault();
				event.stopImmediatePropagation();
				input.focus();
				$(input).trigger("input");
			},
			true
		);
	}

	function repair_check_control(control) {
		if (!(control instanceof Element)) return;

		const input_area = control.querySelector(".checkbox .input-area");
		const disp_area = control.querySelector(".checkbox .disp-area");
		if (!input_area || !disp_area) return;

		const input = input_area.querySelector('input[type="checkbox"]');
		const input_hidden = input_area.classList.contains("hide");
		const disp_hidden = disp_area.classList.contains("hide");

		if (input_hidden && !disp_hidden) {
			input_area.setAttribute("aria-hidden", "true");
			disp_area.setAttribute("aria-hidden", "false");
			return;
		}

		if (disp_hidden && !input_hidden) {
			disp_area.setAttribute("aria-hidden", "true");
			input_area.setAttribute("aria-hidden", "false");
			return;
		}

		if (!input_hidden && !disp_hidden) {
			if (input?.disabled) {
				input_area.classList.add("hide");
				input_area.setAttribute("aria-hidden", "true");
				disp_area.classList.remove("hide");
				disp_area.setAttribute("aria-hidden", "false");
			} else {
				disp_area.classList.add("hide");
				disp_area.setAttribute("aria-hidden", "true");
				input_area.classList.remove("hide");
				input_area.setAttribute("aria-hidden", "false");
			}
		}
	}

	function repair_checkboxes(root = document) {
		const controls = root.querySelectorAll
			? root.querySelectorAll('.frappe-control[data-fieldtype="Check"]')
			: [];
		controls.forEach(repair_check_control);
	}

	function repair_report_filter_grid() {
		const $page = $("#page-query-report:visible").first();
		if (!$page.length) return;

		const $form = $page.find(".page-form").first();
		if (!$form.length) return;
		$form.addClass("st-report-filter-grid");

		const $check_area = $form.children(".check-filter-area");
		if ($check_area.length) $check_area.addClass("st-report-check-grid");

		try {
			frappe.query_report?.$collapse_button?.addClass("st-report-filter-collapse");
		} catch (e) {
			// Report remains usable without the optional collapse marker.
		}
	}

	function repair_report_column_filters() {
		$("#page-query-report .report-wrapper .datatable").each(function () {
			const $table = $(this);
			const $headers = $table.find(".dt-row-header .dt-cell");
			$table.find(".dt-row-filter").each(function () {
				$(this)
					.find(".dt-cell")
					.each(function (index) {
						const $cell = $(this);
						const $input = $cell.find("input.dt-filter, .dt-filter").first();
						if (!$input.length) return;

						const $header = $headers.eq(index);
						const header_text = clean_text($header.text());
						const width = $header.length ? $header.get(0).getBoundingClientRect().width : 0;
						const utility =
							!header_text ||
							width < 72 ||
							/^(no\.?|#|sr\.?|select)$/i.test(header_text);

						$cell.toggleClass("st-filter-utility-cell", utility);
						if (utility) {
							$input.attr({ tabindex: "-1", "aria-hidden": "true" }).val("");
						} else {
							$input.removeAttr("aria-hidden").removeAttr("tabindex");
							if (!$input.attr("placeholder")) $input.attr("placeholder", header_text);
							$input.attr("aria-label", __("Filter {0}", [header_text]));
						}
					});
			});
		});
	}

	function refresh(root = document) {
		repair_checkboxes(root);
		$(".page-head:visible").each(function () {
			ensure_header_search($(this));
		});
		repair_report_filter_grid();
		repair_report_column_filters();
	}

	function schedule(delay = 15, root = document) {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => {
			refresh(root);
			setTimeout(() => refresh(document), 100);
			setTimeout(() => refresh(document), 320);
		}, delay);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;

		state.observer = new MutationObserver((mutations) => {
			let relevant = false;
			for (const mutation of mutations) {
				if (mutation.type === "attributes") {
					const target = mutation.target;
					if (
						target?.closest?.('.frappe-control[data-fieldtype="Check"]') ||
						target?.closest?.("#page-query-report")
					) {
						relevant = true;
						break;
					}
				}

				for (const node of mutation.addedNodes || []) {
					if (!(node instanceof Element)) continue;
					if (
						node.matches?.('.frappe-control[data-fieldtype="Check"], .page-head, #page-query-report, .datatable') ||
						node.querySelector?.('.frappe-control[data-fieldtype="Check"], .page-head, #page-query-report, .datatable')
					) {
						relevant = true;
						break;
					}
				}
				if (relevant) break;
			}
			if (relevant) schedule(10);
		});

		state.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class", "disabled", "style"],
		});
	}

	$(document)
		.off("page-change.saas_ui_precision_v6 toolbar_setup.saas_ui_precision_v6 sidebar_setup.saas_ui_precision_v6")
		.on(
			"page-change.saas_ui_precision_v6 toolbar_setup.saas_ui_precision_v6 sidebar_setup.saas_ui_precision_v6",
			() => schedule(5)
		);

	$(window)
		.off("pageshow.saas_ui_precision_v6 resize.saas_ui_precision_v6")
		.on("pageshow.saas_ui_precision_v6 resize.saas_ui_precision_v6", () => schedule(25));

	$(function () {
		bind_search_shortcut();
		refresh();
		setup_observer();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule(10));
		}
	});
})();

/* ===== END HISTORICAL CONTROLLER: ui_precision_v6.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: ui_precision_v6_2.js ===== */
/*
 * SaaS Theme — UI Precision v6.2
 * Correct Frappe v16 inline search + exact Query Report filter geometry.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_ui_precision_v6_2_fix__) return;
	window.__saas_theme_ui_precision_v6_2_fix__ = true;

	const state = {
		engine: null,
		observer: null,
		timer: null,
	};

	function load_css() { /* bundled in custom.css */ }

	function clean_text(value) {
		return String(value || "").replace(/\s+/g, " ").trim();
	}

	function strip_html(value) {
		const holder = document.createElement("div");
		holder.innerHTML = String(value || "");
		return clean_text(holder.textContent || holder.innerText || "");
	}

	function get_engine() {
		if (frappe.app?.awesome_bar && typeof frappe.app.awesome_bar.build_options === "function") {
			return frappe.app.awesome_bar;
		}

		if (!state.engine && frappe.search?.AwesomeBar) {
			try {
				state.engine = new frappe.search.AwesomeBar();
			} catch (error) {
				console.debug("SaaS Theme: could not initialize AwesomeBar engine", error);
			}
		}
		return state.engine;
	}

	function deduplicate(engine, options) {
		const list = Array.isArray(options) ? options : [];
		if (engine && typeof engine.deduplicate === "function") {
			try {
				return engine.deduplicate(list);
			} catch (e) {
				// Fall through to simple de-duplication.
			}
		}

		const seen = new Set();
		return list.filter((option) => {
			const route = Array.isArray(option?.route) ? option.route.join("/") : option?.route || "";
			const key = route || option?.value || option?.label || "";
			if (!key || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	function build_local_options(query) {
		const engine = get_engine();
		if (!engine || typeof engine.build_options !== "function") return [];

		try {
			if (!frappe.search?.utils?.recent && frappe.search?.utils?.setup_recent) {
				frappe.search.utils.setup_recent();
			}
		} catch (e) {
			// Recent-page search is optional.
		}

		engine.options = [];
		engine.global_results = [];

		try {
			if (query && query.length > 1) {
				const last_space = query.lastIndexOf(" ");
				if (last_space !== -1 && typeof engine.set_specifics === "function") {
					engine.set_specifics(query.slice(0, last_space), query.slice(last_space + 1));
				}
				if (typeof engine.add_defaults === "function") engine.add_defaults(query);
				engine.options = engine.options.concat(engine.build_options(query) || []);
				engine.options = engine.options.concat(engine.global_results || []);
			} else {
				const recent = frappe.search?.utils?.get_recent_pages?.(query || "") || [];
				const frequent = frappe.search?.utils?.get_frequent_links?.() || [];
				engine.options = engine.options.concat(recent, frequent);
			}
		} catch (error) {
			console.debug("SaaS Theme: could not build inline AwesomeBar options", error);
		}

		return deduplicate(engine, engine.options).sort(
			(a, b) => Number(b?.index || 0) - Number(a?.index || 0)
		);
	}

	function fetch_hook_options(query) {
		if (!query || query.length < 2 || !frappe.boot?.has_awesomebar_search) {
			return Promise.resolve([]);
		}

		return new Promise((resolve) => {
			try {
				frappe.call({
					method: "frappe.desk.search.awesomebar_search",
					args: { txt: query },
					callback: (r) => resolve(Array.isArray(r.message) ? r.message : []),
					error: () => resolve([]),
				});
			} catch (e) {
				resolve([]);
			}
		});
	}

	function close_results(input) {
		const data = input?._stV62Search;
		if (!data) return;
		data.results.classList.remove("is-open");
		data.results.innerHTML = "";
		data.active = -1;
		input.setAttribute("aria-expanded", "false");
	}

	function mark_active(input, index) {
		const data = input?._stV62Search;
		if (!data) return;
		const items = Array.from(data.results.querySelectorAll(".st-v62-search-result"));
		if (!items.length) {
			data.active = -1;
			return;
		}

		let next = Number(index);
		if (!Number.isFinite(next)) next = 0;
		if (next < 0) next = items.length - 1;
		if (next >= items.length) next = 0;
		data.active = next;

		items.forEach((item, item_index) => {
			const active = item_index === data.active;
			item.classList.toggle("is-active", active);
			item.setAttribute("aria-selected", active ? "true" : "false");
		});
		items[data.active]?.scrollIntoView?.({ block: "nearest" });
	}

	function render_results(input, options, query) {
		const data = input?._stV62Search;
		if (!data) return;

		data.options = (Array.isArray(options) ? options : []).slice(0, 20);
		data.active = data.options.length ? 0 : -1;
		data.results.innerHTML = "";

		if (!data.options.length) {
			if (query) {
				const empty = document.createElement("div");
				empty.className = "st-v62-search-empty";
				empty.textContent = __("No matching result");
				data.results.appendChild(empty);
				data.results.classList.add("is-open");
				input.setAttribute("aria-expanded", "true");
			} else {
				close_results(input);
			}
			return;
		}

		data.options.forEach((option, index) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "st-v62-search-result";
			button.setAttribute("role", "option");
			button.setAttribute("aria-selected", index === 0 ? "true" : "false");

			const title = document.createElement("span");
			title.className = "st-v62-search-result-title";
			title.textContent = strip_html(option?.label || option?.value || __("Result"));
			button.appendChild(title);

			const meta_text = strip_html(option?.description || option?.type || "");
			if (meta_text && meta_text !== title.textContent) {
				const meta = document.createElement("span");
				meta.className = "st-v62-search-result-meta";
				meta.textContent = meta_text;
				button.appendChild(meta);
			}

			button.addEventListener("mouseenter", () => mark_active(input, index));
			button.addEventListener("mousedown", (event) => {
				event.preventDefault();
				open_option(input, option, event);
			});
			data.results.appendChild(button);
		});

		data.results.classList.add("is-open");
		input.setAttribute("aria-expanded", "true");
	}

	function route_target(route) {
		return Array.isArray(route) ? route[0] : route;
	}

	function open_option(input, option, event) {
		if (!option) return;

		try {
			if (option.route_options) frappe.route_options = option.route_options;

			if (typeof option.onclick === "function") {
				option.onclick(option.match);
			} else if (option.route) {
				const target = route_target(option.route);
				if (typeof target === "string" && /^https?:\/\//i.test(target)) {
					window.open(target, "_blank");
				} else if (typeof target === "string" && target.startsWith("/")) {
					if (typeof window.navigate_in_app_path === "function") {
						window.navigate_in_app_path(target, event);
					} else {
						window.location.href = target;
					}
				} else {
					if (event?.ctrlKey || event?.metaKey) frappe.open_in_new_tab = true;
					frappe.route_flags.jump = true;
					frappe.set_route(option.route);
				}
			}
		} finally {
			input.value = "";
			close_results(input);
			input.blur();
		}
	}

	async function run_search(input) {
		const data = input?._stV62Search;
		if (!data) return [];

		const query = clean_text(input.value);
		const request_id = ++data.seq;
		let options = build_local_options(query);
		render_results(input, options, query);

		const hook_options = await fetch_hook_options(query);
		if (request_id !== data.seq) return data.options;

		if (hook_options.length) {
			options = deduplicate(get_engine(), options.concat(hook_options)).sort(
				(a, b) => Number(b?.index || 0) - Number(a?.index || 0)
			);
			render_results(input, options, query);
		}
		return options;
	}

	function normalize_old_search(input) {
		const old_wrapper = input.closest(".st-inline-awesomebar");
		if (!old_wrapper) return input;

		const clone = input.cloneNode(true);
		clone.dataset.stInlineSearchReady = "1";
		old_wrapper.parentNode.insertBefore(clone, old_wrapper);
		old_wrapper.remove();
		return clone;
	}

	function setup_search_input(original_input) {
		if (!original_input) return;
		let input = normalize_old_search(original_input);
		if (input.dataset.stV62Fixed === "1") return;

		input.dataset.stInlineSearchReady = "1";
		input.dataset.stV62SearchReady = "1";
		input.dataset.stV62Fixed = "1";
		$(input).off(".saas_inline_v6 .saas_v62");
		input.removeAttribute("aria-activedescendant");
		input.setAttribute("aria-autocomplete", "list");
		input.setAttribute("aria-expanded", "false");

		const shell = input.closest(".st-header-search-shell");
		if (!shell) return;
		shell.querySelectorAll(".st-v62-search-results").forEach((node) => node.remove());

		const results = document.createElement("div");
		results.className = "st-v62-search-results";
		results.setAttribute("role", "listbox");
		shell.appendChild(results);

		input._stV62Search = {
			results,
			options: [],
			active: -1,
			seq: 0,
			debounce: null,
		};

		const schedule_search = () => {
			clearTimeout(input._stV62Search.debounce);
			input._stV62Search.debounce = setTimeout(() => run_search(input), 55);
		};

		$(input)
			.on("input.saas_v62", schedule_search)
			.on("focus.saas_v62", () => {
				run_search(input);
			})
			.on("blur.saas_v62", () => {
				setTimeout(() => close_results(input), 140);
			})
			.on("keydown.saas_v62", async (event) => {
				const data = input._stV62Search;
				if (!data) return;

				if (event.key === "ArrowDown") {
					event.preventDefault();
					mark_active(input, data.active + 1);
					return;
				}
				if (event.key === "ArrowUp") {
					event.preventDefault();
					mark_active(input, data.active - 1);
					return;
				}
				if (event.key === "Escape") {
					event.preventDefault();
					close_results(input);
					input.blur();
					return;
				}
				if (event.key === "Enter") {
					event.preventDefault();
					let option = data.options[data.active >= 0 ? data.active : 0];
					if (!option) {
						await run_search(input);
						option = data.options[data.active >= 0 ? data.active : 0];
					}
					if (option) open_option(input, option, event);
				}
			});
	}

	function setup_all_search_inputs() {
		document.querySelectorAll(".page-head .st-header-search-input").forEach(setup_search_input);
	}

	function sync_filter_cell(header, filter_cell, input) {
		if (!header || !filter_cell || !input) return;
		const width = Math.round(header.getBoundingClientRect().width);
		if (width <= 0) return;

		["width", "min-width", "max-width", "flex-basis"].forEach((property) => {
			filter_cell.style.setProperty(property, `${width}px`, "important");
		});

		const content = filter_cell.querySelector(".dt-cell__content");
		if (content) {
			content.style.setProperty("width", "100%", "important");
			content.style.setProperty("max-width", "100%", "important");
			content.style.setProperty("box-sizing", "border-box", "important");
		}

		input.style.setProperty("display", "block", "important");
		input.style.setProperty("width", "100%", "important");
		input.style.setProperty("min-width", "0", "important");
		input.style.setProperty("max-width", "none", "important");
		input.style.setProperty("box-sizing", "border-box", "important");
	}

	function repair_report_filter_row() {
		document.querySelectorAll("#page-query-report .report-wrapper .datatable").forEach((table) => {
			const header_map = new Map();
			table.querySelectorAll(".dt-row-header .dt-cell[data-col-index]").forEach((header) => {
				header_map.set(String(header.getAttribute("data-col-index")), header);
			});

			table.querySelectorAll(".dt-row-filter input.dt-filter[data-col-index]").forEach((input) => {
				const col_index = String(input.getAttribute("data-col-index"));
				const header = header_map.get(col_index);
				const filter_cell = input.closest(".dt-cell");
				if (!header || !filter_cell) return;

				const header_text = clean_text(header.textContent || "");
				const utility = !header_text || /^(no\.?|#|sr\.?|select)$/i.test(header_text);
				filter_cell.classList.toggle("st-v62-filter-utility", utility);
				if (utility) {
					input.style.setProperty("display", "none", "important");
					return;
				}

				sync_filter_cell(header, filter_cell, input);
				input.setAttribute("placeholder", __("Filter"));
				input.setAttribute("aria-label", __("Filter {0}", [header_text]));
			});
		});
	}

	function refresh() {
		setup_all_search_inputs();
		repair_report_filter_row();
	}

	function schedule(delay = 20) {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => {
			refresh();
			setTimeout(refresh, 120);
			setTimeout(refresh, 360);
		}, delay);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;
		state.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes || []) {
					if (!(node instanceof Element)) continue;
					if (
						node.matches?.(".st-header-search-input, .datatable, .dt-row-filter") ||
						node.querySelector?.(".st-header-search-input, .datatable, .dt-row-filter")
					) {
						schedule(10);
						return;
					}
				}
			}
		});
		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	function start() {
		load_css();
		refresh();
		setup_observer();
		window.addEventListener("resize", () => schedule(30), { passive: true });

		$(document)
			.off("page-change.saas_v62 toolbar_setup.saas_v62")
			.on("page-change.saas_v62 toolbar_setup.saas_v62", () => schedule(10));
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, { once: true });
	} else {
		start();
	}
})();

/* ===== END HISTORICAL CONTROLLER: ui_precision_v6_2.js ===== */

/* ===== BEGIN HISTORICAL CONTROLLER: interaction_finish_v2.js ===== */
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

	function ensureStyleLast() { /* bundled last in custom.css */ }

	function scheduleStyleLast(delay = 0) {
		clearTimeout(headTimer);
		headTimer = setTimeout(ensureStyleLast, delay);
	}

	function setupStyleOrderGuard() { /* no runtime stylesheet injection */ }

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
	function inlineGridFieldType(input) {
		return String(
			input?.dataset?.fieldtype ||
			input?.getAttribute?.("data-fieldtype") ||
			input?.closest?.("[data-fieldtype]")?.getAttribute?.("data-fieldtype") ||
			""
		);
	}

	function isInlineGridInput(input) {
		if (!(input instanceof HTMLInputElement)) return false;
		if (!input.closest(".form-grid .editable-row")) return false;
		if (!input.closest(".grid-static-col, .grid-field")) return false;
		return ["Link", "Dynamic Link", "Autocomplete"].includes(inlineGridFieldType(input));
	}

	function listIsOpen(list) {
		return isVisible(list) && !list.hasAttribute("hidden");
	}

	function findGridPopup(input) {
		if (!isInlineGridInput(input)) return null;
		if (input.awesomplete?.ul instanceof Element) return input.awesomplete.ul;
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

	function gridPopupAnchorRect(input) {
		const candidates = [
			input.closest(".control-input-wrapper"),
			input.closest(".frappe-control"),
			input.closest(".grid-field"),
			input.closest(".grid-static-col"),
			input,
		].filter(Boolean);
		for (const element of candidates) {
			const rect = element.getBoundingClientRect();
			if (rect.width >= 160 && rect.height > 0 && rect.height < 140) return rect;
		}
		return input.getBoundingClientRect();
	}

	function positionGridPopup(list, meta) {
		const input = meta?.input;
		if (!input?.isConnected || !listIsOpen(list)) return;
		const rect = gridPopupAnchorRect(input);
		if (!rect.width || !rect.height) return;
		const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
		const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
		const gap = 5;
		const edge = 10;
		const width = Math.max(180, Math.round(rect.width));
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
			const meta = popupPortals.get(list);
			meta.input = input;
			positionGridPopup(list, meta);
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
		const input = document.activeElement;
		if (isInlineGridInput(input)) {
			const list = findGridPopup(input);
			if (list && listIsOpen(list)) portalGridPopup(input, list);
		}
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

/* ===== END HISTORICAL CONTROLLER: interaction_finish_v2.js ===== */

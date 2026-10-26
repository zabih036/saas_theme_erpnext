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

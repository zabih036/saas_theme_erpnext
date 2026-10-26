/*
 * SaaS Theme — Dashboard icon reliability
 * Provides consistent inline SVG icons when Frappe returns empty or broken icon references.
 */
(function () {
	"use strict";

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

		/* These KPI/metric slots are known to receive missing sprite names on some Frappe builds. */
		scope.querySelectorAll("[data-business-metric] .st-hub-metric-icon, .st-analytics-kpi .st-analytics-kpi-icon")
			.forEach((node) => replace_icon(node, true));

		/* Keep native workspace icons where they render correctly; fill only genuinely empty slots. */
		scope.querySelectorAll(".st-hub-quick-icon, .st-hub-recent-icon")
			.forEach((node) => replace_icon(node, false));
	}

	let timer = null;
	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(() => apply_icons(document), 35);
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

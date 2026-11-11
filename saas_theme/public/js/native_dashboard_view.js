/* Native Frappe ListView Dashboard — Home-inspired presentation only.
 * Owns .dashboard-page .dashboard-view; never touches Workspaces or custom Home.
 * Keep NumberCardWidget/ChartWidget routes, data, dates, menus and editor native.
 */
(() => {
	"use strict";
	if (window.__st_dashboard_view_design_v2__) return;
	window.__st_dashboard_view_design_v2__ = true;

	const ROOT = ".dashboard-view";
	const KPI = ".widget.number-widget-box";
	const featuredIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/></svg>';
	const standardIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 10h17"/></svg>';
	// A decorative visual stroke, not a claim about historical prices or growth.
	const wave = '<svg viewBox="0 0 98 34" fill="none" aria-hidden="true"><path d="M1 28 H46 Q58 28 65 24 T78 14 L87 14 L97 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
	let timer = null;
	let observer = null;

	const visible = node => !!(node && node.isConnected && node.getClientRects().length &&
		!node.classList.contains("hidden"));

	function currentRoot() {
		return Array.from(document.querySelectorAll(ROOT)).find(visible) || null;
	}

	function decorative(parent, className, html) {
		let element = Array.from(parent.children).find(child => child.classList.contains(className));
		if (!element) {
			element = document.createElement("span");
			element.className = className;
			element.setAttribute("aria-hidden", "true");
			element.innerHTML = html;
			parent.appendChild(element);
		}
		return element;
	}

	function enhanceCard(card, index) {
		card.classList.add("st-dv-kpi-v2");
		card.classList.toggle("st-dv-kpi-featured", index === 0);
		const editing = !!card.querySelector(".drag-handle, .edit-button, .show-or-hide-button");
		card.classList.toggle("st-dv-kpi-editing", editing);
		const head = card.querySelector(".widget-head");
		if (!head) return;
		const icon = decorative(head, "st-dv-kpi-icon", index === 0 ? featuredIcon : standardIcon);
		const variant = index === 0 ? "featured" : "standard";
		if (icon.dataset.variant !== variant) {
			icon.innerHTML = index === 0 ? featuredIcon : standardIcon;
			icon.dataset.variant = variant;
		}
		decorative(card, "st-dv-kpi-wave", wave);
		decorative(card, "st-dv-kpi-open", arrow);
	}

	function enhance() {
		const root = currentRoot();
		if (!root) return;
		Array.from(root.querySelectorAll(KPI)).filter(visible).forEach(enhanceCard);
		root.querySelectorAll(".widget.dashboard-widget-box").forEach(card => {
			card.classList.add("st-dv-chart-v2");
		});
	}

	function schedule() {
		if (timer !== null) return;
		timer = setTimeout(() => {
			timer = null;
			enhance();
		}, 45);
	}

	function relatesToKPI(mutation) {
		const target = mutation.target;
		if (target && target.nodeType === 1 &&
			(target.matches?.(KPI) || target.closest?.(KPI))) return true;
		return Array.from(mutation.addedNodes || []).some(node =>
			node.nodeType === 1 && (node.matches?.(KPI + ", .dashboard-view, .widget-group") ||
				node.querySelector?.(KPI))
		);
	}

	function start() {
		enhance();
		if (!observer && document.body && typeof MutationObserver === "function") {
			observer = new MutationObserver(records => {
				if (currentRoot() && records.some(relatesToKPI)) schedule();
			});
			observer.observe(document.body, {childList: true, subtree: true});
		}
		if (window.frappe && typeof frappe.after_ajax === "function") {
			frappe.after_ajax(schedule);
		}
	}

	if (typeof $ !== "undefined") {
		$(document).on("page-change.st_dashboard_view_cards_v2", () => {
			schedule();
			setTimeout(enhance, 200);
			setTimeout(enhance, 650);
		});
		$(document).on("list_view_refresh.st_dashboard_view_cards_v2", schedule);
		$(start);
	} else if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, {once: true});
	} else {
		start();
	}
})();

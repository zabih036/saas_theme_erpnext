/* Native Workspaces — Home-inspired presentation only.
 * Owns only [data-page-route="Workspaces"]; DashboardView has a separate file.
 * No route overrides, data fetches, currency formatting or Frappe widgets patched.
 */
(() => {
	"use strict";
	if (window.__st_workspace_card_design_v2__) return;
	window.__st_workspace_card_design_v2__ = true;

	const ROOT = '[data-page-route="Workspaces"]';
	const KPI = ".widget.number-widget-box";
	const chartIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/></svg>';
	const tileIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 10h17"/></svg>';
	// Decorative stroke, explicitly not a plotted financial series.
	const wave = '<svg viewBox="0 0 98 34" fill="none" aria-hidden="true"><path d="M1 28 H46 Q58 28 65 24 T78 14 L87 14 L97 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	let timer = null;
	let observer = null;

	const visible = node => !!(node && node.isConnected && node.getClientRects().length &&
		!node.closest(".workspace-skeleton") && !node.classList.contains("hidden"));

	function currentRoot() {
		const route = (window.frappe && typeof frappe.get_route === "function") ? frappe.get_route() : [];
		if (route && route.length && route[0] !== "Workspaces") return null;
		return Array.from(document.querySelectorAll(ROOT)).find(visible) || null;
	}

	function decorative(parent, className, inner) {
		let element = Array.from(parent.children).find(child => child.classList.contains(className));
		if (!element) {
			element = document.createElement("span");
			element.className = className;
			element.setAttribute("aria-hidden", "true");
			element.innerHTML = inner;
			parent.appendChild(element);
		}
		return element;
	}

	function styleCard(card, index) {
		card.classList.add("st-ws-kpi-v2");
		card.classList.toggle("st-ws-kpi-featured", index === 0);
		const head = card.querySelector(".widget-head");
		if (!head) return;
		const icon = decorative(head, "st-ws-kpi-icon", index === 0 ? chartIcon : tileIcon);
		const desiredIcon = index === 0 ? "featured" : "standard";
		if (icon.dataset.variant !== desiredIcon) {
			icon.innerHTML = index === 0 ? chartIcon : tileIcon;
			icon.dataset.variant = desiredIcon;
		}
		decorative(card, "st-ws-kpi-wave", wave);
		decorative(card, "st-ws-kpi-open", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>');
		// No invented card descriptions or time-series data.
	}

	function enhance() {
		const root = currentRoot();
		if (!root) return;
		const cards = Array.from(root.querySelectorAll(KPI)).filter(visible);
		cards.forEach((card, index) => styleCard(card, index));
		root.querySelectorAll(".widget.shortcut-widget-box").forEach(card => {
			card.classList.add("st-ws-shortcut-v2");
		});
		root.querySelectorAll(".widget.dashboard-widget-box").forEach(card => {
			card.classList.add("st-ws-chart-v2");
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
			node.nodeType === 1 && (node.matches?.(KPI + ", .ce-block, .widget-group") ||
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
		$(document).on("page-change.st_workspace_cards_v2", schedule);
		$(document).on("desktop_screen.st_workspace_cards_v2", schedule);
		$(start);
	} else if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, {once: true});
	} else {
		start();
	}
})();

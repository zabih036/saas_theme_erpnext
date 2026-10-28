/*
 * SaaS Theme — UI Precision v6
 * Runtime-only repairs for checkbox visibility and the centered AwesomeBar entry.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_ui_precision_v6__) return;
	window.__saas_theme_ui_precision_v6__ = true;

	const state = {
		timer: null,
		observer: null,
		search_sync_timer: null,
	};

	function shortcut_label() {
		try {
			return frappe.utils.is_mac?.() ? "⌘K" : "Ctrl K";
		} catch (e) {
			return "Ctrl K";
		}
	}

	function open_awesomebar(seed = "") {
		const value = String(seed || "");
		const awesomebar = frappe.app?.awesome_bar;

		try {
			if (awesomebar?.open) {
				awesomebar.open();
			} else {
				const trigger = document.querySelector(".navbar-modal-search-mobile");
				trigger?.click?.();
			}
		} catch (error) {
			console.debug("SaaS Theme: AwesomeBar open fallback", error);
			const trigger = document.querySelector(".navbar-modal-search-mobile");
			trigger?.click?.();
		}

		clearTimeout(state.search_sync_timer);
		state.search_sync_timer = setTimeout(() => {
			const $native = $("#navbar-search").first();
			if (!$native.length) return;

			if (value) {
				$native.val(value).trigger("input");
			}
			$native.trigger("focus");
		}, 25);
	}

	function build_header_search() {
		const $slot = $('<div class="st-header-search-slot" role="search"></div>');
		const $shell = $('<div class="st-header-search-shell"></div>');
		const $input = $(
			`<input type="text" class="st-header-search-input" autocomplete="off" spellcheck="false" aria-label="${__(
				"Search or type a command"
			)}" placeholder="${__("Search or type a command")}">`
		);
		const $shortcut = $(`<span class="st-header-search-shortcut" aria-hidden="true"></span>`).text(
			shortcut_label()
		);

		$shell.append($input, $shortcut);
		$slot.append($shell);

		$input.on("focus.saas_v6 click.saas_v6", function () {
			open_awesomebar($(this).val());
		});

		$input.on("input.saas_v6", function () {
			const value = $(this).val();
			if (!value) return;
			open_awesomebar(value);
			$(this).val("");
		});

		$input.on("keydown.saas_v6", function (event) {
			if (event.key === "Escape") {
				event.preventDefault();
				$(this).blur().val("");
				return;
			}

			if (event.key === "Enter") {
				event.preventDefault();
				open_awesomebar($(this).val());
				$(this).val("");
			}
		});

		return $slot;
	}

	function ensure_header_search($head) {
		const $content = $head.find(".page-head-content").first();
		if (!$content.length) return;

		let $slot = $content.children(".st-header-search-slot").first();
		if (!$slot.length) {
			$slot = build_header_search();
			const $title = $content.children(".page-title").first();
			if ($title.length) $slot.insertAfter($title);
			else $content.prepend($slot);
		}

		// The native magnifier stays available as the AwesomeBar trigger behind the
		// scenes, but it should no longer consume visible header space on desktop.
		$head.find("#small-search-button, .st-top-search").attr("aria-hidden", "true");
	}

	function repair_check_control(control) {
		if (!(control instanceof Element)) return;

		const inputArea = control.querySelector(".checkbox .input-area");
		const dispArea = control.querySelector(".checkbox .disp-area");
		if (!inputArea || !dispArea) return;

		const input = inputArea.querySelector('input[type="checkbox"]');
		const inputStateHidden = inputArea.classList.contains("hide");
		const dispStateHidden = dispArea.classList.contains("hide");

		if (inputStateHidden && !dispStateHidden) {
			inputArea.setAttribute("aria-hidden", "true");
			dispArea.setAttribute("aria-hidden", "false");
			return;
		}

		if (dispStateHidden && !inputStateHidden) {
			dispArea.setAttribute("aria-hidden", "true");
			inputArea.setAttribute("aria-hidden", "false");
			return;
		}

		/* If a legacy/theme rule left both areas active, choose the same state that
		   Frappe core uses: writable input when enabled, formatted display when the
		   checkbox input itself is disabled/read-only. */
		if (!inputStateHidden && !dispStateHidden) {
			if (input?.disabled) {
				inputArea.classList.add("hide");
				inputArea.setAttribute("aria-hidden", "true");
				dispArea.classList.remove("hide");
				dispArea.setAttribute("aria-hidden", "false");
			} else {
				dispArea.classList.add("hide");
				dispArea.setAttribute("aria-hidden", "true");
				inputArea.classList.remove("hide");
				inputArea.setAttribute("aria-hidden", "false");
			}
		}
	}

	function repair_checkboxes(root = document) {
		const controls = root.querySelectorAll
			? root.querySelectorAll('.frappe-control[data-fieldtype="Check"]')
			: [];
		controls.forEach(repair_check_control);
	}

	function reset_header_search_inputs() {
		$(".st-header-search-input").val("");
	}

	function refresh(root = document) {
		repair_checkboxes(root);
		$(".page-head:visible").each(function () {
			ensure_header_search($(this));
		});
	}

	function schedule(delay = 15, root = document) {
		clearTimeout(state.timer);
		state.timer = setTimeout(() => {
			refresh(root);
			setTimeout(() => refresh(document), 90);
			setTimeout(() => refresh(document), 260);
		}, delay);
	}

	function setup_observer() {
		if (state.observer || !document.body) return;

		state.observer = new MutationObserver((mutations) => {
			let relevantRoot = null;
			for (const mutation of mutations) {
				if (mutation.type === "attributes") {
					const target = mutation.target;
					if (target?.closest?.('.frappe-control[data-fieldtype="Check"]')) {
						relevantRoot = target.closest('.frappe-control[data-fieldtype="Check"]');
						break;
					}
				}

				for (const node of mutation.addedNodes || []) {
					if (!(node instanceof Element)) continue;
					if (
						node.matches?.('.frappe-control[data-fieldtype="Check"], .page-head') ||
						node.querySelector?.('.frappe-control[data-fieldtype="Check"], .page-head')
					) {
						relevantRoot = node;
						break;
					}
				}
				if (relevantRoot) break;
			}

			if (relevantRoot) schedule(5, relevantRoot);
		});

		state.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class", "disabled"],
		});
	}

	$(document)
		.off("page-change.saas_ui_precision_v6 toolbar_setup.saas_ui_precision_v6 sidebar_setup.saas_ui_precision_v6")
		.on(
			"page-change.saas_ui_precision_v6 toolbar_setup.saas_ui_precision_v6 sidebar_setup.saas_ui_precision_v6",
			() => schedule(5)
		);

	$(document)
		.off("hidden.bs.modal.saas_ui_precision_v6")
		.on("hidden.bs.modal.saas_ui_precision_v6", ".modal", reset_header_search_inputs);

	$(window)
		.off("pageshow.saas_ui_precision_v6 resize.saas_ui_precision_v6")
		.on("pageshow.saas_ui_precision_v6 resize.saas_ui_precision_v6", () => schedule(20));

	$(function () {
		refresh();
		setup_observer();
		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule(5));
		}
	});
})();

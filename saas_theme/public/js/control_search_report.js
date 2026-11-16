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

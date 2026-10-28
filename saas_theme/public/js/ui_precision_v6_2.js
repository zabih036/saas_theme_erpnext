/*
 * SaaS Theme — UI Precision v6.2
 * Follow-up fixes for the header inline search and Query Report filter row.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined") return;
	if (window.__saas_theme_ui_precision_v6_2__) return;
	window.__saas_theme_ui_precision_v6_2__ = true;

	const state = {
		engine: null,
		observer: null,
		timer: null,
	};

	function load_css() {
		if (document.getElementById("st-ui-precision-v6-2-css")) return;
		const link = document.createElement("link");
		link.id = "st-ui-precision-v6-2-css";
		link.rel = "stylesheet";
		link.href = "/assets/saas_theme/css/ui_precision_v6_2.css?v=1";
		document.head.appendChild(link);
	}

	function clean_text(value) {
		return String(value || "").replace(/\s+/g, " ").trim();
	}

	function strip_html(value) {
		const holder = document.createElement("div");
		holder.innerHTML = String(value || "");
		return clean_text(holder.textContent || holder.innerText || "");
	}

	function get_engine() {
		if (
			frappe.app?.awesome_bar &&
			typeof frappe.app.awesome_bar.get_options === "function" &&
			typeof frappe.app.awesome_bar.open_option === "function"
		) {
			return frappe.app.awesome_bar;
		}

		if (!state.engine && frappe.search?.AwesomeBar) {
			try {
				state.engine = new frappe.search.AwesomeBar();
				frappe.search?.utils?.setup_recent?.();
			} catch (error) {
				console.debug("SaaS Theme: could not initialize inline search engine", error);
			}
		}

		return state.engine;
	}

	function close_results(input) {
		const shell = input?.closest?.(".st-header-search-shell");
		const results = shell?.querySelector?.(".st-v62-search-results");
		if (results) {
			results.classList.remove("is-open");
			results.innerHTML = "";
		}
		if (input?._stV62Search) input._stV62Search.active = -1;
	}

	function open_option(input, option, event) {
		if (!option) return;
		const engine = get_engine();

		try {
			if (engine?.open_option) {
				engine.open_option(option, {
					ctrlKey: !!event?.ctrlKey,
					metaKey: !!event?.metaKey,
					preventDefault() {},
					stopPropagation() {},
				});
			} else if (option.onclick) {
				option.onclick(option.match);
			} else if (option.route) {
				frappe.set_route(option.route);
			}
		} finally {
			input.value = "";
			close_results(input);
			input.blur();
		}
	}

	function fallback_global_search(query) {
		if (!query) return;
		try {
			frappe.searchdialog?.search?.init_search?.(query, "global_search");
		} catch (error) {
			console.debug("SaaS Theme: global search fallback unavailable", error);
		}
	}

	function mark_active(input, index) {
		const data = input._stV62Search;
		if (!data) return;
		const items = Array.from(data.results.querySelectorAll(".st-v62-search-result"));
		if (!items.length) {
			data.active = -1;
			return;
		}

		data.active = Math.max(0, Math.min(index, items.length - 1));
		items.forEach((item, item_index) => {
			item.classList.toggle("is-active", item_index === data.active);
			item.setAttribute("aria-selected", item_index === data.active ? "true" : "false");
		});
		items[data.active]?.scrollIntoView?.({ block: "nearest" });
	}

	function render_results(input, options, query) {
		const data = input._stV62Search;
		if (!data) return;

		data.options = Array.isArray(options) ? options.slice(0, 12) : [];
		data.active = data.options.length ? 0 : -1;
		data.results.innerHTML = "";

		if (!data.options.length) {
			if (query) {
				const empty = document.createElement("div");
				empty.className = "st-v62-search-empty";
				empty.textContent = __("No direct match. Press Enter to search.");
				data.results.appendChild(empty);
				data.results.classList.add("is-open");
			} else {
				data.results.classList.remove("is-open");
			}
			return;
		}

		data.options.forEach((option, index) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "st-v62-search-result";
			button.setAttribute("role", "option");
			button.setAttribute("aria-selected", index === 0 ? "true" : "false");

			const main = document.createElement("span");
			main.className = "st-v62-search-result-title";
			main.textContent = strip_html(option.label || option.value || __("Result"));

			const meta_text = strip_html(
				option.description || option.default || option.type || ""
			);
			button.appendChild(main);

			if (meta_text && meta_text !== main.textContent) {
				const meta = document.createElement("span");
				meta.className = "st-v62-search-result-meta";
				meta.textContent = meta_text;
				button.appendChild(meta);
			}

			button.addEventListener("mousedown", (event) => {
				event.preventDefault();
				open_option(input, option, event);
			});

			button.addEventListener("mouseenter", () => mark_active(input, index));
			data.results.appendChild(button);
		});

		data.results.classList.add("is-open");
	}

	function query_options(input) {
		const data = input._stV62Search;
		if (!data) return;

		const query = clean_text(input.value);
		const request_id = ++data.seq;
		const engine = get_engine();
		let options = [];

		try {
			options = engine?.get_options ? engine.get_options(query) || [] : [];
		} catch (error) {
			console.debug("SaaS Theme: inline search options unavailable", error);
		}

		render_results(input, options, query);

		if (
			query.length > 1 &&
			frappe.boot?.has_awesomebar_search &&
			typeof engine?.get_hook_results === "function"
		) {
			engine
				.get_hook_results(query)
				.then((hook_results) => {
					if (request_id !== data.seq || !Array.isArray(hook_results)) return;
					const merged =
						typeof engine.merge_hook_results === "function"
							? engine.merge_hook_results(options, hook_results)
							: options.concat(hook_results);
					render_results(input, merged, query);
				})
				.catch(() => {});
		}
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
		if (!original_input || original_input.dataset.stV62SearchReady === "1") return;

		let input = normalize_old_search(original_input);
		if (input.dataset.stV62SearchReady === "1") return;
		input.dataset.stInlineSearchReady = "1";
		input.dataset.stV62SearchReady = "1";

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

		const schedule_query = () => {
			clearTimeout(input._stV62Search.debounce);
			input._stV62Search.debounce = setTimeout(() => query_options(input), 65);
		};

		$(input)
			.on("input.saas_v62", schedule_query)
			.on("focus.saas_v62", () => {
				schedule_query();
				input.setAttribute("aria-expanded", "true");
			})
			.on("blur.saas_v62", () => {
				setTimeout(() => {
					close_results(input);
					input.setAttribute("aria-expanded", "false");
				}, 120);
			})
			.on("keydown.saas_v62", (event) => {
				const data = input._stV62Search;
				if (!data) return;

				if (event.key === "ArrowDown") {
					event.preventDefault();
					mark_active(input, data.active < 0 ? 0 : data.active + 1);
					return;
				}

				if (event.key === "ArrowUp") {
					event.preventDefault();
					mark_active(input, data.active <= 0 ? data.options.length - 1 : data.active - 1);
					return;
				}

				if (event.key === "Enter") {
					event.preventDefault();
					const option = data.options[data.active >= 0 ? data.active : 0];
					if (option) open_option(input, option, event);
					else fallback_global_search(clean_text(input.value));
					return;
				}

				if (event.key === "Escape") {
					event.preventDefault();
					close_results(input);
					input.blur();
				}
			});
	}

	function setup_all_search_inputs() {
		document.querySelectorAll(".page-head .st-header-search-input").forEach(setup_search_input);
	}

	function repair_report_filter_row() {
		document.querySelectorAll("#page-query-report .report-wrapper .datatable").forEach((table) => {
			const headers = Array.from(table.querySelectorAll(".dt-row-header .dt-cell"));
			table.querySelectorAll(".dt-row-filter").forEach((filter_row) => {
				Array.from(filter_row.querySelectorAll(":scope > .dt-cell")).forEach((cell, index) => {
					const content = cell.querySelector(".dt-cell__content");
					const input = cell.querySelector("input.dt-filter, input.dt-input, input");
					if (!input || !content) return;

					const header = headers[index];
					const header_text = clean_text(header?.textContent || "");
					const cell_width = Math.round(cell.getBoundingClientRect().width);
					const utility =
						!header_text || cell_width < 58 || /^(no\.?|#|sr\.?|select)$/i.test(header_text);

					cell.classList.toggle("st-v62-filter-utility", utility);
					if (utility) {
						input.style.setProperty("display", "none", "important");
						return;
					}

					input.style.removeProperty("display");
					content.style.setProperty("width", "100%", "important");
					content.style.setProperty("max-width", "100%", "important");
					content.style.setProperty("box-sizing", "border-box", "important");

					if (cell_width > 20) {
						const target_width = Math.max(32, cell_width - 14);
						input.style.setProperty("width", `${target_width}px`, "important");
						input.style.setProperty("min-width", `${target_width}px`, "important");
						input.style.setProperty("max-width", `${target_width}px`, "important");
					}

					input.setAttribute("placeholder", __("Filter"));
					input.setAttribute("aria-label", __("Filter {0}", [header_text]));
				});
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
			let relevant = false;
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes || []) {
					if (!(node instanceof Element)) continue;
					if (
						node.matches?.(".st-header-search-input, .datatable, .dt-row-filter") ||
						node.querySelector?.(".st-header-search-input, .datatable, .dt-row-filter")
					) {
						relevant = true;
						break;
					}
				}
				if (relevant) break;
			}
			if (relevant) schedule(10);
		});
		state.observer.observe(document.body, { childList: true, subtree: true });
	}

	function start() {
		load_css();
		refresh();
		setup_observer();

		$(document)
			.off("page-change.saas_v62 toolbar_setup.saas_v62")
			.on("page-change.saas_v62 toolbar_setup.saas_v62", () => schedule(10));

		$(window)
			.off("resize.saas_v62 pageshow.saas_v62")
			.on("resize.saas_v62 pageshow.saas_v62", () => schedule(20));

		if (typeof frappe.after_ajax === "function") {
			frappe.after_ajax(() => schedule(10));
		}
	}

	let attempts = 0;
	(function wait_for_v6() {
		if (window.__saas_theme_ui_precision_v6_1__ || attempts > 100) {
			start();
			return;
		}
		attempts += 1;
		setTimeout(wait_for_v6, 50);
	})();
})();
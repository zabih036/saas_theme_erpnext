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

	function load_css() {
		let link = document.getElementById("st-ui-precision-v6-2-css");
		if (link) {
			link.href = "/assets/saas_theme/css/ui_precision_v6_2.css?v=2";
			return;
		}
		link = document.createElement("link");
		link.id = "st-ui-precision-v6-2-css";
		link.rel = "stylesheet";
		link.href = "/assets/saas_theme/css/ui_precision_v6_2.css?v=2";
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

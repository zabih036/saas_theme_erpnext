#!/usr/bin/env node
"use strict";
/* Run native Workspace and Dashboard enhancers in a minimal Frappe-like DOM.
 * Assert no duplicate decoration, no content changes, correct page isolation,
 * async redraws, native menu preservation, and first visible KPI selection.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

class Element {
	constructor(classes = []) {
		this.classes = new Set(classes);
		this.children = [];
		this.dataset = {};
		this.nodeType = 1;
		this.isConnected = true;
		this.hidden = false;
		this.textContent = "Original Frappe value untouched";
		this.parentElement = null;
		this.classList = {
			add: (...values) => values.forEach(v => this.classes.add(v)),
			remove: (...values) => values.forEach(v => this.classes.delete(v)),
			contains: value => this.classes.has(value),
			toggle: (value, state) => {
				if (state) this.classes.add(value);
				else this.classes.delete(value);
				return state;
			},
		};
	}
	set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
	get className() { return [...this.classes].join(" "); }
	setAttribute(name, value) { this[name] = value; }
	getClientRects() { return this.hidden ? [] : [{}]; }
	appendChild(node) { this.children.push(node); node.parentElement = this; return node; }
	matches(sel) {
		return sel.split(",").some(part => {
			const cls = [...part.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(x => x[1]);
			return cls.length > 0 && cls.every(c => this.classes.has(c));
		});
	}
	closest(sel) {
		let at = this;
		while (at) {
			if (at.matches(sel)) return at;
			at = at.parentElement;
		}
		return null;
	}
	querySelector(selector) {
		if (selector === ".widget-head") return this.head || null;
		if (selector.includes(".drag-handle")) return this.editing ? {} : null;
		return null;
	}
	querySelectorAll(selector) {
		if (selector === ".widget.number-widget-box") return this.kpis || [];
		if (selector === ".widget.shortcut-widget-box") return this.shortcuts || [];
		if (selector === ".widget.dashboard-widget-box") return this.charts || [];
		return [];
	}
}
function makeCard() {
	const card = new Element(["widget", "number-widget-box"]);
	const head = new Element(["widget-head"]);
	const control = new Element(["widget-control"]);
	const body = new Element(["widget-body"]);
	head.appendChild(control);
	card.appendChild(head);
	card.appendChild(body);
	card.head = head;
	return {card, head, control, body};
}
function testScript(filename, kind) {
	const source = fs.readFileSync(
		path.join(__dirname, "..", "saas_theme/public/js", filename), "utf8"
	);
	new vm.Script(source, {filename});
	const root = new Element(kind === "dashboard" ? ["dashboard"] : ["root"]);
	const page = new Element(["content", "page-container"]);
	page.id = "page-dashboard-view";
	const graph = new Element(["dashboard-graph"]);
	const group = new Element(["widget-group"]);
	const groupBody = new Element(["widget-group-body", "grid-col-3"]);
	if (kind === "dashboard") {
		page.appendChild(root);
		root.appendChild(graph);
		graph.appendChild(group);
		group.appendChild(groupBody);
	}
	const first = makeCard();
	const second = makeCard();
	const outside = makeCard();
	root.kpis = [first.card, second.card];
	if (kind === "dashboard") {
		groupBody.appendChild(first.card);
		groupBody.appendChild(second.card);
		assert.equal(first.card.closest(".dashboard-graph"), graph,
			"Frappe's actual Accounts Dashboard widget hierarchy must be represented");
	}
	root.charts = [new Element(["widget", "dashboard-widget-box"])];
	root.shortcuts = [new Element(["widget", "shortcut-widget-box"])];
	const original = [first, second].map(x => x.card.textContent);
	let route = kind === "dashboard" ? ["dashboard-view", "Accounts"] : ["Workspaces", "Buying"];
	const timers = [];
	const observers = [];
	const actions = {};
	const callbacks = [];
	let decoratorCreated = 0;
	const doc = {
		body: new Element(["body"]),
		readyState: "complete",
		querySelectorAll(selector) {
			if (kind === "workspace" && selector === '[data-page-route="Workspaces"]') return [root];
			if (kind === "dashboard" && selector === "#page-dashboard-view .dashboard") return [root];
			return [];
		},
		createElement(tag) {
			assert.equal(tag, "span");
			decoratorCreated += 1;
			return new Element();
		},
	};
	const frappe = {
		get_route: () => route,
		after_ajax: cb => callbacks.push(cb),
	};
	const jquery = arg => {
		if (typeof arg === "function") {
			arg();
			return;
		}
		assert.equal(arg, doc);
		return {
			on(event, callback) { actions[event] = callback; return this; },
		};
	};
	const context = {
		window: {frappe},
		frappe,
		document: doc,
		$: jquery,
		MutationObserver: class {
			constructor(cb) { this.cb = cb; observers.push(this); }
			observe(target, args) {
				assert.equal(target, doc.body);
				assert.equal(args.subtree, true);
				assert.equal(args.childList, true);
			}
		},
		setTimeout(fn) { timers.push(fn); return timers.length; },
		console,
	};
	vm.runInNewContext(source, context, {filename});
	const key = kind === "workspace" ? "ws" : "dv";
	assert.equal(observers.length, 1);
	assert.equal(callbacks.length, 1);
	assert.equal(first.card.classList.contains("st-" + key + "-kpi-v2"), true);
	assert.equal(second.card.classList.contains("st-" + key + "-kpi-v2"), true);
	assert.equal(first.card.classList.contains("st-" + key + "-kpi-featured"), true);
	assert.equal(second.card.classList.contains("st-" + key + "-kpi-featured"), false);
	assert.equal(root.charts[0].classList.contains("st-" + key + "-chart-v2"), true);
	assert.equal(first.head.children.includes(first.control), true, "Native widget menu must remain");
	assert.equal(first.body.parentElement, first.card, "Native click target must remain");
	assert.equal(first.card.textContent, original[0], "Original financial value not modified");
	assert.equal(second.card.textContent, original[1], "Original financial value not modified");
	assert.equal(outside.card.children.length, 2, "Outside page remains unmodified");
	const expected = decoratorCreated;
	assert.equal(expected, 6, "Three presentation elements per card");
	// Rerunning script is protected by window sentinel.
	vm.runInNewContext(source, context, {filename});
	assert.equal(observers.length, 1);
	const event = Object.keys(actions).find(s => s.startsWith("page-change."));
	assert.ok(event);
	actions[event]();
	while (timers.length) timers.shift()();
	assert.equal(decoratorCreated, expected, "No duplicate icon/wave/arrow on refresh");
	observers[0].cb([{target: first.card, addedNodes: []}]);
	while (timers.length) timers.shift()();
	assert.equal(decoratorCreated, expected, "No duplicate nodes after widget data refresh");
	// The next visible KPI becomes featured when the leading KPI disappears.
	first.card.hidden = true;
	actions[event]();
	while (timers.length) timers.shift()();
	assert.equal(second.card.classList.contains("st-" + key + "-kpi-featured"), true);
	// No scope leakage when leaving the active Desk route.
	if (kind === "workspace") {
		route = ["Form", "Sales Invoice", "ACC-0001"];
		const third = makeCard();
		root.kpis.push(third.card);
		actions[event]();
		while (timers.length) timers.shift()();
		assert.equal(third.card.classList.contains("st-ws-kpi-v2"), false);
	} else {
		route = ["List", "Sales Invoice", "List"];
		const third = makeCard();
		groupBody.appendChild(third.card);
		root.kpis.push(third.card);
		actions[event]();
		while (timers.length) timers.shift()();
		assert.equal(third.card.classList.contains("st-dv-kpi-v2"), false,
			"Inactive native Dashboard must not decorate another route");
	}
	console.log(filename + ": page scoping, featured KPI, async refresh, no duplicates, native menus preserved");
}

testScript("workspace_dashboard.js", "workspace");
testScript("native_dashboard_view.js", "dashboard");

#!/usr/bin/env node
"use strict";
/* Frappe v16 sidebar shell smoke test: no dependency on browser/jsdom. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
	path.join(__dirname, "../saas_theme/public/js/workspace_sidebar_design.js"), "utf8"
);
new vm.Script(source);

class Node {
	constructor(tag, classes = []) {
		this.tag = tag;
		this.classes = new Set(classes);
		this.children = [];
		this.parentElement = null;
		this.nodeType = 1;
		this.isConnected = true;
		this.handlers = {};
		this.attributes = {};
		this.classList = {
			add: c => this.classes.add(c),
			remove: c => this.classes.delete(c),
			contains: c => this.classes.has(c),
			toggle: (c, flag) => {
				if (flag) this.classes.add(c);
				else this.classes.delete(c);
			},
		};
	}
	set className(value) { this.classes = new Set(String(value).split(/\s+/)); }
	get className() { return [...this.classes].join(" "); }
	setAttribute(k,v) { this.attributes[k] = v; }
	append(...nodes) {
		for(const n of nodes) {n.parentElement=this;this.children.push(n);}
	}
	appendChild(n) {this.append(n);}
	prepend(n) {
		n.parentElement = this;
		this.children.unshift(n);
	}
	getClientRects() { return this.hidden ? [] : [{}]; }
	querySelector(sel) {
		if (sel === ".body-sidebar") return this.children.find(n => n.classes.has("body-sidebar")) || null;
		if (sel === ":scope > .st-sidebar-search") return this.children.find(n => n.classes.has("st-sidebar-search")) || null;
		if (sel === ":scope > .sidebar-header") return this.children.find(n => n.classes.has("sidebar-header")) || null;
		if (sel === ":scope > .standard-items-band") return this.children.find(n => n.classes.has("standard-items-band")) || null;
		if (sel === ":scope > .body-sidebar-top") return this.children.find(n => n.classes.has("body-sidebar-top")) || null;
		return null;
	}
	get nextElementSibling() {
		if (!this.parentElement) return null;
		const a = this.parentElement.children;
		return a[a.indexOf(this) + 1] || null;
	}
	get previousElementSibling() {
		if (!this.parentElement) return null;
		const a = this.parentElement.children;
		return a[a.indexOf(this) - 1] || null;
	}
	after(n) {
		const a = this.parentElement.children;
		if (n.parentElement) {
			const prev = n.parentElement.children;
			prev.splice(prev.indexOf(n),1);
		}
		a.splice(a.indexOf(this)+1,0,n);
		n.parentElement=this.parentElement;
	}
	before(n) {
		const a=this.parentElement.children;
		if(n.parentElement){
			const prev=n.parentElement.children;
			prev.splice(prev.indexOf(n),1);
		}
		a.splice(a.indexOf(this),0,n);
		n.parentElement=this.parentElement;
	}
	addEventListener(k,fn) {this.handlers[k]=fn;}
	closest(sel) { return null; }
}

const sidebar = new Node("div", ["body-sidebar"]);
const header = new Node("div", ["sidebar-header"]);
const band = new Node("div", ["standard-items-band"]);
const list = new Node("div", ["body-sidebar-top"]);
const bottom = new Node("div", ["body-sidebar-bottom"]);
sidebar.append(header, band, list, bottom);
const panel = new Node("div", ["body-sidebar-container", "expanded"]);
panel.append(sidebar);
const body = new Node("body",[]);
const listeners = {};
const document = {
	body,
	readyState: "complete",
	querySelectorAll(sel) {
		return sel === ".body-sidebar-container" ? [panel] : [];
	},
	querySelector() { return null; },
	createElement(tag) {return new Node(tag);},
	addEventListener(name,fn) {listeners[name] = fn;},
};
let dialogs=0;
let mobile=false;
const frappe = {
	is_mobile:()=>mobile,
	searchdialog:{search:{open_global_search_dialog(){dialogs += 1;}}},
};
const window = {
	frappe,
	addEventListener(name,fn){listeners["window:"+name]=fn;},
	matchMedia(){return {matches:mobile};},
};
const events = {};
const timeouts = [];
const dollar = value => {
	if(typeof value==="function"){value();return;}
	return {on(name,fn){for(const key of name.split(" "))events[key]=fn;return this;}};
};
window.$ = dollar;
const context = {
	window, document, frappe, $:dollar,
	setTimeout(fn){timeouts.push(fn);return timeouts.length;},
	clearTimeout(){},
	MutationObserver:class {
		constructor(cb){this.callback=cb;}
		observe(t,opts){assert.equal(t,body);assert.equal(opts.childList,true);}
	},
};
function runTimers() {
	// A throttled refresh should not re-append or duplicate the search.
	for(let n=0;timeouts.length&&n<10;n++)timeouts.shift()();
	assert.equal(timeouts.length,0);
}
vm.runInNewContext(source,context);
assert.equal(window.__st_modern_sidebar_v1__, true);
assert.equal(panel.classList.contains("st-sidebar-modern"),true);
assert.equal(body.classList.contains("st-sidebar-search-available"),true);
let controls = sidebar.children.filter(x=>x.classList.contains("st-sidebar-search"));
assert.equal(controls.length,1);
assert.equal(sidebar.children[1],controls[0],"Search must follow native SidebarHeader");
let button = controls[0].children[0];
assert.equal(button.type, "button");
assert.equal(button.attributes["aria-label"],"Search");
assert.equal(button.children.length,3);
button.handlers.click({preventDefault(){},stopPropagation(){}});
assert.equal(dialogs,1,"Click should open Frappe's actual global search");

// / keyboard search works without stealing input editing.
listeners.keydown({
	key:"/",target:{isContentEditable:false,closest(){return null;}},
	ctrlKey:false,altKey:false,metaKey:false,defaultPrevented:false,
	preventDefault(){}
});
assert.equal(dialogs,2);
listeners.keydown({
	key:"/",target:{isContentEditable:false,closest(){return {};}},
	ctrlKey:false,altKey:false,metaKey:false,defaultPrevented:false,
	preventDefault(){throw Error("Must not steal typing in inputs");}
});
assert.equal(dialogs,2);

events["sidebar_setup.st_sidebar_modern"]();
runTimers();
controls = sidebar.children.filter(x=>x.classList.contains("st-sidebar-search"));
assert.equal(controls.length,1,"Rebuilding a sidebar must not duplicate Search");

// Navbar search returns when sidebar collapses.
panel.classList.remove("expanded");
events["sidebar-expand.st_sidebar_modern"]();
runTimers();
assert.equal(body.classList.contains("st-sidebar-search-available"),false);
panel.classList.add("expanded");
events["page-change.st_sidebar_modern"]();
runTimers();
assert.equal(body.classList.contains("st-sidebar-search-available"),true);

// Mobile drawer retains top-navbar access and search inside the drawer.
mobile = true;
events["page-change.st_sidebar_modern"]();
runTimers();
assert.equal(body.classList.contains("st-sidebar-search-available"),false);
button.handlers.click({preventDefault(){},stopPropagation(){}});
assert.equal(dialogs,3);
assert.equal(sidebar.children[1],controls[0],"Native sidebar menus must remain in place");

vm.runInNewContext(source,context);
assert.equal(sidebar.children.filter(x=>x.classList.contains("st-sidebar-search")).length,1);
console.log("Sidebar smoke checks passed: native SearchDialog, route lifecycle, collapse/mobile, no duplication.");

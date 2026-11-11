#!/usr/bin/env node
"use strict";
/* Regression for Frappe v16's *real* Desk header search and Home boundary.
   No browser dependency: tests native control IDs, generic search input,
   route recreation, Home preservation and mobile restore. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const code = fs.readFileSync(path.join(__dirname,"../saas_theme/public/js/desk_header_search.js"),"utf8");
new vm.Script(code);

class Element {
	constructor({name="div",id="",classes=[],text="",placeholder="",home=false}={}) {
		this.nodeType=1; this.name=name;this.id=id;this.textContent=text;
		this.placeholder=placeholder;this.home=home;this.attrs={};this.isConnected=true;
		this.classes=new Set(classes);
		this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),contains:x=>this.classes.has(x)};
		const props=new Map();
		this.style={
			setProperty:(k,v,p="")=>props.set(k,{v,p}),
			getPropertyValue:k=>props.get(k)?.v||"",
			getPropertyPriority:k=>props.get(k)?.p||"",
			removeProperty:k=>props.delete(k),
		};
	}
	getAttribute(k){if(k==="placeholder")return this.placeholder||null;return this.attrs[k]??null;}
	setAttribute(k,v){this.attrs[k]=String(v);}
	removeAttribute(k){delete this.attrs[k];}
	matches(sel){return sel===this.name;}
	closest(sel){return sel.includes(".desktop-wrapper")&&this.home?{id:"home"}:null;}
	querySelectorAll(){return [];}
	getClientRects(){return [{}];}
}
let mobile=false;
const native=new Element({name:"button",id:"full-search-button",text:"Search or type a command Ctrl K"});
const small=new Element({name:"button",id:"small-search-button",text:"Search"});
const generic=new Element({name:"input",placeholder:"Search or type a command"});
const filter=new Element({name:"input",placeholder:"Filter by supplier"});
const profile=new Element({name:"button",text:"Profile"});
const homeSearch=new Element({name:"button",id:"search-widget-button",text:"Search"});
let headNodes=[native,small,generic,filter,profile];
const head=new Element({classes:["page-head"]});
head.querySelectorAll=selector=>{
	if(selector.includes("#full-search-button"))return headNodes.filter(e=>e.id==="full-search-button"||e.id==="small-search-button");
	if(selector.includes('input[placeholder]'))return headNodes;
	if(selector.startsWith(".st-desk-command-search-hidden"))return headNodes.filter(e=>e.classList.contains("st-desk-command-search-hidden"));
	return [];
};
const document={
	body:new Element({name:"body"}),
	readyState:"complete",
	querySelectorAll:selector=>selector===".page-container .page-head"?[head]:[],
	addEventListener(){},
};
let callbacks={},tasks=[],tid=0;
const setTimeout=fn=>{tasks.push(fn);return ++tid;};
const clearTimeout=()=>{};
const flush=()=>{let n=0;while(tasks.length&&n++<40)tasks.shift()();assert.equal(tasks.length,0);};
const $=v=>{
	if(typeof v==="function"){v();return;}
	return {on(spec,callback){for(const event of spec.split(" "))callbacks[event]=callback;}};
};
const window={matchMedia(){return {matches:mobile};},$,
	addEventListener(event,callback){callbacks["window:"+event]=callback;}};
vm.runInNewContext(code,{window,document,$,setTimeout,clearTimeout,MutationObserver:class{
	constructor(callback){this.callback=callback;}
	observe(target,opts){assert.equal(target,document.body);assert.equal(opts.childList,true);}
}});
assert.equal(window.__st_desk_header_search_scope_v1__,true);
assert.equal(native.style.getPropertyValue("display"),"none","Frappe #full-search-button must disappear");
assert.equal(native.style.getPropertyPriority("display"),"important");
assert.equal(small.style.getPropertyValue("display"),"none","Native small search hidden only on desktop");
assert.equal(generic.style.getPropertyValue("display"),"none","Exact command-input text also hidden");
assert.equal(filter.style.getPropertyValue("display"),"","Document filter remains");
assert.equal(profile.style.getPropertyValue("display"),"","Profile button remains");
assert.equal(homeSearch.style.getPropertyValue("display"),"","Home navbar search remains available");
assert.equal(native.getAttribute("aria-hidden"),"true");
assert.equal(generic.classList.contains("st-desk-command-search-hidden"),true);

// A Form refresh can recreate the exact global trigger after initial paint.
const late=new Element({name:"button",text:"Search or type a command Ctrl K"});
headNodes.push(late);
callbacks["form-refresh.st_desk_header_search"]();
flush();
assert.equal(late.style.getPropertyValue("display"),"none","Late Form/global field hidden");

// Home route may still have a separate native .desktop-navbar.
assert.equal(homeSearch.style.getPropertyValue("display"),"");
assert.equal(homeSearch.classList.contains("st-desk-command-search-hidden"),false);

// The original mobile fallback is restored when viewport becomes narrow.
mobile=true;
callbacks["window:resize"]();
flush();
for(const el of [native,small,generic,late]){
	assert.equal(el.style.getPropertyValue("display"),"");
	assert.equal(el.getAttribute("aria-hidden"),null);
}
mobile=false;
callbacks["page-change.st_desk_header_search"]();flush();
assert.equal(native.style.getPropertyValue("display"),"none");
assert.equal(homeSearch.style.getPropertyValue("display"),"");
console.log("Desk header search scope: exact Frappe controls, late forms, Home search, mobile fallback and action safety passed.");

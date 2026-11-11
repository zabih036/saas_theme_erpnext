#!/usr/bin/env node
"use strict";
/* Browserless Frappe v16 Sidebar integration regression: inline dropdown,
   permission-aware sources, asynchronous stale guard and no modal. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const code = fs.readFileSync(path.join(__dirname, "../saas_theme/public/js/workspace_sidebar_design.js"),"utf8");
new vm.Script(code);

class Element {
	constructor(tag="div",classes=[]) {
		this.tagName=tag.toUpperCase();this.nodeType=1;this.children=[];this.parentElement=null;
		this.classes=new Set(classes);this.attributes={};this.handlers={};this.hidden=false;
		this.isConnected=true;this.textContent="";this.value="";this.id="";
		this.classList={
			add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),
			contains:x=>this.classes.has(x),toggle:(x,on)=>{
				if(on)this.classes.add(x);else this.classes.delete(x);
			},
		};
	}
	set className(v){this.classes=new Set(String(v).split(/\s+/).filter(Boolean));}
	get className(){return [...this.classes].join(" ");}
	setAttribute(k,v){this.attributes[k]=String(v);}
	removeAttribute(k){delete this.attributes[k];}
	getAttribute(k){return this.attributes[k]||null;}
	getClientRects(){return this.hidden?[]:[{}];}
	append(...nodes){
		for(const n of nodes){this.detach(n);n.parentElement=this;this.children.push(n);}
	}
	detach(n){
		if(n.parentElement){const a=n.parentElement.children;a.splice(a.indexOf(n),1);}
	}
	appendChild(n){this.append(n);}
	prepend(n){this.detach(n);n.parentElement=this;this.children.unshift(n);}
	after(n){const p=this.parentElement;if(!p)throw Error("detached");this.detach(n);const a=p.children;a.splice(a.indexOf(this)+1,0,n);n.parentElement=p;}
	before(n){const p=this.parentElement;if(!p)throw Error("detached");this.detach(n);const a=p.children;a.splice(a.indexOf(this),0,n);n.parentElement=p;}
	replaceChildren(...nodes){this.children=[];this.append(...nodes);}
	get nextElementSibling(){if(!this.parentElement)return null;return this.parentElement.children[this.parentElement.children.indexOf(this)+1]||null;}
	get previousElementSibling(){if(!this.parentElement)return null;return this.parentElement.children[this.parentElement.children.indexOf(this)-1]||null;}
	querySelector(s){
		if(s===".body-sidebar")return this.children.find(n=>n.classes.has("body-sidebar"))||null;
		if(s.startsWith(":scope > ")) {
			const all=s.split(",").map(x=>x.trim().replace(":scope > .",""));
			return this.children.find(n=>all.some(cls=>n.classes.has(cls)))||null;
		}
		if(s===".sidebar-item-label")return this.children.find(n=>n.classes.has("sidebar-item-label"))||null;
		return null;
	}
	querySelectorAll(s){
		if(s===".sidebar-items a.item-anchor[href]")return this.links||[];
		if(s===".st-sidebar-search-option")return this.children.filter(n=>n.classes.has("st-sidebar-search-option"));
		return [];
	}
	closest(s){if(s===".hidden, [hidden]")return null;return null;}
	matches(s){if(s===".body-sidebar-container")return this.classes.has("body-sidebar-container");return false;}
	contains(n){return n===this||this.children.some(x=>x.contains(n));}
	addEventListener(k,fn){this.handlers[k]=fn;}
	click(){this.clicked=(this.clicked||0)+1;this.handlers.click?.({preventDefault(){},stopPropagation(){}});}
	focus(){this.focused=true;this.handlers.focus?.();}
	scrollIntoView(){}
}

async function main(){
	const panel=new Element("div",["body-sidebar-container","expanded"]);
	const sidebar=new Element("div",["body-sidebar"]);
	const header=new Element("div",["sidebar-header"]);
	const band=new Element("div",["standard-items-band"]);
	const menu=new Element("div",["body-sidebar-top"]);
	const bottom=new Element("div",["body-sidebar-bottom"]);
	sidebar.append(header,band,menu,bottom);panel.append(sidebar);
	const a=new Element("a",["item-anchor"]);
	a.setAttribute("href","/desk/manufacturing");
	const caption=new Element("span",["sidebar-item-label"]);caption.textContent="Manufacturing";
	a.append(caption);panel.links=[a];
	const body=new Element("body");
	const handlers={};
	const doc={
		body,readyState:"complete",
		createElement:tag=>new Element(tag),
		querySelectorAll:s=>s===".body-sidebar-container"?[panel]:[],
		addEventListener:(name,handler)=>handlers[name]=handler,
	};
	const tasks=[];const cancelled=new Set();let taskID=0;
	const later=fn=>{const id=++taskID;tasks.push({id,fn});return id;};
	const flush=()=>{for(let i=0;tasks.length&&i<30;i++){const t=tasks.shift();if(!cancelled.has(t.id))t.fn();}assert.equal(tasks.length,0);}
	const events={};
	const $=value=>typeof value==="function"?(value(),null):{
		on(spec,fn){for(const key of spec.split(" "))events[key]=fn;return this;}
	};
	const routes=[];
	let modal=0;
	let mobile=false;
	const requestResolvers={};
	const utils={
		get_doctypes(query){return query.toLowerCase().includes("invoice")?[{value:"Purchase Invoice List",route:["List","Purchase Invoice"],type:"List"}]:[];},
		get_reports(){return [];},get_workspaces(){return [];},get_dashboards(){return [];},
		get_global_results(query){return new Promise(resolve=>{requestResolvers[query]=resolve;});},
	};
	const frappe={
		is_mobile(){return mobile;},
		app:{sidebar:{open(){panel.classList.add("expanded");}}},
		set_route(...route){routes.push(route);},
		search:{utils},
		searchdialog:{search:{open_global_search_dialog(){modal+=1;}}},
	};
	const window={frappe,$,addEventListener:()=>{},matchMedia:()=>({matches:mobile})};
	vm.runInNewContext(code,{document:doc,window,frappe,$,setTimeout:later,
		clearTimeout:id=>cancelled.add(id),console});
	assert.equal(window.__st_sidebar_inline_search_v2__,true);
	assert.equal(panel.classList.contains("st-sidebar-modern"),true);
	assert.equal(body.classList.contains("st-sidebar-search-available"),true);
	assert.equal(sidebar.children.filter(n=>n.className==="st-sidebar-search").length,1);
	const shell=sidebar.children[1];
	const control=shell.children[0],popover=shell.children[1];
	const trigger=control.children[0],input=control.children[1],list=popover.children[0];
	assert.equal(input.tagName,"INPUT");
	assert.equal(input.attributes.role,"combobox");
	assert.equal(input.attributes["aria-controls"],list.id);
	assert.equal(popover.hidden,true);
	trigger.click();
	assert.equal(modal,0,"Sidebar click must never open global-search modal");
	assert.equal(input.focused,true);
	assert.equal(popover.hidden,false);
	assert.equal(input.attributes["aria-expanded"],"true");
	assert.equal(list.children.length,1,"Empty query lists existing permitted navigation");
	assert.equal(list.children[0].children[0].textContent,"Manufacturing");

	// Enter selects a real Frappe sidebar anchor (no new route rewriting).
	input.handlers.keydown({key:"Enter",preventDefault(){}});
	assert.equal(a.clicked,1);
	assert.equal(popover.hidden,true);
	assert.equal(input.attributes["aria-expanded"],"false");

	// Typed query gives permitted menu/doctype options and async global records.
	input.value="invoice";
	input.handlers.input();
	assert.equal(list.children[0].children[0].textContent,"Purchase Invoice List");
	flush();
	assert.ok(requestResolvers.invoice);
	requestResolvers.invoice([{title:"Purchase Invoice",results:[
		{label:"INV-00042",route:["Form","Purchase Invoice","INV-00042"]},
	]}]);
	await Promise.resolve();await Promise.resolve();await Promise.resolve();
	assert.equal(list.children.length,2);
	assert.equal(list.children[1].children[0].textContent,"INV-00042");
	input.handlers.keydown({key:"ArrowDown",preventDefault(){}});
	input.handlers.keydown({key:"ArrowDown",preventDefault(){}});
	input.handlers.keydown({key:"Enter",preventDefault(){}});
	assert.deepEqual(routes[0],["Form","Purchase Invoice","INV-00042"]);
	assert.equal(modal,0);

	// Ignore responses to stale prior queries.
	input.value="old";input.handlers.input();flush();
	input.value="invoice";input.handlers.input();flush();
	requestResolvers.old([{title:"Test",results:[{label:"STALE",route:["Form","Doc","Stale"]}]}]);
	await Promise.resolve();await Promise.resolve();await Promise.resolve();
	assert.equal(list.children.some(n=>n.children[0]?.textContent==="STALE"),false);
	requestResolvers.invoice([]);await Promise.resolve();await Promise.resolve();

	// Escape and outside pointerdown both close, without any modal.
	input.handlers.keydown({key:"Escape",preventDefault(){}});
	assert.equal(popover.hidden,true);
	input.focus();
	handlers.pointerdown({target:new Element("div")});
	assert.equal(popover.hidden,true);
	assert.equal(modal,0);

	// Refresh must not produce duplicate fields.
	events["sidebar_setup.st_sidebar_modern"]();flush();
	assert.equal(sidebar.children.filter(n=>n.className==="st-sidebar-search").length,1);

	// Collapsed rail stays searchable by expanding the native Sidebar first.
	panel.classList.remove("expanded");
	trigger.click();
	flush();
	assert.equal(panel.classList.contains("expanded"),true);
	assert.equal(input.focused,true);

	// Mobile drawer retains global navbar search fallback.
	mobile=true;
	events["page-change.st_sidebar_modern"]();flush();
	assert.equal(body.classList.contains("st-sidebar-search-available"),false);
	trigger.click();
	assert.equal(modal,0);
	assert.equal(sidebar.children[1],shell);
	console.log("Sidebar v2: inline dropdown, real links, permitted doctypes/docs,"
		+" stale async guard, keyboard, Escape/outside, collapsed/mobile, no modal.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});

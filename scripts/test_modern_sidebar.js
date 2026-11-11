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
	let recentInitialized=0;
	const recentEntries=[
		{value:"BOM List",route:["List","BOM"],index:80},
		{value:"Manufacturing Workspace",route:["Workspaces","Manufacturing"],index:79},
		{value:"<b>Role</b> List",route:["List","Role"],index:78},
		{value:"Purchase Invoice List",route:["List","Purchase Invoice"],index:77},
	];
	const frequentEntries=[
		{value:"<b>Buying</b> Workspace",route:["Workspaces","Buying"],index:70},
		{value:"<b>User</b> List",route:["List","User"],index:69},
		{value:"<b>General Ledger</b> Report",route:["query-report","General Ledger"],index:68},
	];
	const utils={
		setup_recent(){recentInitialized++;this.recent=[];},
		get_recent_pages(query){return recentEntries.filter(o=>!query||o.value.toLowerCase().includes(query.toLowerCase()));},
		get_frequent_links(){return frequentEntries;},
		get_doctypes(query){return query.toLowerCase().includes("invoice")?[{value:"Purchase Invoice List",route:["List","Purchase Invoice"],type:"List",index:40}]:[];},
		get_creatables(){return [];},
		get_search_in_list(){return [];},
		get_pages(){return [];},
		get_executables(){return [];},
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
	assert.equal(window.__st_sidebar_awesomebar_search_v4__,true);
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
	assert.equal(recentInitialized,1,"Native Frappe recent links should initialize once");
	assert.equal(list.children.length,7,"Blank query must show recent + frequent global pages");
	assert.equal(list.children[0].children[0].textContent,"BOM List");
	assert.equal(list.children[1].children[0].textContent,"Manufacturing Workspace");
	assert.equal(list.children[2].children[0].textContent,"Role List");
	assert.equal(list.children[4].children[0].textContent,"Buying Workspace");
	assert.equal(list.children[2].children[0].textContent,"Role List","Frappe <b> formatting must not leak");
	assert.equal(list.children[5].children[0].textContent,"User List");
	assert.equal(list.children[6].children[0].textContent,"General Ledger Report");
	assert.equal(list.children.some(n=>n.children[0]?.textContent?.includes("<b>")),false);
	assert.equal(list.children[0].classList.contains("is-selected"),true,"First recent command highlighted");
	assert.equal(list.children[0].children.length,2);
	assert.equal(list.children[0].children[1].textContent,"","No repetitive Navigation labels");

	// Enter selects a real user-scoped Frappe route, not only sidebar links.
	input.handlers.keydown({key:"Enter",preventDefault(){}});
	assert.deepEqual(routes[0],["List","BOM"]);
	assert.equal(a.clicked||0,0);
	assert.equal(popover.hidden,true);
	assert.equal(input.attributes["aria-expanded"],"false");

	// Typed query gives permitted menu/doctype options and async global records.
	input.value="invoice";
	input.handlers.input();
	assert.equal(list.children[0].children[0].textContent,"Purchase Invoice List");
	flush();
	await Promise.resolve(); // Global search is dispatched on the next microtask.
	assert.ok(requestResolvers.invoice);
	requestResolvers.invoice([{title:"Purchase Invoice",results:[
		{label:"INV-00042",route:["Form","Purchase Invoice","INV-00042"]},
	]}]);
	await Promise.resolve();await Promise.resolve();await Promise.resolve();
	assert.equal(list.children.length,2);
	assert.equal(list.children[1].children[0].textContent,"INV-00042");
	input.handlers.keydown({key:"ArrowDown",preventDefault(){}});
	input.handlers.keydown({key:"Enter",preventDefault(){}});
	assert.deepEqual(routes[1],["Form","Purchase Invoice","INV-00042"]);
	assert.equal(modal,0);

	// Ignore responses to stale prior queries.
	input.value="old";input.handlers.input();flush();
	await Promise.resolve();
	input.value="invoice";input.handlers.input();flush();
	await Promise.resolve();
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

	// Ctrl/Cmd+K focuses the global sidebar search without opening navbar modal.
	let blocked=false, prevented=false;
	handlers.keydown({key:"k",ctrlKey:true,metaKey:false,altKey:false,
		defaultPrevented:false,target:new Element("div"),
		preventDefault(){prevented=true;},stopImmediatePropagation(){blocked=true;}});
	assert.equal(prevented,true);
	assert.equal(blocked,true,"Ctrl+K must prevent the old navbar AwesomeBar modal");
	assert.equal(input.focused,true);
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

	// Mobile drawer retains native search fallback.
	mobile=true;
	events["page-change.st_sidebar_modern"]();flush();
	assert.equal(body.classList.contains("st-sidebar-search-available"),false);
	trigger.click();
	assert.equal(modal,0);
	assert.equal(sidebar.children[1],shell);

	// Frappe may remove the search shell when rebuilding Sidebar on Form
	// navigation, while leaving .body-sidebar-container alive.
	mobile=false;
	const oldSearch = shell;
	sidebar.children.splice(sidebar.children.indexOf(oldSearch), 1);
	oldSearch.parentElement=null;
	oldSearch.isConnected=false;
	events["form-refresh.st_sidebar_modern"]();
	flush();
	const replacements = sidebar.children.filter(n=>n.className==="st-sidebar-search");
	assert.equal(replacements.length,1,"Form refresh must restore exactly one Search field");
	assert.notEqual(replacements[0],oldSearch,"Removed Form search control must be recreated");
	const formSearch = replacements[0].children[0].children[1];
	formSearch.focus();
	assert.equal(replacements[0].children[1].hidden,false);
	const formList = replacements[0].children[1].children[0];
	assert.equal(formList.children[2].children[0].textContent,"Role List");
	formSearch.value="invoice";formSearch.handlers.input();
	assert.equal(formList.children[0].children[0].textContent,"Purchase Invoice List");
	assert.equal(modal,0);

	// Also cover replacement of the entire native Sidebar element on route
	// change; form search must keep its global providers and focus behavior.
	const newSidebar=new Element("div",["body-sidebar"]);
	newSidebar.append(new Element("div",["sidebar-header"]),
		new Element("div",["standard-items-band"]),
		new Element("div",["body-sidebar-top"]),
		new Element("div",["body-sidebar-bottom"]));
	panel.children.splice(panel.children.indexOf(sidebar),1,newSidebar);
	newSidebar.parentElement=panel;
	events["page-change.st_sidebar_modern"]();flush();
	const newShell = newSidebar.children.find(n=>n.className==="st-sidebar-search");
	assert.ok(newShell && newShell!==replacements[0]);
	newShell.children[0].children[1].focus();
	assert.equal(newShell.children[1].hidden,false);
	assert.equal(newShell.children[1].children[0].children[2].children[0].textContent,"Role List");
	console.log("Sidebar v4: formatted labels stripped, Form search reattached,"
		+" global command providers, Ctrl+K, no modal, collapsed/mobile safe.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});

#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const analytics=fs.readFileSync(path.join(root,"saas_theme/public/js/home_analytics.js"),"utf8");
const picker=fs.readFileSync(path.join(root,"saas_theme/public/js/quick_access_preferences.js"),"utf8");
const css=fs.readFileSync(path.join(root,"saas_theme/public/css/home.css"),"utf8");
new vm.Script(analytics);
new vm.Script(picker);
function block(src,start,end){
    const a=src.indexOf(start),b=src.indexOf(end,a);
    assert.ok(a>=0&&b>a,"Missing controller block "+start);
    return src.slice(a,b);
}
const translate=(str,args)=>String(str).replace(/\{(\d+)\}/g,(_,n)=>args?.[Number(n)]??"");
const escapeHtml=(v)=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const chartSrc=block(analytics,"\tfunction line_points(","\n\tfunction production_chart(");
const chart=vm.runInNewContext(chartSrc+
'\n({view:trend_chart({labels:["May","Jun","Jul","Aug","Sep","Oct"],revenue:[120,200,140,260,230,340],expenses:[80,110,95,120,150,130]}),spark:kpi_sparkline([120,200,140,260,230,340])});',{
    esc:escapeHtml,__:translate,money:(v)=>"AFN "+Math.round(v)
});
for(const needle of ["st-v9-trend-chart","st-dash-chart-line revenue",
    "st-dash-chart-line expenses","st-dash-chart-area revenue","st-home-trend-primary",
    "May","Oct","AFN 340"]) assert.ok(chart.view.includes(needle),needle);
assert.doesNotMatch(chart.view,/NaN|undefined|st-dash-bar/);
assert.match(chart.spark,/st-v9-kpi-spark/);
assert.match(chart.spark,/path d="M/);
assert.equal(vm.runInNewContext(chartSrc+"\nkpi_sparkline(null);",{}),"",
    "Unavailable history must not produce a fake trend");
const actSrc=block(analytics,"\tfunction activity_item_html(","\n\tasync function load_dashboard(");
const activity=vm.runInNewContext(actSrc+
'\n({entry:activity_item_html({actor:"<Admin>",reference_doctype:"Print Format",reference_name:"Format-0001",creation:"2026-11-07 12:00:00",description:"2 fields changed",activity_type:"Updated"}),summary:activity_summary_html({updated:9})});',{
    esc:escapeHtml,__:translate,number:(v)=>String(v),
    relative_time:()=>"1 hour ago",form_route:()=>"/desk/print-format/Format-0001",initials:()=>"A"
});
for(const needle of ["st-v9-activity-entry","&lt;Admin&gt;","Print Format",
    "Format-0001","2 fields changed","1 hour ago"])assert.ok(activity.entry.includes(needle),needle);
assert.doesNotMatch(activity.entry,/<Admin>/);
assert.match(activity.summary,/9 updates/);
const items=Array.from({length:12},(_,i)=>({name:"Module-"+i,title:"Module "+i,module:"Sidebar",icon:"layout-grid"}));
const pickerSrc=block(picker,"\tfunction picker_html(","\n\tfunction open_picker(");
const markup=vm.runInNewContext(pickerSrc+
    "\npicker_html(items, items.map(x=>x.name));",{
    items,esc:escapeHtml,__:translate,icon:()=>"<svg></svg>",search_icon:()=>"<svg></svg>"
});
assert.equal((markup.match(/class="st-quick-picker-option"/g)||[]).length,12);
assert.equal((markup.match(/class="st-quick-picker-check"/g)||[]).length,12);
for(const action of ["select-all","unselect-all","reset"])
    assert.ok(markup.includes("st-quick-picker-"+action),action);
assert.doesNotMatch(markup,/Select up to 8/);
assert.ok(picker.includes('$checks.prop("checked", true)'));
assert.ok(picker.includes('$checks.prop("checked", false)'));
assert.ok(!picker.includes("MAX_ITEMS"));
assert.ok(picker.includes("const chosen = permitted;"));
assert.ok(picker.includes("st-quick-empty-selection"));
const storageSrc=block(picker,"\tfunction storage_key()","\n\tfunction get_sidebars()");
const memory=new Map();
const ctx={frappe:{session:{user:"employee@example.com"}},localStorage:{
    getItem:(key)=>memory.has(key)?memory.get(key):null,
    setItem:(key,value)=>memory.set(key,value),
    removeItem:(key)=>memory.delete(key)
}};
const store=vm.runInNewContext(
    'const STORAGE_PREFIX="saas_theme.quick_access_sidebars_v1";\n'+storageSrc+
    "\n({write_selection,read_selection});",ctx);
store.write_selection(items.map(x=>x.name));
assert.equal(store.read_selection().length,12);
store.write_selection([]);
assert.deepEqual(Array.from(store.read_selection()),[]);
for(const rule of [".st-v9-activity-entry",".st-dash-chart-line.revenue",
    ".st-quick-picker-select-all",".st-quick-picker-unselect-all"])
    assert.ok(css.includes(rule),"Missing CSS "+rule);
console.log("Home visual and picker tests passed: real line chart, Version timeline and Select/Unselect All.");

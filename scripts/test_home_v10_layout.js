#!/usr/bin/env node
"use strict";
/* Home layout regression: blue theme, semantic links and report data. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const analytics = fs.readFileSync(path.join(root, "saas_theme/public/js/home_analytics.js"), "utf8");
const css = fs.readFileSync(path.join(root, "saas_theme/public/css/home.css"), "utf8");
new vm.Script(analytics);

const esc = (v) => String(v).replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const __ = (v, args) => String(v).replace(/\{(\d+)\}/g, (_, i) => args?.[Number(i)] ?? "");
const start = analytics.indexOf("\tfunction heatmap_html(data) {");
const end = analytics.indexOf("\n\tfunction invoice_html(", start);
assert.ok(start > 0 && end > start, "Sales activity chart missing");
const heatmap = analytics.slice(start, end);
const inputs = {
    days: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    times: ["9AM","12PM","3PM","6PM","9PM"],
    values: [[1,0,3,0,2,4,0],[0,2,0,1,0,1,0],[0,0,0,0,0,0,0],
             [2,0,1,0,1,0,0],[0,0,0,0,0,0,0]],
};
const sales = vm.runInNewContext(heatmap + "\nheatmap_html(source);", {
    source: inputs, __, esc, number: (n) => String(n),
});
assert.equal((sales.match(/class="st-v10-sales-day"/g) || []).length, 7);
assert.match(sales, /9AM · Sun: 1/);
assert.match(sales, /3<\/strong>/);
assert.match(sales, /5<\/strong>/);
assert.doesNotMatch(sales, /undefined|NaN|Revenue \$|Trade/);
const empty = vm.runInNewContext(heatmap + "\nheatmap_html(null);", {__,esc,number:String});
assert.match(empty, /No sales activity/);

const htmlStart = analytics.indexOf("\tfunction kpi_icon(");
const htmlEnd = analytics.indexOf("\n\tfunction line_points(", htmlStart);
assert.ok(htmlStart > 0 && htmlEnd > htmlStart);
const html = vm.runInNewContext(analytics.slice(htmlStart, htmlEnd) + "\ndashboard_html();", {
    __, esc,
    list_route: (name) => "/desk/" + name.toLowerCase().replace(/ /g, "-"),
    report_route: (name) => "/desk/query-report/" + encodeURIComponent(name),
});
for (const section of ["overview","analytics","activity"])
    assert.ok(html.includes('data-home-section="' + section + '"'), "Missing section " + section);
assert.doesNotMatch(html, /st-v10-page-nav|data-home-target|st-v10-nav-tab/,
    "The user removed the entire Dashboard/Analytics/Activity header");
assert.ok(!analytics.includes("bind_home_section_navigation()") &&
          !analytics.includes("saas_home_sections") &&
          !analytics.includes("hasAnalytics"), "Old tab controller must be removed");

const expectedKpis = {
    revenue: "/desk/sales-invoice",
    expenses: "/desk/query-report/Profit%20and%20Loss%20Statement",
    customers: "/desk/customer",
    suppliers: "/desk/supplier",
    stock_value: "/desk/query-report/Stock%20Balance",
    cash: "/desk/query-report/General%20Ledger",
    receivables: "/desk/query-report/Accounts%20Receivable",
    payables: "/desk/query-report/Accounts%20Payable",
};
for (const [key, route] of Object.entries(expectedKpis)) {
    const item = html.match(new RegExp('<a hidden class="st-dash-kpi[^>]*data-dashboard-kpi="' + key + '"[^>]*href="([^"]+)"'));
    assert.ok(item, "Missing permission-hidden, accessible KPI anchor for " + key);
    assert.equal(item[1], route, "Wrong ERPNext destination for KPI " + key);
}
const expectedCharts = {
    trend: "/desk/query-report/Profit%20and%20Loss%20Statement",
    production: "/desk/stock-entry",
    heatmap: "/desk/sales-invoice",
    invoices: "/desk/sales-invoice",
};
for (const [key, route] of Object.entries(expectedCharts)) {
    const item = html.match(new RegExp('<a hidden class="st-dash-card[^>]*data-dashboard-panel="' + key + '"[^>]*href="([^"]+)"'));
    assert.ok(item, "Missing clickable, permission-hidden analytic for " + key);
    assert.equal(item[1], route, "Wrong analytics destination for " + key);
}
assert.ok(html.includes("st-home-card-open") && html.includes("aria-label="));
assert.ok(html.includes('role="feed"'), "Version history remains a feed of per-document links");
assert.ok(!html.includes('data-dashboard-panel="activity"'), "Audit must keep individual document links");
assert.ok(analytics.includes("if (!item || item.value == null) return;"),
    "Unavailable KPI must never display a permission-warning link");

assert.match(css, /--st-hub-primary:\s*#1762ca/);
const hoverBlock = css.slice(css.indexOf("Home KPI hover surfaces"));
assert.ok(hoverBlock.length > 4000, "Last loaded Home KPI override is missing");
// Revenue must be the only permanently blue card; other cards remain white.
assert.match(hoverBlock,
    /a\.st-dash-kpi\[data-dashboard-kpi="revenue"\]\s*\{[^}]*background:\s*#1762ca !important/s);
assert.match(hoverBlock,
    /a\.st-dash-kpi:not\(\[data-dashboard-kpi="revenue"\]\)\s*\{[^}]*background:\s*#ffffff !important/s);
// Only non-Revenue KPI cards receive the expanding upper-right blue circle.
assert.match(hoverBlock, /a\.st-dash-kpi:not\(\[data-dashboard-kpi="revenue"\]\)::after\s*\{[^}]*clip-path:\s*circle\(0% at 100% 0%\)/s);
assert.match(hoverBlock,
    /a\.st-dash-kpi:not\(\[data-dashboard-kpi="revenue"\]\):is\(:hover, :focus-visible\)::after\s*\{[^}]*clip-path:\s*circle\(150% at 100% 0%\)/s);
assert.ok(hoverBlock.includes("transition: clip-path .56s cubic-bezier(.22, 1, .36, 1)"),
    "The fill must expand smoothly instead of appearing instantly");
assert.ok(hoverBlock.includes("pointer-events: none"),
    "The hover layer must not block full-card click events");
assert.ok(hoverBlock.includes("prefers-reduced-motion: reduce"),
    "Reduced-motion users need a nonanimated fallback");
assert.ok(hoverBlock.includes('[data-theme="dark"]') &&
          hoverBlock.includes("background: #233247 !important"),
    "Neutral cards must remain legible in dark mode");
assert.ok(hoverBlock.includes(".st-v9-kpi-spark path") &&
          hoverBlock.includes(".st-home-card-open"),
    "SVG and link icons must remain legible over blue");
assert.ok(!hoverBlock.includes("a.st-dash-card::after"),
    "KPI circle must not override analytics card link arrows");
assert.match(css, /--st-v9-bg:\s*linear-gradient\(115deg, #caeaff, #e9f6ff\)/);
assert.match(css, /background:\s*#f3f7fc !important/);
assert.match(css, /outline:\s*3px solid #1762ca !important/);
assert.ok(!css.includes(".st-dashboard-v10 .st-v10-nav-tab"), "Removed nav CSS must stay removed");
for (const x of [".st-v10-sales-chart",".st-v10-sales-segment",".st-dash-chart-line.revenue"])
    assert.ok(css.includes(x), "Unrelated analytics styles must survive " + x);
const scroll = ".st-home-dashboard.st-dashboard-redesign-v7 .st-dashboard-v10 .st-dash-activity-card .st-activity-list";
const at = css.indexOf(scroll);
assert.ok(at > 0);
const rule = css.slice(at,css.indexOf("}",at));
assert.ok(rule.includes("display: block !important") && rule.includes("overflow-y: auto !important"));
assert.ok(css.includes("height: 419px !important"));
console.log("Home links, top-right KPI hover, blue Revenue, neutral cards and Version list passed.");

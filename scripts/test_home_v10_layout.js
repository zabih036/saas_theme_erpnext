#!/usr/bin/env node
"use strict";
/* Home V10: enforce the reference layout, real-data bars, role-safe hiding,
 * uniform ice-blue cards and compact scrollable Version-only activity. */
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
const __ = (v) => String(v);
const start = analytics.indexOf("\tfunction heatmap_html(data) {");
const end = analytics.indexOf("\n\tfunction invoice_html(", start);
assert.ok(start > 0 && end > start, "Sales activity renderer missing");
const actual = analytics.slice(start, end);
const inputs = {
    days: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    times: ["9AM","12PM","3PM","6PM","9PM"],
    values: [
        [1,0,3,0,2,4,0],
        [0,2,0,1,0,1,0],
        [0,0,0,0,0,0,0],
        [2,0,1,0,1,0,0],
        [0,0,0,0,0,0,0]
    ],
};
const rendered = vm.runInNewContext(actual + "\nheatmap_html(source);", {
    source: inputs, __, esc, number: (n) => String(n),
});
assert.equal((rendered.match(/class="st-v10-sales-day"/g) || []).length, 7,
    "Must have seven weekday bars");
assert.ok(rendered.includes("Submitted sales invoices by weekday"));
assert.ok(rendered.includes("9AM · Sun: 1"), "Stacked counts should preserve time buckets");
assert.ok(rendered.includes("3</strong>"), "Sunday total = 1 + 2");
assert.ok(rendered.includes("5</strong>"), "Friday total = 4 + 1");
assert.doesNotMatch(rendered, /undefined|NaN|Revenue \$|Trade/, "No fabricated data");
const empty = vm.runInNewContext(actual + "\nheatmap_html(null);", {__,esc,number:String});
assert.ok(empty.includes("No sales activity"));

const htmlStart = analytics.indexOf("\tfunction kpi_icon(");
const htmlEnd = analytics.indexOf("\n\tfunction line_points(", htmlStart);
assert.ok(htmlStart > 0 && htmlEnd > htmlStart);
const html = vm.runInNewContext(analytics.slice(htmlStart, htmlEnd) + "\ndashboard_html();", {__,esc});
for (const section of ["overview","analytics","activity"])
    assert.ok(html.includes('data-home-section="' + section + '"'), section);
for (const tab of ["overview","analytics","activity"])
    assert.ok(html.includes('data-home-target="' + tab + '"'), "Missing real section nav "+tab);
for (const panel of ["trend","production","heatmap","invoices"])
    assert.ok(html.includes('hidden class="st-dash-card') &&
              html.includes('data-dashboard-panel="' + panel + '"'),
              "Permission-gated panel missing " + panel);
assert.ok(html.indexOf('data-dashboard-panel="trend"') < html.indexOf('data-dashboard-panel="production"'));
assert.ok(html.indexOf('data-dashboard-panel="production"') < html.indexOf('data-dashboard-panel="heatmap"'));
assert.ok(html.indexOf('data-dashboard-panel="heatmap"') < html.indexOf('data-dashboard-panel="invoices"'));
assert.ok(html.indexOf('data-dashboard-panel="invoices"') < html.indexOf('st-dash-activity-card'));
assert.ok(html.includes('role="feed"'));
assert.ok(analytics.includes('section.scrollIntoView({ behavior: "smooth", block: "start" })'),
    "Dashboard tabs must actually navigate to the corresponding panel");
assert.ok(analytics.includes('hasAnalytics') &&
          analytics.includes('.prop("hidden", !hasAnalytics)'),
    "Unavailable analytics tab must remain hidden");
const cardNames = ["revenue","expenses","customers","suppliers","stock_value",
    "cash","receivables","payables"];
for (const name of cardNames)
    assert.ok(html.includes('data-dashboard-kpi="' + name + '"'),
        "Existing KPI missing " + name);

const cssKey = ".st-home-dashboard.st-dashboard-redesign-v7 .st-dashboard-v10 .st-dash-kpi";
assert.ok(css.includes(cssKey), "Home-only palette scope missing");
assert.ok(css.includes("--st-v9-bg: linear-gradient(115deg, #caeaff, #e9f6ff)"),
    "All eight KPI cards must use the former Bank & Treasury color");
assert.ok(css.includes("background: #eeebf9 !important"),
    "Dashboard must have the reference's subtle lavender canvas");
assert.ok(css.includes(".st-v10-nav-tab.is-active") &&
          css.includes("background: #784bef"),
    "Functional purple navigation styling absent");
assert.ok(css.includes(".st-v10-sales-chart") &&
          css.includes(".st-v10-sales-segment"),
    "Data-grounded weekly stacked chart styling missing");
const scrollKey = ".st-home-dashboard.st-dashboard-redesign-v7 .st-dashboard-v10 .st-dash-activity-card .st-activity-list";
const scrollPos = css.indexOf(scrollKey);
assert.ok(scrollPos > 0, "Version activity list scoped selector missing");
const scrollBody = css.slice(scrollPos, css.indexOf("}", scrollPos));
assert.ok(scrollBody.includes("display: block !important") &&
          scrollBody.includes("overflow-y: auto !important") &&
          scrollBody.includes("grid-template-columns: minmax(0,1fr) !important"),
    "Version history must be a single-column scrollable list");
assert.ok(css.includes("height: 419px !important"), "Activity card needs a scrollable height");
console.log("Home V10 passed: layout, uniform blue KPI cards, real stacked sales, scrollable Version list and working tabs.");

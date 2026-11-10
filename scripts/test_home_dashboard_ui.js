#!/usr/bin/env node
"use strict";
/* Guard Home sidebar source, permission-hidden KPI markup, UI syntax and callbacks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const hub = fs.readFileSync(path.join(root, "saas_theme/public/js/home_dashboard.js"), "utf8");
const analytics = fs.readFileSync(path.join(root, "saas_theme/public/js/home_analytics.js"), "utf8");
const css = fs.readFileSync(path.join(root, "saas_theme/public/css/home.css"), "utf8");
new vm.Script(hub);
new vm.Script(analytics);

const events = () => ({off() { return this; }, on() { return this; }});
const context = {
    __: (message) => message,
    window: {location: {pathname: "/desk"}},
    document: {},
    saas_theme: {home_dashboard: {}, professional_ui: {get_workspaces: () => []}},
    frappe: {
        provide() {},
        boot: {
            module_sidebars: {
                Buying: {label: "Buying", header_icon: "cart", items: [{type: "Link"}]},
                Accounting: {label: "Accounting", hidden: 1, items: [{type: "Link"}]},
                Empty: {label: "Empty", items: []},
                Manufacturing: {label: "Manufacturing", items: [{type: "Section"}]},
            },
            workspace_sidebar_item: {},
        },
        app: {sidebar: {module_landing_route: (name) => "/desk/" + name.toLowerCase()}},
    },
    $: (value) => typeof value === "function" ? undefined : events(),
};
vm.runInNewContext(hub, context);
// Before the server has validated custom_allowed_roles, show no sidebar.
const nav = context.saas_theme.home_dashboard.get_quick_access();
assert.deepEqual(Array.from(nav, (v) => v.name), []);
assert.equal(context.saas_theme.home_dashboard.sidebar_access_ready(), false);
assert.ok(hub.includes('method: "saas_theme.home.get_home_sidebar_access"'),
    "Sidebar roles must be checked on the backend");
assert.ok(hub.includes("allowed_sidebar_names = new Set(names)"),
    "Use only the server-approved sidebar identities");
assert.ok(hub.includes('const quick = [];'),
    "Never briefly display unauthorized sidebar links");
assert.ok(hub.includes("Your available sidebar modules"));
assert.ok(!hub.includes("get_quick_access(workspaces)"),
    "Quick Access must not regress to Workspace favorites");
assert.ok(hub.includes("sidebar.custom_hidden") &&
    hub.includes("Number(sidebar.custom_hidden || 0) === 1"),
    "Home must exclude custom_hidden from boot when present");
const candidateStart = hub.indexOf("\tfunction get_sidebar_candidates() {");
const candidateEnd = hub.indexOf("\n\tfunction get_quick_access()", candidateStart);
assert.ok(candidateStart >= 0 && candidateEnd > candidateStart);
const sidebarCandidates = vm.runInNewContext(
    hub.slice(candidateStart, candidateEnd) + "\nget_sidebar_candidates();", {
        __: (value) => value,
        slug: (value) => value.toLowerCase(),
        window: {location: {pathname: "/desk"}},
        frappe: {
            boot: {module_sidebars: {
                Buying: {name: "Buying", items: [{type: "Link"}]},
                CustomHidden: {name: "CustomHidden", custom_hidden: 1, items: [{type: "Link"}]},
            }},
            app: {sidebar: {module_landing_route: (name) => "/desk/" + name.toLowerCase()}},
        },
    });
assert.deepEqual(Array.from(sidebarCandidates, (x) => x.name), ["Buying"],
    "A custom_hidden Sidebar cannot reach Quick Access or Customize modal");

const picker = fs.readFileSync(
    path.join(root, "saas_theme/public/js/quick_access_preferences.js"), "utf8");
new vm.Script(picker);
assert.ok(picker.includes("saas_theme.home_dashboard.get_quick_access()"),
    "The customize modal must use the same permitted sidebar collection");
assert.ok(!picker.includes("get_workspaces()") &&
    !picker.includes("visible_workspaces"),
    "The modal must not independently expose Workspace pages");
assert.ok(picker.includes("saas_home_sidebars_ready"),
    "Picker refreshes only after the permission response");
assert.ok(picker.includes("quick_access_sidebars_v1") &&
    !picker.includes("quick_access_workspaces_v2"),
    "Old Workspace selections must not restore restricted sidebar links");
assert.ok(picker.includes("Search sidebar modules"));


const start = analytics.indexOf("\tfunction kpi_icon(");
const end = analytics.indexOf("\n\tfunction trend_chart(", start);
assert.ok(start > 0 && end > start, "Home KPI template not found");
const template = analytics.slice(start, end);
const dashboard = vm.runInNewContext(template + "\n dashboard_html();", {
    esc: (s) => String(s),
    __: (s, args) => String(s).replace(/\{(\d+)\}/g, (_, n) => args?.[Number(n)] ?? ""),
    list_route: (doctype) => "/desk/" + doctype.toLowerCase().replace(/ /g, "-"),
    report_route: (report) => "/desk/query-report/" + encodeURIComponent(report),
});
const keys = ["revenue", "expenses", "customers", "suppliers",
    "stock_value", "cash", "receivables", "payables"];
for (const key of keys) {
    assert.ok(dashboard.includes('hidden class="st-dash-kpi') &&
              dashboard.includes('data-dashboard-kpi="' + key + '"'),
        "Missing permission-hidden KPI " + key);
}
assert.ok(dashboard.includes("data-dashboard-panel=\"production\""));
assert.ok(dashboard.includes("st-dash-activity-card"));
assert.ok(css.includes(".st-dashboard-v8 [hidden]") &&
          css.includes("display: none !important"),
          "The CSS must honor a permission-hidden KPI against legacy display rules");
assert.ok(analytics.includes("item.description"),
          "Audit events must display their safe change summary");
assert.ok(analytics.includes("if (!item || item.value == null) return;"),
          "An unavailable KPI must never be displayed as a zero");
assert.ok(analytics.includes("if (data.production)"),
          "Production chart must be optional");
assert.ok(analytics.includes("home_currency = data.currency"),
          "Financial figures must use their reporting company's currency");
assert.ok(dashboard.includes("st-dashboard-v9") &&
    dashboard.includes("st-kpi-value-row") &&
    dashboard.includes("st-dashboard-section-title"),
    "Modern portfolio layout and KPI mini-trend slots must be present");
assert.ok(dashboard.includes("st-dashboard-v10") &&
    dashboard.includes('data-home-section="analytics"') &&
    dashboard.includes('data-home-section="activity"') &&
    css.includes("--st-v10-ice: #d5edfb") &&
    css.includes("--st-v9-bg: linear-gradient(115deg, #caeaff, #e9f6ff)") &&
    css.includes("font-size: clamp(17px,1.25vw,22px)"),
    "V10 must use the Bank & Treasury ice-blue KPI palette and reference-style layout");
assert.ok(css.includes(".st-dash-chart-line.revenue") &&
    css.includes(".st-v9-activity-entry") &&
    css.includes(".st-quick-picker-select-all"),
    "Finance charts, Version activity and modal actions must have owned styling");
console.log("Home UI passed: sidebar navigation, permission-hidden cards, audit trail and production chart.");

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
    __: (s) => s,
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
assert.ok(css.includes("background: linear-gradient(115deg, #174783") &&
    css.includes("font-size: clamp(18px, 1.35vw, 22px)"),
    "All Home financial cards must use compact typography and a uniform blue surface");
console.log("Home UI passed: sidebar navigation, permission-hidden cards, audit trail and production chart.");

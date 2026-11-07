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
const nav = context.saas_theme.home_dashboard.get_quick_access();
assert.deepEqual(Array.from(nav, (v) => v.name), ["Buying", "Manufacturing"]);
assert.equal(nav[0].route, "/desk/buying");
assert.equal(nav[1].route, "/desk/manufacturing");
assert.ok(!nav.some((v) => v.name === "Accounting" || v.name === "Empty"));
assert.ok(hub.includes("Your available sidebar modules"));
assert.ok(!hub.includes("get_quick_access(workspaces)"),
    "Quick Access must not regress to workspace favorites");

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
console.log("Home UI passed: sidebar navigation, permission-hidden cards, audit trail and production chart.");

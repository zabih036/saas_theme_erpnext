#!/usr/bin/env node
"use strict";
/* Phase 4E: final v6.2 search/report stylesheet loader smoke test.
 * Keep the original link ID and ensure existing/new link branches match. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const base = path.join(__dirname, "../saas_theme/public/js");
const source = fs.readFileSync(path.join(base,"search_report_refinements.js"),"utf8");
new vm.Script(source);
const start = source.indexOf("\tfunction load_css() {");
const end = source.indexOf("\n\tfunction clean_text(",start);
assert.ok(start > 0 && end > start, "Existing final v6.2 CSS loader function disappeared");
const loader = source.slice(start,end);
const expected="/assets/saas_theme/css/search_report_refinements.css?v=1";
const old="/assets/saas_theme/css/ui_precision_v6_2.css?v=3";
assert.equal(source.split(expected).length-1,2, "Both CSS branches must share one URL");
assert.ok(!source.includes(old), "Retired CSS URL must not be injected");

const nodes = new Map();
const children = [];
const document = {
    getElementById: (id) => nodes.get(id) || null,
    createElement: (tag) => {
        assert.equal(tag,"link");
        return {tagName:"LINK",id:"",rel:"",href:""};
    },
    head: {appendChild: (node) => {nodes.set(node.id,node);children.push(node);}},
};
const context = vm.createContext({document});
vm.runInContext(loader+"\nload_css();",context);
assert.equal(children.length,1);
assert.equal(children[0].id,"st-ui-precision-v6-2-css");
assert.equal(children[0].rel,"stylesheet");
assert.equal(children[0].href,expected);
children[0].href="/assets/saas_theme/css/obsolete.css?v=9";
vm.runInContext("load_css();",context);
assert.equal(children.length,1,"A second run must update, not duplicate, existing link");
assert.equal(children[0].href,expected);
assert.match(source,/__saas_theme_ui_precision_v6_2_fix__/);
assert.match(source,/function restore_native_filter_geometry\(/);
console.log("Phase 4E passed: v6.2 CSS insertion/update and unchanged final-search controller flags.");

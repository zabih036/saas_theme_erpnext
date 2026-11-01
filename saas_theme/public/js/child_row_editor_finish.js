/*
 * SaaS Theme — legacy child-row interaction shim retired in v7.
 *
 * Child-row portal, Link Selector keep-open behavior, overlay stacking and
 * autocomplete positioning are now owned by interaction_finish_v2.js
 * (Consolidated UI Interaction Controller v7).
 *
 * This file intentionally remains as a no-op because it is still referenced by
 * hooks.py on existing installations; keeping the asset avoids a 404 while
 * removing the duplicate monkey-patching that caused conflicting behavior.
 */
(function () {
	"use strict";
	window.__saas_theme_child_row_editor_finish_retired_v7__ = true;
})();

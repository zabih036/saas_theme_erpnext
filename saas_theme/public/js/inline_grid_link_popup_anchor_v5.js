/*
 * SaaS Theme — legacy inline-grid popup controller retired in v7.
 *
 * Frappe v16 moves editable-grid Awesomplete lists into .grid-field. The v7
 * consolidated controller resolves that real list and owns portal/positioning.
 * Keeping this asset as a no-op preserves compatibility with the existing
 * dynamic loader without running a second competing popup controller.
 */
(function () {
	"use strict";
	window.__saas_theme_inline_grid_popup_v5_retired_v7__ = true;
})();

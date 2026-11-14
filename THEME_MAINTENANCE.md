# SaaS Theme Maintenance Guide

This document is the source of truth for future theme changes and cleanup work.

## Non-negotiable rules

1. Do **not** add a new `v2`, `v3`, `final`, `followup`, `fix`, `precision`, or temporary patch file for ordinary feature work.
2. Do **not** reorder live `app_include_css` or `app_include_js` assets casually. Their order is part of the working UI behavior.
3. Do **not** bulk-merge or bulk-delete historical runtime assets just to reduce file count.
4. Change the owner file for the feature being modified. Do not fix the same problem in a second unrelated file.
5. Cross-layer stability belongs only to the final stability owners listed below.
6. Before opening a PR, run:

   ```bash
   python3 scripts/validate_theme_architecture.py
   ```

7. For runtime changes, test the affected surface in light and dark mode where applicable, after scrolling, after reopening the route, and after a hard refresh.
8. Cleanup is performed as a **migration**, not as a rewrite. Each phase must be independently mergeable and reversible.

---

## Home financial revenue and Sidebar hiding

- `Sidebar.custom_hidden = 1` removes that Sidebar from both the Home Quick
  Access list and the Customize Quick Access selection modal. This check is
  **server-side** and applies to Administrator too; role checking through
  `custom_allowed_roles` continues for other users. Clients never show the
  unverified boot list while permission checks are pending.
- The Revenue card and monthly Revenue chart must be computed from submitted
  **General Ledger Income** postings, net `credit - debit`, including returns,
  journal adjustments, and other Income accounts. Sales Invoice net totals are
  not P&L income and must not be substituted.
- Fiscal-year-to-date Revenue uses ERPNext's configured fiscal year for the
  selected Company. The six-month chart displays the same net Income GL
  postings per month. Exclude cancelled entries and Period Closing Vouchers.
  Hide Revenue entirely if the user lacks the necessary GL/Account access.
- The Revenue card links to Profit and Loss Statement; Sales Invoice counts,
  paid/unpaid status, and the sales time-of-day chart remain separate.
- To compare with Profit and Loss Statement, select **the same company,
  fiscal year, base currency and finance book**, and use the unfiltered Total
  Income figure rather than Net Profit or invoice totals. Other P&L filter
  selections (cost center, financial report template, presentation currency)
  can produce different values.
- Never change customer/sidebar permissions as a shortcut to show missing
  metrics. Regression tests cover the hidden check and finance accounting
  reconciliation, with and without GL permissions.

## Language switcher — Home toolbar + user menu

- `brand_shell.js` owns the compact globe/language-code button directly
  **before the Home desktop notification icon** and a language row placed
  immediately **after Settings** in Frappe's existing user popup. Both call
  the **same dialog**. Never modify Frappe core or copy a second language
  controller into `user_theme_menu.js`; that late-loaded script is protected
  by immutable source-hash parity from cleanup Phases 4B–4E.
- `saas_theme.language.get_available_languages` returns only enabled
  Language DocType records and the current signed-in user's preference.
  `set_user_language` validates one enabled code, obtains the session user
  itself (never from client input), and saves **only that User.language**
  through the Frappe User document controller. It cannot change global
  System Settings or another user's preference; Guest calls are denied.
- The dialog offers a searchable list of languages. A language click
  saves immediately and performs `window.location.reload()` **only after**
  Frappe confirms the selected code. The full reload lets Frappe supply the
  right translated Desk boot, formatters and RTL direction for enabled
  translations. Never just update an HTML `dir` attribute or a guest cookie.
- The selector is idempotent across Home/header rebuilds and menu reopenings.
  Existing bell notifications, avatar/menu, Theme Switcher, search and
  sidebar behavior remain untouched. The button is compact on mobile.
  No changes to signed-in user data beyond their chosen language.
- Maintain translations using Frappe/ERPNext language files and the site's
  enabled languages. This feature **switches** language; it does not invent
  missing strings or promise complete translations for third-party apps.
- Test both entry points, enabled/disabled languages, Guest denial, successful
  save/reload, failure without reload, dark/light mode, and RTL appearance
  in a real Frappe v16 browser. CI checks: `scripts/test_language_settings.py`
  and `scripts/test_language_switcher.js`.

## Golden baseline

The working theme after PR #53 is the visual and interaction baseline. PR #54 added architecture documentation and validation without changing the runtime theme.

During cleanup, the rule is simple:

> If a cleanup step changes the UI or interaction behavior, the cleanup step is wrong unless that visual/behavioral change was explicitly requested.

Never use file-count reduction as proof that a refactor is better. Runtime parity comes first.

---

## Canonical ownership map

| Concern | Canonical owner | Maintenance rule |
| --- | --- | --- |
| Base theme foundation | `saas_theme/public/css/saas_theme.css` / `saas_theme/public/js/saas_theme.js` | Treat as base/frozen unless the change truly belongs to the original theme foundation. |
| Main desktop/workspace shell | `saas_theme/public/css/professional_ui.css` / `saas_theme/public/js/professional_ui.js` | Broad desktop shell and workspace rail. |
| Company/header branding + language selection | `saas_theme/public/css/brand_shell.css` / `saas_theme/public/js/brand_shell.js` | Company identity, existing native user menu cleanup, and **one shared language dialog** for the Home toolbar and the Settings-adjacent profile menu. The language API belongs to `saas_theme/language.py`. |
| Workspace navigation polish | `saas_theme/public/css/workspace_shell_polish.css` / `saas_theme/public/js/workspace_shell_polish.js` | Workspace-specific navigation refinements only. |
| Modern native Desk sidebar + global Search | `saas_theme/public/css/workspace_sidebar_design.css` / `saas_theme/public/js/workspace_sidebar_design.js` | Modern light/dark Sidebar items and section spacing, accessible global Search launch in the sidebar, Desktop navbar search suppression only while expanded sidebar is available; native user menu, icons, routes and keyboard shortcuts unchanged. |
| Final Home-style Workspace KPI and chart treatment | `saas_theme/public/css/workspace_dashboard_design.css` / `saas_theme/public/js/workspace_dashboard.js` | Blue featured first visible native Workspace KPI, decorative (non-data) icon/mini-line, white KPI cards, native shortcuts/charts, responsive/dark/RTL; no Frappe controller patches. |
| Final Home-style Dashboard View treatment | `saas_theme/public/css/native_dashboard_view_design.css` / `saas_theme/public/js/native_dashboard_view.js` | Independent per-DocType Dashboard View appearance, real Frappe chart summary mini-cards, native KPI visuals, unchanged chart/menu behavior. |
| Native Workspace dashboard styling | `saas_theme/public/css/workspace_dashboard.css` | Dedicated route-scoped visual owner for standard Frappe v16 number cards, shortcuts, charts, link cards and quick lists. Does not touch custom Home analytics or Frappe widget behavior. |
| Native Dashboard view styling | `saas_theme/public/css/native_dashboard_view.css` | The Frappe v16 ListView Dashboard tab (`.dashboard-page .dashboard-view`), including Accounts and Buying dashboards; separate from Workspaces and custom Home. |
| Desktop navbar | `saas_theme/public/css/desktop_navbar_refinement.css` | Desktop navbar appearance/spacing. |
| Page-header avatar/profile repair (late-loaded) | `saas_theme/public/js/header_profile_repair.js` | Unchanged former v4 controller; ensures the page utility cluster, profile avatar, and native Frappe user menu remain usable after delayed sidebar initialization. |
| Mobile shell | `saas_theme/public/css/mobile_shell.css` / `saas_theme/public/js/mobile_shell.js` | Mobile-only shell/navigation behavior. |
| Form controls + navigation | `saas_theme/public/css/form.css` | Exact bundle of the former form controls + form navigation layers. Input/control rules remain first; tab/navigation rules remain second. Cross-layer sticky-state bugs still belong to the final stability layer. |
| Form palette | `saas_theme/public/css/palette.css` | Exact bundle of the former form palette + palette refinement layers, preserving historical order. |
| Form surface / layout experience | `saas_theme/public/css/form_surface.css` | Exact bundle of the former form experience + professional form card layers, preserving historical order. |
| List View | `saas_theme/public/css/list_view.css` | List rows, cards, list filters and list-only hover/spacing. |
| Home dashboard + ERP analytics styling | `saas_theme/public/css/home.css` | Exact CSS bundle of the former dashboard + analytics styles, preserving historical order. |
| Home sidebar access | `saas_theme/home.py` / `saas_theme/public/js/home_dashboard.js` / `saas_theme/public/js/quick_access_preferences.js` | The backend enforces **custom_hidden** (even for Administrator) and `custom_allowed_roles` for Sidebar/Workspace Sidebar. Both left Quick Access and Customize use one allowed list; boot can prefilter the hidden field but is not authoritative. |
| Home dashboard behavior | `saas_theme/public/js/home_dashboard.js` | Navigation uses user-visible **module sidebars** from Frappe boot, not Workspace cards; respect sidebar permission filtering and native routes. |
| ERP analytics behavior | `saas_theme/public/js/home_analytics.js` / `saas_theme/home.py` | Render only permission-available data. Home **Revenue uses GL Income account postings (credit minus debit) for the selected company's fiscal year to date**, not Sales Invoice totals; P&L period-closing vouchers are excluded. Chart Revenue uses the same GL postings grouped monthly. Invoice counts/status remain separate, and audit activity reads permission-filtered Version entries. |
| Home clarity | `saas_theme/public/css/home_clarity_refinement.css` | Home-only clarity/spacing refinements. |
| Precision compatibility styling | `saas_theme/public/css/precision.css` | Exact bundle of the former control precision + exact follow-up + final precision layers, preserving historical order. |
| General interface refinement styling | `saas_theme/public/css/interface.css` | Exact bundle of the former UI finish + interface refinement layers, preserving historical order. |
| Reports / DataTable + flat-form shell | `saas_theme/public/css/report_and_form_shell.css` | Query/Script report surfaces, report tables and the intentionally colocated no-tab/flat-form shell. |
| Checkbox, inline search and report filter foundations | `saas_theme/public/css/control_search_report.css` / `saas_theme/public/js/control_search_report.js` | Exact v6.1 foundation code, late-loaded immediately before the final v6.2 overrides; do not reimplement checkbox or report geometry in another owner. |
| Report filter/search behavior | `saas_theme/public/js/search_report_refinements.js` | Final report filter labels/utility classification and search behavior. **Frappe DataTable alone owns filter-cell widths** via `.dt-cell__content--col-N`; do not set outer-cell pixel widths. |
| Tree / Chart of Accounts | `saas_theme/public/css/tree_view_refinement.css` | Tree-specific rows, controls and checkboxes. |
| Grid + page-action alignment | `saas_theme/public/css/grid_and_action_alignment.css` | Child-grid geometry and page-head action alignment. Keep separate from form surface and reports because it spans both concerns. |
| Child-table visual baseline | `saas_theme/public/css/child_table_ui.css` / `saas_theme/public/js/child_table_ui.js` | Child-table rows, controls and Configure Columns behavior. |
| Expanded child-row editor, Link Selector, popup portal lifecycle, form-tab stability | `saas_theme/public/js/interaction_finish_v2.js` | **Authoritative final interaction controller.** Do not introduce another controller for these behaviors. |
| Desk stability CSS (late) | `saas_theme/public/css/desk_stability.css` | Exact former stability v3 + precision v4 CSS; load-time parity is protected by Phase 4B checks. |
| Final child-row/popup/menu/tab CSS and stacking contract | `saas_theme/public/css/ui_consolidation_v7.css` | **Authoritative final CSS stability layer.** Only cross-layer conflicts belong here. |
| Child-row editor visibility / modal stacking compatibility | `saas_theme/public/css/overlay_layers.css` | Owns the original v2 + v3 overlay/visibility compatibility rules, preserving PR #53. |
| Inline editable-grid Item/Warehouse popup geometry | `saas_theme/public/js/inline_grid_link_popup_anchor_v5.js` | Owns the PR #52/#53 width/scroll correction. Do not create another popup-position controller. |
| User menu / Theme Switcher | `saas_theme/public/js/user_theme_menu.js` | User-menu behavior. Also bootstraps required late precision assets; preserve loader order. |
| Form sidebar persistence | `saas_theme/public/js/form_sidebar_persistence.js` | Sidebar preference/toggle. Its current inline-grid compatibility loader order is intentional. |
| Quick Access / favorites | `saas_theme/public/js/quick_access_preferences.js` | Quick Access and preference behavior. |
| Route/loading experience | `saas_theme/public/js/route_loader.js` | Route transition/loading behavior. |
| Login styling | `saas_theme/public/css/login_refinement.css` | Login-only styling. |
| Login behavior / company branding | `saas_theme/public/js/login_fix.js` | Login-only interaction and branding. |
| Dark theme styling | `saas_theme/public/css/dark.css` | Exact bundle of the former dark base + dark surface correction layers, preserving historical order. |

---

## Historical compatibility layers still active

These files remain because they still contribute rules or behavior to the current working theme. They are not places to add unrelated features:

- `grid_and_action_alignment.css`
- `child_row_editor_finish.css`
- `overlay_layers.css` (the exact former overlay v2 + v3 blocks)
- `interaction_finish_v2.css`
- `popup_controls.css` (the exact former global-popup v3 + compact-autocomplete v4 blocks)
- `desk_stability.css` (exact original v3 + v4 CSS bundle); `stability_refinement_v3.js` remains its original late-loaded controller
- `header_profile_repair.js` (same active v4 controller after Phase 4F)
- `control_search_report.css` / `.js` (byte-identical v6 foundation for checkboxes, inline search and report filters)

Do not remove an active compatibility layer merely because a newer file exists. First prove that every selector, runtime guard, and event behavior it owns has been migrated.

---

## Cleanup migration program

The old stack will be cleaned in controlled phases.

### Phase 0 — Baseline and guardrails — completed

PR #54 established:

- the canonical ownership map;
- exact asset-order validation;
- runtime guard validation;
- CI architecture checks.

No runtime CSS/JS behavior changed.

### Phase 1 — Remove proven no-op compatibility assets — completed

Retired:

- `saas_theme/public/js/child_row_editor_finish.js`
- `saas_theme/public/css/child_row_editor_refinement_v65.css`

Both were proven no-op compatibility assets before removal. The validator prevents either filename from returning.

### Phase 2 — Mechanical bundling of contiguous, independent assets — completed

Completed migrations:

- `home_dashboard.css` + `home_analytics.css` → `home.css`
- `dark_mode_refinement.css` + `dark_surface_fix.css` → `dark.css`
- `form_palette.css` + `palette_refinement.css` → `palette.css`
- `form_experience_refinement.css` + `professional_form_card_fix.css` → `form_surface.css`
- `control_precision_fix.css` + `exact_ui_followup.css` + `final_precision_v2.css` → `precision.css`
- `ui_finish.css` + `interface_refinement.css` → `interface.css`
- `form_controls.css` + `form_navigation.css` → `form.css`

Phase 2 ends here. The remaining adjacent CSS files were reviewed and intentionally **not** bundled when their ownership boundaries differ. In particular, `form_surface.css`, `grid_and_action_alignment.css`, and `report_and_form_shell.css` remain separate because they own different runtime surfaces. The protected child-row/popup/overlay stack remained untouched during Phase 2; later independent cleanup phases may migrate exact, adjacent CSS blocks under pinned parity checks.

Each completed bundle is a byte-for-byte concatenation in the original CSS load order. JavaScript remains separate to avoid changing execution timing.

Rules for a bundle migration:

1. source files must be contiguous in the existing load order;
2. concatenate their contents **without editing selectors or code**;
3. preserve source order byte-for-byte inside the bundle;
4. replace only those exact hook entries with the new bundle at the same position;
5. search the repository for direct URL references before deleting source files;
6. keep dynamic/late-loaded assets separate until their loader behavior is migrated deliberately;
7. compare the bundle against its source files with a deterministic build/check script;
8. test the affected surfaces before proceeding to another bundle.

No two cleanup domains should be migrated in the same PR unless both are trivial and independently validated.

## Design-change readiness

Normal design work may resume after Phase 2. Phase 3 is **not** a prerequisite for new design changes. Future UI work should edit the canonical owner file directly and must not create another versioned/final/follow-up patch layer.

Protected compatibility files should be migrated only when the feature they own is being deliberately changed and can be regression-tested in that same PR. This keeps design work moving without risking the stabilized child-row, popup, overlay, tab or report behavior.

---

### Phase 3 — Move late-loaded precision layers into explicit owners

This is higher risk and happens only after Phase 2 is stable.

#### Phase 3A — Inventory and lock down the late-load graph

Before moving live code, run `python3 scripts/validate_theme_late_loaders.py`.
CI runs it alongside the existing architecture validator. It verifies the exact
currently effective *reference order*, file existence, duplicate injections,
hook registrations, and every versioned dynamic theme CSS/JS URL. This audit
does **not** alter runtime asset order, CSS declarations, or JavaScript handlers.

| Existing loader | Late-loaded children | Migration concern |
| --- | --- | --- |
| `user_theme_menu.js` | `stability_refinement_v3` bundled CSS + stability JS; `ui_precision_v4.js`; `child_table_ui` CSS/JS; `control_search_report` CSS/JS; `search_report_refinements.js` | Current order is part of the working header, report, checkbox, and child-table behavior |
| `search_report_refinements.js` | `search_report_refinements.css` | The same CSS URL appears in two intentional branches: update an existing link, or insert a new one |
| `form_sidebar_persistence.js` | `inline_grid_link_popup_anchor_v5` CSS/JS | Protected inline-grid dropdown positioning/scroll behavior |
| `interaction_finish_v2.js` | `ui_consolidation_v7.css` | Intentional *second* injection of CSS also included by hooks, preserving final cascade priority |

The original Phase 3A audit tracked **13 distinct late URLs**. After Phase 3C it tracks **12** and one intentional
direct/late CSS reinjection. No file should be deleted or moved merely because
it appears in both the Desk hook list and a dynamic loader.

**Next migration rule:** choose one of the unprotected late layers, document
each rule/event it owns, compare rendered light/dark views and route-reopen
behavior, and migrate it into the canonical owner at equivalent load timing.
Only then update the loader graph and delete its old file in a separate,
reversible pull request. Keep `ui_consolidation_v7.css`,
`interaction_finish_v2.js`, and inline-grid popup compatibility protected.


#### Phase 3B — Stabilize one late controller before migration

The first Phase 3B pass is deliberately limited to
`stability_refinement_v3.js`, the late-loaded controller for Desk header
recovery, sidebar scrolling, and no-tab/one-tab form classification.

- The unused internal `state.patched_sidebar` flag is removed; nothing reads it.
- Two identical delayed DOM-repair sequences now share one private helper.
  The original main refresh and 90ms/320ms follow-up timings remain intact.
- `scripts/test_stability_runtime.js` exercises these timers, route-change
  registration, single-initialization guard, and desktop/mobile sidebar
  behavior under a dependency-free simulated Frappe Desk environment.
- CI additionally runs `node --check` on the controller and adds static
  architecture guards for its active behaviors.

**No behavior has moved to another owner yet**: changing load timing could
break existing headers and forms. Its late loader, stylesheet, selectors,
native patches, and registration order remain exactly as before. Only consider
removing this layer after browser parity tests on live light/dark Desk,
Form, List, Report, and mobile pages prove the new owner equivalent.

#### Phase 3F — Audit and remove only genuinely dead runtime assets

`scripts/audit_runtime_asset_references.py` checks all active Frappe
`app_include_css`/`app_include_js` and web include references, direct
`www/login.html` stylesheet imports, dynamic JavaScript asset injections and
CSS asset URLs. It fails if any CSS/JS file in the public folders has no
runtime entry point or a runtime reference points to a missing file.

The audit deliberately proves that **versioned active files are not dead**:
`header_profile_repair.js` still repairs the header/profile; `login.css` is
loaded by the custom login page; the final `ui_consolidation_v7.css` is
intentionally in both hooks and a late repositioning controller. These must
not be deleted solely because the version in their name looks old.

After Phase 3D and 3E, the two redundant adjacent v4/v3 CSS files are gone.
**No further deletion is approved without proving that the file's runtime
behavior has moved and that there are no remaining references.** The audit
runs in CI so future feature PRs cannot accidentally orphan a live asset.

#### Phase 3E — Overlay stacking CSS parity bundle

The adjacent hook styles `overlay_stacking_fix.css` and
`overlay_stacking_v3.css` shared the same child-row and overlay ownership.
They are mechanically consolidated with **no changes to selectors, values,
media queries, variables or relative cascade order**:

- Append the complete original v3 stylesheet after a single newline in
  `overlay_stacking_fix.css`; remove only the redundant v3 hook and file.
- Keep the surviving stylesheet at the original position between
  `child_row_editor_finish.css` and `interaction_finish_v2.css`,
  cache-bumped to `v=3`. Child-row, Link Selector and modal stacking rules
  preserve their original order.
- `scripts/validate_phase3e_overlay_bundle.py` checks exact v2/v3 Git blob
  IDs, CSS boundary/order, hooks and absence of legacy dynamic loaders.
- Retire the old filename in the architecture validator and preserve runtime
  guards for child-row portal visibility on the combined file.
- No JavaScript event logic or `ui_consolidation_v7.css` late reinjection
  is moved. Live light/dark and modal/child-row browser smoke tests remain
  required before production.

#### Phase 3D — Popup and autocomplete CSS parity bundle

This is a deliberately mechanical consolidation of two **adjacent, hook-loaded**
styling files with overlapping ownership: `global_popup_polish_v3.css` and
`compact_autocomplete_and_form_gap_v4.css`.

- Appended the latter stylesheet **unchanged** after exactly one newline in
  `global_popup_polish_v3.css` to preserve selector order and specificity.
- Removed the now-redundant v4 CSS hook reference and deleted its file.
  The surviving popup asset keeps its original place immediately after
  `interaction_finish_v2.css` and before `ui_consolidation_v7.css`.
- Bumped only the surviving asset cache version from `v=3` to `v=4`.
- Retired the old filename in the architecture validator; the popup bundle
  now checks for both original marker sections.
- `scripts/validate_phase3d_popup_bundle.py` independently verifies
  the two immutable original Git-blob SHA IDs, byte-accurate concatenation,
  hook position and absence of any old dynamically loaded URLs.
- No JS controller, form state, child-row, popup stacking logic, checkbox,
  report filter or Desk behavior was rewritten.

**Remaining Phase 3 work:** header/profile and stability JS controllers,
child-table and report late loaders, popup-portal JS, and the final
`ui_consolidation_v7.css` styling layer still have live ownership. Their
migration requires equivalent runtime timing and browser regression
checks; don't delete these files by version suffix alone.

#### Phase 3C — Consolidate adjacent late CSS and delete v4.css

The first actual file removal in Phase 3 uses a **mechanical stylesheet
consolidation**, without changing any CSS rules or JavaScript controllers:

- The original `stability_refinement_v3.css` content is followed by exactly
  one newline and the complete original `ui_precision_v4.css` content.
  The two stylesheets had adjacent CSS cascade positions: the only intervening
  late asset was the stability **JavaScript** controller.
- The former `ui_precision_v4.css` injection was removed from
  `user_theme_menu.js`, and the now-unreferenced CSS file was deleted.
- `ui_precision_v4.js` remains loaded at its old position and retains its
  existing header/profile behavior.
- The surviving stability CSS URL is cache-bumped to `?v=3`; the loader
  `user_theme_menu.js` is cache-bumped to `?v=2`. No other asset URL is
  changed or reordered.
- `scripts/validate_phase3c_css_bundle.py` checks both original stylesheet
  contents against immutable Git blob SHA-1 IDs, their ordering, and deletion
  of the retired file. It runs in CI alongside the architecture and late
  dependency checks.

**Limitation:** The final CSS cascade is retained, but in the consolidated
bundle v4 declarations become available when the v3 stylesheet loads rather
than when a separate v4 stylesheet finishes loading. Live-browser light/dark,
route-reopen and responsive checks are still recommended before deploying.
Do not use this step as permission to remove the currently active v4 JS,
child-table, search, report, or overlay layers.

For each late layer:

- identify every selector/function it still uniquely owns;
- migrate that code into its canonical owner;
- preserve effective cascade/event order;
- remove its dynamic loader only after the migrated owner is verified;
- then delete the old file.

`ui_consolidation_v7.css`, `interaction_finish_v2.js`, and the current inline-grid popup compatibility fix are treated as protected stability owners until the end of this phase.

### Phase 4F — Canonical late header/profile controller (behavior-preserving)

The former `ui_precision_v4.js` remains an **active** Frappe v16 page-header
and user-menu repair, so the next safe step is to rename it, **not remove or
rewrite its behavior**:

- Rename `ui_precision_v4.js` to `header_profile_repair.js` with the
  **identical Git blob** (`65ad6b740bf1e0f998a08839f7e63230a27a08d5`).
  Keep its duplicate-initialization guard, event namespaces, delayed 100/350ms
  passes, MutationObserver, native menu binding and fallback avatar untouched.
- Replace only the single late-loading asset URL in `user_theme_menu.js`,
  preserving the original `st-ui-precision-v4-js` DOM ID, `defer`, and its
  stable position **after stability JS, before child-table UI**. Bump the
  loader's hook cache from `v=7` to `v=8` without reordering any assets.
- `scripts/validate_phase4f_header_profile_asset.py` pins the full original
  JS blob and entire pre-4F menu loader blob, verifies the single URL-only
  change, and protects DOM identity and loader order. Historical Phase 4B–4E
  validators independently reverse this one additional pinned rename before
  comparing their own original complete loader hashes.
- The runtime-reference audit, architecture inventory/retired names, late
  dependency graph, CI and targeted Node smoke test all use the new filename.

No changes to Home analytics, language selection, Frappe permissions, theme
switching, form/sidebar behavior, CSS declarations or popup controllers. A real
Desk browser smoke test of page-header avatar/menu, routes and light/dark/mobile
is still recommended before production.

### Phase 4E — Rename final inline-search and Query Report overrides

The previously independent v6.2 overrides retain their **exact** behavior,
runtime identities, and final position in the precision loading sequence.
Only descriptive filenames and asset URL literals change:

- `ui_precision_v6_2.css` → `search_report_refinements.css`:
  the stylesheet bytes and declaration order remain **100% identical**.
- `ui_precision_v6_2.js` → `search_report_refinements.js`:
  its two internal CSS URL literals change from the old v6.2 stylesheet
  to the new name; reversing only these two URLs reproduces the *entire*
  original v6.2 JavaScript Git blob.
- The `user_theme_menu.js` loader changes **only one** reference to the
  final override JS, retains its element ID, deferred injection behavior,
  and v6 foundation → v6.2 override order, and bumps the loader hook
  `v=6` → `v=7`. Reversing this URL restores the entire pre-4E loader.
- The original `st-ui-precision-v6-2-css` DOM ID, controller
  initialization flag, observer/timer wiring and
  `restore_native_filter_geometry` logic remain untouched. Do not rename
  these runtime identifiers: their values are not filenames.
- `scripts/validate_phase4e_search_report_overrides.py` pins both
  original Git blob hashes, exact loader replacement counts, and the
  CSS / JS / Hook dependency graph. Earlier Phase 4B–4D tests still
  verify original complete loader hashes after reversing this separately
  verified single URL rename.
- `scripts/test_search_report_refinements.js` checks the same CSS link
  is inserted once and updated instead of duplicated; the existing
  `scripts/test_report_filter_geometry.js` continues guarding native
  DataTable header/filter column widths and utility classification.

No Frappe Desk, form, Home, List, report filter, AwesomeBar or overlay
functionality is intentionally changed. Smoke-test Stock Ledger, General
Ledger, inline search, and dark mode in ERPNext before production use.

### Phase 4D — Rename the v6 controls, search and reports foundation

This phase changes **filenames, not behavior**, for the v6.1 foundation
that implements Check-field visual reliability, inline AwesomeBar search
and report filter/DataTable styling:

- `ui_precision_v6.css` → `control_search_report.css`.
- `ui_precision_v6.js` → `control_search_report.js`.
- Both new files have identical original Git blob SHA hashes. No CSS
  selector or JS event, timeout, observer, focus behavior or route logic
  is modified.
- Only two late asset URL literals change in `user_theme_menu.js`.
  Its DOM IDs, CSS-then-JS injection order and final v6.2 loader remain
  as before. Cache-bump that owner hook from `v=5` to `v=6`.
- The old filenames are retired in the architecture guard; the late
  loader manifest keeps the precise order. Phase 4B and 4C still
  reverse the two independently pinned URL renames before verifying
  their original complete loader SHA IDs.
- `scripts/validate_phase4d_controls_assets.py` independently checks
  both exact v6 Git blobs, the complete pre-Phase-4D loader source
  after reversing **only** the two URLs, original DOM identities,
  and that v6.2 still executes after v6.
- Report geometry tests now read the canonical v6 CSS owner and
  continue to validate the **unchanged** v6.2 report behavior.

**The final v6.2 overrides remain independently active**, not merged
or reordered. Their versioned filenames were subsequently normalized in
Phase 4E (above). Real browser tests on Stock Ledger, General Ledger,
form Check fields and AwesomeBar remain required before deployment.

### Phase 4C — Rename the child-table precision owner (CSS + JS)

The existing child-table v5 CSS/JS pair has one clear responsibility:
Configure Columns modal appearance/tagging, grid-row/editor styling and
the associated Frappe event refreshes. Phase 4C gives this owner
version-independent, matching filenames:

- `child_table_precision_v5.css` → `child_table_ui.css`;
  `child_table_precision_v5.js` → `child_table_ui.js`.
- Both renamed files have **exactly the same Git blob contents**. No
  CSS selectors, overrides, JavaScript event handlers, DOM selectors, timers,
  row-editing logic, global guards or injection IDs are changed.
- In `user_theme_menu.js`, change only the two asset URL strings; retain
  their original CSS-before-JS position between the v4 and v6 loaders.
  Cache-bump only `user_theme_menu.js?v=4` to `v=5`. Its other
  menu, theme, report, search and stability functions stay identical.
- `scripts/validate_phase4c_child_table_assets.py` pins the original
  CSS, JS and full loader Git hashes. Reversing exactly the two URL
  replacements must reproduce the prior loader byte-for-byte.
  `scripts/validate_phase4b_stability_asset.py` still validates its
  own historical original loader and allows only these independently
  pinned Phase 4C URL substitutions.
- `scripts/test_child_table_runtime.js` additionally exercises the
  unchanged Configure Columns tagging, child-row class tagging, click,
  page-change and after-Ajax scheduling, MutationObserver refresh and
  duplicate-controller guard in a simulated browser.
- The architecture and late-loader validators block returning the two
  old filenames. The Frappe app hooks, load timing and final overlay
  reinjection remain unchanged apart from the loader cache URL.

**Still protected:** all child-row popup/portal positioning controllers,
`interaction_finish_v2.js`, `ui_consolidation_v7.css`,
`ui_precision_v6` and v6.2 search/report fixes. Verify expanded child
rows, Configure Columns, linked fields and form styles with real browser
light/dark and responsive tests before production deployment.

### Phase 4B — Give the consolidated stability CSS a stable filename

The previously completed Phase 3C mechanical CSS bundle already had one
real late-loaded owner for stability v3 and precision v4 styling.

- Rename `stability_refinement_v3.css` to `desk_stability.css` with
  **exactly the same Git blob bytes**. Do not rewrite declarations.
- Change **only the CSS URL literal** in `user_theme_menu.js`, preserving
  its existing DOM injection ID, CSS-then-JS loader sequence, timings,
  menu events and dependent child-table/report loaders. The loader's
  hook cache version changes from `v=3` to `v=4`; the new stylesheet
  starts at `desk_stability.css?v=1`.
- Phase 3C's immutable original v3+v4 content parity validator now
  checks the descriptive file path. The Phase 4B regression validator
  compares the full renamed CSS blob with its original Git hash, and
  validates that the current entire loader JS becomes byte-identical
  to its original version after substituting **only** the URL string.
- The late-loader graph, architecture manifest and reference audit
  enforce the new path and guard against reintroduction of the retired
  stylesheet name. No user-facing behavior is intended to change.

**Not removed:** `stability_refinement_v3.js` remains active, along
with `ui_precision_v4.js`, `ui_precision_v6.js`,
`search_report_refinements.js`, child-grid, popup and other protected
controllers. Their remaining migrations require equivalent event
scheduling/route checks and real-browser testing before retirement.

### Phase 4A — Normalize the completed CSS bundles

Once Phase 3D and 3E proved the entire current popup and overlay rule sets
belong to adjacent canonical bundles, these two now-owning stylesheets were
renamed **without editing any CSS bytes**:

- `global_popup_polish_v3.css` → `popup_controls.css`.
- `overlay_stacking_fix.css` → `overlay_layers.css`.

Only their hook URLs are substituted at exactly the same positions, with
fresh `?v=1` filenames. The original CSS rules, specificity, cascade order,
all late-loaded assets, and the Frappe event handlers remain unchanged.
Both retired names are blocked by the architecture validator.

`scripts/validate_phase4_canonical_names.py` pins the two original
Phase 3D/3E **bundle Git blob hashes** and validates exact bytes and load
position, while the Phase 3D/3E scripts continue checking the historic
sub-block integrity. The Phase 3F audit ensures all runtime paths resolve.

**Still pending in Phase 4:** The other versioned JS/CSS assets are active
and not yet migrated to single non-versioned ownership, particularly
`stability_refinement_v3`, `ui_precision_v4.js`,
`search_report_refinements`,
`inline_grid_link_popup_anchor_v5`, and
`interaction_finish_v2` / `ui_consolidation_v7`. They cannot be
deleted or renamed as an untested batch while they contain live runtime
guards, special asset injection timing or corrected popup behavior.

### Phase 4 — Normalize names only after code ownership is clean

Renaming is the last step, not the first.

Only when each concern has one real owner should filenames be simplified. This avoids the previous failure mode where files looked clean while runtime behavior changed.

---

## Change routing examples

- “Make form inputs more modern” → `form.css` (controls section)
- “Change form card spacing/surface/layout” → `form_surface.css`
- “Change child-grid geometry or page-head action alignment” → `grid_and_action_alignment.css`
- “Change established cross-surface precision styling” → `precision.css`
- “Change command-palette/native workspace/general interface refinement styling” → `interface.css`
- “Change normal form tab spacing” → `form.css` (navigation section)
- “Change form palette/colors” → `palette.css`
- “Fix tabs becoming detached after scrolling” → `interaction_finish_v2.js` / `ui_consolidation_v7.css`
- “Change List View row hover” → `list_view.css`
- “Change report table/filter appearance or flat/no-tab form shell” → `report_and_form_shell.css`
- “Fix report filter behavior/alignment logic” → `search_report_refinements.js`
- “Fix Stock Ledger / General Ledger DataTable header/filter alignment” → `control_search_report.css` + `search_report_refinements.css` (input styling only, never force widths on `.dt-cell__content`) and `search_report_refinements.js` (remove legacy inline geometry; preserve DataTable column sizing). `scripts/test_report_filter_geometry.js` guards this.
- “Change child-table row visuals” → `child_table_ui.css`
- “Fix expanded child row opening/clicking” → `interaction_finish_v2.js`; use `overlay_layers.css` only for stacking/visibility compatibility
- “Fix Item/Warehouse inline dropdown width/position while scrolling” → `inline_grid_link_popup_anchor_v5.js`
- “Change normal Link suggestion density” → `ui_consolidation_v7.css`
- “Fix expanded child-table Link open/clear icon block or native show/hide behavior” → `ui_consolidation_v7.css` (body-portaled editor only; never restyle all `.link-btn` wrappers globally).
- “Change workspace navigation” → `workspace_shell_polish.css` / `.js`
- “Change native Workspace KPI, shortcut or chart appearance” → `workspace_dashboard_design.css` + `workspace_dashboard.js` (final design), with legacy `workspace_dashboard.css` as the preserved base.
- “Change native Dashboard View KPI, native chart summary or icon treatment” → `native_dashboard_view_design.css` + `native_dashboard_view.js`; leave `home.css` for the separate custom Home analytics layout.
- “Change Dashboard / Accounts (or another native Dashboard view) number cards and charts” → `native_dashboard_view.css`, not Workspace CSS.
- “Change dashboard/analytics styling” → `home.css`
- “Fix Home KPI data and invoice counts” → `saas_theme/home.py` with permission checks and base-currency totals; do not default inaccessible metrics to zero.
- “Change Home Quick Access links” → `home_dashboard.js`: use the current user's module sidebars, not Workspace favorites; never inject unauthorized navigation.
- “Change Home user activity” → `saas_theme/home.py` Version-only audit logs, read-permission checked per document; do not return Version field values.
- “Change Home production chart” → `home_analytics.js` for visualizations and `saas_theme/home.py` for counts of submitted Manufacture Stock Entries (do not add mixed UOM quantities).

- “Change dashboard behavior” → `home_dashboard.js`
- “Change analytics behavior/data” → `home_analytics.js`
- “Change login” → `login_refinement.css` / `login_fix.js`

---

## Home-style KPI parity v2 — separated native designs

PRs #110/#111 correctly introduced **Workspace** and **Dashboard View**
CSS owners, but broad historic widget `!important` rules and CSS-only
approaches did not produce the user's reference Home KPI composition.

- **Workspace:** `workspace_dashboard_design.css?v=2` and
  `workspace_dashboard.js?v=2` run only under
  `[data-page-route="Workspaces"]`. First visible KPI is blue; remaining
  KPIs are white cards with compact left/start-aligned real values,
  decorative top icon, decorative mini-line and bottom corner mark.
  Real native Shortcut and Dashboard Chart widgets get aligned surfaces.
- **Dashboard View:** `native_dashboard_view_design.css?v=2` and
  `native_dashboard_view.js?v=2` target Frappe's ListView Dashboard
  `.dashboard-page .dashboard-view` independently. The first visible
  real KPI is the blue featured card. The ChartWidget summary is inserted
  directly after `.widget-head`, so its actual `.report-summary` children
  become **separate** mini-cards. Existing chart filters/menus/data stay native.
- The small curved line in each KPI is an **aria-hidden visual motif**,
  not a fabricated trend or user data; we never change the Number Card
  value, percentage, currency, label or click handler. The native menu
  is above the decorative icon on hover/focus; touch modes leave menus usable.
- Existing broad and historical parity-locked CSS stays byte-for-byte
  untouched. The two **separate v2** stylesheets are appended last so
  native widget CSS can no longer override their layout; the two scripts
  only add scoped, deduplicated presentation nodes and CSS classes.
- Both retain Frappe permissions, widget reorder/edit controls, RTL
  layout, charts, report financial values, reduced motion and dark theme.
  They never patch `frappe.set_route`, widget prototypes, report data,
  or click handlers. Each script activates after AJAX/page navigation and
  watches only relevant widget mutations for async dashboard rendering.
- CI validates file and hook ownership, final CSS asset priority,
  unique first-card highlight, no duplicate icon nodes, stable native
  widget markup, hover menu safety and separate root scoping.

After merging, **bench build --app saas_theme**, clear site cache if needed,
and hard-refresh the browser. Check Buying Workspace and
Dashboard / Accounts on desktop/mobile and light/dark, including KPI
values, P&L summary, filters, donut legends, native widget menus and
Workspace/Dashboard customization.
## Native Dashboard View — Home-style KPI and chart cards

**Dashboard / Accounts** in Frappe 16 is *not* a Workspace route.
Frappe's `frappe.views.DashboardView` builds `.dashboard-page .dashboard-view`
and renders native Number Cards and Dashboard Charts with `WidgetGroup`.
This distinct markup is why the previous Workspace CSS did not restyle
the user's Dashboard / Accounts screenshot.

- `native_dashboard_view.css?v=1` is the dedicated scoped styling owner.
  It is appended after the existing Desk styles, intentionally outranking
  broad widget compatibility rules without modifying their original bytes
  or order. `workspace_dashboard.css` remains the actual Workspaces owner;
  `home.css` remains the separate custom Home analytics owner.
- KPI cards use Home-like proportions, left/start-aligned text, quiet
  borders/shadows, and a blue highlighted *first visible dashboard KPI*.
  This is visual prominence, not a claim that the first item is Revenue.
  The arrow glyph is static decoration, not a fake sparkline or trend.
  Hover/focus reveals Frappe's original Number Card Refresh/Edit menu.
- Chart headers/filters, bar corners, legends and axes receive only
  cosmetic polish. The Profit & Loss report summary becomes responsive
  individual metric tiles rather than one gray band; amounts, signs,
  currencies and semantic profit/loss colors remain native.
- The theme does not change chart data, dataset colors, tooltips,
  filtering, dashboard customization, widget ordering, navigation,
  page title, DocType permissions or any backend query.
- Explicit support for dark/light, mobile, RTL and reduced-motion.
  `scripts/test_native_dashboard_view.py` guards route isolation,
  components, chart interactions, and last-load asset placement.

Browser acceptance: Open Dashboard / Accounts and at least one other
native Dashboard tab; check KPI currency values and Refresh/Edit,
Profit & Loss chart and summary, chart menus/date filters/legends,
Receivable/Payable donut tooltips, Save/Discard customizations,
mobile widths, dark theme and RTL locales.
## Native ERPNext Workspace dashboards — visual-only design

The built-in **Buying, Selling, Stock, Accounts, and other** ERPNext/Frappe
v16 Workspaces use the framework's native Number Card, Shortcut, Dashboard
Chart, Link Card and Quick List widgets. Their content and permissions remain
under Frappe's own controllers. They are not the custom `.st-home-dashboard`.

- The dedicated `workspace_dashboard.css?v=1` is loaded after
  `workspace_shell_polish.css` and before `dark.css`, with no changes to the
  relative ordering of any existing stylesheet. It uses scoped
  `[data-page-route="Workspaces"]` selectors that outrank historical broad
  widget rules in `saas_theme.css` and `precision.css`.
- The design follows the custom Home visual language: crisp white/slate
  surfaces, restrained blue accents, compact readable KPI typography,
  consistent borders/radii, quiet shadows and accessible hover/focus states.
- Frappe Number Card values and currency formatting are unchanged. Native
  chart data, SVG dataset colors, plotting dimensions, tooltips, loading and
  empty states, chart filters, date inputs and dropdown actions remain intact.
- Native shortcut navigation/quick entry, link destinations, report permissions,
  edit-mode controls, widgets resizing, drag handles and layout grid are
  unchanged; no wrapping, custom onclicks or synthetic data are introduced.
- The style supports light/dark themes, RTL locales (including Pashto and
  Dari), mobile widths, and reduced-motion users.
- CI runs `python3 scripts/test_native_workspace_dashboard.py` to guard
  native widget contracts, CSS route isolation and safe asset loading.
  Live browser review is still necessary for real chart tooltips, filters,
  dropdowns, native workspace edit mode and RTL presentation.
## Home dashboard data contracts (v8)

- Only keys included in `get_dashboard_overview().kpis` may render a KPI. A missing key means unavailable or unauthorized, **not zero**. Never show a permission warning inside the dashboard.
- All financial KPIs use the selected user/company default and its base currency. No cross-company/currency sums. Stock = current `Bin.stock_value` total for company warehouses. Treasury = debit minus credit from Cash + Bank account types. Receivables = debit minus credit; Payables = credit minus debit.
- GL and Bin totals use `frappe.qb.get_query(..., ignore_permissions=False)` so row, role and field permissions remain enforced. The query builder default **ignores permissions**; always explicitly pass false.
- Revenue is net amount of posted Sales Invoices this month. The note uses `_("{0} submitted sales invoices").format(count)` to avoid leaking a literal `{0}`, and no percentage is shown when last month's amount is zero.
- Invoices/heatmap use a capped, *complete* permitted set; if capped, hide it rather than showing truncated totals. Production chart counts manufacturing runs only.
- Recent user activity = actual Frappe Comment and Version records, sorted by creation, with per-document `frappe.has_permission(..., doc=name, user=user)`. Do **not** expose sensitive Version old/new values or logs for unreadable documents.
- Regressions: `python3 scripts/test_home_dashboard.py` and `node scripts/test_home_dashboard_ui.js`. In-browser checks still required for light/dark, permission roles, empty states, mobile, and module sidebar navigation.

---

### Home KPI cards — primary Revenue and corner-fill hover

- Revenue alone has a permanent, solid **#1762ca** background with white
  text, icons and real Revenue/Expenses trend sparkline colors.
- The other seven KPI cards use a simple white surface with a subtle border
  in light mode and a readable dark-neutral surface in dark mode.
- Hover or keyboard focus on a non-Revenue card smoothly expands a blue
  `clip-path: circle(... at 100% 0%)` layer from its **top-right corner**,
  while copy, icons, sparklines and the action affordance turn white.
  The layer has `pointer-events:none` and stays behind the full clickable
  anchor contents; card routes and hidden-permission states are unchanged.
- The transition honors `prefers-reduced-motion`, and all selectors are
  limited to `st-home-dashboard .st-dashboard-v10 a.st-dash-kpi`.
  Never add this hover to chart tiles, Desk, Form, List or Report CSS.
- The source of truth is `saas_theme/public/css/home.css?v=13` and its
  exact hook/architecture cache version. Keep the prior Link and
  authorized-hidden KPI regression assertions working.

### Home V11 — Blue brand accent and native card navigation

- The horizontal Dashboard / Analytics / Activity tab strip is **deleted**
  (HTML, event handler and scoped styles). The Home content remains in its
  existing overview, operations and activity layout without redundant tabs.
- Use `#1762ca` for the Home primary accent, chart lines/fills, status and
  hover/focus treatments. Retain the eight shared Bank & Treasury ice-blue
  card surfaces and a subtle neutral-blue page background. Do not restyle
  the Desk, Form, List, Report or global sidebar themes.
- All **visible** KPI cards are native `<a>` links, preserving full-card
  click, keyboard focus, open-in-new-tab and browser Back behavior. Destination
  mappings: Revenue → Sales Invoice; Expenses → Profit and Loss Statement;
  Customers → Customer; Suppliers → Supplier; Stock Value → Stock Balance;
  Bank & Treasury → General Ledger; Receivables → Accounts Receivable;
  Payables → Accounts Payable.
- The four analytics cards also link to their relevant ERPNext source/report:
  monthly Revenue & Expenses → Profit and Loss Statement; Manufacture Runs →
  Stock Entry; Sales Activity and invoice status → Sales Invoice.
- The KPI and analytics cards remain hidden until their authorized source
  data arrives. Frappe continues to enforce permission checks for destination
  lists/reports; the Home theme does not bypass roles or publish restricted data.
- Version history continues to link **individual documents**, never the
  entire audit card. Quick Access continues its separate role-validated
  sidebar permissions and selection workflow.
- Tests: `scripts/test_home_v10_layout.js` now guards exact KPI/report link
  destinations, missing navigation, blue palette, authorized-hidden content,
  chart data and the scrollable Version list.

### Home V10 — Reference-layout implementation and uniform financial cards

- The Home **uses** the uploaded dashboard reference as an actual
  composition: subtle neutral-blue page surface, two compact KPI rows, a large Revenue & Expenses
  line chart beside Manufacturing Activity, Sales Activity stacked bars beside
  the paid/unpaid invoice donut, and a full-width Version activity list.
- The eight KPI cards all use the original **Bank & Treasury** ice-blue
  gradient (`#caeaff` to `#e9f6ff`), light border, readable dark text and
  a shared blue icon accent. Do not reintroduce eight saturated pastel colors.
- The stacked weekday bars are the existing Sales Invoice weekday/time
  matrix rendered as counts, not fabricated revenue, web traffic or activity.
  Time buckets determine segment heights and hover labels.
- Version-only activity remains permission-filtered on the server. The
  front end displays a **single-column, fixed-height scrolling list** with
  compact rows and a persistent header; no multi-column activity cards.
- The former in-page Dashboard/Analytics/Activity tab navigation was
  retired in Home V11. Use the normal Desk and sidebar navigation.
- Do not change Frappe/ERPNext Form, List, Reports, Quick Access role gates,
  Version payload fields or accounting calculations as part of this polish.
- Tests: `node scripts/test_home_v10_layout.js` for palette, data-grounded
  stacked bars, actual KPI/report links and Version list scroll behavior, plus
  existing architecture, permissions, dashboard, report and stability tests.
### Home V9 portfolio-style visuals and sidebar bulk selection

- The reference-inspired Home uses the **real** ERPNext KPIs: eight pastel
  snapshot cards (revenue, expenses, customers, suppliers, stock, cash,
  receivables, payables), not invented stock prices or growth figures.
- The six-month Revenue & Expenses view is a purple/cyan SVG line/area chart.
  Its axes, points, tooltips and the two tiny KPI sparklines use the
  permission-available `trend` arrays. If a metric is unavailable, omit it.
- Production remains an independently sourced manufacturing-run count chart;
  Sales Activity remains a weekday/time heatmap; paid/unpaid invoice figures
  retain their factual values. Home colors and layout belong to `home.css`.
- Version-only recent changes use a responsive two-column card/timeline
  presentation when space allows, displaying actor, document, time and safe
  change counts, with no Version values or unauthorized documents.
- Quick Access Customize uses the same server-approved list as the left
  sidebar. `Select All` checks every approved module, `Unselect All` checks
  none, and `Recommended` keeps the existing curated subset. The previous
  eight-item limit is intentionally removed; Quick Access scrolls vertically.
  Persisting `[]` keeps it empty and renders a Customize prompt rather than
  restoring recommendations. The modal never offers disallowed modules.
- Regression checks: `node scripts/test_home_visuals_and_picker.js` covers
  chart source values, escaped Version markup, action buttons and persistence.
  Continue the existing permission/role, architecture and report tests.
### Home Quick Access and Version log (role-safe refinement)

- Quick Access sidebar entries and the Customize modal share `home_dashboard.get_quick_access()`. The modal must **never** independently query Workspace pages or reinstate the legacy Workspace selection key.
- The frontend starts with **no visible sidebar entries** until `saas_theme.home.get_home_sidebar_access` returns approved names.
- This endpoint reads the `custom_allowed_roles` child table on configured `Sidebar` or legacy `Workspace Sidebar` documents and checks the current user's roles. Empty child table = unrestricted; nonempty without matching role = hidden. Errors fail closed.
- The user's Frappe boot sidebar visibility is the first gate; the custom-role endpoint is a second restrictive intersection. It does not grant access to ERPNext records.
- The activity feed is backed by **Version only**. It shows actor, document, time and safe field/row-change counts, with no old/new field values. Per-document read permission applies.
- All eight KPI cards share one modern blue surface and compact 18–22px amount typography. Keep styling in the existing `home.css` owner.
- Test users with and without custom sidebar roles: the sidebar and modal must both hide restricted items after refresh and stale preferences.

## Refactor policy

A refactor is acceptable only when current runtime behavior is preserved.

Preferred order:

1. remove assets proven to be no-ops;
2. rename local variables/functions inside the same owner file;
3. extract helpers inside the same owner file;
4. remove dead comments/duplicated internal code only after confirming no selector/event dependency;
5. mechanically bundle contiguous assets without changing their contents;
6. migrate late compatibility layers one at a time;
7. preserve DOM event timing, asset load order and CSS cascade order throughout;
8. rename/simplify filenames only after ownership has been proven.

The current working `version-16` remains the regression baseline throughout the migration.

### Phase 4 — Workspace compact sizing and DashboardView root correction (2026-11-11)

- **Workspace:** the v2 `height:100%` number-card rule stretched each card to the
  full grid track (observed approximately 180px). A scoped final rule now uses
  142px cards (130px/mobile, natural height while editing), 70px shortcuts,
  shorter inner padding, and keeps native filter/widget functionality.
- **Dashboard View:** the v2 CSS and enhancer both assumed
  `.dashboard-page .dashboard-view`. Frappe v16 guarantees
  `.dashboard-view` inside the actual view, while `.dashboard-page`
  is applied opportunistically to a wrapper. All v2 Dashboard design selectors
  and the enhancer now target the stable `.dashboard-view` directly.
  Essential styles (including three P&L summary tiles) also work before JS
  runs. Native chart datasets and currency formats remain untouched.
- Cache-bust only changed CSS / Dashboard JS to `?v=3`; retain independent
  Workspace JS `?v=2`. Run `scripts/test_native_design_v2.py`,
  `scripts/test_native_design_v2.js` and all existing CI checks.

### Dashboard / Accounts browser-verified selector correction (2026-11-11)

The user's actual Frappe v16 console confirms route
`["dashboard-view", "Accounts"]`, URL
`/desk/accounts/dashboard-view/Accounts`, **four** live
`.widget.number-widget-box` elements, **six**
`.widget.dashboard-widget-box` elements, and **zero**
`.dashboard-view` / `.dashboard-page` elements. The parent hierarchy is:

```
#page-dashboard-view.content.page-container
  .page-wrapper
    .page-content
      .dashboard
        .dashboard-graph
          .widget-group
            .widget-group-body.grid-col-3
              .widget.number-widget-box
```

Fix the **separate Dashboard** design owner only: target
`#page-dashboard-view .dashboard` throughout
`native_dashboard_view_design.css` and its JS enhancer. Style all Dashboard
charts, P&L mini-summary tiles and KPI cards through this route-scoped root,
including before async JS initialization. The dashboard controller gates
activation on the actual Frappe route, observes asynchronously inserted chart
widgets as well as cards, and retains native filters and menus.
Cache-bust only the changed Dashboard CSS/JS from v3 to **v4**.
Leave Workspace design CSS/JS and custom Home untouched.

Regression coverage now models the real dashboard parent hierarchy, route,
visible KPI and chart counts, async updates, no duplicate decorations,
and inactive-route safety. This DOM structure was supplied by the user,
not inferred from Frappe's older ListView Dashboard implementation.

### Native Workspace compact cards + modern sidebar search (November 2026)

- Compact the existing Workspace-only `workspace_dashboard_design.css` from
  **142px to 120px KPI cards**, from **70px to 60px shortcut rows**, keeping
  auto height during editing and 116px minimum on narrow screens. This is
  a pure Workspace visual change: the separate `#page-dashboard-view`
  Accounts Dashboard style and its financial calculations remain untouched.
- Add **`workspace_sidebar_design.css?v=1`** to own the Frappe v16 native
  `.body-sidebar-container` appearance. Items have a 42px click target,
  modern typography, icon alignment, clear first-row and native
  Section Break grouping, subtle hover, quiet borders, a blue selected
  row, an improved profile footer, dark mode, RTL-safe spacing and
  reduced-motion handling. Do not reparent/rewrite menu rows or links.
- Add **`workspace_sidebar_design.js?v=1`** to insert a single Search
  control directly beneath Frappe's SidebarHeader (before the scrolling
  menu). It opens **Frappe's own SearchDialog**; no duplicate search
  implementation, permissions, filtered results or route interception.
  A sidebar-only `/` shortcut is active only outside editable inputs.
- **Top navbar search** is hidden using `body.st-sidebar-search-available`
  only on desktop when the native sidebar is visible (expanded or
  collapsed as an icon rail). On Home/sidebar-free pages or mobile,
  the top search remains accessible. Notifications, language selection, user menu,
  search dialog and Ctrl+K continue working as before.
- New visual/controller assets are last in their respective Desk hook
  lists. Existing historical/byte-pinned styles and scripts are not
  changed or reordered. Cache-bust only the modified Workspace card CSS
  to `?v=4`. The Dashboard View stays at CSS/JS `v=4`.
- Verify in Buying and other Workspace sidebars: spacing, collapse,
  nested sections, Search click and `/`, Edit Workspace, mobile drawer,
  dark/RTL, user dropdown, global search, keyboard shortcuts and navbar
  restoration when the sidebar is unavailable. CI includes
  `scripts/test_modern_sidebar.py` and `scripts/test_modern_sidebar.js`.

### Inline sidebar search and Desk header finish (November 11, 2026)

The previous sidebar search button invoked `frappe.searchdialog.search.open_global_search_dialog()`
and opened a full-width modal. This is **not** the requested interaction.

- `workspace_sidebar_design.js?v=2` now owns an editable combobox under
  `.body-sidebar .sidebar-header`. Focus shows permitted navigation links in
  an **anchored dropdown**; typing filters local links plus Frappe's permission-aware
  DocType/report/workspace/dashboard options, with delayed
  `frappe.search.utils.get_global_results` for document results.
  All visible labels use `textContent`, not untrusted HTML.
- ArrowUp/ArrowDown select, Enter navigates, Escape closes, clicking outside
  closes; `/` focuses the sidebar input only outside editable fields.
  Remote results are debounced, stale results discarded, and failures leave
  local results available. Frappe's original sidebar anchor owns local
  navigation; no route or permission bypass. No search modal is launched.
- `workspace_sidebar_design.css?v=2` anchors a small scrollable dropdown
  under its control, stays usable in light/dark and collapsed/mobile modes.
- New `desk_header_finish.css?v=1` removes the large **desktop** navbar
  command-search field from Desk Home and list/form page headers, without
  removing global keyboard shortcuts or mobile search fallback. It also
  modernizes the **existing** notification bell/badge and avatar controls.
  Native popover, unread count, language chooser and user-menu behavior
  are untouched; only the final CSS surface changes.
- Keep all historic assets in their original positions. Only new sidebar
  CSS/JS asset versions increment and new header CSS loads last.
- Test targets: Manufacturing/Production Plan, Buying Workspace,
  Accounts Dashboard, collapsed sidebar, mobile, RTL/dark, permission-limited
  users, autocomplete results, empty/results states, keyboard navigation,
  notification popover and profile dropdown.

### Sidebar uses real Frappe AwesomeBar suggestions (November 11, 2026)

The previous inline dropdown listed only the active module's links (Home,
Dashboard, BOM...), not the global AwesomeBar's recent/frequent destinations.
This update uses Frappe's existing user-scoped AwesomeBar sources:

- `workspace_sidebar_design.js?v=3`: On focus with an empty query,
  `get_recent_pages` and `get_frequent_links` yield entries from across
  permitted modules; on typing it uses Frappe's native DocType, Report,
  Workspace, Dashboard, Page, Create, List Search, Recent and Executable
  providers. The existing `get_global_results` supplies permitted document
  records, with slots reserved for results.
- Preserve native `onclick(match)`, `route_options`, and Frappe routing
  when selecting items. Keyboard Up/Down, Enter, Escape, slash, and Ctrl/Cmd+K
  work in the anchored search dropdown. Ctrl/Cmd+K opens this sidebar palette
  when the sidebar is available; sidebar-free pages and mobile retain native
  hotkeys. No modal is opened from this control.
- `workspace_sidebar_design.css?v=3` widens the desktop dropdown to up
  to 430px, highlights the first global suggestion, hides repeated Navigation
  metadata, keeps light/dark and RTL behavior. On mobile it stays drawer width.
- `desk_header_finish.css?v=2` explicitly hides remaining desktop
  navbar search-widget variants, without removing native Frappe handlers.
- Regression tests check global recent/frequent ordering, typed commands,
  document results, route/onclick behavior, Ctrl+K, no duplicate search,
  mobile fallback, and the unchanged Workspace/Dashboard visual owners.

### Form navigation, formatted search labels, sticky navbar (11 November 2026)

The screenshots after PR #119 exposed three issues:
1. The native Frappe AwesomeBar formats `value` with e.g.
   `<b>Role</b> List`, but the Sidebar rendered those literal tags
   because it used `textContent` without stripping the markup.
   `workspace_sidebar_design.js?v=4` safely converts Frappe's limited
   formatting to **plain text** (HTML tags and basic character entities),
   and continues rendering with `textContent`. No untrusted HTML executes.
2. During Form navigation, Frappe can reconstruct `.body-sidebar`
   (or remove the inserted search shell) while retaining the surrounding
   `.body-sidebar-container`. The enhancer now checks Sidebar DOM identity,
   reattaches after `form-refresh` and `page-change`, observes the removed
   search control, invalidates stale async results and blurs after a chosen
   route so subsequent focus works. No duplicate Search input.
3. Frappe v16's **actual Desk search button** is
   `#full-search-button`; the `AwesomeBar.setup_correct_button()`
   method actively unhides it after `page-change` and `form-refresh`.
   Earlier CSS only hid wrappers and so the central navbar Search remained.
   `desk_header_finish.css?v=3` now targets this exact control at desktop
   breakpoints, plus the documented `#small-search-button` and Home
   `.search-widget-wrapper`, while keeping the underlying native
   SearchDialog for sidebar-free/mobile fallback. The real
   `.page-container > .page-head` and `.desktop-navbar` use sticky
   positioning and theme-aware borders/background, with a print exception.
The separate Workspace KPI, Accounts Dashboard, form controllers,
notification menus and business computations are unchanged.

### Fixed Desk header search ownership and white sticky navbar (11 November 2026)

Investigation found **three distinct CSS owners suppressing the Home search**
and an unrelated failure to hide later-rendered Desk header search UI:

1. `workspace_sidebar_design.css` hid `.desktop-navbar .search-widget-wrapper`
   under `body.st-sidebar-search-available`. This accidentally hid **Home**.
   Restrict suppression to `.page-head` only; `?v=4`.
2. `desk_header_finish.css` hid Home's `.search-widget-wrapper` and
   `.st-home-search-relocated` in three successive rule groups, including
   a broad `.navbar` rule. Those are now gone. Home's **native Frappe
   Desktop** search is explicitly displayed and retains its original
   click/search behavior. The real Frappe `.page-head` is opaque **white**
   (#fff) in light mode, dark-mode background is retained, and the
   `.desktop-navbar` remains sticky with white background; `?v=4`.
3. Frappe can dynamically render `#full-search-button`,
   `#small-search-button`, or a custom "Search or type a command"
   input/button after `page-change` or `form-refresh`.
   New **`desk_header_search.js?v=1`** scans only
   `.page-container .page-head` for exact command-search triggers,
   marks them hidden, repeats after Frappe route events and late DOM
   insertions, and restores them on mobile. It never touches Desktop Home
   `.desktop-navbar`, individual document filter controls, global search
   services, notification/profile, or modal fallback.
4. `workspace_sidebar_design.js?v=5` preserves the **Home** navbar's
   Ctrl/Cmd+K shortcut when its desktop navbar is visible. Other Desk
   pages keep sidebar search and its keyboard access.

Tests: `scripts/test_desk_header_search_scope.py` rejects future CSS
that hides Home's search and validates asset order/white styling;
`scripts/test_desk_header_search.js` mocks native Desktop/Desk controls,
late Form navigation, mobile restoration and untouched Home/profile/filter.
Existing sidebar regression also verifies that Home Ctrl+K is not stolen.
No Workspace KPI, Accounts Dashboard chart, form data or Frappe core
component is modified.

### Form autocomplete cards + RTL Desktop navbar (14 November 2026)

**Issue 1 — Link and Autocomplete dropdown behind the following section.**

The Form section-card owner `desk_stability.css` deliberately sets
`overflow: hidden !important` on
`.form-layout.st-section-card-form > .form-page > .form-section`.
That clips Frappe's nested Awesomplete popup at the card edge; a high
z-index on the input/UL cannot escape an ancestor's overflow. The result
is precisely the reported dropdown showing one visible option and hiding
the rest behind the next Form section.

- New **`form_autocomplete_layer.css?v=1`** is loaded after the existing
  stylesheets. Only the *currently active* Form section containing a
  focused/open Awesomplete gets `overflow:visible` and a bounded local
  z-index (`320`, below the sticky header and dialogs). Its body,
  column and Form tab wrappers similarly allow the results to extend.
  The native list has an independently scrollable maximum height of
  `min(280px,42vh)`. Hidden lists remain hidden.
- The surrounding sections keep their rounded card appearance and original
  overflow. Separate child-row editor portals, native modal overlays,
  Select2 and grid editing are **not modified**.

**Issue 2 — Pashto / RTL navbar layout.**

The Desktop Home native navbar contains `.navbar-home` (the logo) and
the `.flex.st-desktop-top-actions` group (search, language, notifications
and avatar). Earlier CSS set `margin-left:auto!important` on the group,
which is the wrong physical edge after Frappe switches to RTL.

- New **`rtl_navbar_alignment.css?v=1`** applies only to RTL document
  direction or `ps/fa/ar/ur` language. It fixes the logo at the physical
  right, cancels the conflicting left auto margin, uses
  `margin-inline-start:auto` / `margin-right:auto` to place **all**
  utility controls together at the physical left. Keeps native ordering,
  click handlers, unread counts and dropdowns untouched.
- Also aligns Form/List/Dashboard page-header utilities on the left when
  RTL. Narrow widths use Frappe's compact 36px search icon.
- LTR layout, normal Home navbar search restoration, full-white sticky
  header, and theme-specific dark-mode colors are not changed.

The CI test `scripts/test_form_autocomplete_rtl.py` guards the actual
source of clipping, active-only promotion, native Frappe list visibility,
RTL physical margins, original Desktop markup and asset load order.
A final visual check is still required on live Form pages and Home in
English, Pashto and Dari at desktop/mobile widths.

### RTL KPI cards, Profit & Loss legibility and Link actions (14 November 2026)

Reported screenshots after the prior RTL navbar correction showed three visual
errors in Pashto/Dari:

1. **Workspace and native Dashboard KPI cards:** The modern cards use
   `:before` top-right circular accents and CSS animations with
   `clip-path:circle(... at 100% 0%)`; the decorative icon/wave already
   follow RTL via `inset-inline-end`. This mixes a physical-right corner
   with an RTL-left icon and reverses the `K/M` currency suffix around a
   mixed Arabic/LTR number. New independent files
   `rtl_workspace_kpi.css?v=1` and `rtl_dashboard_cards.css?v=1`
   mirror the corner and hover reveal to **physical left**, retain
   existing action controls and native data, right-align translated
   labels, and use isolated LTR numeric runs aligned at the physical right.
   Only RTL contexts and corresponding real card selectors are targeted.
2. **Form Link/Dynamic Link Open icon:** Earlier
   `precision.css` and `ui_consolidation_v7.css` position the native
   `.link-field > .link-btn` with `right:4-5px` and reserve
   `padding-right:72px`. New `rtl_form_link_actions.css?v=1`
   moves this group inside the **physical left** of standard RTL Form
   Link inputs and reserves padding on the left. Open/Clear native
   actions, Frappe visibility rules, and Grid/Modal editors remain intact.
3. **Profit and Loss summary:** Frappe ChartWidget supplies real
   `.report-summary > .summary-item` labels, whose previous CSS
   forced 11.5px muted text. The RTL native Dashboard file now sets a
   readable 13.5px, 700-weight, high-contrast Pashto/Dari label, allows
   natural line wrapping, adds vertical breathing room, and isolates
   the numeric value so currency and digits read in the correct order.
   No value, green/red profitability color, filters or graph data change.

Added source-level regression test
`scripts/test_rtl_kpi_form_readability.py` and wired it into the
architecture CI. Three independent stylesheet owners are appended after
the existing styles so other areas and LTR are not touched. Validate
visually on Buying/Accounts Dashboard, Profit & Loss chart and RTL
standard Form Link fields before deployment.

### RTL Link input text and KPI sparkline non-overlap (14 November 2026)

PR #123 mirrored the Workspace and Dashboard decorations but left the
sparkline in the **same physical-left region** as the Open icon (the
wave starts at left:17px, icon is left:14px and 25px wide). In the
reported RTL screenshot the line visibly crosses the Open icon.

The v2 owners `rtl_workspace_kpi.css` and `rtl_dashboard_cards.css`
now place the decorative wave at physical left **58px**, leaving
at least **19px of horizontal separation** from the icon's footprint
(left:14–39px). The native KPI data, clicks, menus, charts and graph
series stay unchanged.

A second reproduced issue was RTL Form Link text disappearing under the
Open action. In `rtl_form_link_actions.css?v=1`, a direction:ltr
link-button wrapper was assigned `inset-inline-end:5px` alongside
`left:5px`. On a direction:ltr wrapper, the logical end resolves
to **physical right**, overriding the intended left pin. A headless
Chromium geometry check reproduced right:5px and verified that removing
the competing logical insets produces left:5px. The v2 CSS also
reduces the default padding reserve from 72px to 44px for one native
Open action, using 76px only when the native Clear action is visible.
It explicitly preserves native Frappe inline display:none states,
text-align:right, and an RTL input string. Form Grid and modal controls
remain separate.

`test_rtl_kpi_form_readability.py` now guards the exact physical
left icon/wave separation, single/dual icon padding, native hide
contracts, and the absence of conflicting logical insets. Browser
acceptance is still needed in the user's actual Form and Workspace.

### Follow-up: RTL Link spacing, KPI decorative direction, LTR Profit & Loss (14 November 2026)

Screenshots from the actual deployment exposed three remaining visual regressions
after PR #124:

1. **RTL Link action had a blank strip to its physical left.**
   Frappe v16's `ControlLink.make_input()` inserts the optional Clear
   anchor **before** the Open anchor inside `.link-btn`. Generic theme
   rules may keep the Clear anchor in the flex layout even while it
   appears visually hidden, pushing Open approximately one button-width
   to the right. `rtl_form_link_actions.css?v=3` uses
   `flex-direction:row-reverse` on the *RTL-scoped* Link action
   container, placing Open nearest the left field border, with Clear
   immediately to its right when visible. All Frappe selection
   callbacks, blur/hide behavior, permissions and keyboard handling are
   unchanged. Input padding remains 44px for Open only or 76px when
   Clear is actually visible.
2. **RTL KPI sparkline pointed in the wrong direction.**
   The native decorative SVG rises toward the **right** and the LTR
   design anchors it near the right Open icon. The preceding RTL patch
   merely shifted the wave to `left:58px`, which changed spacing
   but **did not mirror the shape**. `rtl_workspace_kpi.css?v=3`
   and `rtl_dashboard_cards.css?v=3` now place the wave at the
   matching mirrored edge `left:17px` and apply `scaleX(-1)`
   **only to its decorative SVG**. `bottom:27px` keeps the
   rising tip above the Open icon instead of drawing across it.
   The actual KPI value, labels, chart datasets and native links are
   not changed.
3. **English Profit & Loss summary was left-biased.**
   Earlier generic `native_dashboard_view_design.css` rules forced
   `align-items:flex-start` and `text-align:start`, including for
   English. Its v5 correction adds a
   `:root:dir(ltr) body:dir(ltr)`-scoped rule for real native
   DashboardView ChartWidget `.report-summary` tiles. The label and
   value now center together with readable 13px labels and 21–26px
   values. RTL/Pashto/Dari summary rules remain separate and unchanged,
   including profit/loss green/red colors.

The test `scripts/test_rtl_kpi_form_readability.py` now guards
Frappe's native Clear/Open DOM order, RTL `row-reverse` positioning,
SVG direction/vertical clearance, and centered **LTR** summary text.
A local Chromium DOM/layout sanity rendering verified the first visible
Open button sits 5px inside the left input border, Clear is hidden,
the waveform's SVG uses a `matrix(-1,0,0,1,0,0)` transform in RTL,
and the English summary labels compute to `text-align:center`.
This is not a substitute for a live Frappe browser visual check.

### Native child-row selection, mobile Desk menu and RTL sidebar footer (14 November 2026)

New visual QA screenshots show three UI regressions.

**Child table:** Frappe v16 `grid_row.js` creates a `.row-check`
with a native `input.grid-row-check` next to the 40px row index. Frappe
`grid.js` reserves **31px** for its sticky checkbox cell and **40px**
for the row index, then uses checkbox click/checked state to activate
the native `Delete row` / `Delete N rows` actions. Old theme
`precision.css` overrode the cell minimum to 36px. Revised
`child_table_ui.css?v=2`, loaded by `user_theme_menu.js?v=9`,
restores the native 31/40 geometry, keeps enabled checkboxes visible
and clickable, and pins the two cells at the **physical right** of
horizontally scrolling RTL tables. It does not introduce deletion logic
or override permissions, read-only, or hidden button states.

**Mobile Desk:** `desk_stability.css` had hidden the native page
sidebar control, while `mobile_shell.css` converted the Sidebar into
an off-canvas drawer. The mobile Dashboard screenshot had no way to
open that drawer. `mobile_shell.js?v=3` adds one 36px accessible
menu trigger to visible Desk page headers (and Desktop Home mobile
navbar); it calls the **native `frappe.app.sidebar.open()/close()`**,
respects `page_allows_sidebar`, updates `aria-expanded` and recovers
after route changes. `mobile_shell.css?v=2` raises the drawer
over the sticky header and mirrors its entry edge/backdrop for
Pashto/Dari RTL. No duplicate navigation list or route permissions.

**RTL Collapse menu:** The real `st-sidebar-persist-toggle` is
attached inside the native sidebar bottom area by
`brand_shell.js?v=3`. It now also exists while the mobile drawer
is open (Close navigation), reverses chevron orientation for RTL,
and keeps the label next to its icon; updated `brand_shell.css?v=5`
ensures the RTL label/control remains visible in expanded state.
Frappe still owns sidebar expanded/collapsed state and persistence.

Test all three in Pashto/Dari and English, with a child table with
editable rows, a disabled/read-only table, Dashboard / Accounts mobile
at widths <768px, Home mobile, and desktop sidebar collapse.

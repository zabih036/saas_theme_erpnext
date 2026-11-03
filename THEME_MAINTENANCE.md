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
| Company/header branding | `saas_theme/public/css/brand_shell.css` / `saas_theme/public/js/brand_shell.js` | Company identity and branded shell behavior. |
| Workspace navigation polish | `saas_theme/public/css/workspace_shell_polish.css` / `saas_theme/public/js/workspace_shell_polish.js` | Workspace-specific navigation refinements only. |
| Desktop navbar | `saas_theme/public/css/desktop_navbar_refinement.css` | Desktop navbar appearance/spacing. |
| Mobile shell | `saas_theme/public/css/mobile_shell.css` / `saas_theme/public/js/mobile_shell.js` | Mobile-only shell/navigation behavior. |
| Form controls + navigation | `saas_theme/public/css/form.css` | Exact bundle of the former form controls + form navigation layers. Input/control rules remain first; tab/navigation rules remain second. Cross-layer sticky-state bugs still belong to the final stability layer. |
| Form palette | `saas_theme/public/css/palette.css` | Exact bundle of the former form palette + palette refinement layers, preserving historical order. |
| Form surface / layout experience | `saas_theme/public/css/form_surface.css` | Exact bundle of the former form experience + professional form card layers, preserving historical order. |
| List View | `saas_theme/public/css/list_view.css` | List rows, cards, list filters and list-only hover/spacing. |
| Home dashboard + ERP analytics styling | `saas_theme/public/css/home.css` | Exact CSS bundle of the former dashboard + analytics styles, preserving historical order. |
| Home dashboard behavior | `saas_theme/public/js/home_dashboard.js` | Dashboard behavior. |
| ERP analytics behavior | `saas_theme/public/js/home_analytics.js` | Analytics interactions and data loading. |
| Home clarity | `saas_theme/public/css/home_clarity_refinement.css` | Home-only clarity/spacing refinements. |
| Precision compatibility styling | `saas_theme/public/css/precision.css` | Exact bundle of the former control precision + exact follow-up + final precision layers, preserving historical order. |
| General interface refinement styling | `saas_theme/public/css/interface.css` | Exact bundle of the former UI finish + interface refinement layers, preserving historical order. |
| Reports / DataTable + flat-form shell | `saas_theme/public/css/report_and_form_shell.css` | Query/Script report surfaces, report tables and the intentionally colocated no-tab/flat-form shell. |
| Report filter/search behavior | `saas_theme/public/js/ui_precision_v6_2.js` | Existing final report filter-cell/search behavior. Do not duplicate elsewhere. |
| Tree / Chart of Accounts | `saas_theme/public/css/tree_view_refinement.css` | Tree-specific rows, controls and checkboxes. |
| Grid + page-action alignment | `saas_theme/public/css/grid_and_action_alignment.css` | Child-grid geometry and page-head action alignment. Keep separate from form surface and reports because it spans both concerns. |
| Child-table visual baseline | `saas_theme/public/css/child_table_precision_v5.css` / `saas_theme/public/js/child_table_precision_v5.js` | Child-table rows, controls and Configure Columns behavior. |
| Expanded child-row editor, Link Selector, popup portal lifecycle, form-tab stability | `saas_theme/public/js/interaction_finish_v2.js` | **Authoritative final interaction controller.** Do not introduce another controller for these behaviors. |
| Final child-row/popup/menu/tab CSS and stacking contract | `saas_theme/public/css/ui_consolidation_v7.css` | **Authoritative final CSS stability layer.** Only cross-layer conflicts belong here. |
| Child-row editor visibility / modal stacking compatibility | `saas_theme/public/css/overlay_stacking_v3.css` | Owns the current PR #53 visibility compatibility fix. |
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
- `overlay_stacking_fix.css`
- `interaction_finish_v2.css`
- `global_popup_polish_v3.css`
- `compact_autocomplete_and_form_gap_v4.css`
- `stability_refinement_v3.css` / `.js`
- `ui_precision_v4.css` / `.js`
- `ui_precision_v6.css` / `.js`

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

Phase 2 ends here. The remaining adjacent CSS files were reviewed and intentionally **not** bundled when their ownership boundaries differ. In particular, `form_surface.css`, `grid_and_action_alignment.css`, and `report_and_form_shell.css` remain separate because they own different runtime surfaces. The protected child-row/popup/overlay stack also remains untouched.

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
| `user_theme_menu.js` | `stability_refinement_v3` CSS/JS; `ui_precision_v4` CSS/JS; `child_table_precision_v5` CSS/JS; `ui_precision_v6` CSS/JS; `ui_precision_v6_2.js` | Current order is part of the working header, report, checkbox, and child-table behavior |
| `ui_precision_v6_2.js` | `ui_precision_v6_2.css` | The same CSS URL appears in two intentional branches: update an existing link, or insert a new one |
| `form_sidebar_persistence.js` | `inline_grid_link_popup_anchor_v5` CSS/JS | Protected inline-grid dropdown positioning/scroll behavior |
| `interaction_finish_v2.js` | `ui_consolidation_v7.css` | Intentional *second* injection of CSS also included by hooks, preserving final cascade priority |

The audit currently tracks **13 distinct late URLs** and one intentional
direct/late CSS reinjection. No file should be deleted or moved merely because
it appears in both the Desk hook list and a dynamic loader.

**Next migration rule:** choose one of the unprotected late layers, document
each rule/event it owns, compare rendered light/dark views and route-reopen
behavior, and migrate it into the canonical owner at equivalent load timing.
Only then update the loader graph and delete its old file in a separate,
reversible pull request. Keep `ui_consolidation_v7.css`,
`interaction_finish_v2.js`, and inline-grid popup compatibility protected.


For each late layer:

- identify every selector/function it still uniquely owns;
- migrate that code into its canonical owner;
- preserve effective cascade/event order;
- remove its dynamic loader only after the migrated owner is verified;
- then delete the old file.

`ui_consolidation_v7.css`, `interaction_finish_v2.js`, and the current inline-grid popup compatibility fix are treated as protected stability owners until the end of this phase.

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
- “Fix report filter behavior/alignment logic” → `ui_precision_v6_2.js`
- “Change child-table row visuals” → `child_table_precision_v5.css`
- “Fix expanded child row opening/clicking” → `interaction_finish_v2.js`; use `overlay_stacking_v3.css` only for stacking/visibility compatibility
- “Fix Item/Warehouse inline dropdown width/position while scrolling” → `inline_grid_link_popup_anchor_v5.js`
- “Change normal Link suggestion density” → `ui_consolidation_v7.css`
- “Change workspace navigation” → `workspace_shell_polish.css` / `.js`
- “Change dashboard/analytics styling” → `home.css`
- “Change dashboard behavior” → `home_dashboard.js`
- “Change analytics behavior/data” → `home_analytics.js`
- “Change login” → `login_refinement.css` / `login_fix.js`

---

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

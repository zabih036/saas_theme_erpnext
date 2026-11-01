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
| Form controls | `saas_theme/public/css/form_controls.css` | Data, Link, Select, Date, read-only/submitted controls. |
| Form tabs/navigation | `saas_theme/public/css/form_navigation.css` | Normal form tab presentation. Cross-layer sticky-state bugs belong to the final stability layer. |
| Form palette | `saas_theme/public/css/form_palette.css` | Form-specific color tokens/palette. |
| Professional form card/surface | `saas_theme/public/css/professional_form_card_fix.css` | Form card shell, spacing and surface treatment. |
| Form layout/experience refinements | `saas_theme/public/css/form_experience_refinement.css` | Established form-layout refinements not owned by controls/tabs. |
| List View | `saas_theme/public/css/list_view.css` | List rows, cards, list filters and list-only hover/spacing. |
| Home dashboard + ERP analytics styling | `saas_theme/public/css/home.css` | Exact CSS bundle of the former dashboard + analytics styles, preserving historical order. |
| Home dashboard behavior | `saas_theme/public/js/home_dashboard.js` | Dashboard behavior. |
| ERP analytics behavior | `saas_theme/public/js/home_analytics.js` | Analytics interactions and data loading. |
| Home clarity | `saas_theme/public/css/home_clarity_refinement.css` | Home-only clarity/spacing refinements. |
| Reports / DataTable appearance | `saas_theme/public/css/report_and_form_shell.css` | Query/Script report surfaces and report tables. |
| Report filter/search behavior | `saas_theme/public/js/ui_precision_v6_2.js` | Existing final report filter-cell/search behavior. Do not duplicate elsewhere. |
| Tree / Chart of Accounts | `saas_theme/public/css/tree_view_refinement.css` | Tree-specific rows, controls and checkboxes. |
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
| Dark theme base refinements | `saas_theme/public/css/dark_mode_refinement.css` | General dark-mode adjustments. |
| Dark control/surface corrections | `saas_theme/public/css/dark_surface_fix.css` | Dark-mode surface/control corrections. |

---

## Historical compatibility layers still active

These files remain because they still contribute rules or behavior to the current working theme. They are not places to add unrelated features:

- `palette_refinement.css`
- `ui_finish.css`
- `interface_refinement.css`
- `control_precision_fix.css`
- `exact_ui_followup.css`
- `final_precision_v2.css`
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

### Phase 2 — Mechanical bundling of contiguous, independent assets — current

First migration: `home_dashboard.css` + `home_analytics.css` → `home.css`.

The bundle is a byte-for-byte concatenation in the original CSS load order. JavaScript remains in `home_dashboard.js` and `home_analytics.js` to avoid changing execution timing.

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

### Phase 3 — Move late-loaded precision layers into explicit owners

This is higher risk and happens only after Phase 2 is stable.

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

- “Make form inputs more modern” → `form_controls.css`
- “Change normal form tab spacing” → `form_navigation.css`
- “Fix tabs becoming detached after scrolling” → `interaction_finish_v2.js` / `ui_consolidation_v7.css`
- “Change List View row hover” → `list_view.css`
- “Change report table/filter appearance” → `report_and_form_shell.css`
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

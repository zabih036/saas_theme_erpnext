<p align="center">
  <img src="saas_theme/www/logo.png" alt="Saas Theme Logo" width="120">
</p>

<h1 align="center">Saas Theme</h1>

<p align="center">
  A modern, polished SaaS UI theme for <strong>Frappe Framework v16</strong> that transforms the default desk into a sleek, professional interface.
</p>

---

## Features

### Dual Sidebar with Workspace Rail
- Dark workspace rail (60px) with module icons for quick switching
- Sidebar panel with smooth expand/collapse behavior
- Tooltips on rail hover, active state indicators

### Redesigned Form UI
- Larger, squarish form inputs scoped to forms only (filters untouched)
- Active tabs styled with primary color border, background, and text
- Modern form right sidebar with colored section icons, enhanced attachment cards, and polished meta footer

### Slide-in Child Table Editor
- Child table row editing opens as a right-side sheet instead of a centered modal
- Full-height panel with slide-in animation, scrollable body, header/footer toolbars
- Close button and all action buttons always visible

### Enhanced Attachments
- File type badges (PDF, DOC, XLS, IMG, ZIP, CODE) with color coding
- Clean card layout with filename, privacy status, and remove button
- Auto-enhances dynamically added attachments via MutationObserver

### Dashboard Widgets
- Squarish card design with subtle header separation
- Chart colors overridden to primary blue
- Consistent hover effects across all widget types

### Connections Tab
- Grouped mini-cards with masonry layout (CSS columns)
- Uppercase section headers with subtle background
- Clean list rows with primary-colored count badges

### Login Page
- Two-column split layout with form on left and branded gradient panel on right
- Polished inputs, buttons, and social login styling
- Mobile responsive — panel hidden on small screens
- Dark mode support

### Desk Homepage
- Proper 6-column grid layout for workspace icons
- Hover effects with lift animation
- Responsive breakpoints (4 columns tablet, 3 columns mobile)

### User Menu
- Custom user menu triggered from sidebar avatar
- Profile info, integrations, logout, and version display

---

## Screenshots

### Workspace Home & Sidebar
![Workspace Home](saas_theme/screenshots/home_buying.png)
*Dual sidebar with dark workspace rail, module icons, and Buying workspace*

### Dashboard
![Dashboard](saas_theme/screenshots/dashboard.png)
*Polished dashboard with number cards, charts in primary blue, and squarish widget cards*

### List View
![List View](saas_theme/screenshots/list_view_purchase_invoice.png)
*Clean list view with status indicators and styled filters*

### Connections Tab & Form Sidebar
![Connections Tab](saas_theme/screenshots/connections_tab_with_right_sidebar.png)
*Grouped connection cards with masonry layout and redesigned right sidebar*

### Slide-in Child Table Editor
![Child Table Editor](saas_theme/screenshots/child_table_edit.png)
*Right-side sheet for editing child table rows with all actions visible*

### Login Page
![Login](saas_theme/screenshots/login.png)
*Two-column split login with branded gradient panel*

### Reports
![General Ledger](saas_theme/screenshots/report_general_ledger.png)
*General Ledger report view*

![Trial Balance](saas_theme/screenshots/report_trial_balance.png)
*Trial Balance report with expandable tree view*

---

## Requirements

- Frappe Framework v16
---

## Installation (this customized fork)

The ERPNext theme maintained in this repository is **not** the upstream
`vineyrawat/saas_theme` theme. Installing the upstream repository will **not**
include dashboard, Workspace, form, or language changes merged here.

```bash
cd "$PATH_TO_YOUR_BENCH"
bench get-app --branch version-16 https://github.com/zabih036/saas_theme_erpnext.git
bench --site YOUR_SITE_NAME install-app saas_theme
bench build --app saas_theme
bench restart
```

For an existing installation, check the actual local repository before updating.
A GitHub pull-request merge does **not** deploy code to your Frappe bench.

## Safely update the customized theme

```bash
cd "$PATH_TO_YOUR_BENCH"

# Ensure local app modifications will not be overwritten.
git -C apps/saas_theme status --short
git -C apps/saas_theme remote -v
git -C apps/saas_theme branch --show-current

# On the existing version-16 branch, fetch this customized fork.
git -C apps/saas_theme fetch https://github.com/zabih036/saas_theme_erpnext.git version-16
git -C apps/saas_theme merge --ff-only FETCH_HEAD

# Refresh built/public assets and the target site's cached hook values.
bench build --app saas_theme
bench --site YOUR_SITE_NAME clear-cache

# Apply updated Python hooks on a maintenance window (may interrupt requests).
bench restart
```

**Do not** use `git reset --hard`, discard local changes, or force-pull if
`git merge --ff-only` fails. Inspect the divergent history first, especially
on production. If the app is inside a Docker deployment, run the Git and build
steps in the persistent source/build environment used to create the running
containers and redeploy the updated image as appropriate.

### Verify PR #113 is really deployed

The read-only verifier checks that the installed repository contains the
merged design, that the correct public files exist, and optionally that the
site serves the current CSS/JS rather than old or cached versions:

```bash
cd "$PATH_TO_YOUR_BENCH"
bash apps/saas_theme/scripts/check_theme_deployment.sh "$PWD" https://YOUR_ERP_DOMAIN
```

Expected source baseline is merge commit `265abc5ca50c9ec69475013a1e216d1d1662383b`
(PR #113) or a later descendant. Required asset URLs include:

- `/assets/saas_theme/css/workspace_dashboard_design.css?v=3`
- `/assets/saas_theme/css/native_dashboard_view_design.css?v=3`
- `/assets/saas_theme/js/native_dashboard_view.js?v=3`

Finally, log into Desk, open the **Buying Workspace** and
**Dashboard / Accounts**, and hard-refresh with **Ctrl+Shift+R**. The
CI suite validates the *repository*, not the running server or its cache.
If the verifier passes but the browser still shows old cards, use DevTools
Network to ensure these assets load with HTTP 200 and inspect their computed
CSS rules for overrides.

## Uninstall

```bash
cd $PATH_TO_YOUR_BENCH
bench uninstall-app saas_theme
bench remove-app saas_theme
bench restart
```

---

## Configuration

No additional configuration required. The theme activates automatically on installation and applies to all desk pages.

Desk CSS and JS assets are listed in `saas_theme/hooks.py`; changed
asset URLs use versioned query strings. A PR merge alone does not update the
server checkout, its built assets, or the user's browser cache.

---

## Compatibility

| Component | Version |
|-----------|---------|
| Frappe    | v16     |

---

## Support

For support, feature requests, or bug reports, contact:

- **Email**: vineyrawat@yahoo.com, vinay@vinay-rawat.dev
- **Publisher**: [Vinay Rawat](https://github.com/vineyrawat)

---

## License
MIT

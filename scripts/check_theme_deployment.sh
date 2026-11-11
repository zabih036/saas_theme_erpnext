#!/usr/bin/env bash
# Read-only verification of the merged ERPNext Workspace / Dashboard assets.
# Usage: bash apps/saas_theme/scripts/check_theme_deployment.sh [BENCH_ROOT] [SITE_BASE_URL]
set -uo pipefail
bench_root="$PWD"
site_base_url=""
if (( $# >= 1 )); then bench_root="$1"; fi
if (( $# >= 2 )); then site_base_url="$2"; fi
app_dir="$bench_root/apps/saas_theme"
asset_dir="$bench_root/sites/assets/saas_theme"
expected_commit="265abc5ca50c9ec69475013a1e216d1d1662383b"
errors=0

pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1"; errors=$((errors + 1)); }
warn() { printf 'WARN: %s\n' "$1"; }

if ! git -C "$app_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    fail "No Git checkout in $app_dir; run from bench root."
    exit 1
fi
printf 'Installed theme commit: '
git -C "$app_dir" rev-parse HEAD
printf 'Theme Git remotes:\n'
git -C "$app_dir" remote -v

if git -C "$app_dir" remote -v | grep -Eiq 'zabih036/saas_theme_erpnext(\.git)?([[:space:]]|$)'; then
    pass "Customized fork configured as a remote"
else
    warn "No customized fork remote: the app may be updating from its original vendor."
fi
if git -C "$app_dir" cat-file -e "$expected_commit^{commit}" 2>/dev/null; then
    if git -C "$app_dir" merge-base --is-ancestor "$expected_commit" HEAD; then
        pass "Checkout contains merged PR #113"
    else
        fail "Checkout does not contain merged PR #113"
    fi
else
    warn "Cannot compare merge ancestry (shallow or different Git history). Checking actual files."
fi

check() {
    local file="$1"
    local marker="$2"
    if [[ -f "$app_dir/$file" ]] && grep -Fq "$marker" "$app_dir/$file"; then
        pass "Source verified: $file"
    else
        fail "Source missing PR #113 contents: $file"
    fi
}
check "saas_theme/hooks.py" "workspace_dashboard_design.css?v=3"
check "saas_theme/hooks.py" "native_dashboard_view_design.css?v=3"
check "saas_theme/hooks.py" "native_dashboard_view.js?v=3"
check "saas_theme/public/css/workspace_dashboard_design.css" "height: 142px !important;"
check "saas_theme/public/css/native_dashboard_view_design.css" ".dashboard-view .widget.number-widget-box.st-dv-kpi-v2"
check "saas_theme/public/js/native_dashboard_view.js" 'const ROOT = ".dashboard-view";'

if [[ -d "$asset_dir" ]]; then
    for item in css/workspace_dashboard_design.css css/native_dashboard_view_design.css js/native_dashboard_view.js; do
        if [[ -f "$asset_dir/$item" ]]; then
            pass "Public asset present: $item"
        else
            fail "Public asset missing: $item"
        fi
    done
else
    fail "Public asset directory missing: $asset_dir"
fi

if [[ -n "$site_base_url" ]]; then
    if ! command -v curl >/dev/null 2>&1; then
        warn "curl unavailable; skipping HTTP checks"
    else
        site_base_url="$(printf '%s' "$site_base_url" | sed 's#/$##')"
        for item in "css/native_dashboard_view_design.css?v=3" "js/native_dashboard_view.js?v=3"; do
            body="$(curl -fsSL --max-time 20 "$site_base_url/assets/saas_theme/$item" 2>/dev/null)" || body=""
            if [[ "$item" == css/* ]]; then
                marker=".dashboard-view .widget.number-widget-box.st-dv-kpi-v2"
            else
                marker='const ROOT = ".dashboard-view";'
            fi
            if [[ "$body" == *"$marker"* ]]; then
                pass "Live HTTP serves current asset: $item"
            else
                fail "Live HTTP asset is missing or stale: $item"
            fi
        done
    fi
fi

printf '\nDeployment result: %s failure(s)\n' "$errors"
if (( errors > 0 )); then
    printf 'Check Git remote and checkout, rebuild theme, clear site cache and hard refresh.\n'
    exit 1
fi
printf 'Source and served files are present. Browser render still needs checking.\n'

/*
 * SaaS Theme — Route/Login loader
 * Lightweight top progress for Desk navigation and a compact blocking state for login.
 */
(function () {
	"use strict";

	if (window.__saas_theme_route_loader__) return;
	window.__saas_theme_route_loader__ = true;

	const STYLE_ID = "st-route-loader-style";
	const BAR_ID = "st-route-loader";
	const LOGIN_ID = "st-login-loader";
	let failSafe = null;
	let hideTimer = null;

	function ensure_style() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			#${BAR_ID} {
				position: fixed;
				inset: 0 0 auto 0;
				height: 3px;
				z-index: 2147483000;
				pointer-events: none;
				opacity: 0;
				transition: opacity .12s ease;
			}
			#${BAR_ID}.is-visible { opacity: 1; }
			#${BAR_ID} .st-route-loader-bar {
				height: 100%;
				width: 0;
				border-radius: 0 3px 3px 0;
				background: linear-gradient(90deg, #064ADB 0%, #2F6FE7 58%, #14213D 100%);
				box-shadow: 0 0 10px rgba(6, 74, 219, .28);
				transition: width 1.35s cubic-bezier(.2,.8,.2,1);
			}
			#${BAR_ID}.is-done .st-route-loader-bar {
				transition-duration: .16s;
			}
			#${LOGIN_ID} {
				position: fixed;
				inset: 0;
				z-index: 2147482990;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 20px;
				background: rgba(248, 250, 252, .76);
				backdrop-filter: blur(3px);
				-webkit-backdrop-filter: blur(3px);
				opacity: 0;
				visibility: hidden;
				transition: opacity .15s ease, visibility .15s ease;
			}
			#${LOGIN_ID}.is-visible {
				opacity: 1;
				visibility: visible;
			}
			#${LOGIN_ID} .st-login-loader-card {
				display: flex;
				align-items: center;
				gap: 12px;
				min-width: 176px;
				padding: 13px 16px;
				border: 1px solid #E5E5E5;
				border-radius: 11px;
				background: #FFFFFF;
				color: #14213D;
				font: 600 13px/1.25 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				box-shadow: 0 16px 44px rgba(20, 33, 61, .14), 0 3px 10px rgba(20, 33, 61, .06);
			}
			#${LOGIN_ID} .st-login-loader-spinner {
				width: 20px;
				height: 20px;
				flex: 0 0 20px;
				border: 2px solid rgba(6, 74, 219, .16);
				border-top-color: #064ADB;
				border-radius: 50%;
				animation: st-route-spin .68s linear infinite;
			}
			@keyframes st-route-spin { to { transform: rotate(360deg); } }
			@media (prefers-reduced-motion: reduce) {
				#${BAR_ID} .st-route-loader-bar { transition-duration: .01ms !important; }
				#${LOGIN_ID} .st-login-loader-spinner { animation-duration: 1.5s; }
			}
			[data-theme="dark"] #${LOGIN_ID} { background: rgba(15, 20, 27, .72); }
			[data-theme="dark"] #${LOGIN_ID} .st-login-loader-card {
				background: #161C24;
				border-color: #334155;
				color: #E8EEF8;
			}
		`;
		document.head.appendChild(style);
	}

	function ensure_nodes() {
		ensure_style();

		let loader = document.getElementById(BAR_ID);
		if (!loader) {
			loader = document.createElement("div");
			loader.id = BAR_ID;
			loader.setAttribute("aria-hidden", "true");
			loader.innerHTML = '<div class="st-route-loader-bar"></div>';
			document.body.appendChild(loader);
		}

		let login = document.getElementById(LOGIN_ID);
		if (!login) {
			login = document.createElement("div");
			login.id = LOGIN_ID;
			login.setAttribute("aria-hidden", "true");
			login.innerHTML = `
				<div class="st-login-loader-card" role="status" aria-live="polite">
					<span class="st-login-loader-spinner" aria-hidden="true"></span>
					<span class="st-login-loader-text">Signing in…</span>
				</div>`;
			document.body.appendChild(login);
		}
		return { loader, login };
	}

	function start(options) {
		const opts = typeof options === "object" && options ? options : {};
		const { loader, login } = ensure_nodes();
		const bar = loader.querySelector(".st-route-loader-bar");

		clearTimeout(hideTimer);
		clearTimeout(failSafe);
		loader.classList.remove("is-done");
		loader.classList.add("is-visible");
		bar.style.width = "9%";
		requestAnimationFrame(() => requestAnimationFrame(() => {
			bar.style.width = opts.blocking ? "82%" : "72%";
		}));

		if (opts.blocking) {
			const text = login.querySelector(".st-login-loader-text");
			if (text) text.textContent = opts.text || "Signing in…";
			login.classList.add("is-visible");
			login.setAttribute("aria-hidden", "false");
		}

		failSafe = setTimeout(done, opts.blocking ? 12000 : 5000);
	}

	function done() {
		const loader = document.getElementById(BAR_ID);
		const login = document.getElementById(LOGIN_ID);
		clearTimeout(failSafe);

		if (login) {
			login.classList.remove("is-visible");
			login.setAttribute("aria-hidden", "true");
		}

		if (!loader) return;
		const bar = loader.querySelector(".st-route-loader-bar");
		loader.classList.add("is-done", "is-visible");
		if (bar) bar.style.width = "100%";

		hideTimer = setTimeout(() => {
			loader.classList.remove("is-visible", "is-done");
			if (bar) bar.style.width = "0";
		}, 190);
	}

	function is_internal_navigation(anchor, event) {
		if (!anchor || !anchor.href) return false;
		if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false;
		if (anchor.target && anchor.target !== "_self") return false;
		if (anchor.hasAttribute("download")) return false;
		if (anchor.getAttribute("href") === "#") return false;

		try {
			const url = new URL(anchor.href, window.location.href);
			if (url.origin !== window.location.origin) return false;
			if (url.href === window.location.href) return false;
			return url.pathname.startsWith("/app") || url.hash || document.body.classList.contains("desk");
		} catch (e) {
			return false;
		}
	}

	function patch_frappe_route() {
		if (!window.frappe || typeof frappe.set_route !== "function" || frappe.set_route.__st_loader_wrapped) return;
		const original = frappe.set_route;
		const wrapped = function () {
			start();
			return original.apply(this, arguments);
		};
		wrapped.__st_loader_wrapped = true;
		frappe.set_route = wrapped;
	}

	document.addEventListener("click", (event) => {
		const anchor = event.target.closest && event.target.closest("a[href]");
		if (is_internal_navigation(anchor, event)) start();

		const loginButton = event.target.closest && event.target.closest(".btn-login");
		if (loginButton) start({ blocking: true, text: "Signing in…" });
	}, true);

	document.addEventListener("submit", (event) => {
		const form = event.target;
		if (form && form.matches && form.matches("form.form-login, .for-login form")) {
			start({ blocking: true, text: "Signing in…" });
		}
	}, true);

	window.addEventListener("hashchange", () => start());
	window.addEventListener("popstate", () => start());
	window.addEventListener("pageshow", done);
	window.addEventListener("load", done);

	if (typeof $ !== "undefined") {
		$(document)
			.off("page-change.saas_route_loader")
			.on("page-change.saas_route_loader", () => setTimeout(done, 40));
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			ensure_nodes();
			patch_frappe_route();
		}, { once: true });
	} else {
		ensure_nodes();
		patch_frappe_route();
	}

	/* Frappe may initialize after app assets; retry briefly without a permanent timer. */
	let tries = 0;
	const patchTimer = setInterval(() => {
		patch_frappe_route();
		tries += 1;
		if (tries > 20 || (window.frappe && frappe.set_route && frappe.set_route.__st_loader_wrapped)) {
			clearInterval(patchTimer);
		}
	}, 250);

	window.saasThemeLoader = { start, done };
})();

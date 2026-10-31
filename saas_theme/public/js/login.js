/* SaaS Theme — Login transition and branding fixes */
(function () {
	"use strict";
	if (window.__saas_theme_login_fix__) return;
	window.__saas_theme_login_fix__ = true;

	let patched = false;
	let tries = 0;
	let branding_promise = null;

	function loader_done() {
		try { window.saasThemeLoader?.done?.(); } catch (e) {}
	}

	function loader_start(text) {
		try { window.saasThemeLoader?.start?.({ blocking: true, text: text || "Signing in…" }); } catch (e) {}
	}

	async function get_login_branding() {
		if (branding_promise) return branding_promise;
		branding_promise = (async () => {
			try {
				if (window.frappe?.call) {
					const response = await frappe.call({
						method: "saas_theme.branding.get_company_branding",
						type: "GET",
					});
					return response?.message || {};
				}
				const response = await fetch("/api/method/saas_theme.branding.get_company_branding", {
					credentials: "same-origin",
					headers: { Accept: "application/json" },
				});
				if (!response.ok) return {};
				const data = await response.json();
				return data?.message || {};
			} catch (e) {
				return {};
			}
		})();
		return branding_promise;
	}

	async function apply_login_branding() {
		const branding = await get_login_branding();
		const company = String(branding?.company || "").trim();
		const logo = String(branding?.company_logo || "").trim();
		if (logo) {
			document.querySelectorAll(".page-card-head .app-logo, .login-content .app-logo").forEach((image) => {
				if (!(image instanceof HTMLImageElement)) return;
				image.src = logo;
				image.alt = company || "Company Logo";
				image.classList.add("st-login-company-logo");
			});
		}
		const title = company ? `Login to ${company}` : "Login";
		document.querySelectorAll(".for-login .page-card-head h4, .for-email-login .page-card-head h4, .st-login-form-col .page-card-head h4").forEach((heading) => {
			heading.textContent = title;
			heading.classList.add("st-login-company-title");
		});
		document.querySelectorAll("h1, h2, h3, h4").forEach((heading) => {
			if (/^\s*login\s+to\s+frappe\s*$/i.test(heading.textContent || "")) {
				heading.textContent = title;
				heading.classList.add("st-login-company-title");
			}
		});
	}

	function patch_login() {
		if (patched || !window.login || !window.frappe) return false;
		if (!login.login_handlers || typeof login.login_handlers[200] !== "function") return false;

		if (typeof login.hide_loading === "function" && !login.hide_loading.__st_wrapped) {
			const original = login.hide_loading;
			const wrapped = function () { loader_done(); return original.apply(this, arguments); };
			wrapped.__st_wrapped = true;
			login.hide_loading = wrapped;
		}

		if (typeof login.set_invalid === "function" && !login.set_invalid.__st_wrapped) {
			const original = login.set_invalid;
			const wrapped = function () { loader_done(); return original.apply(this, arguments); };
			wrapped.__st_wrapped = true;
			login.set_invalid = wrapped;
		}

		[401, 417, 429, 500].forEach((status) => {
			const handler = login.login_handlers[status];
			if (typeof handler !== "function" || handler.__st_wrapped) return;
			const wrapped = function () { loader_done(); return handler.apply(this, arguments); };
			wrapped.__st_wrapped = true;
			login.login_handlers[status] = wrapped;
		});

		const original_200 = login.login_handlers[200];
		if (!original_200.__st_wrapped) {
			const wrapped_200 = function (data) {
				if (data && data.message === "Logged In") {
					loader_start("Opening workspace…");
					let target = data.home_page || "/app";
					try {
						const redirect = frappe.utils.sanitise_redirect(frappe.utils.get_url_arg("redirect-to"));
						if (redirect) target = redirect;
					} catch (e) {}
					window.location.href = target;
					return;
				}
				const result = original_200.apply(this, arguments);
				if (!data || data.message !== "Logged In") loader_done();
				return result;
			};
			wrapped_200.__st_wrapped = true;
			login.login_handlers[200] = wrapped_200;
		}
		patched = true;
		return true;
	}

	document.addEventListener("submit", (event) => {
		const form = event.target;
		if (!form?.matches?.("form.form-login, .for-login form")) return;
		setTimeout(() => {
			const user = String(document.querySelector("#login_email")?.value || "").trim();
			const password = String(document.querySelector("#login_password")?.value || "");
			if (!user || !password) loader_done();
		}, 0);
	}, true);

	document.addEventListener("login_rendered", () => {
		patch_login();
		setTimeout(apply_login_branding, 0);
	}, { passive: true });

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			patch_login();
			apply_login_branding();
		}, { once: true });
	} else {
		patch_login();
		apply_login_branding();
	}

	const timer = setInterval(() => {
		tries += 1;
		apply_login_branding();
		if (patch_login() || tries > 40) clearInterval(timer);
	}, 125);
})();

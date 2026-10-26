/*
 * SaaS Theme — Login transition fixes
 *
 * - stop the custom loader immediately when credentials/validation fail
 * - preserve Frappe's validation messages
 * - skip Frappe's default splash screen after successful login
 */
(function () {
	"use strict";

	if (window.__saas_theme_login_fix__) return;
	window.__saas_theme_login_fix__ = true;

	let patched = false;
	let tries = 0;

	function loader_done() {
		try {
			window.saasThemeLoader?.done?.();
		} catch (e) {
			// Login feedback must never fail because the theme loader failed.
		}
	}

	function loader_start(text) {
		try {
			window.saasThemeLoader?.start?.({ blocking: true, text: text || "Signing in…" });
		} catch (e) {
			// Ignore loader failures and allow authentication to continue.
		}
	}

	function patch_login() {
		if (patched || !window.login || !window.frappe) return false;
		if (!login.login_handlers || typeof login.login_handlers[200] !== "function") return false;

		/* Any native login error path eventually calls hide_loading / set_invalid.
		   Mirror that state into the theme overlay. */
		if (typeof login.hide_loading === "function" && !login.hide_loading.__st_wrapped) {
			const original_hide_loading = login.hide_loading;
			const wrapped_hide_loading = function () {
				loader_done();
				return original_hide_loading.apply(this, arguments);
			};
			wrapped_hide_loading.__st_wrapped = true;
			login.hide_loading = wrapped_hide_loading;
		}

		if (typeof login.set_invalid === "function" && !login.set_invalid.__st_wrapped) {
			const original_set_invalid = login.set_invalid;
			const wrapped_set_invalid = function () {
				loader_done();
				return original_set_invalid.apply(this, arguments);
			};
			wrapped_set_invalid.__st_wrapped = true;
			login.set_invalid = wrapped_set_invalid;
		}

		/* Explicitly wrap common HTTP error handlers as a second safety net. */
		[401, 417, 429, 500].forEach((status) => {
			const handler = login.login_handlers[status];
			if (typeof handler !== "function" || handler.__st_wrapped) return;
			const wrapped = function () {
				loader_done();
				return handler.apply(this, arguments);
			};
			wrapped.__st_wrapped = true;
			login.login_handlers[status] = wrapped;
		});

		/* Frappe's stock 200 handler replaces the body with splash_screen.html before
		   redirecting. Handle only the successful-login branch ourselves so the
		   default ERPNext/Frappe splash logo never flashes. All other responses still
		   use Frappe's original handler. */
		const original_200 = login.login_handlers[200];
		if (!original_200.__st_wrapped) {
			const wrapped_200 = function (data) {
				if (data && data.message === "Logged In") {
					loader_start("Opening workspace…");

					let target = data.home_page || "/app";
					try {
						const redirect = frappe.utils.sanitise_redirect(
							frappe.utils.get_url_arg("redirect-to")
						);
						if (redirect) target = redirect;
					} catch (e) {
						// Fall back to the server-provided home page.
					}

					window.location.href = target;
					return;
				}

				const result = original_200.apply(this, arguments);
				// Password reset / signup / other non-redirect responses should not leave
				// our blocking overlay active.
				if (!data || data.message !== "Logged In") loader_done();
				return result;
			};
			wrapped_200.__st_wrapped = true;
			login.login_handlers[200] = wrapped_200;
		}

		patched = true;
		return true;
	}

	/* If validation stops submit before frappe.call (empty user/password), the route
	   loader may already have started from the button click. Stop it on the next tick. */
	document.addEventListener(
		"submit",
		(event) => {
			const form = event.target;
			if (!form?.matches?.("form.form-login, .for-login form")) return;
			setTimeout(() => {
				const user = String(document.querySelector("#login_email")?.value || "").trim();
				const password = String(document.querySelector("#login_password")?.value || "");
				if (!user || !password) loader_done();
			}, 0);
		},
		true
	);

	document.addEventListener("login_rendered", () => patch_login(), { passive: true });

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", patch_login, { once: true });
	} else {
		patch_login();
	}

	const timer = setInterval(() => {
		tries += 1;
		if (patch_login() || tries > 40) clearInterval(timer);
	}, 125);
})();

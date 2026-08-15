const BASE_URLS = {
	test: "https://test.stytch.com",
	live: "https://api.stytch.com",
};

const REQUEST_TIMEOUT_MS = 15000;

const CODE_TTL_MINUTES = 10;

const RESEND_COOLDOWN_SECONDS = 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const fail = (status, message) => {
	const error = new Error(message);
	error.status = status;
	return error;
};

export const normalizeEmail = (email) => (email || "").trim().toLowerCase();

const assertUsableEmail = (email) => {
	if (!EMAIL_PATTERN.test(email)) {
		throw fail(400, "Please enter a valid email address.");
	}
};

const isConfigured = () =>
	Boolean(process.env.STYTCH_PROJECT_ID && process.env.STYTCH_SECRET);

const getBaseUrl = () =>
	BASE_URLS[(process.env.STYTCH_ENV || "test").toLowerCase()] || BASE_URLS.test;

const postToStytch = async (path, body) => {
	const credentials = Buffer.from(
		`${process.env.STYTCH_PROJECT_ID}:${process.env.STYTCH_SECRET}`,
	).toString("base64");

	const response = await fetch(`${getBaseUrl()}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${credentials}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	return {
		ok: response.ok,
		status: response.status,
		payload: await response.json().catch(() => ({})),
	};
};

class SignInCodeService {
	async requestCode(rawEmail) {
		const email = normalizeEmail(rawEmail);
		assertUsableEmail(email);

		if (!isConfigured()) {
			throw fail(503, "Email verification is not configured on this server.");
		}

		let result;
		try {
			result = await postToStytch("/v1/otps/email/login_or_create", {
				email,
				expiration_minutes: CODE_TTL_MINUTES,
			});
		} catch (error) {
			console.error("Email verification send error:", error.message);
			throw fail(
				502,
				"We could not send the verification code right now. Please try again in a moment.",
			);
		}

		if (result.status === 429) {
			const error = fail(
				429,
				"Please wait a moment before requesting another code.",
			);
			error.retryAfterSeconds = RESEND_COOLDOWN_SECONDS;
			throw error;
		}

		if (!result.ok || !result.payload?.email_id) {
			console.error(
				`Email verification send failed (HTTP ${result.status}): ${result.payload?.error_message || result.payload?.error_type || "no detail"}`,
			);
			throw fail(
				502,
				"We could not send the verification code to that address. Please check it and try again.",
			);
		}

		return {
			email,
			methodId: result.payload.email_id,
			expiresInSeconds: CODE_TTL_MINUTES * 60,
			resendInSeconds: RESEND_COOLDOWN_SECONDS,
		};
	}

	async confirmCode(rawMethodId, rawCode) {
		const methodId = (rawMethodId || "").trim();
		if (!methodId) {
			throw fail(400, "Request a verification code first.");
		}

		const code = (rawCode || "").trim();
		if (!/^\d{6}$/.test(code)) {
			throw fail(400, "Please enter the 6 digit code from the email.");
		}

		if (!isConfigured()) {
			throw fail(503, "Email verification is not configured on this server.");
		}

		let result;
		try {
			result = await postToStytch("/v1/otps/authenticate", {
				method_id: methodId,
				code,
			});
		} catch (error) {
			console.error("Email verification confirm error:", error.message);
			throw fail(
				502,
				"We could not check that code right now. Please try again in a moment.",
			);
		}

		if (result.status === 429) {
			throw fail(429, "Too many attempts. Please wait a moment and try again.");
		}

		if (!result.ok) {
			throw fail(
				400,
				"That code is not correct or has expired. Please check it, or request a new one.",
			);
		}

		const addresses = result.payload?.user?.emails || [];
		const confirmed =
			addresses.find((entry) => entry.email_id === methodId) ||
			(addresses.length === 1 ? addresses[0] : null);

		if (!confirmed?.email) {
			console.error(
				"Email verification confirm: no address on the authenticated response.",
			);
			throw fail(
				502,
				"We could not confirm that address. Please request a new code.",
			);
		}

		return { email: normalizeEmail(confirmed.email) };
	}
}

export default new SignInCodeService();

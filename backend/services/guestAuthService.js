import jwt from "jsonwebtoken";
import signInCodeService, { normalizeEmail } from "./signInCodeService.js";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_PURPOSE = "guest-session";

class GuestAuthService {
	async requestLoginCode(email) {
		return await signInCodeService.requestCode(email);
	}

	async confirmLoginCode(methodId, code) {
		const confirmed = await signInCodeService.confirmCode(methodId, code);

		return {
			email: confirmed.email,
			// The session the dashboard is read with.
			token: this.issueSession(confirmed.email),
			expiresInSeconds: SESSION_TTL_SECONDS,
		};
	}

	issueSession(email) {
		return jwt.sign(
			{ email: normalizeEmail(email), purpose: SESSION_PURPOSE },
			process.env.JWT_SECRET,
			{
				expiresIn: SESSION_TTL_SECONDS,
			},
		);
	}

	readSession(token) {
		if (!token) return null;
		try {
			const payload = jwt.verify(token, process.env.JWT_SECRET);
			return payload?.purpose === SESSION_PURPOSE
				? normalizeEmail(payload.email)
				: null;
		} catch {
			return null;
		}
	}

	readSessionFromHeader(authorizationHeader) {
		const header = authorizationHeader || "";
		if (!header.startsWith("Bearer ")) return null;
		return this.readSession(header.slice(7).trim());
	}
}

export default new GuestAuthService();

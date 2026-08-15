import jwt from "jsonwebtoken";

// Pass is given to user on successfull ID verification.
const PASS_TTL_SECONDS = 2 * 60 * 60;
const PASS_PURPOSE = "document-verification";

class DocumentPassService {
	issuePass(document, email) {
		return jwt.sign(
			{ ...document, email, purpose: PASS_PURPOSE },
			process.env.JWT_SECRET,
			{
				expiresIn: PASS_TTL_SECONDS,
			},
		);
	}

	readPass(token, email) {
		if (!token || !email) return null;
		try {
			const payload = jwt.verify(token, process.env.JWT_SECRET);
			if (payload?.purpose !== PASS_PURPOSE) return null;
			if (payload.email !== email) return null;
			return payload;
		} catch {
			return null;
		}
	}
}

export default new DocumentPassService();

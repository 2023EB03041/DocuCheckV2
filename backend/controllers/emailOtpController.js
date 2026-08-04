import emailOtpService from '../services/emailOtpService.js';

class EmailOtpController {
  async sendCode(req, res) {
    try {
      const result = await emailOtpService.requestCode(req.body?.email);
      res.json({
        message: `A verification code has been sent to ${result.email}. It can take a moment to arrive — check your spam folder if it does not.`,
        expiresInSeconds: result.expiresInSeconds,
        resendInSeconds: result.resendInSeconds
      });
    } catch (error) {
      if (error.status) {
        // A cooldown carries the wait with it so the page can count it down
        // instead of guessing when the next code may be asked for.
        return res.status(error.status).json({
          message: error.message,
          ...(error.retryAfterSeconds ? { resendInSeconds: error.retryAfterSeconds } : {})
        });
      }
      console.error('Email verification send error:', error);
      res.status(500).json({ message: 'Internal server error while sending the verification code' });
    }
  }

  async confirmCode(req, res) {
    try {
      const result = await emailOtpService.confirmCode(req.body?.email, req.body?.code);
      res.json({
        message: 'Email address verified.',
        email: result.email,
        token: result.token,
        expiresInSeconds: result.expiresInSeconds
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error('Email verification confirm error:', error);
      res.status(500).json({ message: 'Internal server error while confirming the verification code' });
    }
  }
}

export default new EmailOtpController();

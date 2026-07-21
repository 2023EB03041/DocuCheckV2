import authService from '../services/authService.js';

class AuthController {
  async login(req, res) {
    try {
      const { username, password, loginType } = req.body;
      const result = await authService.authenticateUser(username, password, loginType);
      res.json(result);
    } catch (error) {
      if (error.message === 'Invalid credentials' || error.message.includes('authorized for')) {
        res.status(401).json({ message: error.message });
      } else {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
      }
    }
  }

  async register(req, res) {
    try {
      const user = await authService.registerManager(req.body);
      res.status(201).json({ message: 'User created successfully', user: { username: user.username, role: user.role } });
    } catch (error) {
      if (error.message === 'Username already exists') {
        res.status(400).json({ message: error.message });
      } else {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error during registration' });
      }
    }
  }
}

export default new AuthController();

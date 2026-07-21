import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userRepository from '../repositories/userRepository.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev';

class AuthService {
  async authenticateUser(username, password, loginType) {
    const user = await userRepository.findByUsername(username);
    if (!user) throw new Error('Invalid credentials');

    if (loginType && user.role !== loginType) {
      throw new Error(`Account is not authorized for ${loginType} access.`);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');

    const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
    
    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role
      }
    };
  }

  async registerManager(userData) {
    const existing = await userRepository.findByUsername(userData.username);
    if (existing) throw new Error('Username already exists');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    return await userRepository.createUser({
      ...userData,
      password: hashedPassword,
      role: 'Manager' 
    });
  }
}

export default new AuthService();

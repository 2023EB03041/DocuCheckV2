import User from '../models/User.js';

class UserRepository {
  async findByUsername(username) {
    return await User.findOne({ username });
  }

  async createUser(userData) {
    const newUser = new User(userData);
    return await newUser.save();
  }
}

export default new UserRepository();

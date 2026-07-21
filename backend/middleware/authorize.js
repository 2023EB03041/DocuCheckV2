// Role-based authorization. Use after authMiddleware, which sets req.user.
// Example: router.post('/x', authMiddleware, authorize('Superuser'), handler)
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: insufficient permissions' });
  }
  next();
};

export default authorize;

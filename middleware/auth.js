// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

// Middleware to check if user has specific role
const hasRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
    
    if (!req.session.userRole) {
      return res.status(403).render('error', { message: 'Access denied: No role assigned' });
    }
    
    const userRole = req.session.userRole;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (allowedRoles.includes(userRole)) {
      return next();
    }
    
    res.status(403).render('error', { message: 'Access denied: Insufficient permissions' });
  };
};

module.exports = { isAuthenticated, hasRole };

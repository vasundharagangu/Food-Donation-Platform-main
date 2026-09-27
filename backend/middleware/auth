const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        error: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid token - user not found',
        error: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account is deactivated',
        error: 'ACCOUNT_DEACTIVATED'
      });
    }

    // For NGOs, check if they are approved
    if (user.role === 'ngo' && !user.isApproved) {
      return res.status(403).json({ 
        message: 'NGO account pending approval',
        error: 'NGO_NOT_APPROVED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        error: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token',
        error: 'INVALID_TOKEN'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      message: 'Authentication error',
      error: 'AUTH_ERROR'
    });
  }
};

// Check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${roles.join(', ')}`,
        error: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Admin access required',
      error: 'ADMIN_REQUIRED'
    });
  }
  next();
};

// Check if user is approved (for NGOs)
const requireApproval = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      error: 'NOT_AUTHENTICATED'
    });
  }

  if (req.user.role === 'ngo' && !req.user.isApproved) {
    return res.status(403).json({ 
      message: 'NGO approval required',
      error: 'APPROVAL_REQUIRED'
    });
  }

  next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    req.user = user && user.isActive ? user : null;
    next();
  } catch (error) {
    // If token is invalid, just proceed without user
    req.user = null;
    next();
  }
};

// Check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceUserField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED'
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.resource && req.resource[resourceUserField];
    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({ 
      message: 'Access denied - not resource owner',
      error: 'NOT_OWNER'
    });
  };
};

// Rate limiting for sensitive operations
const sensitiveOperationLimit = (req, res, next) => {
  // This would typically use Redis or similar for distributed rate limiting
  // For now, we'll use a simple in-memory approach
  const now = Date.now();

  // Configurable thresholds
  const WINDOW_MS = parseInt(process.env.SENSITIVE_LIMIT_WINDOW_MS || '60000', 10); // default 60s
  const MAX_PER_WINDOW = parseInt(
    process.env.SENSITIVE_LIMIT_PER_MINUTE || (process.env.NODE_ENV === 'development' ? '100' : '10'),
    10
  );

  // Build a key: prefer user ID; else use email (for login) to avoid blocking all users behind one IP; else IP
  let userKey = req.user ? req.user._id.toString() : null;
  if (!userKey) {
    const email = (req.body && req.body.email && String(req.body.email).toLowerCase()) || null;
    userKey = email ? `email:${email}` : `ip:${req.ip}`;
  }

  if (!global.sensitiveOpLimits) {
    global.sensitiveOpLimits = new Map();
  }

  const current = global.sensitiveOpLimits.get(userKey) || { count: 0, resetTime: now + WINDOW_MS };

  if (now > current.resetTime) {
    current.count = 0;
    current.resetTime = now + WINDOW_MS;
  }

  if (current.count >= MAX_PER_WINDOW) {
    return res.status(429).json({
      message: 'Too many requests. Please wait a moment and try again.',
      error: 'RATE_LIMITED'
    });
  }

  current.count++;
  global.sensitiveOpLimits.set(userKey, current);

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireApproval,
  optionalAuth,
  requireOwnershipOrAdmin,
  sensitiveOperationLimit
};

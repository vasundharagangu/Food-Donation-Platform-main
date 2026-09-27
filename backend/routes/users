const express = require('express');
const { query } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, requireApproval } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/nearby
// @desc    Get nearby users (donors/NGOs/requesters)
// @access  Private
router.get('/nearby', authenticateToken, requireApproval, [
  query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  query('radius').optional().isFloat({ min: 1, max: 50000 }).withMessage('Invalid radius'),
  query('role').optional().isIn(['donor', 'requester', 'ngo']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const { latitude, longitude, radius = 10000, role } = req.query;

    const nearbyUsers = await User.findNearby(
      { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      parseFloat(radius),
      role
    );

    res.json({
      users: nearbyUsers.map(user => user.getPublicProfile()),
      count: nearbyUsers.length
    });

  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ message: 'Failed to get nearby users' });
  }
});

// @route   GET /api/users/profile/:id
// @desc    Get user public profile
// @access  Private
router.get('/profile/:id', authenticateToken, requireApproval, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: user.getPublicProfile() });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Failed to get user profile' });
  }
});

module.exports = router;

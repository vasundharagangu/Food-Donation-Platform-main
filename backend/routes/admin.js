const express = require('express');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Request = require('../models/Request');
const Delivery = require('../models/Delivery');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/admin/stats
// @desc    Get platform statistics
// @access  Private (Admin only)
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalDonors,
      totalRequesters,
      totalNGOs,
      pendingNGOs,
      totalDonations,
      activeDonations,
      totalRequests,
      activeRequests,
      totalDeliveries,
      completedDeliveries
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'donor', isActive: true }),
      User.countDocuments({ role: 'requester', isActive: true }),
      User.countDocuments({ role: 'ngo', isActive: true, isApproved: true }),
      User.countDocuments({ role: 'ngo', isActive: true, isApproved: false }),
      Donation.countDocuments(),
      Donation.countDocuments({ status: 'active' }),
      Request.countDocuments(),
      Request.countDocuments({ status: 'pending' }),
      Delivery.countDocuments(),
      Delivery.countDocuments({ deliveryStatus: 'delivered' })
    ]);

    res.json({
      users: {
        total: totalUsers,
        donors: totalDonors,
        requesters: totalRequesters,
        ngos: totalNGOs,
        pendingNGOs
      },
      donations: {
        total: totalDonations,
        active: activeDonations
      },
      requests: {
        total: totalRequests,
        active: activeRequests
      },
      deliveries: {
        total: totalDeliveries,
        completed: completedDeliveries
      }
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Failed to get statistics' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, isApproved, isActive, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (role) query.role = role;
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (page - 1) * limit;
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

// @route   PUT /api/admin/users/:id/approve
// @desc    Approve NGO
// @access  Private (Admin only)
router.put('/users/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'ngo') {
      return res.status(400).json({ message: 'Only NGOs can be approved' });
    }

    user.isApproved = true;
    await user.save();

    // Send notification
    const io = req.app.get('io');
    if (io) {
      io.to(user._id.toString()).emit('ngo_approved', {
        message: 'Your NGO has been approved! You can now start accepting donations.'
      });
    }

    res.json({ message: 'NGO approved successfully', user: user.getPublicProfile() });

  } catch (error) {
    console.error('Approve NGO error:', error);
    res.status(500).json({ message: 'Failed to approve NGO' });
  }
});

// @route   PUT /api/admin/users/:id/deactivate
// @desc    Deactivate user
// @access  Private (Admin only)
router.put('/users/:id/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Failed to deactivate user' });
  }
});

module.exports = router;

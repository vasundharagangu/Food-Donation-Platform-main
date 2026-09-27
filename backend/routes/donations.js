const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Donation = require('../models/Donation');
const User = require('../models/User');
const { authenticateToken, requireRole, requireApproval } = require('../middleware/auth');
const { notifyNearbyUsers } = require('../services/eventNotifications');

const router = express.Router();

// @route   POST /api/donations
// @desc    Create a new donation
// @access  Private (Donors only)
router.post('/', authenticateToken, requireRole('donor', 'admin'), requireApproval, [
  body('foodType')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Food type must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('quantity.amount')
    .isFloat({ min: 1 })
    .withMessage('Quantity amount must be at least 1'),
  body('quantity.unit')
    .isIn(['kg', 'grams', 'pieces', 'plates', 'boxes', 'liters'])
    .withMessage('Invalid quantity unit'),
  body('category')
    .isIn(['cooked_food', 'raw_ingredients', 'packaged_food', 'beverages', 'dairy', 'fruits_vegetables', 'bakery'])
    .withMessage('Invalid food category'),
  body('expiryTime')
    .isISO8601()
    .withMessage('Invalid expiry time format'),
  body('pickupLocation.address')
    .notEmpty()
    .withMessage('Pickup address is required'),
  body('pickupLocation.coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid pickup latitude'),
  body('pickupLocation.coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid pickup longitude'),
  body('deliveryMethod')
    .isIn(['self_delivery', 'ngo_pickup'])
    .withMessage('Invalid delivery method')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if expiry time is in the future
    const expiryTime = new Date(req.body.expiryTime);
    if (expiryTime <= new Date()) {
      return res.status(400).json({
        message: 'Expiry time must be in the future'
      });
    }

    // Create donation
    const donation = new Donation({
      ...req.body,
      donor: req.user._id,
      expiryTime
    });

    await donation.save();

    // Populate donor information
    await donation.populate('donor', 'name businessType phone');

    // Update donor's total donations count and award points
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalDonations: 1, points: 25 }
    });

    // Emit real-time notification to nearby NGOs and requesters
    const io = req.app.get('io');
    if (io) {
      // Find nearby NGOs and requesters
      const nearbyUsers = await User.findNearby(
        donation.pickupLocation.coordinates,
        10000, // 10km radius
        null // all roles
      );

      nearbyUsers.forEach(user => {
        if (user.role === 'ngo' || user.role === 'requester') {
          io.to(user._id.toString()).emit('new_donation', {
            donation: donation.toObject(),
            message: `New food donation available: ${donation.foodType}`
          });
        }
      });

      // Send email/SMS notifications to nearby users
      await notifyNearbyUsers(io, donation, nearbyUsers);
    }

    res.status(201).json({
      message: 'Donation created successfully',
      donation
    });

  } catch (error) {
    console.error('Create donation error:', error);
    res.status(500).json({
      message: 'Failed to create donation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/donations
// @desc    Get donations (with filters)
// @access  Private
router.get('/', authenticateToken, requireApproval, [
  query('status')
    .optional()
    .isIn(['active', 'assigned_to_ngo', 'picked_up', 'delivered', 'expired', 'cancelled'])
    .withMessage('Invalid status filter'),
  query('category')
    .optional()
    .isIn(['cooked_food', 'raw_ingredients', 'packaged_food', 'beverages', 'dairy', 'fruits_vegetables', 'bakery'])
    .withMessage('Invalid category filter'),
  query('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  query('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  query('radius')
    .optional()
    .isFloat({ min: 1, max: 50000 })
    .withMessage('Radius must be between 1 and 50000 meters'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      status = 'active',
      category,
      latitude,
      longitude,
      radius = 10000,
      page = 1,
      limit = 20,
      donorId
    } = req.query;

    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by donor (for donor's own donations)
    if (donorId) {
      query.donor = donorId;
    } else if (req.user.role === 'donor') {
      // Donors can only see their own donations by default
      query.donor = req.user._id;
    }

    // Only show non-expired donations for non-donors
    if (req.user.role !== 'donor') {
      query.expiryTime = { $gt: new Date() };
    }

    let donations;

    // If location is provided, find nearby donations
    if (latitude && longitude) {
      donations = await Donation.findNearby(
        { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
        parseFloat(radius),
        status
      );

      // Apply additional filters
      if (category) {
        donations = donations.filter(d => d.category === category);
      }
      if (donorId) {
        donations = donations.filter(d => d.donor._id.toString() === donorId);
      }

      // Manual pagination for geospatial results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      donations = donations.slice(startIndex, endIndex);

    } else {
      // Regular query without geospatial search
      const skip = (page - 1) * limit;
      
      donations = await Donation.find(query)
        .populate('donor', 'name businessType phone location')
        .populate('assignedNGO', 'name organizationName phone')
        .populate('assignedRequester', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
    }

    // Get total count for pagination
    const total = await Donation.countDocuments(query);

    res.json({
      donations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({
      message: 'Failed to get donations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/donations/:id
// @desc    Get single donation
// @access  Private
router.get('/:id', authenticateToken, requireApproval, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('donor', 'name businessType phone location')
      .populate('assignedNGO', 'name organizationName phone location')
      .populate('assignedRequester', 'name phone location');

    if (!donation) {
      return res.status(404).json({
        message: 'Donation not found'
      });
    }

    // Check if user has permission to view this donation
    const canView = 
      req.user.role === 'admin' ||
      donation.donor._id.toString() === req.user._id.toString() ||
      (donation.assignedNGO && donation.assignedNGO._id.toString() === req.user._id.toString()) ||
      (donation.assignedRequester && donation.assignedRequester._id.toString() === req.user._id.toString()) ||
      (donation.status === 'active' && (req.user.role === 'ngo' || req.user.role === 'requester'));

    if (!canView) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    res.json({ donation });

  } catch (error) {
    console.error('Get donation error:', error);
    res.status(500).json({
      message: 'Failed to get donation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/donations/:id
// @desc    Update donation
// @access  Private (Donor only)
router.put('/:id', authenticateToken, requireRole('donor', 'admin'), requireApproval, [
  body('foodType')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Food type must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('quantity.amount')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Quantity amount must be at least 1'),
  body('specialInstructions')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Special instructions cannot exceed 300 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: 'Donation not found'
      });
    }

    // Check if user owns this donation
    if (donation.donor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your donation'
      });
    }

    // Check if donation can be updated (only active donations)
    if (donation.status !== 'active') {
      return res.status(400).json({
        message: 'Cannot update donation - not in active status'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'foodType', 'description', 'quantity', 'specialInstructions', 
      'isVegetarian', 'isVegan', 'allergens', 'images'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedDonation = await Donation.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('donor', 'name businessType phone');

    res.json({
      message: 'Donation updated successfully',
      donation: updatedDonation
    });

  } catch (error) {
    console.error('Update donation error:', error);
    res.status(500).json({
      message: 'Failed to update donation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/donations/:id/assign-ngo
// @desc    Assign donation to NGO
// @access  Private (Donor only)
router.put('/:id/assign-ngo', authenticateToken, requireRole('donor', 'admin'), requireApproval, [
  body('ngoId')
    .isMongoId()
    .withMessage('Invalid NGO ID')
], async (req, res) => {
  try {
    const { ngoId } = req.body;

    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({
        message: 'Donation not found'
      });
    }

    // Check ownership
    if (donation.donor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your donation'
      });
    }

    // Check if donation is active
    if (donation.status !== 'active') {
      return res.status(400).json({
        message: 'Donation is not available for assignment'
      });
    }

    // Verify NGO exists and is approved
    const ngo = await User.findOne({
      _id: ngoId,
      role: 'ngo',
      isApproved: true,
      isActive: true
    });

    if (!ngo) {
      return res.status(404).json({
        message: 'NGO not found or not approved'
      });
    }

    // Update donation
    donation.assignedNGO = ngoId;
    donation.status = 'assigned_to_ngo';
    await donation.save();

    await donation.populate('assignedNGO', 'name organizationName phone');

    // Send notification to NGO
    const io = req.app.get('io');
    if (io) {
      io.to(ngoId).emit('donation_assigned', {
        donation: donation.toObject(),
        message: `You have been assigned a food pickup: ${donation.foodType}`
      });
    }

    res.json({
      message: 'NGO assigned successfully',
      donation
    });

  } catch (error) {
    console.error('Assign NGO error:', error);
    res.status(500).json({
      message: 'Failed to assign NGO',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/donations/:id/cancel
// @desc    Cancel donation
// @access  Private (Donor only)
router.put('/:id/cancel', authenticateToken, requireRole('donor', 'admin'), requireApproval, [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Cancellation reason cannot exceed 200 characters')
], async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: 'Donation not found'
      });
    }

    // Check ownership
    if (donation.donor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your donation'
      });
    }

    // Check if donation can be cancelled
    if (['delivered', 'cancelled', 'expired'].includes(donation.status)) {
      return res.status(400).json({
        message: 'Cannot cancel donation in current status'
      });
    }

    // Update donation
    donation.status = 'cancelled';
    donation.cancellationReason = req.body.reason || 'Cancelled by donor';
    await donation.save();

    // Notify assigned NGO if any
    const io = req.app.get('io');
    if (io && donation.assignedNGO) {
      io.to(donation.assignedNGO.toString()).emit('donation_cancelled', {
        donationId: donation._id,
        message: `Donation cancelled: ${donation.foodType}`
      });
    }

    res.json({
      message: 'Donation cancelled successfully',
      donation
    });

  } catch (error) {
    console.error('Cancel donation error:', error);
    res.status(500).json({
      message: 'Failed to cancel donation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/donations/:id
// @desc    Delete donation (only if not assigned)
// @access  Private (Donor only)
router.delete('/:id', authenticateToken, requireRole('donor', 'admin'), requireApproval, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({
        message: 'Donation not found'
      });
    }

    // Check ownership
    if (donation.donor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your donation'
      });
    }

    // Check if donation can be deleted (only active donations)
    if (donation.status !== 'active') {
      return res.status(400).json({
        message: 'Cannot delete donation - already assigned or completed'
      });
    }

    await Donation.findByIdAndDelete(req.params.id);

    // Update donor's total donations count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalDonations: -1 }
    });

    res.json({
      message: 'Donation deleted successfully'
    });

  } catch (error) {
    console.error('Delete donation error:', error);
    res.status(500).json({
      message: 'Failed to delete donation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Request = require('../models/Request');
const User = require('../models/User');
const Donation = require('../models/Donation');
const { authenticateToken, requireRole, requireApproval } = require('../middleware/auth');
const { notifyRequestAccepted } = require('../services/eventNotifications');

const router = express.Router();

// @route   POST /api/requests
// @desc    Create a new food request
// @access  Private (Requesters only)
router.post('/', authenticateToken, requireRole('requester', 'admin'), requireApproval, [
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('location.address')
    .notEmpty()
    .withMessage('Delivery address is required'),
  body('location.coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid delivery latitude'),
  body('location.coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid delivery longitude'),
  body('requirements.foodTypes')
    .isArray({ min: 1 })
    .withMessage('At least one food type is required'),
  body('requirements.quantity.amount')
    .isFloat({ min: 1 })
    .withMessage('Required quantity must be at least 1'),
  body('requirements.quantity.unit')
    .isIn(['kg', 'grams', 'pieces', 'plates', 'boxes', 'liters'])
    .withMessage('Invalid quantity unit'),
  body('numberOfPeople')
    .isInt({ min: 1, max: 100 })
    .withMessage('Number of people must be between 1 and 100'),
  body('urgency')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid urgency level')
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

    // Create request with 5-minute expiry
    const request = new Request({
      ...req.body,
      requester: req.user._id,
      expiryTimestamp: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
    });

    await request.save();

    // Populate requester information
    await request.populate('requester', 'name phone');

    // Update requester's total requests count and award points
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalRequests: 1, points: 25 }
    });

    // Emit real-time notification to nearby donors and NGOs
    const io = req.app.get('io');
    if (io) {
      // Find nearby donors and NGOs
      const nearbyUsers = await User.findNearby(
        request.location.coordinates,
        10000, // 10km radius
        null // all roles
      );

      nearbyUsers.forEach(user => {
        if (user.role === 'donor' || user.role === 'ngo') {
          io.to(user._id.toString()).emit('new_request', {
            request: request.toObject(),
            message: `New food request: ${request.title}`
          });
        }
      });
    }

    res.status(201).json({
      message: 'Food request created successfully',
      request,
      expiresIn: '5 minutes'
    });

  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({
      message: 'Failed to create request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/requests
// @desc    Get food requests (with filters)
// @access  Private
router.get('/', authenticateToken, requireApproval, [
  query('status')
    .optional()
    .isIn(['pending', 'accepted_by_donor', 'accepted_by_ngo', 'in_transit', 'delivered', 'expired', 'cancelled'])
    .withMessage('Invalid status filter'),
  query('urgency')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid urgency filter'),
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
      status = 'pending',
      urgency,
      latitude,
      longitude,
      radius = 10000,
      page = 1,
      limit = 20,
      requesterId
    } = req.query;

    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by urgency
    if (urgency) {
      query.urgency = urgency;
    }

    // Filter by requester (for requester's own requests)
    if (requesterId) {
      query.requester = requesterId;
    } else if (req.user.role === 'requester') {
      // Requesters can only see their own requests by default
      query.requester = req.user._id;
    }

    // Only show non-expired requests for non-requesters
    if (req.user.role !== 'requester') {
      query.expiryTimestamp = { $gt: new Date() };
    }

    let requests;

    // If location is provided, find nearby requests
    if (latitude && longitude) {
      requests = await Request.findNearby(
        { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
        parseFloat(radius),
        status
      );

      // Apply additional filters
      if (urgency) {
        requests = requests.filter(r => r.urgency === urgency);
      }
      if (requesterId) {
        requests = requests.filter(r => r.requester._id.toString() === requesterId);
      }

      // Manual pagination for geospatial results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      requests = requests.slice(startIndex, endIndex);

    } else {
      // Regular query without geospatial search
      const skip = (page - 1) * limit;
      
      requests = await Request.find(query)
        .populate('requester', 'name phone location')
        .populate('acceptedBy.donor', 'name businessType phone')
        .populate('acceptedBy.ngo', 'name organizationName phone')
        .populate('assignedDonation', 'foodType quantity')
        .sort({ urgency: -1, createdAt: -1 }) // Sort by urgency first, then by creation time
        .skip(skip)
        .limit(parseInt(limit));
    }

    // Get total count for pagination
    const total = await Request.countDocuments(query);

    res.json({
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      message: 'Failed to get requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/requests/:id
// @desc    Get single request
// @access  Private
router.get('/:id', authenticateToken, requireApproval, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('requester', 'name phone location')
      .populate('acceptedBy.donor', 'name businessType phone location')
      .populate('acceptedBy.ngo', 'name organizationName phone location')
      .populate('assignedDonation', 'foodType quantity pickupLocation');

    if (!request) {
      return res.status(404).json({
        message: 'Request not found'
      });
    }

    // Check if user has permission to view this request
    const canView = 
      req.user.role === 'admin' ||
      request.requester._id.toString() === req.user._id.toString() ||
      (request.acceptedBy.donor && request.acceptedBy.donor._id.toString() === req.user._id.toString()) ||
      (request.acceptedBy.ngo && request.acceptedBy.ngo._id.toString() === req.user._id.toString()) ||
      (request.status === 'pending' && (req.user.role === 'donor' || req.user.role === 'ngo'));

    if (!canView) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    res.json({ 
      request,
      timeRemaining: request.getTimeRemaining(),
      isExpired: request.isExpired()
    });

  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({
      message: 'Failed to get request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/requests/:id
// @desc    Update request
// @access  Private (Requester only)
router.put('/:id', authenticateToken, requireRole('requester', 'admin'), requireApproval, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('urgency')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid urgency level'),
  body('specialCircumstances')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Special circumstances cannot exceed 300 characters')
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

    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found'
      });
    }

    // Check if user owns this request
    if (request.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your request'
      });
    }

    // Check if request can be updated (only pending requests)
    if (request.status !== 'pending') {
      return res.status(400).json({
        message: 'Cannot update request - already accepted or completed'
      });
    }

    // Check if request is expired
    if (request.isExpired()) {
      return res.status(400).json({
        message: 'Cannot update expired request'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'urgency', 'specialCircumstances',
      'contactPreferences', 'isEmergency'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedRequest = await Request.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('requester', 'name phone');

    res.json({
      message: 'Request updated successfully',
      request: updatedRequest
    });

  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({
      message: 'Failed to update request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/requests/:id/accept
// @desc    Accept a food request (by donor or NGO)
// @access  Private (Donors and NGOs only)
router.put('/:id/accept', authenticateToken, requireRole('donor', 'ngo'), requireApproval, [
  body('donationId')
    .optional()
    .isMongoId()
    .withMessage('Invalid donation ID')
], async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found'
      });
    }

    // Check if request is still pending
    if (request.status !== 'pending') {
      return res.status(400).json({
        message: 'Request is no longer available'
      });
    }

    // Check if request is expired
    if (request.isExpired()) {
      request.status = 'expired';
      await request.save();
      return res.status(400).json({
        message: 'Request has expired'
      });
    }

    let donation = null;

    if (req.user.role === 'donor') {
      // Donor accepting request - need to link with a donation
      if (!req.body.donationId) {
        return res.status(400).json({
          message: 'Donation ID is required when donor accepts request'
        });
      }

      donation = await Donation.findOne({
        _id: req.body.donationId,
        donor: req.user._id,
        status: 'active'
      });

      if (!donation) {
        return res.status(404).json({
          message: 'Donation not found or not available'
        });
      }

      // Update request
      request.status = 'accepted_by_donor';
      request.acceptedBy.donor = req.user._id;
      request.assignedDonation = donation._id;

      // Update donation
      donation.assignedRequester = request.requester;
      donation.status = 'assigned_to_requester';
      await donation.save();

    } else if (req.user.role === 'ngo') {
      // NGO accepting request
      request.status = 'accepted_by_ngo';
      request.acceptedBy.ngo = req.user._id;
    }

    await request.save();

    await request.populate([
      { path: 'requester', select: 'name phone location' },
      { path: 'acceptedBy.donor', select: 'name businessType phone' },
      { path: 'acceptedBy.ngo', select: 'name organizationName phone' },
      { path: 'assignedDonation', select: 'foodType quantity pickupLocation' }
    ]);

    // Send notification to requester
    const io = req.app.get('io');
    if (io) {
      const acceptorName = req.user.role === 'donor' 
        ? req.user.name 
        : req.user.organizationName || req.user.name;
      
      io.to(request.requester._id.toString()).emit('request_accepted', {
        request: request.toObject(),
        message: `Your food request has been accepted by ${acceptorName}`
      });
    }

    // Send email/SMS notification to requester
    await notifyRequestAccepted(io, request);

    res.json({
      message: 'Request accepted successfully',
      request
    });

  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({
      message: 'Failed to accept request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/requests/:id/extend
// @desc    Extend request expiry time
// @access  Private (Requester only, or admin in special cases)
router.put('/:id/extend', authenticateToken, [
  body('additionalMinutes')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Additional minutes must be between 1 and 30'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason cannot exceed 200 characters')
], async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found'
      });
    }

    // Check permissions
    const canExtend = 
      req.user.role === 'admin' ||
      (req.user.role === 'requester' && request.requester.toString() === req.user._id.toString());

    if (!canExtend) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Check if request is still pending
    if (request.status !== 'pending') {
      return res.status(400).json({
        message: 'Can only extend pending requests'
      });
    }

    const additionalMinutes = req.body.additionalMinutes || 5;
    await request.extendExpiry(additionalMinutes);

    res.json({
      message: `Request expiry extended by ${additionalMinutes} minutes`,
      request,
      newExpiryTime: request.expiryTimestamp
    });

  } catch (error) {
    console.error('Extend request error:', error);
    res.status(500).json({
      message: 'Failed to extend request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/requests/:id/cancel
// @desc    Cancel request
// @access  Private (Requester only)
router.put('/:id/cancel', authenticateToken, requireRole('requester', 'admin'), requireApproval, [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Cancellation reason cannot exceed 200 characters')
], async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found'
      });
    }

    // Check ownership
    if (request.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your request'
      });
    }

    // Check if request can be cancelled
    if (['delivered', 'cancelled', 'expired'].includes(request.status)) {
      return res.status(400).json({
        message: 'Cannot cancel request in current status'
      });
    }

    // Update request
    request.status = 'cancelled';
    request.cancellationReason = req.body.reason || 'Cancelled by requester';
    await request.save();

    // Notify accepted donor/NGO if any
    const io = req.app.get('io');
    if (io) {
      if (request.acceptedBy.donor) {
        io.to(request.acceptedBy.donor.toString()).emit('request_cancelled', {
          requestId: request._id,
          message: `Food request cancelled: ${request.title}`
        });
      }
      if (request.acceptedBy.ngo) {
        io.to(request.acceptedBy.ngo.toString()).emit('request_cancelled', {
          requestId: request._id,
          message: `Food request cancelled: ${request.title}`
        });
      }
    }

    res.json({
      message: 'Request cancelled successfully',
      request
    });

  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({
      message: 'Failed to cancel request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/requests/:id
// @desc    Delete request (only if not accepted)
// @access  Private (Requester only)
router.delete('/:id', authenticateToken, requireRole('requester', 'admin'), requireApproval, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found'
      });
    }

    // Check ownership
    if (request.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your request'
      });
    }

    // Check if request can be deleted (only pending requests)
    if (request.status !== 'pending') {
      return res.status(400).json({
        message: 'Cannot delete request - already accepted or completed'
      });
    }

    await Request.findByIdAndDelete(req.params.id);

    // Update requester's total requests count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalRequests: -1 }
    });

    res.json({
      message: 'Request deleted successfully'
    });

  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({
      message: 'Failed to delete request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/requests/expire-old
// @desc    Expire old requests (utility endpoint)
// @access  Private (Admin only)
router.post('/expire-old', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await Request.expireOldRequests();
    
    res.json({
      message: 'Old requests expired successfully',
      expiredCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Expire old requests error:', error);
    res.status(500).json({
      message: 'Failed to expire old requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

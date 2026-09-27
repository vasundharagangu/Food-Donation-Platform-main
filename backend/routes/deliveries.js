const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Request = require('../models/Request');
const { authenticateToken, requireRole, requireApproval } = require('../middleware/auth');
const { notifyDeliveryStatusChange } = require('../services/eventNotifications');

const router = express.Router();

// @route   POST /api/deliveries
// @desc    Create a new delivery (when NGO accepts a donation)
// @access  Private (NGOs only)
router.post('/', authenticateToken, requireRole('ngo', 'admin'), requireApproval, [
  body('donationId')
    .isMongoId()
    .withMessage('Invalid donation ID'),
  body('requestId')
    .isMongoId()
    .withMessage('Invalid request ID')
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

    const { donationId, requestId } = req.body;

    // Verify donation exists and is available
    const donation = await Donation.findOne({
      _id: donationId,
      status: 'active'
    }).populate('donor', 'name businessType phone location');

    if (!donation) {
      return res.status(404).json({
        message: 'Donation not found or not available'
      });
    }

    // Verify request exists and is pending
    const request = await Request.findOne({
      _id: requestId,
      status: 'pending'
    }).populate('requester', 'name phone location');

    if (!request) {
      return res.status(404).json({
        message: 'Request not found or not available'
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

    // Create delivery
    const delivery = new Delivery({
      ngo: req.user._id,
      donor: donation.donor._id,
      requester: request.requester._id,
      donation: donationId,
      request: requestId,
      pickupLocation: {
        address: donation.pickupLocation.address,
        coordinates: donation.pickupLocation.coordinates
      },
      deliveryLocation: {
        address: request.location.address,
        coordinates: request.location.coordinates
      },
      priority: request.urgency === 'critical' ? 'urgent' : 
                request.urgency === 'high' ? 'high' : 'medium'
    });

    await delivery.save();

    // Update donation status
    donation.status = 'assigned_to_ngo';
    donation.assignedNGO = req.user._id;
    donation.assignedRequester = request.requester._id;
    await donation.save();

    // Update request status
    request.status = 'accepted_by_ngo';
    request.acceptedBy.ngo = req.user._id;
    await request.save();

    // Populate delivery details
    await delivery.populate([
      { path: 'donor', select: 'name businessType phone location' },
      { path: 'requester', select: 'name phone location' },
      { path: 'donation', select: 'foodType quantity pickupLocation' },
      { path: 'request', select: 'title urgency numberOfPeople' }
    ]);

    // Update NGO's total deliveries count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalDeliveries: 1 }
    });

    // Send notifications
    const io = req.app.get('io');
    if (io) {
      // Notify donor
      io.to(donation.donor._id.toString()).emit('delivery_created', {
        delivery: delivery.toObject(),
        message: `NGO ${req.user.organizationName || req.user.name} will pick up your donation`
      });

      // Notify requester
      io.to(request.requester._id.toString()).emit('delivery_created', {
        delivery: delivery.toObject(),
        message: `NGO ${req.user.organizationName || req.user.name} will deliver food to you`
      });
    }

    // Send SMS notifications with contact information
    try {
      const { sendSMS } = require('../services/notifications');
      
      // SMS to NGO with requester contact info
      await sendSMS({
        to: req.user.phone,
        message: `Delivery created! Requester: ${request.requester.name}, Phone: ${request.requester.phone}. Please contact them to arrange pickup and delivery.`
      });

      // SMS to donor with requester contact info
      await sendSMS({
        to: donation.donor.phone,
        message: `Your donation assigned to NGO! Requester: ${request.requester.name}, Phone: ${request.requester.phone}. NGO will contact you for pickup.`
      });

      // SMS to requester with NGO contact info
      await sendSMS({
        to: request.requester.phone,
        message: `Your request accepted! NGO: ${req.user.organizationName || req.user.name}, Phone: ${req.user.phone}. They will contact you for delivery.`
      });
    } catch (error) {
      console.error('Failed to send delivery creation SMS notifications:', error);
    }

    res.status(201).json({
      message: 'Delivery created successfully',
      delivery
    });

  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({
      message: 'Failed to create delivery',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/deliveries
// @desc    Get deliveries (with filters)
// @access  Private
router.get('/', authenticateToken, requireApproval, [
  query('status')
    .optional()
    .isIn(['assigned', 'pickup_in_progress', 'picked_up', 'delivery_in_progress', 'delivered', 'failed', 'cancelled'])
    .withMessage('Invalid status filter'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority filter'),
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
      status,
      priority,
      page = 1,
      limit = 20,
      ngoId,
      donorId,
      requesterId
    } = req.query;

    let query = {};

    // Filter by status
    if (status) {
      query.deliveryStatus = status;
    }

    // Filter by priority
    if (priority) {
      query.priority = priority;
    }

    // Role-based filtering
    if (req.user.role === 'ngo') {
      query.ngo = req.user._id;
    } else if (req.user.role === 'donor') {
      query.donor = req.user._id;
    } else if (req.user.role === 'requester') {
      query.requester = req.user._id;
    } else {
      // Admin can filter by specific users
      if (ngoId) query.ngo = ngoId;
      if (donorId) query.donor = donorId;
      if (requesterId) query.requester = requesterId;
    }

    const skip = (page - 1) * limit;

    const deliveries = await Delivery.find(query)
      .populate('ngo', 'name organizationName phone location')
      .populate('donor', 'name businessType phone location')
      .populate('requester', 'name phone location')
      .populate('donation', 'foodType quantity category')
      .populate('request', 'title urgency numberOfPeople')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Delivery.countDocuments(query);

    res.json({
      deliveries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({
      message: 'Failed to get deliveries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/deliveries/active
// @desc    Get active deliveries for NGO
// @access  Private (NGOs only)
router.get('/active', authenticateToken, requireRole('ngo', 'admin'), requireApproval, async (req, res) => {
  try {
    const deliveries = await Delivery.findActiveForNGO(req.user._id);

    res.json({
      deliveries,
      count: deliveries.length
    });

  } catch (error) {
    console.error('Get active deliveries error:', error);
    res.status(500).json({
      message: 'Failed to get active deliveries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/deliveries/:id
// @desc    Get single delivery
// @access  Private
router.get('/:id', authenticateToken, requireApproval, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('ngo', 'name organizationName phone location')
      .populate('donor', 'name businessType phone location')
      .populate('requester', 'name phone location')
      .populate('donation', 'foodType quantity category pickupLocation')
      .populate('request', 'title urgency numberOfPeople location');

    if (!delivery) {
      return res.status(404).json({
        message: 'Delivery not found'
      });
    }

    // Check if user has permission to view this delivery
    const canView = 
      req.user.role === 'admin' ||
      delivery.ngo._id.toString() === req.user._id.toString() ||
      delivery.donor._id.toString() === req.user._id.toString() ||
      delivery.requester._id.toString() === req.user._id.toString();

    if (!canView) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    res.json({ delivery });

  } catch (error) {
    console.error('Get delivery error:', error);
    res.status(500).json({
      message: 'Failed to get delivery',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/deliveries/:id/start-pickup
// @desc    Start pickup process
// @access  Private (NGO only)
router.put('/:id/start-pickup', authenticateToken, requireRole('ngo', 'admin'), requireApproval, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        message: 'Delivery not found'
      });
    }

    // Check if user owns this delivery
    if (delivery.ngo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your delivery'
      });
    }

    // Check if delivery is in correct status
    if (delivery.deliveryStatus !== 'assigned') {
      return res.status(400).json({
        message: 'Cannot start pickup - delivery not in assigned status'
      });
    }

    // Update delivery status
    delivery.deliveryStatus = 'pickup_in_progress';
    await delivery.save();

    // Send notification to donor
    const io = req.app.get('io');
    if (io) {
      io.to(delivery.donor.toString()).emit('pickup_started', {
        deliveryId: delivery._id,
        message: 'NGO is on the way to pick up your donation'
      });
    }

    // Send email/SMS notification for pickup started
    await notifyDeliveryStatusChange(io, delivery, 'assigned', 'pickup_in_progress');

    res.json({
      message: 'Pickup started successfully',
      delivery
    });

  } catch (error) {
    console.error('Start pickup error:', error);
    res.status(500).json({
      message: 'Failed to start pickup',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/deliveries/:id/complete-pickup
// @desc    Complete pickup process
// @access  Private (NGO only)
router.put('/:id/complete-pickup', authenticateToken, requireRole('ngo', 'admin'), requireApproval, [
  body('foodCondition')
    .isIn(['excellent', 'good', 'fair', 'poor'])
    .withMessage('Invalid food condition'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Notes cannot exceed 300 characters'),
  body('photos')
    .optional()
    .isArray()
    .withMessage('Photos must be an array')
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

    const { foodCondition, notes, photos = [] } = req.body;

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        message: 'Delivery not found'
      });
    }

    // Check if user owns this delivery
    if (delivery.ngo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your delivery'
      });
    }

    // Check if delivery is in correct status
    if (delivery.deliveryStatus !== 'pickup_in_progress') {
      return res.status(400).json({
        message: 'Cannot complete pickup - not in pickup progress status'
      });
    }

    // Complete pickup
    await delivery.completePickup(req.user._id, notes, photos);
    delivery.foodCondition.atPickup = foodCondition;
    delivery.deliveryStatus = 'delivery_in_progress';
    await delivery.save();

    // Update donation status
    await Donation.findByIdAndUpdate(delivery.donation, {
      status: 'picked_up'
    });

    // Send notifications
    const io = req.app.get('io');
    if (io) {
      // Notify donor
      io.to(delivery.donor.toString()).emit('pickup_completed', {
        deliveryId: delivery._id,
        message: 'Your donation has been picked up successfully'
      });

      // Notify requester
      io.to(delivery.requester.toString()).emit('delivery_started', {
        deliveryId: delivery._id,
        message: 'Your food is on the way!'
      });
    }

    // Send SMS notifications for pickup completion
    try {
      await notifyDeliveryStatusChange(io, delivery, 'pickup_in_progress', 'delivery_in_progress');
    } catch (error) {
      console.error('Failed to send pickup completion notifications:', error);
    }

    res.json({
      message: 'Pickup completed successfully',
      delivery
    });

  } catch (error) {
    console.error('Complete pickup error:', error);
    res.status(500).json({
      message: 'Failed to complete pickup',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/deliveries/:id/complete-delivery
// @desc    Complete delivery process
// @access  Private (NGO only)
router.put('/:id/complete-delivery', authenticateToken, requireRole('ngo', 'admin'), requireApproval, [
  body('foodCondition')
    .isIn(['excellent', 'good', 'fair', 'poor'])
    .withMessage('Invalid food condition'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Notes cannot exceed 300 characters'),
  body('photos')
    .optional()
    .isArray()
    .withMessage('Photos must be an array')
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

    const { foodCondition, notes, photos = [] } = req.body;

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        message: 'Delivery not found'
      });
    }

    // Check if user owns this delivery
    if (delivery.ngo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your delivery'
      });
    }

    // Check if delivery is in correct status
    if (delivery.deliveryStatus !== 'delivery_in_progress') {
      return res.status(400).json({
        message: 'Cannot complete delivery - not in delivery progress status'
      });
    }

    // Set atDelivery before moving to delivered to satisfy validation
    delivery.foodCondition = delivery.foodCondition || {};
    delivery.foodCondition.atDelivery = foodCondition;
    // Complete delivery (sets status to delivered and saves)
    await delivery.completeDelivery(req.user._id, notes, photos);

    // Update related models
    await Promise.all([
      Donation.findByIdAndUpdate(delivery.donation, { status: 'delivered' }),
      Request.findByIdAndUpdate(delivery.request, { status: 'delivered' })
    ]);

    // Defer awarding points until requester confirms receipt

    // Send notifications
    const io = req.app.get('io');
    if (io) {
      // Notify requester
      io.to(delivery.requester.toString()).emit('delivery_completed', {
        deliveryId: delivery._id,
        message: 'Your food has been delivered successfully!'
      });

      // Notify donor
      io.to(delivery.donor.toString()).emit('delivery_completed', {
        deliveryId: delivery._id,
        message: 'Your donation has been delivered successfully!'
      });
    }

    // Send SMS and email notifications
    try {
      await notifyDeliveryStatusChange(io, delivery, 'delivery_in_progress', 'delivered');
    } catch (error) {
      console.error('Failed to send delivery completion notifications:', error);
    }

    res.json({
      message: 'Delivery completed successfully',
      delivery,
      pointsEarned: delivery.pointsEarned
    });

  } catch (error) {
    console.error('Complete delivery error:', error);
    res.status(500).json({
      message: 'Failed to complete delivery',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/deliveries/:id/update-location
// @desc    Update current location during delivery
// @access  Private (NGO only)
router.put('/:id/update-location', authenticateToken, requireRole('ngo', 'admin'), requireApproval, [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude')
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

    const { latitude, longitude } = req.body;

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        message: 'Delivery not found'
      });
    }

    // Check if user owns this delivery
    if (delivery.ngo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied - not your delivery'
      });
    }

    // Update location
    await delivery.updateLocation(latitude, longitude);

    // Send real-time location update
    const io = req.app.get('io');
    if (io) {
      io.to(delivery.requester.toString()).emit('location_update', {
        deliveryId: delivery._id,
        location: { latitude, longitude },
        timestamp: new Date()
      });
    }

    res.json({
      message: 'Location updated successfully',
      location: { latitude, longitude }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      message: 'Failed to update location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/deliveries/:id/report-issue
// @desc    Report an issue during delivery
// @access  Private
router.put('/:id/report-issue', authenticateToken, requireApproval, [
  body('type')
    .isIn(['pickup_delay', 'delivery_delay', 'food_quality', 'location_issue', 'contact_issue', 'other'])
    .withMessage('Invalid issue type'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters')
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

    const { type, description } = req.body;

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        message: 'Delivery not found'
      });
    }

    // Check if user is involved in this delivery
    const isInvolved = 
      delivery.ngo.toString() === req.user._id.toString() ||
      delivery.donor.toString() === req.user._id.toString() ||
      delivery.requester.toString() === req.user._id.toString();

    if (!isInvolved && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Add issue
    delivery.issues.push({
      type,
      description,
      reportedBy: req.user._id
    });

    await delivery.save();

    // Send notification to admin
    const io = req.app.get('io');
    if (io) {
      // Find admin users
      const admins = await User.find({ role: 'admin', isActive: true });
      admins.forEach(admin => {
        io.to(admin._id.toString()).emit('delivery_issue_reported', {
          deliveryId: delivery._id,
          issue: { type, description },
          reportedBy: req.user.name,
          message: `Issue reported in delivery: ${type}`
        });
      });
    }

    res.json({
      message: 'Issue reported successfully',
      delivery
    });

  } catch (error) {
    console.error('Report issue error:', error);
    res.status(500).json({
      message: 'Failed to report issue',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/deliveries/:id/cancel
// @desc    Cancel delivery
// @access  Private (NGO only, or admin)
router.put('/:id/cancel', authenticateToken, [
  body('reason')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Cancellation reason must be between 10 and 200 characters')
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

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({
        message: 'Delivery not found'
      });
    }

    // Check permissions
    const canCancel = 
      req.user.role === 'admin' ||
      (req.user.role === 'ngo' && delivery.ngo.toString() === req.user._id.toString());

    if (!canCancel) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Check if delivery can be cancelled
    if (['delivered', 'cancelled'].includes(delivery.deliveryStatus)) {
      return res.status(400).json({
        message: 'Cannot cancel delivery in current status'
      });
    }

    // Update delivery
    delivery.deliveryStatus = 'cancelled';
    delivery.cancellationReason = req.body.reason;
    delivery.cancelledBy = req.user._id;
    await delivery.save();

    // Reset related models
    await Promise.all([
      Donation.findByIdAndUpdate(delivery.donation, { 
        status: 'active',
        assignedNGO: null,
        assignedRequester: null
      }),
      Request.findByIdAndUpdate(delivery.request, { 
        status: 'pending',
        'acceptedBy.ngo': null
      })
    ]);

    // Send notifications
    const io = req.app.get('io');
    if (io) {
      io.to(delivery.donor.toString()).emit('delivery_cancelled', {
        deliveryId: delivery._id,
        message: 'Delivery has been cancelled. Your donation is available again.'
      });

      io.to(delivery.requester.toString()).emit('delivery_cancelled', {
        deliveryId: delivery._id,
        message: 'Delivery has been cancelled. Your request is active again.'
      });
    }

    res.json({
      message: 'Delivery cancelled successfully',
      delivery
    });

  } catch (error) {
    console.error('Cancel delivery error:', error);
    res.status(500).json({
      message: 'Failed to cancel delivery',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;

// --- Requester confirms receipt and awards points ---
// @route   PUT /api/deliveries/:id/confirm-receipt
// @desc    Requester confirms they received the delivery; award NGO points here
// @access  Private (Requester only)
router.put('/:id/confirm-receipt', authenticateToken, requireRole('requester', 'admin'), async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    // Must belong to this requester
    if (delivery.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Must be delivered before confirming receipt
    if (delivery.deliveryStatus !== 'delivered') {
      return res.status(400).json({ message: 'Cannot confirm before delivery is marked delivered' });
    }

    // Idempotent: if already confirmed and points awarded, just return
    if (delivery.requesterConfirmed && delivery.pointsAwarded) {
      return res.json({ message: 'Already confirmed', alreadyConfirmed: true });
    }

    // Mark confirmed
    delivery.requesterConfirmed = true;
    await delivery.save();

    // Award points to NGO once (deferred awarding)
    if (!delivery.pointsAwarded) {
      await User.findByIdAndUpdate(delivery.ngo, { $inc: { points: delivery.pointsEarned } });
      delivery.pointsAwarded = true;
      await delivery.save();
    }

    // Notify NGO
    const io = req.app.get('io');
    if (io) {
      io.to(delivery.ngo.toString()).emit('receipt_confirmed', {
        deliveryId: delivery._id,
        message: 'Requester confirmed receipt; points awarded.'
      });
    }

    res.json({ message: 'Receipt confirmed. Points awarded to NGO.', deliveryId: delivery._id });
  } catch (error) {
    console.error('Confirm receipt error:', error);
    res.status(500).json({ message: 'Failed to confirm receipt', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
});

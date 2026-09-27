const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, requireApproval } = require('../middleware/auth');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Request = require('../models/Request');

const router = express.Router();

// @route   POST /api/ratings/delivery/:id
// @desc    Requester rates donor and NGO after delivery completion
// @access  Private (Requester only)
router.post('/delivery/:id', authenticateToken, requireRole('requester', 'admin'), requireApproval, [
  body('donorRating').optional().isInt({ min: 1, max: 5 }).withMessage('Invalid donor rating'),
  body('donorFeedback').optional().isString().isLength({ max: 500 }).withMessage('Feedback too long'),
  body('ngoRating').optional().isInt({ min: 1, max: 5 }).withMessage('Invalid NGO rating'),
  body('ngoFeedback').optional().isString().isLength({ max: 500 }).withMessage('Feedback too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const delivery = await Delivery.findById(req.params.id)
      .populate('donor', 'points')
      .populate('ngo', 'points')
      .populate('requester', 'points');

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    // Ensure requester is rating their own delivery and it's delivered
    const requesterId = (delivery.requester && delivery.requester._id)
      ? delivery.requester._id.toString()
      : delivery.requester.toString();
    if (requesterId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (delivery.deliveryStatus !== 'delivered') {
      return res.status(400).json({ message: 'Can only rate completed deliveries' });
    }

    const { donorRating, donorFeedback, ngoRating, ngoFeedback } = req.body;

    // Update delivery ratings from requester
    if (typeof donorRating !== 'undefined') {
      delivery.ratings.fromRequester = delivery.ratings.fromRequester || {};
      delivery.ratings.fromRequester.donorRating = donorRating;
      delivery.ratings.fromRequester.donorFeedback = donorFeedback;
    }
    if (typeof ngoRating !== 'undefined') {
      delivery.ratings.fromRequester = delivery.ratings.fromRequester || {};
      delivery.ratings.fromRequester.ngoRating = ngoRating;
      delivery.ratings.fromRequester.ngoFeedback = ngoFeedback;
    }
    await delivery.save();

    // Reflect ratings to Donation and Request simple aggregates (optional)
    if (typeof donorRating !== 'undefined') {
      await Donation.findByIdAndUpdate(delivery.donation, { rating: donorRating, feedback: donorFeedback }, { new: true });
    }
    if (typeof ngoRating !== 'undefined') {
      await Request.findByIdAndUpdate(delivery.request, { rating: ngoRating, feedback: ngoFeedback }, { new: true });
    }

    // Award points based on ratings
    const ops = [];
    if (typeof donorRating !== 'undefined') {
      ops.push(User.findByIdAndUpdate(delivery.donor, { $inc: { points: donorRating * 5 } }));
    }
    if (typeof ngoRating !== 'undefined') {
      ops.push(User.findByIdAndUpdate(delivery.ngo, { $inc: { points: ngoRating * 5 } }));
    }
    // Reward to requester for providing feedback
    ops.push(User.findByIdAndUpdate(req.user._id, { $inc: { points: 25 } }));
    await Promise.all(ops);

    // Emit real-time notifications
    const io = req.app.get('io');
    if (io) {
      if (typeof donorRating !== 'undefined') {
        io.to(delivery.donor.toString()).emit('rated', {
          type: 'donor', rating: donorRating, deliveryId: delivery._id,
          message: `You received a rating of ${donorRating}★ from the requester.`
        });
      }
      if (typeof ngoRating !== 'undefined') {
        io.to(delivery.ngo.toString()).emit('rated', {
          type: 'ngo', rating: ngoRating, deliveryId: delivery._id,
          message: `You received a rating of ${ngoRating}★ from the requester.`
        });
      }
    }

    res.json({ message: 'Ratings submitted', deliveryId: delivery._id });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({ message: 'Failed to submit ratings', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  ngo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'NGO is required']
  },
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Donor is required']
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required']
  },
  donation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donation',
    required: [true, 'Donation is required']
  },
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Request',
    required: [true, 'Request is required']
  },
  deliveryStatus: {
    type: String,
    enum: ['assigned', 'pickup_in_progress', 'picked_up', 'delivery_in_progress', 'delivered', 'failed', 'cancelled'],
    default: 'assigned'
  },
  // Pickup details
  pickupLocation: {
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  pickupTime: {
    scheduled: Date,
    actual: Date
  },
  pickupNotes: {
    type: String,
    maxlength: [300, 'Pickup notes cannot exceed 300 characters']
  },
  pickupConfirmation: {
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    confirmedAt: Date,
    signature: String, // Base64 encoded signature
    photos: [String] // URLs to pickup photos
  },
  
  // Delivery details
  deliveryLocation: {
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  deliveryTime: {
    scheduled: Date,
    actual: Date
  },
  deliveryNotes: {
    type: String,
    maxlength: [300, 'Delivery notes cannot exceed 300 characters']
  },
  deliveryConfirmation: {
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    confirmedAt: Date,
    signature: String, // Base64 encoded signature
    photos: [String] // URLs to delivery photos
  },
  
  // Route and tracking
  route: {
    distance: Number, // in meters
    estimatedDuration: Number, // in minutes
    actualDuration: Number // in minutes
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    lastUpdated: Date
  },
  
  // Quality and condition
  foodCondition: {
    atPickup: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      required: function() {
        // Require atPickup only once pickup has been completed and delivery is in progress or completed
        return this.deliveryStatus === 'delivery_in_progress' || this.deliveryStatus === 'delivered';
      }
    },
    atDelivery: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      required: function() { return this.deliveryStatus === 'delivered'; }
    }
  },
  
  // Points and rewards
  pointsEarned: {
    type: Number,
    default: 0,
    min: [0, 'Points earned cannot be negative']
  },
  pointsAwarded: {
    type: Boolean,
    default: false
  },

  // Requester confirmation
  requesterConfirmed: {
    type: Boolean,
    default: false
  },
  
  // Issues and problems
  issues: [{
    type: {
      type: String,
      enum: ['pickup_delay', 'delivery_delay', 'food_quality', 'location_issue', 'contact_issue', 'other']
    },
    description: String,
    reportedAt: {
      type: Date,
      default: Date.now
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolution: String
  }],
  
  // Ratings and feedback
  ratings: {
    fromDonor: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: String
    },
    fromRequester: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: String
    }
  },
  
  // Administrative
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  estimatedCompletionTime: Date,
  actualCompletionTime: Date,
  
  // Cancellation
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date
}, {
  timestamps: true
});

// Indexes
deliverySchema.index({ ngo: 1 });
deliverySchema.index({ donor: 1 });
deliverySchema.index({ requester: 1 });
deliverySchema.index({ deliveryStatus: 1 });
deliverySchema.index({ 'pickupTime.scheduled': 1 });
deliverySchema.index({ 'deliveryTime.scheduled': 1 });
deliverySchema.index({ 'currentLocation': '2dsphere' });

// Method to calculate points based on delivery
deliverySchema.methods.calculatePoints = function() {
  let points = 25; // Base points for any delivery (increased from 10 to 25)
  
  // Bonus points for urgency
  if (this.priority === 'urgent') points += 15;
  else if (this.priority === 'high') points += 10;
  else if (this.priority === 'medium') points += 5;
  
  // Bonus points for food condition maintenance
  if (this.foodCondition.atDelivery === 'excellent') points += 10;
  else if (this.foodCondition.atDelivery === 'good') points += 5;
  
  // Bonus points for timely delivery
  if (this.actualCompletionTime && this.estimatedCompletionTime) {
    const timeDiff = this.actualCompletionTime - this.estimatedCompletionTime;
    if (timeDiff <= 0) points += 10; // On time or early
  }
  
  // Penalty for issues
  points -= this.issues.length * 2;
  
  return Math.max(0, points);
};

// Method to update current location
deliverySchema.methods.updateLocation = function(latitude, longitude) {
  this.currentLocation = {
    latitude,
    longitude,
    lastUpdated: new Date()
  };
  return this.save();
};

// Method to mark pickup complete
deliverySchema.methods.completePickup = function(confirmedBy, notes, photos = []) {
  this.deliveryStatus = 'picked_up';
  this.pickupTime.actual = new Date();
  this.pickupConfirmation = {
    confirmedBy,
    confirmedAt: new Date(),
    photos
  };
  if (notes) this.pickupNotes = notes;
  
  return this.save();
};

// Method to mark delivery complete
deliverySchema.methods.completeDelivery = function(confirmedBy, notes, photos = []) {
  this.deliveryStatus = 'delivered';
  this.deliveryTime.actual = new Date();
  this.actualCompletionTime = new Date();
  this.deliveryConfirmation = {
    confirmedBy,
    confirmedAt: new Date(),
    photos
  };
  if (notes) this.deliveryNotes = notes;
  
  // Calculate and set points
  this.pointsEarned = this.calculatePoints();
  
  return this.save();
};

// Static method to find active deliveries for NGO
deliverySchema.statics.findActiveForNGO = function(ngoId) {
  return this.find({
    ngo: ngoId,
    deliveryStatus: { $in: ['assigned', 'pickup_in_progress', 'picked_up', 'delivery_in_progress'] }
  }).populate('donor', 'name businessType phone location')
    .populate('requester', 'name phone location')
    .populate('donation', 'foodType quantity pickupLocation')
    .populate('request', 'title location urgency');
};

// Pre-save middleware to handle status changes
deliverySchema.pre('save', function(next) {
  if (this.isModified('deliveryStatus')) {
    const now = new Date();
    
    // Set estimated completion time when assigned
    if (this.deliveryStatus === 'assigned' && !this.estimatedCompletionTime) {
      this.estimatedCompletionTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    }
    
    // Set pickup time when pickup starts
    if (this.deliveryStatus === 'pickup_in_progress' && !this.pickupTime.actual) {
      this.pickupTime.actual = now;
    }
    
    // Set delivery start time
    if (this.deliveryStatus === 'delivery_in_progress' && !this.deliveryTime.scheduled) {
      this.deliveryTime.scheduled = now;
    }
  }
  next();
});

module.exports = mongoose.model('Delivery', deliverySchema);

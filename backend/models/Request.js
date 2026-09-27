const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required']
  },
  title: {
    type: String,
    required: [true, 'Request title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Request description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  location: {
    address: {
      type: String,
      required: [true, 'Delivery address is required']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: [true, 'Delivery latitude is required']
      },
      longitude: {
        type: Number,
        required: [true, 'Delivery longitude is required']
      }
    },
    // GeoJSON point for geospatial queries
    geo: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined
      }
    },
    instructions: {
      type: String,
      maxlength: [200, 'Delivery instructions cannot exceed 200 characters']
    }
  },
  requirements: {
    foodTypes: [{
      type: String,
      required: true
    }],
    quantity: {
      amount: {
        type: Number,
        required: [true, 'Required quantity is needed'],
        min: [1, 'Quantity must be at least 1']
      },
      unit: {
        type: String,
        required: [true, 'Quantity unit is required'],
        enum: ['kg', 'grams', 'pieces', 'plates', 'boxes', 'liters']
      }
    },
    categories: [{
      type: String,
      enum: ['cooked_food', 'raw_ingredients', 'packaged_food', 'beverages', 'dairy', 'fruits_vegetables', 'bakery']
    }],
    isVegetarianOnly: {
      type: Boolean,
      default: false
    },
    isVeganOnly: {
      type: Boolean,
      default: false
    },
    allergiesToAvoid: [{
      type: String,
      enum: ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish', 'sesame']
    }]
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  numberOfPeople: {
    type: Number,
    required: [true, 'Number of people is required'],
    min: [1, 'Must be for at least 1 person'],
    max: [100, 'Cannot exceed 100 people']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted_by_donor', 'accepted_by_ngo', 'in_transit', 'delivered', 'expired', 'cancelled'],
    default: 'pending'
  },
  expiryTimestamp: {
    type: Date,
    required: [true, 'Expiry timestamp is required'],
    default: function() {
      return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    }
  },
  // Assignment tracking
  acceptedBy: {
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  assignedDonation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donation'
  },
  // Timing fields
  acceptedAt: Date,
  deliveryStartedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  
  // Contact preferences
  contactPreferences: {
    allowPhoneCalls: {
      type: Boolean,
      default: true
    },
    allowSMS: {
      type: Boolean,
      default: true
    },
    allowEmail: {
      type: Boolean,
      default: true
    }
  },
  
  // Special circumstances
  isEmergency: {
    type: Boolean,
    default: false
  },
  specialCircumstances: {
    type: String,
    maxlength: [300, 'Special circumstances cannot exceed 300 characters']
  },
  
  // Feedback and rating
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    maxlength: [500, 'Feedback cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Index for geospatial queries (GeoJSON)
requestSchema.index({ "location.geo": "2dsphere" });
requestSchema.index({ status: 1 });
requestSchema.index({ requester: 1 });
requestSchema.index({ expiryTimestamp: 1 });
requestSchema.index({ urgency: 1 });

// Static method to find nearby requests
requestSchema.statics.findNearby = function(coordinates, maxDistance = 10000, status = 'pending') {
  return this.find({
    "location.geo": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude]
        },
        $maxDistance: maxDistance
      }
    },
    status: status,
    expiryTimestamp: { $gt: new Date() }
  }).populate('requester', 'name phone')
    .populate('acceptedBy.donor', 'name businessType phone')
    .populate('acceptedBy.ngo', 'name organizationName phone');
};

// Method to check if request is expired
requestSchema.methods.isExpired = function() {
  return new Date() > this.expiryTimestamp;
};

// Method to calculate time remaining
requestSchema.methods.getTimeRemaining = function() {
  const now = new Date();
  const timeRemaining = this.expiryTimestamp - now;
  return Math.max(0, timeRemaining);
};

// Method to extend expiry time (in case of special circumstances)
requestSchema.methods.extendExpiry = function(additionalMinutes = 5) {
  this.expiryTimestamp = new Date(this.expiryTimestamp.getTime() + additionalMinutes * 60 * 1000);
  return this.save();
};

// Pre-save middleware to handle status changes
requestSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    switch (this.status) {
      case 'accepted_by_donor':
      case 'accepted_by_ngo':
        if (!this.acceptedAt) this.acceptedAt = now;
        break;
      case 'in_transit':
        if (!this.deliveryStartedAt) this.deliveryStartedAt = now;
        break;
      case 'delivered':
        if (!this.deliveredAt) this.deliveredAt = now;
        break;
      case 'cancelled':
        if (!this.cancelledAt) this.cancelledAt = now;
        break;
    }
  }
  next();
});

// Ensure GeoJSON is set from latitude/longitude before validation/save
requestSchema.pre('validate', function(next) {
  try {
    const lat = this.location?.coordinates?.latitude;
    const lng = this.location?.coordinates?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      this.location = this.location || {};
      this.location.geo = { type: 'Point', coordinates: [lng, lat] };
    }
  } catch (e) {}
  next();
});

// Static method to expire old requests
requestSchema.statics.expireOldRequests = function() {
  return this.updateMany(
    {
      status: 'pending',
      expiryTimestamp: { $lt: new Date() }
    },
    {
      status: 'expired'
    }
  );
};

module.exports = mongoose.model('Request', requestSchema);

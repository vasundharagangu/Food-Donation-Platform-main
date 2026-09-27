const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Donor is required']
  },
  foodType: {
    type: String,
    required: [true, 'Food type is required'],
    trim: true,
    maxlength: [100, 'Food type cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  quantity: {
    amount: {
      type: Number,
      required: [true, 'Quantity amount is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unit: {
      type: String,
      required: [true, 'Quantity unit is required'],
      enum: ['kg', 'grams', 'pieces', 'plates', 'boxes', 'liters']
    }
  },
  category: {
    type: String,
    required: [true, 'Food category is required'],
    enum: ['cooked_food', 'raw_ingredients', 'packaged_food', 'beverages', 'dairy', 'fruits_vegetables', 'bakery']
  },
  expiryTime: {
    type: Date,
    required: [true, 'Expiry time is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Expiry time must be in the future'
    }
  },
  pickupLocation: {
    address: {
      type: String,
      required: [true, 'Pickup address is required']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: [true, 'Pickup latitude is required']
      },
      longitude: {
        type: Number,
        required: [true, 'Pickup longitude is required']
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
      maxlength: [200, 'Pickup instructions cannot exceed 200 characters']
    }
  },
  status: {
    type: String,
    enum: ['active', 'assigned_to_ngo', 'picked_up', 'delivered', 'expired', 'cancelled'],
    default: 'active'
  },
  deliveryMethod: {
    type: String,
    enum: ['self_delivery', 'ngo_pickup'],
    required: [true, 'Delivery method is required']
  },
  assignedNGO: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.deliveryMethod === 'ngo_pickup' && this.status !== 'active'; }
  },
  assignedRequester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  images: [{
    type: String // URLs to food images
  }],
  specialInstructions: {
    type: String,
    maxlength: [300, 'Special instructions cannot exceed 300 characters']
  },
  isVegetarian: {
    type: Boolean,
    default: false
  },
  isVegan: {
    type: Boolean,
    default: false
  },
  allergens: [{
    type: String,
    enum: ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish', 'sesame']
  }],
  // Tracking fields
  assignedAt: Date,
  pickedUpAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  
  // Rating and feedback
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
donationSchema.index({ "pickupLocation.geo": "2dsphere" });
donationSchema.index({ status: 1 });
donationSchema.index({ donor: 1 });
donationSchema.index({ assignedNGO: 1 });
donationSchema.index({ expiryTime: 1 });

// Static method to find nearby donations
donationSchema.statics.findNearby = function(coordinates, maxDistance = 10000, status = 'active') {
  return this.find({
    "pickupLocation.geo": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude]
        },
        $maxDistance: maxDistance
      }
    },
    status: status,
    expiryTime: { $gt: new Date() }
  }).populate('donor', 'name phone businessType')
    .populate('assignedNGO', 'name organizationName phone');
};

// Method to check if donation is expired
donationSchema.methods.isExpired = function() {
  return new Date() > this.expiryTime;
};

// Method to calculate time remaining
donationSchema.methods.getTimeRemaining = function() {
  const now = new Date();
  const timeRemaining = this.expiryTime - now;
  return Math.max(0, timeRemaining);
};

// Pre-save middleware to handle status changes
donationSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    switch (this.status) {
      case 'assigned_to_ngo':
        if (!this.assignedAt) this.assignedAt = now;
        break;
      case 'picked_up':
        if (!this.pickedUpAt) this.pickedUpAt = now;
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
donationSchema.pre('validate', function(next) {
  try {
    const lat = this.pickupLocation?.coordinates?.latitude;
    const lng = this.pickupLocation?.coordinates?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      this.pickupLocation = this.pickupLocation || {};
      this.pickupLocation.geo = { type: 'Point', coordinates: [lng, lat] };
    }
  } catch (e) {}
  next();
});

module.exports = mongoose.model('Donation', donationSchema);

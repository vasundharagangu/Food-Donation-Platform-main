const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['donor', 'requester', 'ngo', 'admin'],
    required: [true, 'Role is required']
  },
  location: {
    address: {
      type: String,
      required: [true, 'Address is required']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    }
  },
  points: {
    type: Number,
    default: 0,
    min: [0, 'Points cannot be negative']
  },
  // NGO specific fields
  organizationName: {
    type: String,
    required: function() { return this.role === 'ngo'; }
  },
  registrationNumber: {
    type: String,
    required: function() { return this.role === 'ngo'; }
  },
  isApproved: {
    type: Boolean,
    default: function() { return this.role !== 'ngo'; } // NGOs need approval, others are auto-approved
  },
  // Donor specific fields
  businessType: {
    type: String,
    enum: ['restaurant', 'hotel', 'grocery_store', 'other'],
    required: function() { return this.role === 'donor'; }
  },
  // Profile and activity tracking
  profilePicture: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  totalDonations: {
    type: Number,
    default: 0
  },
  totalRequests: {
    type: Number,
    default: 0
  },
  totalDeliveries: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for geospatial queries
userSchema.index({ "location.coordinates": "2dsphere" });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

// Static method to find nearby users
userSchema.statics.findNearby = function(coordinates, maxDistance = 10000, role = null) {
  const query = {
    "location.coordinates": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude]
        },
        $maxDistance: maxDistance // in meters
      }
    },
    isActive: true,
    isApproved: true
  };
  
  if (role) {
    query.role = role;
  }
  
  return this.find(query);
};

module.exports = mongoose.model('User', userSchema);

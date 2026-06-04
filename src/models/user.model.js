const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    contactNo: {
      type: String,
      default: null
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ['employee', 'technician', 'admin'],
      default: 'employee'
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null  // Initially null until approved by org admin
    },

    isActive: {
      type: Boolean,
      default: false  // Initially inactive, activated after admin approval
    },

    department: {
      type: String,
      default: null
    },

    floor: {
      type: String,
      default: null
    },

    // Technician specific fields
    professionType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProfessionType',
      default: null
      // Reference to profession type (IT Support, Electrical, etc.)
    },

    skills: {
      type: [String],
      default: []
    },

    isAvailable: {
      type: Boolean,
      default: true
    },

    currentWorkload: {
      type: Number,
      default: 0  // Count of assigned issues
    },

    maxCapacity: {
      type: Number,
      default: 10  // Max issues a technician can handle
    },

    rating: {
      type: Number,
      default: 0
    },

    totalReviews: {
      type: Number,
      default: 0
    },

    profileCompleted: {
      type: Boolean,
      default: false  // For technicians - track if they completed profile setup
    }
  },
  {timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPass) {
  return await bcrypt.compare(enteredPass, this.password);
};

module.exports = mongoose.model('User', userSchema);

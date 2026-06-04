const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    contactNumber: {
      type: String,
      default: null
    },

    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },

    // Admin who registered this organization
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },

    // Status of organization
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending'
    },

    // Verification details
    isVerified: {
      type: Boolean,
      default: false
    },

    verifiedBy: {
      type: String,
      default: null  // Super admin or admin who verified
    },

    verificationDate: {
      type: Date,
      default: null
    },

    verificationNotes: {
      type: String,
      default: null
    },

    website: {
      type: String,
      default: null
    },

    industry: {
      type: String,
      default: null
    },

    employeeCount: {
      type: Number,
      default: null
    },

    // Pending employees & technicians awaiting approval
    pendingUsers: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        role: {
          type: String,
          enum: ['employee', 'technician']
        },
        requestedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // Active users in organization
    activeUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],

    isActive: {
      type: Boolean,
      default: true
    },

    suspensionReason: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Index for faster queries
organizationSchema.index({ adminId: 1 });
organizationSchema.index({ status: 1 });
organizationSchema.index({ organizationName: 1 });

module.exports = mongoose.model('Organization', organizationSchema);

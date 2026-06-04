const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true
    },

    registrationNumber: {
      type: String,
      required: true,
      unique: true,
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
      required: true
    },

    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },

    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive', 'expired', 'cancelled', 'pending'],
      default: 'pending'
    },

    subscriptionPlan: {
      type: String,
      enum: ['basic', 'pro', 'enterprise'],
      default: null
    },

    subscriptionStartDate: {
      type: Date,
      default: null
    },

    subscriptionEndDate: {
      type: Date,
      default: null
    },

    subscriptionRenewalDate: {
      type: Date,
      default: null
    },

    maxEmployees: {
      type: Number,
      default: 10
    },

    maxTechnicians: {
      type: Number,
      default: 5
    },

    currentEmployeeCount: {
      type: Number,
      default: 0
    },

    currentTechnicianCount: {
      type: Number,
      default: 0
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },

    verificationDate: {
      type: Date,
      default: null
    },

    verificationNotes: {
      type: String,
      default: null
    },

    logo: {
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

    isActive: {
      type: Boolean,
      default: true
    },

    suspensionReason: {
      type: String,
      default: null
    },

    suspendedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Index for faster queries
companySchema.index({ adminId: 1 });
companySchema.index({ subscriptionStatus: 1 });
companySchema.index({ isVerified: 1 });

module.exports = mongoose.model('Company', companySchema);

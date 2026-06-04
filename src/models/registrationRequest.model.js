const mongoose = require('mongoose');

const registrationRequestSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    userRole: {
      type: String,
      enum: ['employee', 'technician'],
      required: true
    },

    userName: {
      type: String,
      required: true
    },

    userEmail: {
      type: String,
      required: true
    },

    // Registration details
    department: {
      type: String,
      default: null
    },

    floor: {
      type: String,
      default: null
    },

    skills: [String],  // For technicians

    professionType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProfessionType',
      default: null
    },

    // Request status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },

    approvedBy: {
      type: String,
      default: null  // Admin email who approved
    },

    approvalDate: {
      type: Date,
      default: null
    },

    rejectionReason: {
      type: String,
      default: null
    },

    requestedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for faster queries
registrationRequestSchema.index({ organizationId: 1 });
registrationRequestSchema.index({ status: 1 });
registrationRequestSchema.index({ userId: 1 });

module.exports = mongoose.model('RegistrationRequest', registrationRequestSchema);

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true
    },

    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true
    },

    razorpayPaymentId: {
      type: String,
      unique: true,
      required: true
    },

    razorpayOrderId: {
      type: String,
      required: true
    },

    planType: {
      type: String,
      enum: ['basic', 'pro', 'enterprise'],
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    currency: {
      type: String,
      default: 'INR'
    },

    status: {
      type: String,
      enum: ['captured', 'failed', 'refunded', 'pending'],
      default: 'pending'
    },

    method: {
      type: String,
      default: null
    },

    description: {
      type: String,
      default: null
    },

    email: {
      type: String,
      default: null
    },

    contact: {
      type: String,
      default: null
    },

    receiptUrl: {
      type: String,
      default: null
    },

    notes: {
      customKey: String,
      customValue: String
    },

    failureReason: {
      type: String,
      default: null
    },

    acquirerData: {
      authCode: String,
      bankName: String
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for faster queries
paymentSchema.index({ companyId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);

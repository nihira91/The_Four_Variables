const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true
    },

    razorpayOrderId: {
      type: String,
      default: null
    },

    razorpayPaymentId: {
      type: String,
      default: null
    },

    razorpaySubscriptionId: {
      type: String,
      default: null
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

    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },

    status: {
      type: String,
      enum: ['pending', 'initiated', 'authorized', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },

    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    nextBillingDate: {
      type: Date,
      default: null
    },

    renewalReminder: {
      type: Boolean,
      default: false
    },

    isAutoRenew: {
      type: Boolean,
      default: true
    },

    paymentMethod: {
      type: String,
      default: null
    },

    receipt: {
      type: String,
      default: null
    },

    failureReason: {
      type: String,
      default: null
    },

    notes: {
      type: String,
      default: null
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
subscriptionSchema.index({ companyId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);

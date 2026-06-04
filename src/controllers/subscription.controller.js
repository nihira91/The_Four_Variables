const Razorpay = require('razorpay');
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model');
const Payment = require('../models/payment.model');
const crypto = require('crypto');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Subscription Plans
const PLANS = {
  basic: {
    amount: 50000, // ₹500 in paise
    employees: 10,
    technicians: 5,
    duration: 1, // monthly
  },
  pro: {
    amount: 100000, // ₹1000 in paise
    employees: 50,
    technicians: 15,
    duration: 1,
  },
  enterprise: {
    amount: 200000, // ₹2000 in paise
    employees: 999,
    technicians: 50,
    duration: 1,
  },
};

/**
 * Create Razorpay Order for Subscription
 */
exports.createSubscriptionOrder = async (req, res) => {
  try {
    const { companyId, planType } = req.body;

    // Validate input
    if (!companyId || !planType) {
      return res.status(400).json({
        success: false,
        message: 'Company ID and Plan Type are required'
      });
    }

    if (!PLANS[planType]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type'
      });
    }

    // Get company
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const plan = PLANS[planType];

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: 'INR',
      receipt: `receipt_${companyId}_${Date.now()}`,
      notes: {
        companyId: companyId,
        companyName: company.companyName,
        planType: planType,
      },
    });

    // Create subscription record
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subscription = new Subscription({
      companyId,
      razorpayOrderId: order.id,
      planType,
      amount: plan.amount,
      billingCycle: 'monthly',
      status: 'initiated',
      paymentStatus: 'pending',
      startDate,
      endDate,
      nextBillingDate: endDate,
    });

    await subscription.save();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        subscription: subscription,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
    });
  }
};

/**
 * Verify Razorpay Payment Signature
 */
exports.verifyPaymentSignature = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscriptionId } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment details',
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature',
      });
    }

    // Get subscription details
    const subscription = await Subscription.findById(subscriptionId).populate('companyId');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    // Update subscription
    subscription.razorpayPaymentId = razorpay_payment_id;
    subscription.status = 'completed';
    subscription.paymentStatus = 'paid';
    await subscription.save();

    // Update company subscription status
    const company = subscription.companyId;
    company.subscriptionStatus = 'active';
    company.subscriptionPlan = subscription.planType;
    company.subscriptionStartDate = subscription.startDate;
    company.subscriptionEndDate = subscription.endDate;
    company.subscriptionRenewalDate = subscription.nextBillingDate;
    company.maxEmployees = PLANS[subscription.planType].employees;
    company.maxTechnicians = PLANS[subscription.planType].technicians;
    await company.save();

    // Create payment record
    const payment = new Payment({
      companyId: subscription.companyId._id,
      subscriptionId: subscription._id,
      razorpayPaymentId,
      razorpayOrderId,
      planType: subscription.planType,
      amount: subscription.amount,
      status: 'captured',
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        subscription,
        company,
      },
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message,
    });
  }
};

/**
 * Get Subscription Details
 */
exports.getSubscriptionDetails = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    const subscription = await Subscription.findOne({ companyId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        company: {
          name: company.companyName,
          subscriptionStatus: company.subscriptionStatus,
          subscriptionPlan: company.subscriptionPlan,
          subscriptionStartDate: company.subscriptionStartDate,
          subscriptionEndDate: company.subscriptionEndDate,
          maxEmployees: company.maxEmployees,
          maxTechnicians: company.maxTechnicians,
          currentEmployees: company.currentEmployeeCount,
          currentTechnicians: company.currentTechnicianCount,
        },
        subscription,
      },
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription details',
      error: error.message,
    });
  }
};

/**
 * Get Payment History
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const payments = await Payment.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Payment.countDocuments({ companyId });

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message,
    });
  }
};

/**
 * Cancel Subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Update company subscription
    company.subscriptionStatus = 'cancelled';
    await company.save();

    // Update subscription
    const subscription = await Subscription.findOne({ companyId });
    if (subscription) {
      subscription.status = 'cancelled';
      await subscription.save();
    }

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: company,
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message,
    });
  }
};

/**
 * Renew Subscription
 */
exports.renewSubscription = async (req, res) => {
  try {
    const { companyId } = req.body;

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    if (!company.subscriptionPlan) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found',
      });
    }

    const planType = company.subscriptionPlan;
    const plan = PLANS[planType];

    // Create new order for renewal
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: 'INR',
      receipt: `renewal_${companyId}_${Date.now()}`,
      notes: {
        companyId: companyId,
        companyName: company.companyName,
        planType: planType,
        type: 'renewal',
      },
    });

    // Create new subscription record
    const startDate = new Date(company.subscriptionEndDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const subscription = new Subscription({
      companyId,
      razorpayOrderId: order.id,
      planType,
      amount: plan.amount,
      billingCycle: 'monthly',
      status: 'initiated',
      paymentStatus: 'pending',
      startDate,
      endDate,
      nextBillingDate: endDate,
    });

    await subscription.save();

    res.status(201).json({
      success: true,
      message: 'Renewal order created successfully',
      data: {
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        subscription,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error('Error renewing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to renew subscription',
      error: error.message,
    });
  }
};

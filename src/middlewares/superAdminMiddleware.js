/**
 * Super Admin Verification Middleware
 * - Verify super admin role
 * - Verify company subscriptions
 * - Verify pending companies
 */

const Admin = require('../models/admin.model');
const Company = require('../models/company.model');

/**
 * Check if user is Super Admin
 */
exports.isSuperAdmin = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    if (admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can perform this action',
      });
    }

    req.superAdmin = admin;
    next();
  } catch (error) {
    console.error('Error checking super admin role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify super admin',
      error: error.message,
    });
  }
};

/**
 * Verify company subscription
 * Super admin endpoint to approve/verify companies
 */
exports.verifyCompanySubscriptionAdmin = async (req, res, next) => {
  try {
    const { companyId, action, notes } = req.body;

    if (!companyId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Company ID and action are required',
      });
    }

    if (!['approve', 'reject', 'suspend'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Allowed: approve, reject, suspend',
      });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Update company verification status
    if (action === 'approve') {
      company.isVerified = true;
      company.verifiedBy = req.superAdmin._id;
      company.verificationDate = new Date();
      company.verificationNotes = notes || '';
    } else if (action === 'reject') {
      company.isVerified = false;
      company.verificationNotes = notes || 'Company rejected by super admin';
    } else if (action === 'suspend') {
      company.isActive = false;
      company.suspendedAt = new Date();
      company.suspensionReason = notes || 'Suspended by super admin';
    }

    await company.save();

    req.company = company;
    next();
  } catch (error) {
    console.error('Error in verification middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process verification',
      error: error.message,
    });
  }
};

/**
 * Get pending companies for verification
 */
exports.getPendingCompanies = async (req, res) => {
  try {
    const { limit = 10, offset = 0, status = 'pending' } = req.query;

    const filter = {};

    if (status === 'pending') {
      filter.isVerified = false;
      filter.subscriptionStatus = 'pending';
    } else if (status === 'verified') {
      filter.isVerified = true;
    } else if (status === 'active') {
      filter.subscriptionStatus = 'active';
    }

    const companies = await Company.find(filter)
      .populate('adminId', 'name email')
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Company.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        companies,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching pending companies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch companies',
      error: error.message,
    });
  }
};

/**
 * Get all companies for super admin
 */
exports.getAllCompaniesAdmin = async (req, res) => {
  try {
    const { limit = 10, offset = 0, search = '', subscriptionStatus } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (subscriptionStatus) {
      filter.subscriptionStatus = subscriptionStatus;
    }

    const companies = await Company.find(filter)
      .populate('adminId', 'name email')
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Company.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        companies,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch companies',
      error: error.message,
    });
  }
};

/**
 * Suspend company
 */
exports.suspendCompany = async (req, res) => {
  try {
    const { companyId, reason } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required',
      });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    company.isActive = false;
    company.suspendedAt = new Date();
    company.suspensionReason = reason || 'Suspended by super admin';
    await company.save();

    res.status(200).json({
      success: true,
      message: 'Company suspended successfully',
      data: company,
    });
  } catch (error) {
    console.error('Error suspending company:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend company',
      error: error.message,
    });
  }
};

/**
 * Reactivate company
 */
exports.reactivateCompany = async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required',
      });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    company.isActive = true;
    company.suspensionReason = null;
    company.suspendedAt = null;
    await company.save();

    res.status(200).json({
      success: true,
      message: 'Company reactivated successfully',
      data: company,
    });
  } catch (error) {
    console.error('Error reactivating company:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate company',
      error: error.message,
    });
  }
};

/**
 * Get company details and stats
 */
exports.getCompanyStats = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId)
      .populate('adminId', 'name email contactNumber')
      .populate('verifiedBy', 'name email');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Get company statistics
    const stats = {
      company,
      usage: {
        employees: {
          current: company.currentEmployeeCount,
          max: company.maxEmployees,
          percentage: Math.round((company.currentEmployeeCount / company.maxEmployees) * 100),
        },
        technicians: {
          current: company.currentTechnicianCount,
          max: company.maxTechnicians,
          percentage: Math.round((company.currentTechnicianCount / company.maxTechnicians) * 100),
        },
      },
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching company stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company statistics',
      error: error.message,
    });
  }
};

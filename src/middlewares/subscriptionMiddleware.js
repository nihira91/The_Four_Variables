const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model');

/**
 * Verify if company has active subscription
 * Prevents employees/technicians registration if company is not subscribed
 */
exports.verifyCompanySubscription = async (req, res, next) => {
  try {
    const { companyId } = req.body || req.params;

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

    // Check if company is verified
    if (!company.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Company must be verified by admin before registration',
      });
    }

    // Check if subscription is active
    if (company.subscriptionStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Company subscription is ${company.subscriptionStatus}. Please contact admin.`,
        subscriptionStatus: company.subscriptionStatus,
      });
    }

    // Check if subscription is expired
    if (company.subscriptionEndDate && new Date() > new Date(company.subscriptionEndDate)) {
      company.subscriptionStatus = 'expired';
      await company.save();

      return res.status(403).json({
        success: false,
        message: 'Company subscription has expired',
        subscriptionStatus: 'expired',
      });
    }

    // Check employee limit
    if (req.body.role === 'employee') {
      if (company.currentEmployeeCount >= company.maxEmployees) {
        return res.status(403).json({
          success: false,
          message: `Employee limit (${company.maxEmployees}) reached for this company`,
        });
      }
    }

    // Check technician limit
    if (req.body.role === 'technician') {
      if (company.currentTechnicianCount >= company.maxTechnicians) {
        return res.status(403).json({
          success: false,
          message: `Technician limit (${company.maxTechnicians}) reached for this company`,
        });
      }
    }

    // Check if company is suspended
    if (!company.isActive) {
      return res.status(403).json({
        success: false,
        message: `Company is suspended. Reason: ${company.suspensionReason}`,
      });
    }

    req.company = company;
    next();
  } catch (error) {
    console.error('Error verifying company subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify subscription',
      error: error.message,
    });
  }
};

/**
 * Check if company belongs to the admin
 */
exports.verifyCompanyOwnership = async (req, res, next) => {
  try {
    const { companyId } = req.body || req.params;
    const adminId = req.user?.id || req.admin?.id;

    if (!companyId || !adminId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID and Admin ID are required',
      });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    if (company.adminId.toString() !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this company',
      });
    }

    req.company = company;
    next();
  } catch (error) {
    console.error('Error verifying company ownership:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify company ownership',
      error: error.message,
    });
  }
};

/**
 * Check subscription capacity before adding user
 */
exports.checkSubscriptionCapacity = async (req, res, next) => {
  try {
    const { companyId, role } = req.body;

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

    if (role === 'employee') {
      if (company.currentEmployeeCount >= company.maxEmployees) {
        return res.status(403).json({
          success: false,
          message: `Cannot add more employees. Limit reached (${company.maxEmployees})`,
          current: company.currentEmployeeCount,
          max: company.maxEmployees,
        });
      }
    } else if (role === 'technician') {
      if (company.currentTechnicianCount >= company.maxTechnicians) {
        return res.status(403).json({
          success: false,
          message: `Cannot add more technicians. Limit reached (${company.maxTechnicians})`,
          current: company.currentTechnicianCount,
          max: company.maxTechnicians,
        });
      }
    }

    req.company = company;
    next();
  } catch (error) {
    console.error('Error checking subscription capacity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription capacity',
      error: error.message,
    });
  }
};

/**
 * Update company user counts
 */
exports.updateCompanyUserCounts = async (companyId, role, action = 'add') => {
  try {
    const company = await Company.findById(companyId);

    if (!company) {
      throw new Error('Company not found');
    }

    if (action === 'add') {
      if (role === 'employee') {
        company.currentEmployeeCount += 1;
      } else if (role === 'technician') {
        company.currentTechnicianCount += 1;
      }
    } else if (action === 'remove') {
      if (role === 'employee') {
        company.currentEmployeeCount = Math.max(0, company.currentEmployeeCount - 1);
      } else if (role === 'technician') {
        company.currentTechnicianCount = Math.max(0, company.currentTechnicianCount - 1);
      }
    }

    await company.save();
    return company;
  } catch (error) {
    console.error('Error updating company user counts:', error);
    throw error;
  }
};

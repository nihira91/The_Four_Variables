const Company = require('../models/company.model');
const Admin = require('../models/admin.model');
const User = require('../models/user.model');
const Subscription = require('../models/subscription.model');

/**
 * Admin: Register Company
 * Admin creates a company and becomes the company admin
 */
exports.registerCompany = async (req, res) => {
  try {
    const {
      companyName,
      registrationNumber,
      email,
      contactNumber,
      address,
      website,
      industry,
      employeeCount,
    } = req.body;

    const adminId = req.user?.id || req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate required fields
    if (!companyName || !registrationNumber || !email || !contactNumber) {
      return res.status(400).json({
        success: false,
        message: 'Company name, registration number, email, and contact number are required',
      });
    }

    // Check if registration number already exists
    const existingCompany = await Company.findOne({ registrationNumber });
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company with this registration number already exists',
      });
    }

    // Check if email already exists
    const existingEmail = await Company.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Company with this email already exists',
      });
    }

    // Create company
    const company = new Company({
      companyName,
      registrationNumber,
      email,
      contactNumber,
      address: address || {},
      website: website || null,
      industry: industry || null,
      employeeCount: employeeCount || null,
      adminId,
      subscriptionStatus: 'pending',
      isVerified: false,
    });

    await company.save();

    // Update admin to link to company
    const admin = await Admin.findById(adminId);
    if (admin) {
      admin.companyId = company._id;
      await admin.save();
    }

    res.status(201).json({
      success: true,
      message: 'Company registered successfully',
      data: {
        company,
        message: 'Your company registration is pending verification by super admin',
      },
    });
  } catch (error) {
    console.error('Error registering company:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register company',
      error: error.message,
    });
  }
};

/**
 * Get Company Details
 */
exports.getCompanyDetails = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId)
      .populate('adminId', 'name email contactNumber department')
      .populate('verifiedBy', 'name email');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company details',
      error: error.message,
    });
  }
};

/**
 * Get Company by Admin
 * Logged-in admin gets their company details
 */
exports.getMyCompany = async (req, res) => {
  try {
    const adminId = req.user?.id || req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin?.companyId) {
      return res.status(404).json({
        success: false,
        message: 'No company linked to this admin',
      });
    }

    const company = await Company.findById(admin.companyId)
      .populate('verifiedBy', 'name email');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Get company stats
    const users = await User.find({ companyId: company._id }).select('role');
    const employeeCount = users.filter(u => u.role === 'employee').length;
    const technicianCount = users.filter(u => u.role === 'technician').length;

    const response = {
      ...company.toObject(),
      stats: {
        employees: {
          current: employeeCount,
          max: company.maxEmployees,
          available: company.maxEmployees - employeeCount,
        },
        technicians: {
          current: technicianCount,
          max: company.maxTechnicians,
          available: company.maxTechnicians - technicianCount,
        },
      },
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company details',
      error: error.message,
    });
  }
};

/**
 * Update Company Details
 */
exports.updateCompanyDetails = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { website, industry, employeeCount, address } = req.body;

    const company = await Company.findByIdAndUpdate(
      companyId,
      {
        website,
        industry,
        employeeCount,
        address: address || company.address,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Company details updated successfully',
      data: company,
    });
  } catch (error) {
    console.error('Error updating company details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company details',
      error: error.message,
    });
  }
};

/**
 * Get Company Users (Employees and Technicians)
 */
exports.getCompanyUsers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { role, limit = 20, offset = 0 } = req.query;

    const filter = { companyId };

    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter)
      .select('-password')
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching company users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company users',
      error: error.message,
    });
  }
};

/**
 * Remove User from Company
 */
exports.removeUserFromCompany = async (req, res) => {
  try {
    const { userId, companyId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.companyId.toString() !== companyId) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to this company',
      });
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    // Update company user counts
    const company = await Company.findById(companyId);
    if (company) {
      if (user.role === 'employee') {
        company.currentEmployeeCount = Math.max(0, company.currentEmployeeCount - 1);
      } else if (user.role === 'technician') {
        company.currentTechnicianCount = Math.max(0, company.currentTechnicianCount - 1);
      }
      await company.save();
    }

    res.status(200).json({
      success: true,
      message: 'User removed from company successfully',
    });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove user',
      error: error.message,
    });
  }
};

/**
 * Get Company Dashboard Stats
 */
exports.getCompanyDashboardStats = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    const employees = await User.countDocuments({ companyId, role: 'employee' });
    const technicians = await User.countDocuments({ companyId, role: 'technician' });

    const stats = {
      company: {
        name: company.companyName,
        subscriptionStatus: company.subscriptionStatus,
        subscriptionPlan: company.subscriptionPlan,
        subscriptionEndDate: company.subscriptionEndDate,
        isActive: company.isActive,
        isVerified: company.isVerified,
      },
      users: {
        employees: {
          current: employees,
          max: company.maxEmployees,
          available: Math.max(0, company.maxEmployees - employees),
          percentage: Math.round((employees / company.maxEmployees) * 100),
        },
        technicians: {
          current: technicians,
          max: company.maxTechnicians,
          available: Math.max(0, company.maxTechnicians - technicians),
          percentage: Math.round((technicians / company.maxTechnicians) * 100),
        },
      },
      subscription: {
        status: company.subscriptionStatus,
        plan: company.subscriptionPlan,
        startDate: company.subscriptionStartDate,
        endDate: company.subscriptionEndDate,
        renewalDate: company.subscriptionRenewalDate,
        daysRemaining: company.subscriptionEndDate
          ? Math.ceil((new Date(company.subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24))
          : 0,
      },
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching company dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company statistics',
      error: error.message,
    });
  }
};

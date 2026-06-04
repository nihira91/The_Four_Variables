const Organization = require('../models/organization.model');
const RegistrationRequest = require('../models/registrationRequest.model');
const User = require('../models/user.model');
const Admin = require('../models/admin.model');

/**
 * Admin: Register Organization
 */
exports.registerOrganization = async (req, res) => {
  try {
    const { organizationName, email, contactNumber, address, website, industry } = req.body;
    const adminId = req.user?.id || req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!organizationName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Organization name and email are required'
      });
    }

    // Check if organization already exists
    const existingOrg = await Organization.findOne({ $or: [{ organizationName }, { email }] });
    if (existingOrg) {
      return res.status(400).json({
        success: false,
        message: 'Organization with this name or email already exists'
      });
    }

    // Create organization
    const organization = new Organization({
      organizationName,
      email,
      contactNumber: contactNumber || null,
      address: address || {},
      website: website || null,
      industry: industry || null,
      adminId,
      status: 'approved',  // Admin registration is auto-approved
      isVerified: false
    });

    await organization.save();

    res.status(201).json({
      success: true,
      message: 'Organization registered successfully',
      data: {
        organization,
        message: 'Your organization is ready. Employees and technicians can now register.'
      }
    });
  } catch (error) {
    console.error('Error registering organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register organization',
      error: error.message
    });
  }
};

/**
 * Get list of all available organizations
 */
exports.getOrganizations = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { status: 'approved', isActive: true };

    if (search) {
      filter.organizationName = { $regex: search, $options: 'i' };
    }

    const organizations = await Organization.find(filter)
      .select('organizationName email contactNumber industry')
      .sort({ createdAt: -1 })
      .lean();

    // Transform to match frontend expectations
    const formattedOrganizations = organizations.map(org => ({
      _id: org._id,
      name: org.organizationName,
      email: org.email,
      contactNumber: org.contactNumber,
      industry: org.industry
    }));

    res.status(200).json({
      success: true,
      organizations: formattedOrganizations
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations',
      error: error.message
    });
  }
};

/**
 * Get organization details
 */
exports.getOrganizationDetails = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const organization = await Organization.findById(organizationId)
      .populate('adminId', 'name email')
      .populate('activeUsers', 'name email role');

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    res.status(200).json({
      success: true,
      data: organization
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization',
      error: error.message
    });
  }
};

/**
 * Get organization's pending registration requests (for admin)
 */
exports.getPendingRegistrations = async (req, res) => {
  try {
    // Get admin's organization - req.user._id is set by authMiddleware
    const adminId = req.user._id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Get organization managed by this admin
    const organization = await Organization.findOne({ adminId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'No organization found for this admin'
      });
    }

    // Get pending requests
    const pendingRequests = await RegistrationRequest.find({
      organizationId: organization._id,
      status: 'pending'
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: pendingRequests
    });
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending registrations',
      error: error.message
    });
  }
};

/**
 * Approve user registration (admin)
 */
exports.approveRegistration = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user?.id || req.admin?.id;

    // Get registration request
    const request = await RegistrationRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Registration request not found'
      });
    }

    // Verify organization belongs to this admin
    const organization = await Organization.findById(request.organizationId);
    if (organization.adminId.toString() !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this request'
      });
    }

    // Update registration request
    request.status = 'approved';
    request.approvedBy = req.user?.email || req.admin?.email;
    request.approvalDate = new Date();
    await request.save();

    // Activate user account
    const user = await User.findById(request.userId);
    user.isActive = true;
    await user.save();

    // Add to organization's active users
    if (!organization.activeUsers.includes(request.userId)) {
      organization.activeUsers.push(request.userId);
      await organization.save();
    }

    res.status(200).json({
      success: true,
      message: `${request.userRole} registration approved successfully`,
      data: request
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve registration',
      error: error.message
    });
  }
};

/**
 * Reject user registration (admin)
 */
exports.rejectRegistration = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.id || req.admin?.id;

    // Get registration request
    const request = await RegistrationRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Registration request not found'
      });
    }

    // Verify organization belongs to this admin
    const organization = await Organization.findById(request.organizationId);
    if (organization.adminId.toString() !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this request'
      });
    }

    // Update registration request
    request.status = 'rejected';
    request.rejectionReason = reason || 'No reason provided';
    await request.save();

    // Delete user account
    await User.findByIdAndDelete(request.userId);

    res.status(200).json({
      success: true,
      message: 'Registration rejected and user account deleted',
      data: request
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject registration',
      error: error.message
    });
  }
};

/**
 * Get organization's active users (for admin)
 */
exports.getOrganizationUsers = async (req, res) => {
  try {
    const adminId = req.user?.id || req.admin?.id;
    const { role } = req.query;

    const organization = await Organization.findOne({ adminId });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'No organization found for this admin'
      });
    }

    const filter = { _id: { $in: organization.activeUsers } };
    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter).select('-password');

    res.status(200).json({
      success: true,
      data: {
        organizationName: organization.organizationName,
        totalUsers: users.length,
        users
      }
    });
  } catch (error) {
    console.error('Error fetching organization users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization users',
      error: error.message
    });
  }
};

/**
 * Get admin's organization details
 */
exports.getMyOrganization = async (req, res) => {
  try {
    const adminId = req.user?.id || req.admin?.id;

    const organization = await Organization.findOne({ adminId })
      .populate('adminId', 'name email')
      .populate('activeUsers', 'name email role');

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found for this admin'
      });
    }

    // Get pending requests count
    const pendingCount = await RegistrationRequest.countDocuments({
      organizationId: organization._id,
      status: 'pending'
    });

    res.status(200).json({
      success: true,
      data: {
        ...organization.toObject(),
        stats: {
          totalUsers: organization.activeUsers.length,
          pendingApprovals: pendingCount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching my organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization details',
      error: error.message
    });
  }
};

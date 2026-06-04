const Organization = require('../models/organization.model');
const RegistrationRequest = require('../models/registrationRequest.model');

/**
 * Verify organization exists and is active
 */
exports.verifyOrganizationExists = async (req, res, next) => {
  try {
    const { organizationId } = req.body || req.params;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    if (!organization.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Organization is inactive'
      });
    }

    if (organization.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Organization is ${organization.status}. Please contact super admin.`
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error('Error verifying organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify organization',
      error: error.message
    });
  }
};

/**
 * Check if admin belongs to organization
 */
exports.verifyAdminBelongsToOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params || req.body;
    const adminId = req.user?.id || req.admin?.id;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    if (organization.adminId.toString() !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to manage this organization'
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error('Error verifying admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify authorization',
      error: error.message
    });
  }
};

/**
 * Create registration request for pending user
 */
exports.createRegistrationRequest = async (userId, organizationId, userRole, userDetails) => {
  try {
    const request = new RegistrationRequest({
      userId,
      organizationId,
      userRole,
      userName: userDetails.name,
      userEmail: userDetails.email,
      department: userDetails.department || null,
      floor: userDetails.floor || null,
      skills: userDetails.skills || [],
      professionType: userDetails.professionType || null,
      status: 'pending'
    });

    await request.save();
    return request;
  } catch (error) {
    console.error('Error creating registration request:', error);
    throw error;
  }
};

/**
 * Check if user has pending approval
 */
exports.hasPendingApproval = async (userId, organizationId) => {
  try {
    const request = await RegistrationRequest.findOne({
      userId,
      organizationId,
      status: 'pending'
    });

    return !!request;
  } catch (error) {
    console.error('Error checking pending approval:', error);
    return false;
  }
};

/**
 * Check if user is approved in organization
 */
exports.isUserApproved = async (userId, organizationId) => {
  try {
    const request = await RegistrationRequest.findOne({
      userId,
      organizationId,
      status: 'approved'
    });

    return !!request;
  } catch (error) {
    console.error('Error checking user approval:', error);
    return false;
  }
};

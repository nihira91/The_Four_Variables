const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organization.controller');
const organizationMiddleware = require('../middlewares/organizationMiddleware');
const authMiddleware = require('../middlewares/authmiddleware');
const { adminAuthCheck } = require('../middlewares/adminAuthCheck');

/**
 * ADMIN ROUTES
 */

/**
 * Admin: Register Organization
 * POST /api/organization/register
 */
router.post('/register', authMiddleware, adminAuthCheck, organizationController.registerOrganization);

/**
 * Admin: Get their organization details
 * GET /api/organization/my-organization
 */
router.get('/my-organization', authMiddleware, adminAuthCheck, organizationController.getMyOrganization);

/**
 * Admin: Get pending registration requests
 * GET /api/organization/pending-approvals
 */
router.get('/pending-approvals', authMiddleware, adminAuthCheck, organizationController.getPendingRegistrations);

/**
 * Admin: Approve user registration
 * POST /api/organization/approve/:requestId
 */
router.post('/approve/:requestId', authMiddleware, adminAuthCheck, organizationController.approveRegistration);

/**
 * Admin: Reject user registration
 * POST /api/organization/reject/:requestId
 */
router.post('/reject/:requestId', authMiddleware, adminAuthCheck, organizationController.rejectRegistration);

/**
 * Admin: Get active users in their organization
 * GET /api/organization/users?role=employee
 */
router.get('/users', authMiddleware, adminAuthCheck, organizationController.getOrganizationUsers);

/**
 * PUBLIC ROUTES
 */

/**
 * Get list of available organizations (for employee/technician registration)
 * GET /api/organization/list?search=company
 */
router.get('/list', organizationController.getOrganizations);

/**
 * Get organization details by ID
 * GET /api/organization/:organizationId
 */
router.get('/:organizationId', organizationController.getOrganizationDetails);

module.exports = router;

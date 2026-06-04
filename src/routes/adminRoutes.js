/* Admin Routes for FixFlow IMS */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middlewares/authmiddleware');
const { adminAuthCheck } = require('../middlewares/adminAuthCheck');

// Middleware to verify admin
const verifyAdmin = [verifyToken, adminAuthCheck];

// Admin Profile
router.get('/profile', verifyAdmin, adminController.getAdminProfile);

// Dashboard & Statistics
router.get('/dashboard-stats', verifyAdmin, adminController.getDashboardStats);
router.get('/sla-metrics', verifyAdmin, adminController.getSLAMetrics);
router.get('/breached-slas', verifyAdmin, adminController.getBreachedSLAs);

// View all issues
router.get('/issues', verifyAdmin, adminController.getAllIssues);

// Bulk Operations
router.post('/bulk-assign', verifyAdmin, adminController.bulkAssignIssues);
router.post('/auto-assign', verifyAdmin, adminController.autoAssignIssues);
router.post('/remove-assignment/:issueId', verifyAdmin, adminController.removeTechnicianAssignment);
router.post('/bulk-close', verifyAdmin, adminController.bulkCloseIssues);
router.get('/export', verifyAdmin, adminController.exportReports);

// Escalation Management
router.post('/escalate-by-priority', verifyAdmin, adminController.escalateByPriority);
router.post('/escalate/:issueId', verifyAdmin, adminController.escalateIssueById);
router.post('/setup-auto-escalation', verifyAdmin, adminController.setupAutoEscalation);
router.post('/setup-critical-escalation', verifyAdmin, adminController.setupCriticalAutoEscalation);

// User Management
router.get('/employees', verifyAdmin, adminController.getAllEmployees);
router.get('/technicians', verifyAdmin, adminController.getAllTechnicians);
router.delete('/user/:userId', verifyAdmin, adminController.deleteUser);

// Settings
router.post('/settings', verifyAdmin, adminController.saveSettings);

module.exports = router;

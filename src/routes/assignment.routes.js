/**
 * Assignment Routes
 * Admin endpoints for assign/deallocate/reassign issues
 */

const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment.controller');
const verifyToken = require('../middlewares/authmiddleware');
const { adminAuthCheck } = require('../middlewares/adminAuthCheck');

// Middleware to verify admin
const verifyAdmin = [verifyToken, adminAuthCheck];

/**
 * @route POST /api/assignments/auto-assign/:issueId
 * @desc Auto-assign an issue to best available technician
 * @access Admin only
 */
router.post('/auto-assign/:issueId', verifyAdmin, assignmentController.autoAssignIssue);

/**
 * @route POST /api/assignments/manual-assign/:issueId
 * @desc Manually assign issue to specific technician
 * @access Admin only
 * @body { technicianId, reason }
 */
router.post('/manual-assign/:issueId', verifyAdmin, assignmentController.manualAssignIssue);

/**
 * @route POST /api/assignments/deallocate/:issueId
 * @desc Remove technician from issue
 * @access Admin only
 * @body { reason }
 */
router.post('/deallocate/:issueId', verifyAdmin, assignmentController.deallocateIssue);

/**
 * @route POST /api/assignments/bulk-auto-assign
 * @desc Auto-assign multiple issues at once
 * @access Admin only
 * @body { issueIds: [id1, id2, ...] }
 */
router.post('/bulk-auto-assign', verifyAdmin, assignmentController.bulkAutoAssign);

/**
 * @route POST /api/assignments/reassign/:issueId
 * @desc Reassign issue to different technician
 * @access Admin only
 * @body { newTechnicianId, reason }
 */
router.post('/reassign/:issueId', verifyAdmin, assignmentController.reassignIssue);

/**
 * @route GET /api/assignments/history/:issueId
 * @desc Get assignment history for an issue
 * @access Admin, Technician (for their own issues)
 */
router.get('/history/:issueId', verifyToken, assignmentController.getAssignmentHistory);

/**
 * @route GET /api/assignments/technician/:technicianId
 * @desc Get all active assignments for a technician
 * @access Admin, Technician (for themselves)
 */
router.get('/technician/:technicianId', verifyToken, assignmentController.getTechnicianAssignments);

/**
 * @route GET /api/assignments/workload/summary
 * @desc Get workload summary for all technicians
 * @access Admin only
 */
router.get('/workload/summary', verifyAdmin, assignmentController.getTechnicianWorkloadSummary);

module.exports = router;

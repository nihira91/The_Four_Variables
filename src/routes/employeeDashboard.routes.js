
const express = require("express");
const router = express.Router();

const { employeeAuthCheck } = require("../middlewares/employeeAuthCheck");
const verifyToken = require('../middlewares/authmiddleware');
const {
  getEmployeeDashboardStats,
  getIssueDetails,
  getEmployeeIssuesEnhanced,
  rateTechnician
} = require("../controllers/employeeDashboard.controller");

router.get("/stats", employeeAuthCheck, getEmployeeDashboardStats);

/**
 * @route GET /api/employee/dashboard/issues
 * Enhanced issue list with deadline, progress, assigned technician
 */
router.get('/issues', verifyToken, getEmployeeIssuesEnhanced);

/**
 * @route GET /api/employee/dashboard/issue/:issueId
 * Get detailed issue info with technician details, deadline, progress
 */
router.get('/issue/:issueId', verifyToken, getIssueDetails);

/**
 * @route POST /api/employee/dashboard/rate/:issueId
 * Rate technician after issue completion
 */
router.post('/rate/:issueId', verifyToken, rateTechnician);

module.exports = router;

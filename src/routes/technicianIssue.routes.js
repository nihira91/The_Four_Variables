const express = require("express");
const router = express.Router();

const { verifyToken, technicianAuthCheck } = require("../middlewares/technicianAuthCheck");

const {
    getAssignedIssues,
    getTechnicianIssueDetails,
    updateIssueStatus,
    uploadProof
} = require("../controllers/technicianIssue.controller");

const {
    getTechnicianAssignedIssues,
    getTechnicianIssueDetails: getDashboardIssueDetails,
    updateIssueProgress,
    addTechnicianNote,
    completeIssue,
    getTechnicianDashboardSummary
} = require("../controllers/technicianDashboard.controller");

// Original routes (kept for compatibility)
//get all issues assigned to the technician
router.get(
    "/assigned",
    verifyToken,
    technicianAuthCheck("technician"),
    getAssignedIssues
);

//get single issue details
router.get(
    "/:id",
    verifyToken,
    technicianAuthCheck("technician"),
    getTechnicianIssueDetails
);

//update issue status
router.patch(
    "/:id/status",
    verifyToken,
    technicianAuthCheck("technician"),
    updateIssueStatus
);

//upload work proof
router.patch(
    "/:id/upload-proof",
    verifyToken,
    technicianAuthCheck("technician"),
    uploadProof
);

// New enhanced dashboard routes
/**
 * @route GET /api/technician/issues/dashboard/summary
 * Get technician dashboard summary
 */
router.get('/dashboard/summary', verifyToken, getTechnicianDashboardSummary);

/**
 * @route GET /api/technician/issues/dashboard/assigned
 * Get all assigned issues with enhanced details
 */
router.get('/dashboard/assigned', verifyToken, getTechnicianAssignedIssues);

/**
 * @route GET /api/technician/issues/dashboard/:issueId
 * Get detailed issue info for technician
 */
router.get('/dashboard/:issueId', verifyToken, getDashboardIssueDetails);

/**
 * @route POST /api/technician/issues/:issueId/progress
 * Update issue progress
 * @body { progress: 0-100, message: "update message" }
 */
router.post('/:issueId/progress', verifyToken, updateIssueProgress);

/**
 * @route POST /api/technician/issues/:issueId/note
 * Add technician note/comment
 * @body { message: "note content" }
 */
router.post('/:issueId/note', verifyToken, addTechnicianNote);

/**
 * @route POST /api/technician/issues/:issueId/complete
 * Mark issue as complete
 * @body { completionNotes: "optional notes" }
 */
router.post('/:issueId/complete', verifyToken, completeIssue);

module.exports = router;

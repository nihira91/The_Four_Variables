/**
 * SLA Routes - API endpoints for SLA tracking
 */

const express = require('express');
const router = express.Router();
const slaController = require('../controllers/sla.controller');
const protect = require('../middlewares/authmiddleware');
const { migrateSLAForExistingIssues } = require('../services/sla.migration');

// 🔄 MIGRATE EXISTING ISSUES - Initialize SLA for issues without it
router.post('/migrate', async (req, res) => {
  try {
    const result = await migrateSLAForExistingIssues();
    res.status(200).json(result);
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

// 📊 GET SLA METRICS - Dashboard overview
router.get('/metrics', protect, slaController.getSLAMetrics);

// 🚨 GET BREACHED SLAs - List all breached SLAs with filters
router.get('/breached', protect, slaController.getBreachedSLAs);

// 📋 GET ISSUE SLA DETAILS - Single issue SLA info with remaining time
router.get('/issue/:issueId', protect, slaController.getIssueSLADetails);

// ⚠️ CHECK SLA VIOLATIONS - Manually trigger violation check and alerts
router.post('/check-violations/:issueId', protect, slaController.checkSLAViolations);

// 📈 GET ISSUES BY COMPLIANCE STATUS - Filter by response-breach, resolution-breach, at-risk
router.get('/status/:status', protect, slaController.getIssuesByComplianceStatus);

// 📊 GET SLA REPORT - Generate report for date range
router.get('/report', protect, slaController.getSLAReport);

// 📊 GET ENHANCED SLA METRICS - New SLA tracking service
router.get('/enhanced/metrics', protect, slaController.getEnhancedSLAMetrics);

// ⚠️ GET ISSUES AT RISK - Issues at risk of SLA breach (70%+ time used)
router.get('/risk/at-risk', protect, slaController.getIssuesAtRisk);

// 🔔 CHECK ALL SLA BREACHES - Check all issues and send notifications
router.post('/admin/check-all-breaches', protect, slaController.checkAllSLABreach);

module.exports = router;

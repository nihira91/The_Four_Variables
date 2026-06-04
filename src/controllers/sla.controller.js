/**
 * SLA Controller - Handles SLA tracking endpoints
 */

const { 
  getBreachedSLAs, 
  getSLAMetrics, 
  calculateRemainingTime,
  checkAndAlertSLAViolations 
} = require('../services/sla.service');

const Issue = require('../models/issue.model');

/**
 * Get all breached SLAs with optional filters
 * GET /api/sla/breached
 */
exports.getBreachedSLAs = async (req, res) => {
  try {
    const { priority, category, technicianId } = req.query;

    const filters = {};
    if (priority) filters.priority = priority;
    if (category) filters.category = category;
    if (technicianId) filters.assignedTechnician = technicianId;

    const breachedSLAs = await getBreachedSLAs(filters);

    res.status(200).json({
      count: breachedSLAs.length,
      breachedSLAs
    });
  } catch (error) {
    console.error('❌ Error fetching breached SLAs:', error);
    res.status(500).json({ message: 'Error fetching breached SLAs' });
  }
};

/**
 * Get SLA metrics and compliance dashboard
 * GET /api/sla/metrics
 */
exports.getSLAMetrics = async (req, res) => {
  try {
    const metrics = await getSLAMetrics();

    res.status(200).json({
      timestamp: new Date(),
      metrics
    });
  } catch (error) {
    console.error('❌ Error fetching SLA metrics:', error);
    res.status(500).json({ message: 'Error fetching SLA metrics' });
  }
};

/**
 * Get single issue SLA details with remaining time
 * GET /api/sla/issue/:issueId
 */
exports.getIssueSLADetails = async (req, res) => {
  try {
    const { issueId } = req.params;

    const issue = await Issue.findById(issueId)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email');

    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    // Calculate remaining time
    const { responseRemaining, resolutionRemaining } = await calculateRemainingTime(issueId);

    res.status(200).json({
      issueId: issue._id,
      title: issue.title,
      priority: issue.priority,
      status: issue.status,
      createdAt: issue.createdAt,
      sla: {
        ...issue.sla.toObject(),
        responseTimeRemaining: Math.round(responseRemaining),
        resolutionTimeRemaining: Math.round(resolutionRemaining)
      },
      createdBy: issue.createdBy,
      assignedTechnician: issue.assignedTechnician
    });
  } catch (error) {
    console.error('❌ Error fetching issue SLA:', error);
    res.status(500).json({ message: 'Error fetching issue SLA details' });
  }
};

/**
 * Manually trigger SLA violation check and alert
 * POST /api/sla/check-violations/:issueId
 */
exports.checkSLAViolations = async (req, res) => {
  try {
    const { issueId } = req.params;
    const io = require('../socket').getIO();

    const result = await checkAndAlertSLAViolations(issueId, io);

    if (result) {
      return res.status(200).json({
        message: 'SLA violation alert sent',
        issue: result
      });
    }

    res.status(200).json({
      message: 'No SLA violations detected or alert already sent'
    });
  } catch (error) {
    console.error('❌ Error checking SLA violations:', error);
    res.status(500).json({ message: 'Error checking SLA violations' });
  }
};

/**
 * Get issues by compliance status
 * GET /api/sla/status/:status
 */
exports.getIssuesByComplianceStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 20 } = req.query;

    let query = {};

    switch (status.toLowerCase()) {
      case 'response-breach':
        query['sla.responseTimeBreached'] = true;
        break;
      case 'resolution-breach':
        query['sla.resolutionTimeBreached'] = true;
        break;
      case 'at-risk':
        // Issues where remaining time < 25% of target
        query.$expr = {
          $lt: ['$sla.responseTimeRemaining', { $multiply: ['$sla.responseTimeTarget', 0.25] }]
        };
        break;
      default:
        return res.status(400).json({ message: 'Invalid status. Use: response-breach, resolution-breach, or at-risk' });
    }

    const issues = await Issue.find(query)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Issue.countDocuments(query);

    res.status(200).json({
      status,
      count: issues.length,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
      issues
    });
  } catch (error) {
    console.error('❌ Error fetching issues by compliance:', error);
    res.status(500).json({ message: 'Error fetching issues' });
  }
};

/**
 * Get SLA report for a date range
 * GET /api/sla/report?startDate=2024-01-01&endDate=2024-12-31
 */
exports.getSLAReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const issues = await Issue.find(query);

    const report = {
      period: {
        start: startDate || 'All time',
        end: endDate || 'Present'
      },
      summary: {
        totalIssues: issues.length,
        responseCompliance: {
          met: issues.filter(i => i.sla.responseStatus === 'met').length,
          breached: issues.filter(i => i.sla.responseStatus === 'breached').length,
          pending: issues.filter(i => i.sla.responseStatus === 'pending').length,
          rate: 0
        },
        resolutionCompliance: {
          met: issues.filter(i => i.sla.resolutionStatus === 'met').length,
          breached: issues.filter(i => i.sla.resolutionStatus === 'breached').length,
          pending: issues.filter(i => i.sla.resolutionStatus === 'pending').length,
          rate: 0
        }
      },
      byPriority: {}
    };

    // Calculate compliance rates
    if (issues.length > 0) {
      const responseMet = report.summary.responseCompliance.met + report.summary.responseCompliance.pending;
      report.summary.responseCompliance.rate = ((responseMet / issues.length) * 100).toFixed(2);

      const resolutionMet = report.summary.resolutionCompliance.met + report.summary.resolutionCompliance.pending;
      report.summary.resolutionCompliance.rate = ((resolutionMet / issues.length) * 100).toFixed(2);
    }

    // By priority
    ['Critical', 'Urgent', 'Risky', 'Routine'].forEach(priority => {
      const priorityIssues = issues.filter(i => i.priority === priority);
      const breached = priorityIssues.filter(i => i.sla.responseTimeBreached || i.sla.resolutionTimeBreached);
      report.byPriority[priority] = {
        total: priorityIssues.length,
        breached: breached.length,
        complianceRate: priorityIssues.length > 0 
          ? (((priorityIssues.length - breached.length) / priorityIssues.length) * 100).toFixed(2)
          : 0
      };
    });

    res.status(200).json(report);
  } catch (error) {
    console.error('❌ Error generating SLA report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
};

/**
 * Get enhanced SLA metrics (new service)
 * GET /api/sla/enhanced/metrics
 */
exports.getEnhancedSLAMetrics = async (req, res) => {
  try {
    const slaTrackingService = require('../services/slaTracking.service');
    const metrics = await slaTrackingService.getSLAMetrics();

    return res.json({
      message: 'SLA metrics retrieved',
      data: metrics,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error getting enhanced SLA metrics:', error);
    res.status(500).json({ error: 'Failed to get SLA metrics' });
  }
};

/**
 * Get issues at risk of SLA breach
 * GET /api/sla/at-risk
 */
exports.getIssuesAtRisk = async (req, res) => {
  try {
    const slaTrackingService = require('../services/slaTracking.service');
    const result = await slaTrackingService.getIssuesAtRisk();

    return res.json({
      message: 'At-risk issues retrieved',
      data: result,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error getting at-risk issues:', error);
    res.status(500).json({ error: 'Failed to get at-risk issues' });
  }
};

/**
 * Check all issues for SLA breaches and send alerts
 * POST /api/sla/check-all-breaches
 * Admin only
 */
exports.checkAllSLABreach = async (req, res) => {
  try {
    const slaTrackingService = require('../services/slaTracking.service');
    const notificationService = require('../services/notification.service');

    const result = await slaTrackingService.checkAllIssuesForSLABreach();

    // Send notifications for breached issues
    for (const issue of result.breachedIssues) {
      await notificationService.notifySLABreached(issue);
    }

    // Send alerts for at-risk issues
    for (const atRiskItem of result.atRiskIssues) {
      await notificationService.notifySLAAtRisk(atRiskItem.issue, atRiskItem.percentageUsed);
    }

    return res.json({
      message: 'SLA check completed',
      data: {
        breachedCount: result.breachedCount,
        atRiskCount: result.atRiskCount,
        notificationsSent: result.breachedCount + result.atRiskCount
      }
    });
  } catch (error) {
    console.error('Error checking all SLA breaches:', error);
    res.status(500).json({ error: 'Failed to check SLA breaches' });
  }
};

module.exports = exports;

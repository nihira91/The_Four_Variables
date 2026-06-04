/**
 * SLA Tracking Service
 * Monitors issues for SLA breaches
 * Sends alerts to admins when SLA at risk
 */

const Issue = require('../models/issue.model');
const Notification = require('../models/notifications.model');
const { SLA_CONFIG } = require('../config/sla.config');

/**
 * Check and update SLA status for an issue
 */
exports.checkAndUpdateSLAStatus = async (issue) => {
  try {
    if (!issue) return null;

    const createdTime = issue.createdAt;
    const now = new Date();
    const elapsedMinutes = (now - createdTime) / 60000;

    const slaConfig = SLA_CONFIG[issue.priority] || SLA_CONFIG['Routine'];

    // Check response time SLA
    if (!issue.sla.firstResponseTime && issue.assignedAt) {
      issue.sla.firstResponseTime = issue.assignedAt;
    }

    if (issue.sla.firstResponseTime) {
      const responseTimeElapsed = (issue.sla.firstResponseTime - createdTime) / 60000;
      issue.sla.responseTimeTarget = slaConfig.responseTimeMinutes;
      issue.sla.responseTimeRemaining = Math.max(0, slaConfig.responseTimeMinutes - responseTimeElapsed);

      if (responseTimeElapsed <= slaConfig.responseTimeMinutes) {
        issue.sla.responseStatus = 'met';
        issue.sla.responseTimeBreached = false;
      } else {
        issue.sla.responseStatus = 'breached';
        issue.sla.responseTimeBreached = true;
      }
    } else {
      // Not yet responded
      issue.sla.responseTimeTarget = slaConfig.responseTimeMinutes;
      issue.sla.responseTimeRemaining = Math.max(0, slaConfig.responseTimeMinutes - elapsedMinutes);

      if (elapsedMinutes <= slaConfig.responseTimeMinutes) {
        issue.sla.responseStatus = 'pending';
      } else {
        issue.sla.responseStatus = 'breached';
        issue.sla.responseTimeBreached = true;
      }
    }

    // Check resolution time SLA
    if (issue.status !== 'resolved' && issue.status !== 'closed') {
      issue.sla.resolutionTimeTarget = slaConfig.resolutionTimeMinutes;
      issue.sla.resolutionTimeRemaining = Math.max(0, slaConfig.resolutionTimeMinutes - elapsedMinutes);

      if (elapsedMinutes <= slaConfig.resolutionTimeMinutes) {
        issue.sla.resolutionStatus = 'pending';
      } else {
        issue.sla.resolutionStatus = 'breached';
        issue.sla.resolutionTimeBreached = true;
      }
    } else {
      // Issue is resolved/closed
      if (issue.sla.resolvedTime) {
        const resolutionTimeElapsed = (issue.sla.resolvedTime - createdTime) / 60000;

        if (resolutionTimeElapsed <= slaConfig.resolutionTimeMinutes) {
          issue.sla.resolutionStatus = 'met';
          issue.sla.resolutionTimeBreached = false;
        } else {
          issue.sla.resolutionStatus = 'breached';
          issue.sla.resolutionTimeBreached = true;
        }
      }
    }

    return issue.sla;
  } catch (error) {
    console.error('Error updating SLA status:', error);
    return null;
  }
};

/**
 * Check all open issues for SLA breaches
 * Run this periodically (every 5-10 minutes)
 */
exports.checkAllIssuesForSLABreach = async () => {
  try {
    // Get all non-closed issues
    const openIssues = await Issue.find({
      status: { $nin: ['resolved', 'closed'] }
    }).populate('assignedTechnician', 'name email')
      .populate('createdBy', 'name email');

    const breachedIssues = [];
    const atRiskIssues = [];

    for (const issue of openIssues) {
      // Update SLA status
      await exports.checkAndUpdateSLAStatus(issue);

      // Check if breached
      if (issue.sla.resolutionTimeBreached && !issue.sla.breachAlertSent) {
        breachedIssues.push(issue);
        issue.sla.breachAlertSent = true;
        await issue.save();
      }

      // Check if at risk (80% of time used)
      if (issue.sla.resolutionTimeRemaining && issue.sla.resolutionTimeTarget) {
        const percentageUsed = ((issue.sla.resolutionTimeTarget - issue.sla.resolutionTimeRemaining) / issue.sla.resolutionTimeTarget) * 100;

        if (percentageUsed >= 80 && percentageUsed < 100) {
          atRiskIssues.push({
            issue: issue,
            percentageUsed: percentageUsed
          });
        }
      }
    }

    return {
      breachedCount: breachedIssues.length,
      atRiskCount: atRiskIssues.length,
      breachedIssues: breachedIssues,
      atRiskIssues: atRiskIssues
    };
  } catch (error) {
    console.error('Error checking SLA breaches:', error);
    return null;
  }
};

/**
 * Get SLA metrics for dashboard
 */
exports.getSLAMetrics = async () => {
  try {
    const allIssues = await Issue.find({});

    let totalIssues = allIssues.length;
    let metCount = 0;
    let breachedCount = 0;
    let pendingCount = 0;

    const byPriority = {
      Critical: { met: 0, breached: 0, pending: 0 },
      Urgent: { met: 0, breached: 0, pending: 0 },
      Risky: { met: 0, breached: 0, pending: 0 },
      Routine: { met: 0, breached: 0, pending: 0 }
    };

    for (const issue of allIssues) {
      await exports.checkAndUpdateSLAStatus(issue);

      if (issue.sla.resolutionStatus === 'met') {
        metCount++;
        byPriority[issue.priority].met++;
      } else if (issue.sla.resolutionStatus === 'breached') {
        breachedCount++;
        byPriority[issue.priority].breached++;
      } else {
        pendingCount++;
        byPriority[issue.priority].pending++;
      }
    }

    const breachPercentage = totalIssues > 0 ? ((breachedCount / totalIssues) * 100).toFixed(2) : 0;
    const metPercentage = totalIssues > 0 ? ((metCount / totalIssues) * 100).toFixed(2) : 0;

    return {
      summary: {
        totalIssues,
        met: metCount,
        breached: breachedCount,
        pending: pendingCount,
        breachPercentage: parseFloat(breachPercentage),
        metPercentage: parseFloat(metPercentage)
      },
      byPriority,
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('Error getting SLA metrics:', error);
    return null;
  }
};

/**
 * Get issues at risk of SLA breach
 */
exports.getIssuesAtRisk = async () => {
  try {
    const openIssues = await Issue.find({
      status: { $nin: ['resolved', 'closed'] }
    })
      .populate('assignedTechnician', 'name email')
      .populate('createdBy', 'name email')
      .sort('-deadline');

    const atRisk = [];

    for (const issue of openIssues) {
      await exports.checkAndUpdateSLAStatus(issue);

      // At risk if more than 70% time used
      if (issue.sla.resolutionTimeTarget && issue.sla.resolutionTimeRemaining !== null) {
        const percentageUsed = ((issue.sla.resolutionTimeTarget - issue.sla.resolutionTimeRemaining) / issue.sla.resolutionTimeTarget) * 100;

        if (percentageUsed >= 70) {
          atRisk.push({
            id: issue._id,
            title: issue.title,
            priority: issue.priority,
            status: issue.status,
            progress: issue.progress,
            assignedTechnician: issue.assignedTechnician,
            createdBy: issue.createdBy,
            deadline: issue.deadline,
            percentageUsed: parseFloat(percentageUsed.toFixed(2)),
            resolutionStatus: issue.sla.resolutionStatus,
            timeRemaining: issue.sla.resolutionTimeRemaining,
            createdAt: issue.createdAt
          });
        }
      }
    }

    return {
      atRiskCount: atRisk.length,
      issues: atRisk.sort((a, b) => b.percentageUsed - a.percentageUsed)
    };
  } catch (error) {
    console.error('Error getting at-risk issues:', error);
    return null;
  }
};

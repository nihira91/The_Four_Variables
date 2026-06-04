/**
 * Assignment Controller
 * Handles manual assignments, deallocations, and assignment history
 */

const autoAssignmentService = require('../services/autoAssignment.service');
const Issue = require('../models/issue.model');
const User = require('../models/user.model');
const Assignment = require('../models/assignment.model');

/**
 * Auto-assign an open issue
 * Admin endpoint
 */
exports.autoAssignIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const adminId = req.user._id;

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (issue.status !== 'open') {
      return res.status(400).json({
        error: `Issue status is '${issue.status}', cannot assign non-open issues`
      });
    }

    const result = await autoAssignmentService.autoAssignIssue(issue, adminId);

    if (!result.success) {
      return res.status(400).json({
        error: result.message,
        details: result.error || null
      });
    }

    return res.json({
      message: result.message,
      data: result
    });

  } catch (error) {
    console.error('Error auto-assigning issue:', error);
    res.status(500).json({ error: 'Failed to auto-assign issue' });
  }
};

/**
 * Manually assign issue to technician
 * Admin endpoint
 */
exports.manualAssignIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { technicianId, reason } = req.body;
    const adminId = req.user._id;

    // Validate input
    if (!technicianId) {
      return res.status(400).json({ error: 'Technician ID is required' });
    }

    // Validate issue exists
    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Validate technician exists
    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== 'technician') {
      return res.status(404).json({ error: 'Technician not found' });
    }

    const result = await autoAssignmentService.manualAssignIssue(
      issueId,
      technicianId,
      adminId,
      reason
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.message,
        details: result.error || null
      });
    }

    return res.json({
      message: result.message,
      data: result
    });

  } catch (error) {
    console.error('Error manually assigning issue:', error);
    res.status(500).json({ error: 'Failed to manually assign issue' });
  }
};

/**
 * Deallocate technician from issue
 * Admin endpoint
 */
exports.deallocateIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    const result = await autoAssignmentService.deallocateIssue(
      issueId,
      adminId,
      reason
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.message,
        details: result.error || null
      });
    }

    return res.json({
      message: result.message,
      data: result
    });

  } catch (error) {
    console.error('Error deallocating issue:', error);
    res.status(500).json({ error: 'Failed to deallocate issue' });
  }
};

/**
 * Bulk auto-assign multiple issues
 * Admin endpoint
 */
exports.bulkAutoAssign = async (req, res) => {
  try {
    const { issueIds } = req.body;
    const adminId = req.user._id;

    if (!Array.isArray(issueIds) || issueIds.length === 0) {
      return res.status(400).json({ error: 'Issue IDs array is required and must not be empty' });
    }

    const results = await autoAssignmentService.autoAssignMultipleIssues(
      issueIds,
      adminId
    );

    return res.json({
      message: 'Bulk auto-assignment completed',
      data: results
    });

  } catch (error) {
    console.error('Error in bulk auto-assign:', error);
    res.status(500).json({ error: 'Failed to perform bulk auto-assignment' });
  }
};

/**
 * Reassign issue (when SLA at risk)
 * Admin endpoint - can reassign to different technician
 */
exports.reassignIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { newTechnicianId, reason } = req.body;
    const adminId = req.user._id;

    if (!newTechnicianId) {
      return res.status(400).json({ error: 'New technician ID is required' });
    }

    // Deallocate from current technician
    const deallocResult = await autoAssignmentService.deallocateIssue(
      issueId,
      adminId,
      `Reassignment - ${reason || 'SLA at risk'}`
    );

    if (!deallocResult.success) {
      return res.status(400).json({
        error: 'Failed to deallocate from current technician',
        details: deallocResult.message
      });
    }

    // Assign to new technician
    const assignResult = await autoAssignmentService.manualAssignIssue(
      issueId,
      newTechnicianId,
      adminId,
      reason || 'Reassigned for better handling'
    );

    if (!assignResult.success) {
      return res.status(400).json({
        error: 'Failed to assign to new technician',
        details: assignResult.message
      });
    }

    return res.json({
      message: 'Issue reassigned successfully',
      data: assignResult
    });

  } catch (error) {
    console.error('Error reassigning issue:', error);
    res.status(500).json({ error: 'Failed to reassign issue' });
  }
};

/**
 * Get assignment history for an issue
 */
exports.getAssignmentHistory = async (req, res) => {
  try {
    const { issueId } = req.params;

    const assignments = await Assignment.find({ issue: issueId })
      .populate('technician', 'name email contactNo')
      .populate('assignedBy', 'name email')
      .sort('-createdAt');

    return res.json({
      issueId,
      total: assignments.length,
      data: assignments
    });

  } catch (error) {
    console.error('Error fetching assignment history:', error);
    res.status(500).json({ error: 'Failed to fetch assignment history' });
  }
};

/**
 * Get all assignments for a technician
 */
exports.getTechnicianAssignments = async (req, res) => {
  try {
    const { technicianId } = req.params;

    // Check if technician exists
    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== 'technician') {
      return res.status(404).json({ error: 'Technician not found' });
    }

    // Get active assignments
    const activeAssignments = await Assignment.find({
      technician: technicianId,
      isActive: true
    })
      .populate('issue', 'title priority status deadline progress')
      .sort('-assignedAt');

    return res.json({
      technicianId,
      total: activeAssignments.length,
      data: activeAssignments
    });

  } catch (error) {
    console.error('Error fetching technician assignments:', error);
    res.status(500).json({ error: 'Failed to fetch technician assignments' });
  }
};

/**
 * Get workload summary for all technicians
 */
exports.getTechnicianWorkloadSummary = async (req, res) => {
  try {
    const technicians = await User.find({
      role: 'technician'
    }).select('name email currentWorkload maxCapacity isAvailable professionType');

    const summary = technicians.map((tech) => ({
      id: tech._id,
      name: tech.name,
      email: tech.email,
      currentWorkload: tech.currentWorkload,
      maxCapacity: tech.maxCapacity,
      utilizationPercentage: ((tech.currentWorkload / tech.maxCapacity) * 100).toFixed(2),
      isAvailable: tech.isAvailable,
      availableSlots: tech.maxCapacity - tech.currentWorkload
    }));

    return res.json({
      total: summary.length,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching workload summary:', error);
    res.status(500).json({ error: 'Failed to fetch workload summary' });
  }
};

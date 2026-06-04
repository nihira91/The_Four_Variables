/**
 * Auto Assignment Service
 * Automatically assigns issues to best available technician
 * Based on: Availability, Profession Type, Workload, and Priority
 */

const User = require('../models/user.model');
const Issue = require('../models/issue.model');
const Assignment = require('../models/assignment.model');
const { SLA_CONFIG } = require('../config/sla.config');

/**
 * Calculate assignment score for a technician
 * Higher score = better fit
 * 
 * Score = (Availability * 100) + 
 *         (Inverse Workload Ratio * 50) + 
 *         (Rating * 20)
 */
const calculateTechnicianScore = (technician) => {
  let score = 0;

  // Availability: 100 points if available, 0 if not
  if (technician.isAvailable) {
    score += 100;
  }

  // Workload: Max 50 points (lower workload = higher score)
  const workloadRatio = technician.currentWorkload / technician.maxCapacity;
  const inverseWorkloadScore = (1 - workloadRatio) * 50;
  score += Math.max(0, inverseWorkloadScore);

  // Rating: Max 20 points (higher rating = higher score)
  const ratingScore = (technician.rating / 5) * 20;
  score += ratingScore;

  // Bonus for having relevant skills
  score += 5; // Default bonus, will be increased if skills match

  return score;
};

/**
 * Get available technicians for an issue
 */
const getAvailableTechnicians = async (issue) => {
  try {
    // Find technicians matching the profession type
    const technicians = await User.find({
      professionType: issue.professionType || undefined,
      role: 'technician',
      isAvailable: true,
      currentWorkload: { $lt: '$maxCapacity' } // Not at capacity
    }).populate('professionType', 'name skills');

    if (technicians.length === 0) {
      return null;
    }

    return technicians;
  } catch (error) {
    console.error('Error getting available technicians:', error);
    return null;
  }
};

/**
 * Find best technician for an issue
 */
const findBestTechnician = async (issue) => {
  try {
    // Get available technicians
    const technicians = await getAvailableTechnicians(issue);

    if (!technicians || technicians.length === 0) {
      console.log('❌ No available technicians for this issue');
      return null;
    }

    // Score all technicians
    const scoredTechnicians = technicians.map((tech) => ({
      technician: tech,
      score: calculateTechnicianScore(tech)
    }));

    // Sort by score (highest first)
    scoredTechnicians.sort((a, b) => b.score - a.score);

    console.log(`📊 Top 3 candidates for issue ${issue._id}:`);
    scoredTechnicians.slice(0, 3).forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.technician.name} (Score: ${item.score.toFixed(2)})`);
    });

    // Return the best tech
    return scoredTechnicians[0].technician;
  } catch (error) {
    console.error('Error finding best technician:', error);
    return null;
  }
};

/**
 * Calculate deadline based on SLA config
 */
const calculateDeadline = (priority) => {
  const slaConfig = SLA_CONFIG[priority] || SLA_CONFIG['Routine'];
  const resolutionMinutes = slaConfig.resolutionTimeMinutes;
  
  const deadline = new Date();
  deadline.setMinutes(deadline.getMinutes() + resolutionMinutes);
  
  return deadline;
};

/**
 * Auto-assign an issue to best technician
 */
exports.autoAssignIssue = async (issue, assignedBy = null) => {
  const session = await Issue.startSession();
  session.startTransaction();

  try {
    // Find best technician
    const technician = await findBestTechnician(issue);

    if (!technician) {
      console.log(`⚠️ Could not auto-assign issue ${issue._id} - no available technicians`);
      await session.abortTransaction();
      return {
        success: false,
        message: 'No available technicians for this issue',
        assignedTechnician: null
      };
    }

    // Calculate deadline
    const deadline = calculateDeadline(issue.priority);
    const slaConfig = SLA_CONFIG[issue.priority] || SLA_CONFIG['Routine'];

    // Update issue with deadline and SLA initialization
    issue.assignedTechnician = technician._id;
    issue.assignedAt = new Date();
    issue.deadline = deadline;
    issue.status = 'assigned';
    
    // Initialize SLA fields
    if (!issue.sla) {
      issue.sla = {
        responseTimeTarget: slaConfig.responseTimeMinutes,
        resolutionTimeTarget: slaConfig.resolutionTimeMinutes,
        firstResponseTime: null,
        resolvedTime: null,
        responseStatus: 'pending',
        resolutionStatus: 'pending',
        responseTimeBreached: false,
        resolutionTimeBreached: false,
        responseTimeRemaining: slaConfig.responseTimeMinutes,
        resolutionTimeRemaining: slaConfig.resolutionTimeMinutes,
        breachAlertSent: false
      };
    }
    
    // Add to timeline
    issue.timeline.push({
      status: 'assigned',
      timestamp: new Date(),
      note: `Auto-assigned to ${technician.name}`
    });

    await issue.save({ session });

    // Create assignment record
    const assignment = new Assignment({
      issue: issue._id,
      technician: technician._id,
      assignedBy: assignedBy || technician._id,
      assignmentType: 'automatic',
      reason: 'Auto-assigned based on availability and workload',
      assignedAt: new Date(),
      isActive: true
    });

    await assignment.save({ session });

    // Update technician workload
    await User.findByIdAndUpdate(
      technician._id,
      { $inc: { currentWorkload: 1 } },
      { session }
    );

    await session.commitTransaction();

    console.log(`✅ Issue ${issue._id} auto-assigned to ${technician.name}`);
    console.log(`📅 Deadline: ${deadline.toISOString()}`);

    return {
      success: true,
      message: 'Issue auto-assigned successfully',
      assignedTechnician: {
        id: technician._id,
        name: technician.name,
        email: technician.email,
        contactNo: technician.contactNo
      },
      deadline: deadline,
      assignmentId: assignment._id
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('Error auto-assigning issue:', error);
    return {
      success: false,
      message: 'Failed to auto-assign issue',
      error: error.message
    };
  } finally {
    session.endSession();
  }
};

/**
 * Manually assign an issue to a specific technician
 * Used by admin
 */
exports.manualAssignIssue = async (issueId, technicianId, adminId, reason = null) => {
  const session = await Issue.startSession();
  session.startTransaction();

  try {
    // Fetch issue
    const issue = await Issue.findById(issueId).session(session);
    if (!issue) {
      await session.abortTransaction();
      return { success: false, message: 'Issue not found' };
    }

    // Fetch technician
    const technician = await User.findById(technicianId).session(session);
    if (!technician || technician.role !== 'technician') {
      await session.abortTransaction();
      return { success: false, message: 'Invalid technician' };
    }

    // Check if technician is at capacity
    if (technician.currentWorkload >= technician.maxCapacity) {
      await session.abortTransaction();
      return {
        success: false,
        message: `Technician is at max capacity (${technician.maxCapacity} issues)`
      };
    }

    // If already assigned, deallocate previous
    if (issue.assignedTechnician) {
      const previousAssignment = await Assignment.findOneAndUpdate(
        { issue: issueId, isActive: true },
        { isActive: false, deallocatedAt: new Date() },
        { session }
      );

      // Reduce previous technician's workload
      await User.findByIdAndUpdate(
        issue.assignedTechnician,
        { $inc: { currentWorkload: -1 } },
        { session }
      );
    }

    // Calculate deadline
    const deadline = calculateDeadline(issue.priority);
    const slaConfig = SLA_CONFIG[issue.priority] || SLA_CONFIG['Routine'];

    // Update issue with deadline and SLA initialization
    issue.assignedTechnician = technician._id;
    issue.assignedAt = new Date();
    issue.deadline = deadline;
    issue.status = 'assigned';
    
    // Initialize SLA fields if not present
    if (!issue.sla || !issue.sla.responseTimeTarget) {
      issue.sla = {
        responseTimeTarget: slaConfig.responseTimeMinutes,
        resolutionTimeTarget: slaConfig.resolutionTimeMinutes,
        firstResponseTime: null,
        resolvedTime: null,
        responseStatus: 'pending',
        resolutionStatus: 'pending',
        responseTimeBreached: false,
        resolutionTimeBreached: false,
        responseTimeRemaining: slaConfig.responseTimeMinutes,
        resolutionTimeRemaining: slaConfig.resolutionTimeMinutes,
        breachAlertSent: false
      };
    }
    
    issue.timeline.push({
      status: 'assigned',
      timestamp: new Date(),
      note: `Manually assigned to ${technician.name} by admin`
    });

    await issue.save({ session });

    // Create new assignment
    const assignment = new Assignment({
      issue: issueId,
      technician: technicianId,
      assignedBy: adminId,
      assignmentType: 'manual',
      reason: reason,
      assignedAt: new Date(),
      isActive: true
    });

    await assignment.save({ session });

    // Update technician workload
    await User.findByIdAndUpdate(
      technicianId,
      { $inc: { currentWorkload: 1 } },
      { session }
    );

    await session.commitTransaction();

    console.log(`✅ Issue ${issueId} manually assigned to ${technician.name}`);

    return {
      success: true,
      message: 'Issue manually assigned successfully',
      assignedTechnician: {
        id: technician._id,
        name: technician.name,
        email: technician.email
      },
      deadline: deadline,
      assignmentId: assignment._id
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('Error manually assigning issue:', error);
    return {
      success: false,
      message: 'Failed to manually assign issue',
      error: error.message
    };
  } finally {
    session.endSession();
  }
};

/**
 * Deallocate technician from an issue
 * Used by admin
 */
exports.deallocateIssue = async (issueId, adminId, reason = null) => {
  const session = await Issue.startSession();
  session.startTransaction();

  try {
    const issue = await Issue.findById(issueId).session(session);
    if (!issue || !issue.assignedTechnician) {
      await session.abortTransaction();
      return { success: false, message: 'Issue not found or not assigned' };
    }

    const previousTechnicianId = issue.assignedTechnician;

    // Deactivate assignment
    await Assignment.findOneAndUpdate(
      { issue: issueId, isActive: true },
      { isActive: false, deallocatedAt: new Date() },
      { session }
    );

    // Update issue
    issue.assignedTechnician = null;
    issue.assignedAt = null;
    issue.deadline = null;
    issue.status = 'open';

    issue.timeline.push({
      status: 'open',
      timestamp: new Date(),
      note: `Deallocated by admin. Reason: ${reason || 'N/A'}`
    });

    await issue.save({ session });

    // Reduce technician's workload
    await User.findByIdAndUpdate(
      previousTechnicianId,
      { $inc: { currentWorkload: -1 } },
      { session }
    );

    await session.commitTransaction();

    console.log(`✅ Issue ${issueId} deallocated from technician`);

    return {
      success: true,
      message: 'Issue deallocated successfully'
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('Error deallocating issue:', error);
    return {
      success: false,
      message: 'Failed to deallocate issue',
      error: error.message
    };
  } finally {
    session.endSession();
  }
};

/**
 * Auto-assign multiple issues (bulk operation)
 */
exports.autoAssignMultipleIssues = async (issueIds, adminId) => {
  const results = {
    total: issueIds.length,
    assigned: 0,
    failed: 0,
    details: []
  };

  for (const issueId of issueIds) {
    try {
      const issue = await Issue.findById(issueId);
      if (!issue || issue.status !== 'open') {
        results.failed++;
        results.details.push({
          issueId,
          status: 'failed',
          message: 'Issue not found or already assigned'
        });
        continue;
      }

      const result = await exports.autoAssignIssue(issue, adminId);
      
      if (result.success) {
        results.assigned++;
        results.details.push({
          issueId,
          status: 'assigned',
          technician: result.assignedTechnician
        });
      } else {
        results.failed++;
        results.details.push({
          issueId,
          status: 'failed',
          message: result.message
        });
      }
    } catch (error) {
      results.failed++;
      results.details.push({
        issueId,
        status: 'error',
        message: error.message
      });
    }
  }

  return results;
};

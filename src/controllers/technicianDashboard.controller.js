/**
 * Technician Dashboard Controller
 * Shows assigned issues, allows progress updates
 */

const Issue = require('../models/issue.model');
const User = require('../models/user.model');
const Assignment = require('../models/assignment.model');

/**
 * Get all assigned issues for a technician
 */
exports.getTechnicianAssignedIssues = async (req, res) => {
  try {
    const technicianId = req.user.id || req.user._id;
    const { status } = req.query;

    let query = { assignedTechnician: technicianId };

    if (status) {
      query.status = status;
    }

    const issues = await Issue.find(query)
      .populate('createdBy', 'name email contactNo department')
      .sort('-assignedAt');

    // Enhance with time calculations
    const enhancedIssues = issues.map((issue) => {
      let timeRemaining = null;
      let isOverdue = false;
      let percentComplete = 0;

      if (issue.deadline) {
        const now = new Date();
        const timeDiff = issue.deadline - now;
        timeRemaining = timeDiff > 0 ? Math.ceil(timeDiff / 60000) : null; // in minutes
        isOverdue = timeDiff < 0 && issue.status !== 'resolved' && issue.status !== 'closed';
        percentComplete = issue.progress || 0;
      }

      return {
        id: issue._id,
        title: issue.title,
        description: issue.description,
        issueType: issue.issueType,
        priority: issue.priority,
        location: issue.location,
        status: issue.status,
        progress: issue.progress,
        createdBy: issue.createdBy,
        assignedAt: issue.assignedAt,
        deadline: issue.deadline,
        timeRemaining: timeRemaining,
        isOverdue: isOverdue
      };
    });

    // Summary stats
    const stats = {
      total: enhancedIssues.length,
      open: enhancedIssues.filter(i => i.status === 'open').length,
      assigned: enhancedIssues.filter(i => i.status === 'assigned').length,
      inProgress: enhancedIssues.filter(i => i.status === 'in-progress').length,
      onHold: enhancedIssues.filter(i => i.status === 'on-hold').length,
      resolved: enhancedIssues.filter(i => i.status === 'resolved').length,
      closed: enhancedIssues.filter(i => i.status === 'closed').length,
      overdue: enhancedIssues.filter(i => i.isOverdue).length
    };

    return res.json({
      stats,
      data: enhancedIssues
    });

  } catch (error) {
    console.error('Error fetching technician assigned issues:', error);
    res.status(500).json({ error: 'Failed to fetch assigned issues' });
  }
};

/**
 * Get single issue details for technician
 */
exports.getTechnicianIssueDetails = async (req, res) => {
  try {
    const { issueId } = req.params;
    const technicianId = req.user.id || req.user._id;

    const issue = await Issue.findById(issueId)
      .populate('createdBy', 'name email contactNo department floor')
      .populate('assignedTechnician', 'name email contactNo');

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Verify authorization - assigned technician or admin
    if (issue.assignedTechnician._id.toString() !== technicianId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to view this issue' });
    }

    // Calculate time remaining
    let timeRemaining = null;
    let isOverdue = false;
    
    if (issue.deadline) {
      const now = new Date();
      const timeDiff = issue.deadline - now;
      timeRemaining = timeDiff > 0 ? Math.ceil(timeDiff / 60000) : null;
      isOverdue = timeDiff < 0 && issue.status !== 'resolved' && issue.status !== 'closed';
    }

    const response = {
      issue: {
        id: issue._id,
        title: issue.title,
        description: issue.description,
        issueType: issue.issueType,
        priority: issue.priority,
        location: issue.location,
        status: issue.status,
        progress: issue.progress,
        images: issue.images,
        
        // Customer info
        createdBy: issue.createdBy,
        
        // Assignment details
        assignedAt: issue.assignedAt,
        deadline: issue.deadline,
        timeRemaining: timeRemaining, // in minutes
        isOverdue: isOverdue,
        
        // Progress
        progress: issue.progress,
        progressUpdates: issue.progressUpdates || [],
        completedAt: issue.completedAt,
        completionNotes: issue.completionNotes,
        
        // SLA Info
        sla: {
          responseStatus: issue.sla?.responseStatus,
          resolutionStatus: issue.sla?.resolutionStatus,
          responseTimeRemaining: issue.sla?.responseTimeRemaining,
          resolutionTimeRemaining: issue.sla?.resolutionTimeRemaining,
          responseTimeBreached: issue.sla?.responseTimeBreached,
          resolutionTimeBreached: issue.sla?.resolutionTimeBreached
        },
        
        // Timeline & history
        timeline: issue.timeline,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt
      }
    };

    return res.json(response);

  } catch (error) {
    console.error('Error fetching issue details:', error);
    res.status(500).json({ error: 'Failed to fetch issue details' });
  }
};

/**
 * Update progress on an issue
 * Technician updates work progress
 */
exports.updateIssueProgress = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { progress, message } = req.body;
    const technicianId = req.user.id || req.user._id;

    console.log(`[PROGRESS UPDATE] Technician ${technicianId} updating issue ${issueId} to ${progress}%`);

    // Validate progress
    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ error: 'Progress must be between 0 and 100' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Progress message is required' });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      console.log(`[PROGRESS UPDATE] Issue ${issueId} not found`);
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Verify authorization
    if (!issue.assignedTechnician) {
      console.log(`[PROGRESS UPDATE] Issue ${issueId} has no assigned technician`);
      return res.status(403).json({ error: 'Issue is not assigned to anyone' });
    }

    const assignedId = issue.assignedTechnician.toString();
    const currentId = technicianId.toString();
    
    if (assignedId !== currentId) {
      console.log(`[PROGRESS UPDATE] Authorization failed: assigned=${assignedId}, current=${currentId}`);
      return res.status(403).json({ error: 'Can only update your own assigned issues' });
    }
    
    console.log(`[PROGRESS UPDATE] Authorization passed. Proceeding with update.`);

    // Update progress using safe method (avoids full validation)
    const updateOps = {
      $set: {
        progress: progress
      },
      $push: {
        progressUpdates: {
          technician: technicianId,
          message: message.trim(),
          timestamp: new Date(),
          type: 'progress'
        }
      }
    };

    // Also transition status if needed
    if (progress > 0 && issue.status === 'assigned') {
      updateOps.$set.status = 'in-progress';
      updateOps.$push.timeline = {
        status: 'in-progress',
        timestamp: new Date(),
        note: 'Technician started work'
      };
    }

    const updatedIssue = await Issue.findByIdAndUpdate(
      issueId,
      updateOps,
      { new: true, runValidators: false }
    );
    
    console.log(`[PROGRESS UPDATE] Issue ${issueId} saved successfully with progress ${progress}%`);

    return res.json({
      message: 'Progress updated successfully',
      data: {
        issueId: updatedIssue._id,
        progress: updatedIssue.progress,
        status: updatedIssue.status,
        progressUpdates: updatedIssue.progressUpdates
      }
    });

  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress', details: error.message });
  }
};

/**
 * Add note/comment from technician
 */
exports.addTechnicianNote = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { message } = req.body;
    const technicianId = req.user.id || req.user._id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Verify authorization
    if (issue.assignedTechnician.toString() !== technicianId.toString()) {
      return res.status(403).json({ error: 'Can only add notes to your assigned issues' });
    }

    // Add note using safe update method
    const updatedIssue = await Issue.findByIdAndUpdate(
      issueId,
      {
        $push: {
          progressUpdates: {
            technician: technicianId,
            message: message.trim(),
            timestamp: new Date(),
            type: 'note'
          }
        }
      },
      { new: true, runValidators: false }
    );

    return res.json({
      message: 'Note added successfully',
      data: {
        note: updatedIssue.progressUpdates[updatedIssue.progressUpdates.length - 1]
      }
    });

  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
};

/**
 * Mark issue as complete
 */
exports.completeIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { completionNotes } = req.body;
    const technicianId = req.user.id || req.user._id;

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Verify authorization
    if (issue.assignedTechnician.toString() !== technicianId.toString()) {
      return res.status(403).json({ error: 'Can only complete your assigned issues' });
    }

    // Calculate SLA metrics for update
    const now = new Date();
    const createdTime = issue.createdAt;
    const resolutionTime = (now - createdTime) / 60000; // in minutes
    const targetTime = issue.sla?.resolutionTimeTarget || 480;
    
    const slaUpdate = issue.sla ? {
      'sla.resolvedTime': now,
      'sla.resolutionStatus': resolutionTime <= targetTime ? 'met' : 'breached',
      'sla.resolutionTimeBreached': resolutionTime > targetTime
    } : {};

    // Use safe update method
    const updatedIssue = await Issue.findByIdAndUpdate(
      issueId,
      {
        $set: {
          status: 'resolved',
          progress: 100,
          completedAt: now,
          completionNotes: completionNotes || '',
          ...slaUpdate
        },
        $push: {
          timeline: {
            status: 'resolved',
            timestamp: now,
            note: `Completed by technician. ${completionNotes ? `Notes: ${completionNotes}` : ''}`
          },
          progressUpdates: {
            technician: technicianId,
            message: `Issue completed. ${completionNotes || 'No additional notes'}`,
            timestamp: now,
            type: 'status-change'
          }
        }
      },
      { new: true, runValidators: false }
    );

    return res.json({
      message: 'Issue marked as complete',
      data: {
        issueId: updatedIssue._id,
        status: updatedIssue.status,
        completedAt: updatedIssue.completedAt,
        sla: updatedIssue.sla
      }
    });

  } catch (error) {
    console.error('Error completing issue:', error);
    res.status(500).json({ error: 'Failed to complete issue' });
  }
};

/**
 * Get technician dashboard summary
 */
exports.getTechnicianDashboardSummary = async (req, res) => {
  try {
    const technicianId = req.user.id || req.user._id;

    // Get all assigned issues
    const allIssues = await Issue.find({ assignedTechnician: technicianId })
      .select('status priority deadline progress createdAt');

    // Group by status
    const byStatus = {
      open: 0,
      assigned: 0,
      inProgress: 0,
      onHold: 0,
      resolved: 0,
      closed: 0
    };

    // Group by priority
    const byPriority = {
      Critical: 0,
      Urgent: 0,
      Risky: 0,
      Routine: 0
    };

    let overdue = 0;
    let avgProgress = 0;
    let completedToday = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    allIssues.forEach((issue) => {
      byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
      byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;

      // Check if overdue
      if (issue.deadline) {
        const now = new Date();
        if (issue.deadline < now && issue.status !== 'resolved' && issue.status !== 'closed') {
          overdue++;
        }
      }

      // Count completed today
      if (issue.status === 'resolved' || issue.status === 'closed') {
        const completedDate = new Date(issue.updatedAt);
        completedDate.setHours(0, 0, 0, 0);
        if (completedDate.getTime() === today.getTime()) {
          completedToday++;
        }
      }

      avgProgress += issue.progress || 0;
    });

    avgProgress = allIssues.length > 0 ? (avgProgress / allIssues.length).toFixed(2) : 0;

    // Get technician info
    const technician = await User.findById(technicianId).select('name email currentWorkload maxCapacity rating');

    if (!technician) {
      return res.status(404).json({ error: 'Technician user record not found' });
    }

    return res.json({
      technician: {
        name: technician.name,
        email: technician.email,
        currentWorkload: technician.currentWorkload || 0,
        maxCapacity: technician.maxCapacity || 10,
        utilizationPercentage: technician.maxCapacity > 0 ? ((technician.currentWorkload || 0) / technician.maxCapacity * 100).toFixed(2) : 0,
        rating: technician.rating || 0
      },
      totalIssues: allIssues.length,
      byStatus,
      byPriority,
      avgProgress: parseFloat(avgProgress),
      overdueCount: overdue,
      completedToday: completedToday,
      lastUpdated: new Date()
    });

  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};

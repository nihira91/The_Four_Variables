
const Issue = require("../models/issue.model");
const User = require('../models/user.model');
const Assignment = require('../models/assignment.model');
const { success } = require("../utils/response");
//const { APIError } = require("../utils/errorHandler");

exports.getEmployeeDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const total = await Issue.countDocuments({ createdBy: userId });
    const open = await Issue.countDocuments({ createdBy: userId, status: "open" });
    const inProgress = await Issue.countDocuments({ createdBy: userId, status: "in-progress" });
    const resolved = await Issue.countDocuments({ createdBy: userId, status: "resolved" });

    return success(res, "Dashboard stats loaded", {
      total,
      open,
      inProgress,
      resolved
    });
  } catch (err) {
    next(new APIError("Failed to load dashboard", 500));
  }
};

/**
 * Get single issue with full details (for employee)
 */
exports.getIssueDetails = async (req, res) => {
  try {
    const { issueId } = req.params;
    const userId = req.user._id;

    const issue = await Issue.findById(issueId)
      .populate('createdBy', 'name email contactNo department')
      .populate('assignedTechnician', 'name email contactNo skills rating');

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Check authorization - only creator or assigned tech can view
    const isCreator = issue.createdBy._id.toString() === userId.toString();
    const isAssignedTech = issue.assignedTechnician && issue.assignedTechnician._id.toString() === userId.toString();

    if (!isCreator && !isAssignedTech && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to view this issue' });
    }

    // Calculate time remaining
    let timeRemaining = null;
    let isOverdue = false;
    
    if (issue.deadline) {
      const now = new Date();
      const timeDiff = issue.deadline - now;
      timeRemaining = timeDiff > 0 ? Math.ceil(timeDiff / 60000) : null; // in minutes
      isOverdue = timeDiff < 0 && issue.status !== 'resolved' && issue.status !== 'closed';
    }

    // Get assignment history
    const assignments = await Assignment.find({ issue: issueId })
      .populate('technician', 'name email')
      .populate('assignedBy', 'name')
      .sort('-assignedAt')
      .limit(5);

    // Format response
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
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        
        // Important fields for user
        createdBy: issue.createdBy,
        assignedTechnician: issue.assignedTechnician || null,
        assignedAt: issue.assignedAt,
        deadline: issue.deadline,
        
        // Time tracking
        timeRemaining: timeRemaining, // in minutes
        isOverdue: isOverdue,
        
        // Progress and completion
        progress: issue.progress,
        progressUpdates: issue.progressUpdates || [],
        completedAt: issue.completedAt,
        completionNotes: issue.completionNotes,
        
        // SLA status
        sla: {
          responseStatus: issue.sla?.responseStatus,
          resolutionStatus: issue.sla?.resolutionStatus,
          responseTimeRemaining: issue.sla?.responseTimeRemaining,
          resolutionTimeRemaining: issue.sla?.resolutionTimeRemaining,
          responseTimeBreached: issue.sla?.responseTimeBreached,
          resolutionTimeBreached: issue.sla?.resolutionTimeBreached
        },
        
        // Timeline
        timeline: issue.timeline,
        
        // Assignment history
        assignmentHistory: assignments
      }
    };

    return res.json(response);

  } catch (error) {
    console.error('Error fetching issue details:', error);
    res.status(500).json({ error: 'Failed to fetch issue details' });
  }
};

/**
 * Get all issues for an employee with enhanced status
 */
exports.getEmployeeIssuesEnhanced = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, priority, sortBy } = req.query;

    let query = { createdBy: userId };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by priority
    if (priority) {
      query.priority = priority;
    }

    const issues = await Issue.find(query)
      .populate('assignedTechnician', 'name email contactNo rating')
      .sort(sortBy === 'deadline' ? { deadline: 1 } : '-createdAt');

    // Enhance with time remaining
    const enhancedIssues = issues.map((issue) => {
      let timeRemaining = null;
      let isOverdue = false;

      if (issue.deadline) {
        const now = new Date();
        const timeDiff = issue.deadline - now;
        timeRemaining = timeDiff > 0 ? Math.ceil(timeDiff / 60000) : null;
        isOverdue = timeDiff < 0 && issue.status !== 'resolved' && issue.status !== 'closed';
      }

      return {
        id: issue._id,
        title: issue.title,
        issueType: issue.issueType,
        priority: issue.priority,
        status: issue.status,
        progress: issue.progress,
        assignedTechnician: issue.assignedTechnician,
        deadline: issue.deadline,
        timeRemaining: timeRemaining,
        isOverdue: isOverdue,
        createdAt: issue.createdAt
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
    console.error('Error fetching employee issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
};

/**
 * Rate technician after issue completion
 */
exports.rateTechnician = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { rating, review } = req.body;
    const userId = req.user._id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Only creator can rate
    if (issue.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Only issue creator can rate' });
    }

    // Issue must be completed
    if (issue.status !== 'resolved' && issue.status !== 'closed') {
      return res.status(400).json({ error: 'Can only rate completed issues' });
    }

    // Update rating
    issue.technicianRating = {
      rating: rating,
      review: review || null,
      ratedBy: userId,
      ratedAt: new Date()
    };

    await issue.save();

    // Update technician's average rating
    if (issue.assignedTechnician) {
      const allRatings = await Issue.find({
        assignedTechnician: issue.assignedTechnician,
        'technicianRating.rating': { $exists: true }
      }).select('technicianRating.rating');

      let totalRating = 0;
      allRatings.forEach((iss) => {
        totalRating += iss.technicianRating?.rating || 0;
      });

      const avgRating = (totalRating / allRatings.length).toFixed(2);

      await User.findByIdAndUpdate(
        issue.assignedTechnician,
        {
          rating: avgRating,
          totalReviews: allRatings.length
        }
      );
    }

    return res.json({
      message: 'Rating submitted successfully',
      data: issue.technicianRating
    });

  } catch (error) {
    console.error('Error rating technician:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
};

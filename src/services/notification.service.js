/**
 * Notification Service
 * Centralized service for creating and managing notifications
 */

const Notification = require('../models/notifications.model');
const User = require('../models/user.model');

/**
 * Create a notification
 */
exports.createNotification = async (notificationData) => {
  try {
    const {
      userId,
      type = 'general',
      title,
      message,
      issueId = null,
      relatedUserId = null,
      actionUrl = null,
      isPriority = false,
      metadata = null
    } = notificationData;

    // Validate required fields
    if (!userId || !title || !message) {
      console.error('Missing required notification fields');
      return null;
    }

    const notification = new Notification({
      userId,
      type,
      title,
      message,
      issueId,
      relatedUserId,
      actionUrl,
      isPriority,
      metadata
    });

    await notification.save();
    console.log(`✅ Notification sent to user ${userId}: ${title}`);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Send notification when issue is assigned
 */
exports.notifyIssueAssigned = async (issue, technicianId, adminId) => {
  try {
    // Notify technician
    await exports.createNotification({
      userId: technicianId,
      type: 'issue_assigned',
      title: '🎯 New Issue Assigned',
      message: `Issue "${issue.title}" has been assigned to you. Priority: ${issue.priority}. Deadline: ${issue.deadline ? new Date(issue.deadline).toLocaleString() : 'N/A'}`,
      issueId: issue._id,
      relatedUserId: adminId,
      actionUrl: `/technician/issue/${issue._id}`,
      isPriority: issue.priority === 'Critical' || issue.priority === 'Urgent',
      metadata: {
        priority: issue.priority,
        deadline: issue.deadline,
        issueType: issue.issueType
      }
    });

    // Notify issue creator (employee)
    await exports.createNotification({
      userId: issue.createdBy,
      type: 'issue_assigned',
      title: '✅ Technician Assigned',
      message: `Your issue "${issue.title}" has been assigned to a technician. You'll receive updates on progress.`,
      issueId: issue._id,
      relatedUserId: technicianId,
      actionUrl: `/employee/issue/${issue._id}`,
      metadata: {
        technicianName: (await User.findById(technicianId))?.name,
        priority: issue.priority
      }
    });

    console.log(`📢 Assignment notifications sent for issue ${issue._id}`);
  } catch (error) {
    console.error('Error sending assignment notifications:', error);
  }
};

/**
 * Send notification when progress is updated
 */
exports.notifyProgressUpdate = async (issue, progressMessage, technicianId) => {
  try {
    const technician = await User.findById(technicianId);

    // Notify issue creator (employee)
    await exports.createNotification({
      userId: issue.createdBy,
      type: 'issue_progress_update',
      title: '📤 Progress Update',
      message: `${technician.name} updated your issue: "${progressMessage}". Current progress: ${issue.progress}%`,
      issueId: issue._id,
      relatedUserId: technicianId,
      actionUrl: `/employee/issue/${issue._id}`,
      metadata: {
        progress: issue.progress,
        technicianName: technician.name
      }
    });

    console.log(`📢 Progress update notification sent for issue ${issue._id}`);
  } catch (error) {
    console.error('Error sending progress notification:', error);
  }
};

/**
 * Send notification when issue is completed
 */
exports.notifyIssueCompleted = async (issue, completionNotes) => {
  try {
    const technician = await User.findById(issue.assignedTechnician);

    // Notify issue creator (employee)
    await exports.createNotification({
      userId: issue.createdBy,
      type: 'issue_completed',
      title: '✨ Issue Completed',
      message: `Your issue "${issue.title}" has been completed by ${technician.name}. Please review and rate the technician.`,
      issueId: issue._id,
      relatedUserId: issue.assignedTechnician,
      actionUrl: `/employee/issue/${issue._id}`,
      isPriority: true,
      metadata: {
        technicianName: technician.name,
        completionNotes: completionNotes
      }
    });

    // Notify admin
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await exports.createNotification({
        userId: admin._id,
        type: 'issue_completed',
        title: `✅ Issue Completed: ${issue.title}`,
        message: `Issue has been marked complete by ${technician.name}`,
        issueId: issue._id,
        relatedUserId: issue.assignedTechnician,
        actionUrl: `/admin/issue/${issue._id}`
      });
    }

    console.log(`📢 Completion notifications sent for issue ${issue._id}`);
  } catch (error) {
    console.error('Error sending completion notifications:', error);
  }
};

/**
 * Send notification when SLA is at risk
 */
exports.notifySLAAtRisk = async (issue, percentageUsed) => {
  try {
    const technician = await User.findById(issue.assignedTechnician);

    // Notify technician
    await exports.createNotification({
      userId: issue.assignedTechnician,
      type: 'sla_at_risk',
      title: '⏰ SLA At Risk',
      message: `Issue "${issue.title}" is ${percentageUsed.toFixed(0)}% through its deadline. Time remaining: ${issue.sla.resolutionTimeRemaining?.toFixed(0) || 'N/A'} minutes`,
      issueId: issue._id,
      actionUrl: `/technician/issue/${issue._id}`,
      isPriority: true,
      metadata: {
        percentageUsed: percentageUsed,
        deadline: issue.deadline,
        priority: issue.priority
      }
    });

    // Notify all admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await exports.createNotification({
        userId: admin._id,
        type: 'sla_at_risk',
        title: `⚠️ SLA Alert: ${issue.title}`,
        message: `Issue assigned to ${technician.name} is at risk. ${percentageUsed.toFixed(0)}% through deadline.`,
        issueId: issue._id,
        relatedUserId: issue.assignedTechnician,
        actionUrl: `/admin/issue/${issue._id}`,
        isPriority: true,
        metadata: {
          technician: technician.name,
          percentageUsed: percentageUsed,
          priority: issue.priority
        }
      });
    }

    console.log(`📢 SLA at risk notifications sent for issue ${issue._id}`);
  } catch (error) {
    console.error('Error sending SLA at risk notification:', error);
  }
};

/**
 * Send notification when SLA is breached
 */
exports.notifySLABreached = async (issue) => {
  try {
    const technician = await User.findById(issue.assignedTechnician);

    // Notify technician
    await exports.createNotification({
      userId: issue.assignedTechnician,
      type: 'sla_breached',
      title: '🚨 SLA BREACHED',
      message: `URGENT: Issue "${issue.title}" deadline has passed! Please complete immediately.`,
      issueId: issue._id,
      actionUrl: `/technician/issue/${issue._id}`,
      isPriority: true,
      metadata: {
        deadlineBreached: issue.deadline,
        priority: issue.priority
      }
    });

    // Notify issue creator
    await exports.createNotification({
      userId: issue.createdBy,
      type: 'sla_breached',
      title: '⚠️ Your Issue is Overdue',
      message: `Your issue "${issue.title}" is past the deadline. It's being escalated to management.`,
      issueId: issue._id,
      actionUrl: `/employee/issue/${issue._id}`,
      isPriority: true
    });

    // Notify all admins
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await exports.createNotification({
        userId: admin._id,
        type: 'sla_breached',
        title: `🚨 SLA BREACH: ${issue.title}`,
        message: `Issue assigned to ${technician.name} has breached SLA deadline!`,
        issueId: issue._id,
        relatedUserId: issue.assignedTechnician,
        actionUrl: `/admin/issue/${issue._id}`,
        isPriority: true,
        metadata: {
          technician: technician.name,
          priority: issue.priority,
          daysOverdue: Math.ceil((new Date() - issue.deadline) / (1000 * 60 * 60 * 24))
        }
      });
    }

    console.log(`📢 SLA breach notifications sent for issue ${issue._id}`);
  } catch (error) {
    console.error('Error sending SLA breach notification:', error);
  }
};

/**
 * Send notification when issue is reassigned
 */
exports.notifyIssueReassigned = async (issue, oldTechnicianId, newTechnicianId, adminId, reason) => {
  try {
    const oldTechnician = await User.findById(oldTechnicianId);
    const newTechnician = await User.findById(newTechnicianId);

    // Notify old technician (deallocated)
    await exports.createNotification({
      userId: oldTechnicianId,
      type: 'issue_reassigned',
      title: '🔄 Issue Deallocated',
      message: `Issue "${issue.title}" has been deallocated from you. Reason: ${reason}`,
      issueId: issue._id,
      relatedUserId: adminId,
      actionUrl: `/technician/issue/${issue._id}`
    });

    // Notify new technician (assigned)
    await exports.createNotification({
      userId: newTechnicianId,
      type: 'issue_assigned',
      title: '🎯 Issue Reassigned to You',
      message: `Issue "${issue.title}" has been reassigned to you from ${oldTechnician.name}. Reason: ${reason}`,
      issueId: issue._id,
      relatedUserId: adminId,
      actionUrl: `/technician/issue/${issue._id}`,
      isPriority: true,
      metadata: {
        previousTechnician: oldTechnician.name,
        priority: issue.priority,
        deadline: issue.deadline
      }
    });

    // Notify issue creator
    await exports.createNotification({
      userId: issue.createdBy,
      type: 'issue_reassigned',
      title: '🔄 Technician Changed',
      message: `Your issue "${issue.title}" has been reassigned to ${newTechnician.name}.`,
      issueId: issue._id,
      actionUrl: `/employee/issue/${issue._id}`,
      metadata: {
        newTechnician: newTechnician.name,
        oldTechnician: oldTechnician.name
      }
    });

    console.log(`📢 Reassignment notifications sent for issue ${issue._id}`);
  } catch (error) {
    console.error('Error sending reassignment notifications:', error);
  }
};

/**
 * Get unread notifications for a user
 */
exports.getUnreadNotifications = async (userId) => {
  try {
    const notifications = await Notification.find({
      userId: userId,
      isRead: false
    })
      .sort('-createdAt')
      .populate('relatedUserId', 'name email')
      .populate('issueId', 'title priority status');

    return notifications;
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    return [];
  }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (notificationId) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return null;
  }
};

/**
 * Mark all notifications as read for a user
 */
exports.markAllAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { userId: userId, isRead: false },
      { isRead: true }
    );

    return result;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return null;
  }
};

/**
 * Get all notifications for a user (paginated)
 */
exports.getAllNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ userId: userId })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('relatedUserId', 'name email')
      .populate('issueId', 'title priority status');

    const total = await Notification.countDocuments({ userId });

    return {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      data: notifications
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return null;
  }
};

/**
 * Delete old notifications (cleanup)
 * Keep only last 30 days of notifications
 */
exports.cleanupOldNotifications = async (daysToKeep = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      isRead: true
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
    return result;
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    return null;
  }
};

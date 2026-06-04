/**
 * Notifications Controller
 * Handles getting, marking as read notifications
 */

const notificationService = require('../services/notification.service');
const Notification = require('../models/notifications.model');

/**
 * Get unread notifications count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await Notification.countDocuments({
      userId: userId,
      isRead: false
    });

    return res.json({
      unreadCount: count
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

/**
 * Get unread notifications
 */
exports.getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await notificationService.getUnreadNotifications(userId);

    return res.json({
      total: notifications.length,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    res.status(500).json({ error: 'Failed to fetch unread notifications' });
  }
};

/**
 * Get all notifications (paginated)
 */
exports.getAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await notificationService.getAllNotifications(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    return res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    // Verify ownership
    const notification = await Notification.findById(notificationId);
    if (!notification || notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'You do not have permission to update this notification' });
    }

    const result = await notificationService.markAsRead(notificationId);

    return res.json({
      message: 'Notification marked as read',
      data: result
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await notificationService.markAllAsRead(userId);

    return res.json({
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    // Verify ownership
    const notification = await Notification.findById(notificationId);
    if (!notification || notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'You do not have permission to delete this notification' });
    }

    await Notification.findByIdAndDelete(notificationId);

    return res.json({
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

/**
 * Get notification statistics
 */
exports.getNotificationStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const total = await Notification.countDocuments({ userId });
    const unread = await Notification.countDocuments({ userId, isRead: false });
    const byType = await Notification.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    return res.json({
      total,
      unread,
      read: total - unread,
      byType: byType || []
    });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({ error: 'Failed to get notification statistics' });
  }
};

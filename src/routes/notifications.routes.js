/**
 * Unified Notifications Routes
 */

const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');
const verifyToken = require('../middlewares/authmiddleware');

/**
 * @route GET /api/notifications/unread/count
 * Get unread notifications count
 */
router.get('/unread/count', verifyToken, notificationsController.getUnreadCount);

/**
 * @route GET /api/notifications/unread
 * Get all unread notifications
 */
router.get('/unread', verifyToken, notificationsController.getUnreadNotifications);

/**
 * @route GET /api/notifications
 * Get all notifications (paginated)
 * Query: page=1, limit=20
 */
router.get('/', verifyToken, notificationsController.getAllNotifications);

/**
 * @route GET /api/notifications/stats
 * Get notification statistics
 */
router.get('/stats', verifyToken, notificationsController.getNotificationStats);

/**
 * @route PUT /api/notifications/:notificationId/read
 * Mark single notification as read
 */
router.put('/:notificationId/read', verifyToken, notificationsController.markAsRead);

/**
 * @route PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', verifyToken, notificationsController.markAllAsRead);

/**
 * @route DELETE /api/notifications/:notificationId
 * Delete a notification
 */
router.delete('/:notificationId', verifyToken, notificationsController.deleteNotification);

module.exports = router;

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      enum: [
        'issue_assigned',
        'issue_progress_update',
        'issue_completed',
        'sla_at_risk',
        'sla_breached',
        'issue_reassigned',
        'comment_added',
        'status_changed',
        'general'
      ],
      default: 'general'
    },

    title: {
      type: String,
      required: true
    },

    message: {
      type: String,
      required: true
    },

    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      default: null
    },

    relatedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
      // Who triggered this notification (technician, admin, etc.)
    },

    actionUrl: {
      type: String,
      default: null
      // Link to action (e.g., "/issue/123")
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true
    },

    isPriority: {
      type: Boolean,
      default: false
      // High priority alerts (SLA breach, etc.)
    },

    metadata: {
      type: Object,
      default: null
      // Extra data like priority, technician name, etc.
    }
  },
  { timestamps: true }
);

// Index for quick queries
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ issueId: 1 });

module.exports = mongoose.model("Notification", notificationSchema);

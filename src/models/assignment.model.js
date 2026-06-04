const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true
    },

    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
      // Jo admin assign kiya (manual) ya system (automatic)
    },

    assignmentType: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'automatic'
      // Automatic agar system ne assign kiya, Manual agar admin ne
    },

    reason: {
      type: String,
      default: null
      // Agar manual hai toh admin kyu assign kiya?
    },

    assignedAt: {
      type: Date,
      default: Date.now
    },

    deallocatedAt: {
      type: Date,
      default: null
      // Agar deallocate hua toh kab?
    },

    isActive: {
      type: Boolean,
      default: true
      // True = abhi yeh technician pe assigned hai
      // False = deallocated ho gaya ya moved to another
    }
  },
  { timestamps: true }
);

// Index for quick queries
assignmentSchema.index({ issue: 1, isActive: 1 });
assignmentSchema.index({ technician: 1, isActive: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);

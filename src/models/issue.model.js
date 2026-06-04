// const mongoose = require('mongoose');

// const issueSchema = new mongoose.Schema(
//   {
//     title: {
//       type: String,
//       required: true
//     },

//     description: {
//       type: String,
//       required: true
//     },

//     category: {
//       type: String,
//       required: true
//     },

//     priority: {
//       type: String,
//       enum: ['Routine', 'Risky', 'Urgent', 'Critical'],
//       default: 'Routine'
//     }
//     ,

//     location: {
//       type: String,
//       required: true
//     },

//     images: [
//       {
//         type: String
//       }
//     ],

//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true
//     },

//     assignedTechnician: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       default: null
//     },

//     status: {
//       type: String,
//       enum: ['open', 'assigned', 'in-progress', 'on-hold', 'resolved', 'closed'],
//       default: 'open'
//     },

//     timeline: [
//       {
//         status: String,
//         timestamp: { type: Date, default: Date.now }
//       }
//     ]
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model('Issue', issueSchema);

const mongoose = require("mongoose");

const ISSUE_STATUS = [
  "open",
  "assigned",
  "in-progress",
  "on-hold",
  "resolved",
  "closed"
];

const ISSUE_PRIORITY = [
  "Routine",
  "Risky",
  "Urgent",
  "Critical"
];

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    issueType: {
      type: String,
      default: "General"
      // Generic: "Network Issue", "Hardware", "Software", "Maintenance", etc.
      // Hospital: "Equipment Issue", "Infection Control", "Patient Complaint"
      // Manufacturing: "Production Stop", "Safety Issue", "Quality Issue"
    },

    priority: {
      type: String,
      enum: ISSUE_PRIORITY,
      default: "Routine"
    },

    location: {
      type: String,
      required: true
    },

    images: [
      {
        type: String
      }
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    assignedAt: {
      type: Date,
      default: null
      // Kab technician assign hua
    },

    deadline: {
      type: Date,
      default: null
      // SLA ke basis par calculate hoga
    },

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
      // 0 = not started, 50 = half done, 100 = completed
    },

    /** ✅ SINGLE SOURCE OF TRUTH */
    status: {
      type: String,
      enum: ISSUE_STATUS,
      default: "open",
      index: true
    },

    /** ✅ HISTORY ONLY (NOT PRIMARY STATUS) */
    timeline: [
      {
        status: {
          type: String,
          enum: ISSUE_STATUS,
          required: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        note: {
          type: String,
          default: null
        }
      }
    ],

    /** ✅ SLA TRACKING FIELDS */
    sla: {
      responseTimeTarget: {
        type: Number, // in minutes
        default: null
      },
      resolutionTimeTarget: {
        type: Number, // in minutes
        default: null
      },
      firstResponseTime: {
        type: Date, // when issue was first assigned/acknowledged
        default: null
      },
      resolvedTime: {
        type: Date, // when issue was resolved
        default: null
      },
      responseStatus: {
        type: String,
        enum: ['pending', 'met', 'breached'],
        default: 'pending'
      },
      resolutionStatus: {
        type: String,
        enum: ['pending', 'met', 'breached'],
        default: 'pending'
      },
      responseTimeBreached: {
        type: Boolean,
        default: false
      },
      resolutionTimeBreached: {
        type: Boolean,
        default: false
      },
      responseTimeRemaining: {
        type: Number, // in minutes (calculated)
        default: null
      },
      resolutionTimeRemaining: {
        type: Number, // in minutes (calculated)
        default: null
      },
      breachAlertSent: {
        type: Boolean,
        default: false
      }
    },

    /** ✅ PROGRESS UPDATES FROM TECHNICIAN */
    progressUpdates: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true
        },
        technician: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        message: {
          type: String,
          required: true,
          trim: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        type: {
          type: String,
          enum: ['progress', 'note', 'status-change'],
          default: 'progress'
        }
      }
    ],

    /** ✅ TECHNICIAN RATING FROM EMPLOYEE */
    technicianRating: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      review: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null
      },
      ratedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      ratedAt: {
        type: Date,
        default: null
      }
    },

    /** ✅ COMPLETION DETAILS */
    completedAt: {
      type: Date,
      default: null
    },
    completionNotes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Issue", issueSchema);


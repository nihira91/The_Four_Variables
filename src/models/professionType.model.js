const mongoose = require('mongoose');

const professionTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
      // Example: "IT Support", "Electrical", "Plumbing", "Healthcare", etc.
    },

    description: {
      type: String,
      default: null
      // Ek line mein explain karo ye profession kya karta hai
    },

    skills: [
      {
        type: String
        // Example: ["Network Setup", "Hardware Repair", "Software Installation"]
      }
    ],

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
      // Kon admin ye profession type add kiya
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProfessionType', professionTypeSchema);

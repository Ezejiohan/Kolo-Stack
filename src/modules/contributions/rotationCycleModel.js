const mongoose = require("mongoose");

const rotationCycleSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true
    },

    cycleNumber: {
      type: Number,
      required: true
    },

    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    recipientPosition: {
      type: Number,
      required: true
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    contributorsCount: {
      type: Number,
      required: true,
      default: 0
    },

    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "cancelled"],
      default: "pending"
    },

    payoutDate: {
      type: Date
    },

    payoutReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment"
    },

    notes: String
  },
  { timestamps: true }
);

// Indexes for faster queries
rotationCycleSchema.index({ group: 1, cycleNumber: 1 });
rotationCycleSchema.index({ group: 1, status: 1 });
rotationCycleSchema.index({ recipientUser: 1 });
rotationCycleSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model("RotationCycle", rotationCycleSchema);

const mongoose = require("mongoose");

const contributionSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    cycleNumber: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "completed", "defaulted"],
      default: "pending"
    },

    paymentReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment"
    },

    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction"
    },

    dueDate: {
      type: Date,
      required: true
    },

    paidDate: {
      type: Date
    },

    notes: String
  },
  { timestamps: true }
);

// Indexes for faster queries
contributionSchema.index({ group: 1, cycleNumber: 1 });
contributionSchema.index({ group: 1, user: 1, cycleNumber: 1 });
contributionSchema.index({ user: 1, status: 1 });
contributionSchema.index({ dueDate: 1 });

module.exports = mongoose.model("Contribution", contributionSchema);

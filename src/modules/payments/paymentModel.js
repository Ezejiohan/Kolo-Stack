const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    reference: {
      type: String,
      required: true,
      unique: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    currency: {
      type: String,
      default: "NGN"
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "cancelled"],
      default: "pending"
    },

    paymentMethod: {
      type: String,
      default: "paystack"
    },

    // optional link to a group for contributions
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group"
    },

    purpose: {
      type: String,
      enum: ["deposit", "contribution", "payout", "other"],
      default: "deposit"
    },

    paystackData: {
      type: mongoose.Schema.Types.Mixed
    },

    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction"
    }
  },
  { timestamps: true }
);

// Index for faster queries
//paymentSchema.index({ user: 1, status: 1 });
//paymentSchema.index({ reference: 1 });

module.exports = mongoose.model("Payment", paymentSchema);

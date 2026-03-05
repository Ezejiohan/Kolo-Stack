const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      enum: ["deposit", "withdraw", "contribution", "payout"],
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group"
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed"
    },

    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);

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
        required: true 
    },
    group: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Group" 
    },
    status: { 
        type: String, 
        enum: ["pending", "completed", "failed"], 
        default: "pending" 
    },
    idempotencyKey: { 
        type: String, 
        unique: true 
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);

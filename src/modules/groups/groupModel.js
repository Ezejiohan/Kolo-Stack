const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    contributionAmount: { type: Number, required: true },
    rotationFrequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "monthly" },
    currentRotationIndex: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);

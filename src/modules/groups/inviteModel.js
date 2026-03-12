const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  email: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  used: { type: Boolean, default: false }
});

module.exports = mongoose.model("Invite", inviteSchema);
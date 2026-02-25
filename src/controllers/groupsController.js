const mongoose = require("mongoose");
const Group = require("../modules/groups/groupModel");
const Wallet = require("../modules/wallet/walletModel");
const Transaction = require("../modules/transactions/transactionModel");
const AuditLog = require("../modules/audit/auditLogModel");

// Create Group
exports.createGroup = async (req, res) => {
  try {
    const { name, contributionAmount, rotationFrequency } = req.body;

    const group = await Group.create({
      name,
      owner: req.user._id,
      members: [req.user._id],
      contributionAmount,
      rotationFrequency,
    });

    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Join Group
exports.joinGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.members.includes(req.user._id))
      return res.status(400).json({ message: "Already a member" });

    group.members.push(req.user._id);
    await group.save();

    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get My Groups
exports.getMyGroups = async (req, res) => {
  const groups = await Group.find({ members: req.user._id });
  res.json(groups);
};

// Contribute to Group
exports.contribute = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const group = await Group.findById(req.params.id).session(session);
    if (!group) throw new Error("Group not found");

    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet || wallet.balance < group.contributionAmount)
      throw new Error("Insufficient funds");

    wallet.balance -= group.contributionAmount;
    await wallet.save({ session });

    await Transaction.create(
      [{
        user: req.user._id,
        type: "contribution",
        amount: group.contributionAmount,
        group: group._id,
        status: "completed"
      }],
      { session }
    );

    await AuditLog.create([{
      user: req.user._id,
      action: "CONTRIBUTION",
      metadata: { groupId: group._id },
      ipAddress: req.ip
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Contribution successful" });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: error.message });
  }
};

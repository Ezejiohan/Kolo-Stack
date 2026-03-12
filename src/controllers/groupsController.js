const mongoose = require("mongoose");
const Group = require("../modules/groups/groupModel");
const Wallet = require("../modules/wallet/walletModel");
const Transaction = require("../modules/transactions/transactionModel");
const AuditLog = require("../modules/audit/auditLogModel");
const User = require("../modules/users/userModel");
const Invite = require("../modules/groups/inviteModel");
const { sendMail } = require("../utils/mailer");


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

    // notify creator via email
    try {
      await sendMail({
        to: req.user.email,
        subject: "Group created successfully",
        text: `Your group \"${group.name}\" has been created. Invite members or start contributing!`
      });
    } catch (err) {
      console.error("Failed to send group creation email:", err);
    }

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

    if (group.members.some(member => member.toString() === req.user._id.toString()))
        return res.status(400).json({ message: "Already a member" });

    group.members.push(req.user._id);
    await group.save();

    // notify group owner that someone joined
    try {
      const owner = await User.findById(group.owner);
      if (owner && owner.email) {
        await sendMail({
          to: owner.email,
          subject: "New member joined your group",
          text: `${req.user.email} has joined your group \"${group.name}\".`
        });
      }
    } catch (err) {
      console.error("Error sending join notification email:", err);
    }

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

// send an invite to an email address (owner only)
exports.sendInvite = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only owner can send invites" });
    }

    const token = require("crypto").randomBytes(20).toString("hex");
    const invite = await Invite.create({
      group: groupId,
      email,
      token,
      createdAt: new Date(),
      used: false
    });

    // send email
    const acceptUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/groups/invite/accept/${token}`;
    await sendMail({
      to: email,
      subject: "You're invited to join a Kolo group",
      text: `Click here to join group ${group.name}: ${acceptUrl}`
    });

    res.json({ success: true, invite });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// accept an invite token
exports.acceptInvite = async (req, res) => {
  try {
    const token = req.params.token;
    const invite = await Invite.findOne({ token });
    if (!invite || invite.used) return res.status(400).json({ message: "Invalid or expired invite" });

    const group = await Group.findById(invite.group);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // add user if not already a member
    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      group.members.push(req.user._id);
      await group.save();
    }
    invite.used = true;
    await invite.save();

    res.json({ success: true, message: "Joined group via invite", group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Contribute to Group
exports.contribute = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const group = await Group.findById(req.params.id).session(session);
    if (!group) throw new Error("Group not found");

       //PREVENT DOUBLE CONTRIBUTION
    const existingContribution = await Transaction.findOne({
      user: req.user._id,
      group: group._id,
      type: "contribution"
    }).session(session);

    if (existingContribution) {
      throw new Error("You have already contributed to this group");
    }

       // CHECK WALLET
    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet || wallet.balance < group.contributionAmount)
      throw new Error("Insufficient funds");

      // DEDUCT BALANCE
    wallet.balance -= group.contributionAmount;
    await wallet.save({ session });

       // CREATE TRANSACTION
    const txn = await Transaction.create(
      [{
        user: req.user._id,
        type: "contribution",
        amount: group.contributionAmount,
        group: group._id,
        status: "completed"
      }],
      { session }
    );

       //RECORD CONTRIBUTION (service updates rotation counts)
    const contributionService = require("../services/contributionService");
    try {
      await contributionService.recordContribution(
        group._id,
        req.user._id,
        group.contributionAmount,
        null, // no payment reference for wallet contribution
        txn[0]._id
      );
    } catch (err) {
      // log but don't fail entire transaction
      console.error("Error recording contribution via service:", err);
    }

       // AUDIT LOG
    await AuditLog.create(
      [{
        user: req.user._id,
        action: "CONTRIBUTION",
        metadata: { groupId: group._id },
        ipAddress: req.ip
      }],
      { session }
    );

       // COMMIT
    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Contribution successful" });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: error.message });
  }
};

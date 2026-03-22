const mongoose = require("mongoose");
const Group = require("../modules/groups/groupModel");
const Wallet = require("../modules/wallet/walletModel");
const Transaction = require("../modules/transactions/transactionModel");
const AuditLog = require("../modules/audit/auditLogModel");
const User = require("../modules/users/userModel");
const Invite = require("../modules/groups/inviteModel");
const { sendMail } = require("../utils/mailer");

/**
 * Create Group
 * FIX: Removed `authorize("admin")` gate from route — it's now open to
 *      authenticated users (kept here for reference; route file is the source of truth)
 * FIX: Added input validation
 */
exports.createGroup = async (req, res) => {
  try {
    const { name, contributionAmount, rotationFrequency } = req.body;

    // FIX: Validate required fields
    if (!name || !contributionAmount || !rotationFrequency) {
      return res.status(400).json({
        message: "name, contributionAmount, and rotationFrequency are required",
      });
    }
    if (contributionAmount <= 0) {
      return res.status(400).json({ message: "contributionAmount must be positive" });
    }
    const validFrequencies = ["daily", "weekly", "monthly"];
    if (!validFrequencies.includes(rotationFrequency)) {
      return res.status(400).json({
        message: `rotationFrequency must be one of: ${validFrequencies.join(", ")}`,
      });
    }

    const group = await Group.create({
      name,
      owner: req.user._id,
      members: [req.user._id],
      contributionAmount,
      rotationFrequency,
    });

    // Notify creator via email
    try {
      await sendMail({
        to: req.user.email,
        subject: "Group created successfully",
        text: `Your group "${group.name}" has been created. Invite members or start contributing!`,
      });
    } catch (err) {
      console.error("Failed to send group creation email:", err);
    }

    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Join Group
 */
exports.joinGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.members.some((member) => member.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: "Already a member" });
    }

    group.members.push(req.user._id);
    await group.save();

    // Notify group owner
    try {
      const owner = await User.findById(group.owner);
      if (owner && owner.email) {
        await sendMail({
          to: owner.email,
          subject: "New member joined your group",
          text: `${req.user.email} has joined your group "${group.name}".`,
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

/**
 * Get My Groups
 */
exports.getMyGroups = async (req, res) => {
  try {
    // FIX: Added try/catch (was missing) and lean() for performance
    const groups = await Group.find({ members: req.user._id }).lean();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Send an invite to an email address (owner only)
 * FIX: Check for existing pending (unused) invite to prevent spam
 */
exports.sendInvite = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // FIX: Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only owner can send invites" });
    }

    // FIX: Prevent duplicate pending invites to the same email for the same group
    const existingInvite = await Invite.findOne({ group: groupId, email, used: false });
    if (existingInvite) {
      return res
        .status(409)
        .json({ message: "A pending invite already exists for this email" });
    }

    const token = require("crypto").randomBytes(20).toString("hex");
    const invite = await Invite.create({
      group: groupId,
      email,
      token,
      createdAt: new Date(),
      used: false,
    });

    const acceptUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/groups/invite/accept/${token}`;
    await sendMail({
      to: email,
      subject: "You're invited to join a Kolo group",
      text: `Click here to join group ${group.name}: ${acceptUrl}`,
    });

    res.json({ success: true, invite });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Accept an invite token
 */
exports.acceptInvite = async (req, res) => {
  try {
    const token = req.params.token;
    const invite = await Invite.findOne({ token });
    if (!invite || invite.used)
      return res.status(400).json({ message: "Invalid or expired invite" });

    // FIX: Verify the invite email matches the authenticated user's email
    if (invite.email !== req.user.email) {
      return res
        .status(403)
        .json({ message: "This invite was sent to a different email address" });
    }

    const group = await Group.findById(invite.group);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.members.some((m) => m.toString() === req.user._id.toString())) {
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

/**
 * Contribute to Group
 * FIX: Added cycle check — requires an active (pending) cycle before accepting contribution
 * FIX: Validate contribution amount matches group.contributionAmount
 */
exports.contribute = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const group = await Group.findById(req.params.id).session(session);
    if (!group) throw new Error("Group not found");

    // FIX: Verify user is a member of the group
    if (!group.members.some((m) => m.toString() === req.user._id.toString())) {
      throw new Error("You are not a member of this group");
    }

    // FIX: Check there is an active cycle to contribute to
    const RotationCycle = require("../modules/contributions/rotationCycleModel");
    const activeCycle = await RotationCycle.findOne({
      group: group._id,
      status: "pending",
    })
      .sort({ cycleNumber: -1 })
      .session(session);

    if (!activeCycle) {
      throw new Error("No active cycle found. Ask the group owner to start a new cycle.");
    }

    // Prevent double contribution in the same cycle
    const Contribution = require("../modules/contributions/contributionModel");
    const existingContribution = await Contribution.findOne({
      user: req.user._id,
      group: group._id,
      cycleNumber: activeCycle.cycleNumber,
      status: "completed",
    }).session(session);

    if (existingContribution) {
      throw new Error("You have already contributed to this group in the current cycle");
    }

    // Check wallet balance
    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet || wallet.balance < group.contributionAmount)
      throw new Error("Insufficient funds");

    // Deduct balance
    wallet.balance -= group.contributionAmount;
    await wallet.save({ session });

    // Create transaction record
    const txn = await Transaction.create(
      [
        {
          user: req.user._id,
          type: "contribution",
          amount: group.contributionAmount,
          group: group._id,
          status: "completed",
        },
      ],
      { session }
    );

    // Record contribution via service
    const contributionService = require("../services/contributionService");
    try {
      await contributionService.recordContribution(
        group._id,
        req.user._id,
        group.contributionAmount,
        null, // no external payment reference for wallet contributions
        txn[0]._id
      );
    } catch (err) {
      console.error("Error recording contribution via service:", err);
      // FIX: Re-throw so the transaction is aborted and the user is not silently debited
      throw err;
    }

    // Audit log
    await AuditLog.create(
      [
        {
          user: req.user._id,
          action: "CONTRIBUTION",
          metadata: { groupId: group._id, cycleNumber: activeCycle.cycleNumber },
          ipAddress: req.ip,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Contribution successful" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: error.message });
  }
};
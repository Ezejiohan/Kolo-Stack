const contributionService = require("../services/contributionService");
const Group = require("../modules/groups/groupModel");
const User = require("../modules/users/userModel");
const RotationCycle = require("../modules/contributions/rotationCycleModel");
const { sendMail } = require("../utils/mailer");

// FIX: Moved RotationCycle require to top-level (was inline require inside handlers)

/**
 * Initialize a new rotation cycle for a group (owner only)
 */
exports.initializeCycle = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId).populate("members");
    if (!group)
      return res.status(404).json({ success: false, message: "Group not found" });

    if (group.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Only the group owner can start a cycle" });
    }

    // FIX: Derive next cycle number directly from RotationCycle, not from stats
    const latestCycle = await RotationCycle.findOne({ group: groupId }).sort({
      cycleNumber: -1,
    });
    const nextCycle = latestCycle ? latestCycle.cycleNumber + 1 : 1;

    const cycle = await contributionService.initializeRotationCycle(groupId, nextCycle);

    // Notify members about new cycle
    try {
      const emails = group.members.map((m) => m.email).filter(Boolean);
      if (emails.length) {
        await sendMail({
          to: emails.join(","),
          subject: `New cycle ${nextCycle} started in group ${group.name}`,
          text: `A new contribution cycle (#${nextCycle}) has been initialized. Please make your payments.`,
        });
      }
    } catch (err) {
      console.error("Error sending cycle start emails:", err);
    }

    res.status(201).json({ success: true, cycle });
  } catch (error) {
    console.error(error);
    // FIX: Return 409 Conflict for duplicate cycle instead of 500
    const statusCode = error.message.includes("already exists") ? 409 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Record contribution after successful payment
 */
exports.recordContribution = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!req.body || !req.body.amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: amount, paymentReference, transactionId",
      });
    }

    const { amount, paymentReference, transactionId } = req.body;

    const contribution = await contributionService.recordContribution(
      groupId,
      req.user._id,
      amount,
      paymentReference,
      transactionId
    );

    // Send receipt email
    try {
      await sendMail({
        to: req.user.email,
        subject: "Contribution received",
        text: `Your contribution of ${amount} for group ${groupId} has been recorded.`,
      });
    } catch (err) {
      console.error("Failed to send contribution email:", err);
    }

    res.json({ success: true, contribution });
  } catch (error) {
    console.error(error);
    // FIX: 409 for already-recorded, 404 for not found, 400 for others
    let statusCode = 400;
    if (error.message.includes("already been recorded")) statusCode = 409;
    if (error.message.includes("not found")) statusCode = 404;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Get statistics for a group or cycle
 */
exports.getGroupStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { cycle } = req.query;
    const stats = await contributionService.getGroupContributionStats(groupId, cycle);
    res.json({ success: true, stats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a member's contribution history
 */
exports.getMemberHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;
    const history = await contributionService.getMemberContributionHistory(
      userId,
      groupId
    );
    res.json({ success: true, history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get next recipient info
 */
exports.getNextRecipient = async (req, res) => {
  try {
    const { groupId } = req.params;
    const recipient = await contributionService.getNextRecipient(groupId);
    res.json({ success: true, recipient });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Complete a cycle (owner triggers after payout)
 * FIX: Use cycle.recipientUser (correct field name) instead of cycle.recipient
 */
exports.completeCycle = async (req, res) => {
  try {
    const { cycleId } = req.params;

    if (!req.body || !req.body.payoutReference) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required field: payoutReference" });
    }

    const { payoutReference } = req.body;

    const cycle = await RotationCycle.findById(cycleId).populate("group");
    if (!cycle)
      return res.status(404).json({ success: false, message: "Cycle not found" });

    if (cycle.group.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Only the group owner can complete a cycle" });
    }

    const updated = await contributionService.completeRotationCycle(cycleId, payoutReference);

    // Notify group members and recipient
    try {
      const group = await Group.findById(cycle.group._id).populate("members");
      // FIX: Use correct field name `recipientUser` (not `recipient`)
      const recipient = await User.findById(updated.recipientUser);

      const emails = group.members.map((m) => m.email).filter(Boolean);
      if (emails.length) {
        await sendMail({
          to: emails.join(","),
          subject: `Cycle ${cycle.cycleNumber} completed for group ${group.name}`,
          text: `The cycle has been marked complete. Payout reference: ${payoutReference}`,
        });
      }

      if (recipient && recipient.email) {
        await sendMail({
          to: recipient.email,
          subject: "You have received a payout",
          text: `You are the recipient for cycle ${cycle.cycleNumber} of group ${group.name}.`,
        });
      }
    } catch (err) {
      console.error("Error sending completion emails:", err);
    }

    res.json({ success: true, cycle: updated });
  } catch (error) {
    console.error(error);
    const statusCode = error.message.includes("already been completed") ? 409 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Check cycle completion status
 */
exports.checkCycle = async (req, res) => {
  try {
    const { groupId, cycleNumber } = req.params;
    // FIX: Validate cycleNumber is a positive integer
    const parsedCycle = parseInt(cycleNumber, 10);
    if (isNaN(parsedCycle) || parsedCycle < 1) {
      return res
        .status(400)
        .json({ success: false, message: "cycleNumber must be a positive integer" });
    }
    const result = await contributionService.checkCycleCompletion(groupId, parsedCycle);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
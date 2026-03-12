const contributionService = require("../services/contributionService");
const Group = require("../modules/groups/groupModel");
const User = require("../modules/users/userModel");
const { sendMail } = require("../utils/mailer");

// initialize a new rotation cycle for a group (owner only)
exports.initializeCycle = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId).populate('members');
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });
    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the group owner can start a cycle" });
    }

    // Determine next cycle number
    const lastCycle = await contributionService.getGroupContributionStats(groupId);
    // stats returns req contributions; we need last cycle number from rotation cycles
    // Instead of stats, just query rotation cycles directly here
    const RotationCycle = require("../modules/contributions/rotationCycleModel");
    const latestCycle = await RotationCycle.findOne({ group: groupId }).sort({ cycleNumber: -1 });
    const nextCycle = latestCycle ? latestCycle.cycleNumber + 1 : 1;

    const cycle = await contributionService.initializeRotationCycle(groupId, nextCycle);

    // notify members about new cycle
    try {
      const emails = group.members.map(m => m.email).filter(Boolean);
      if (emails.length) {
        await sendMail({
          to: emails.join(","),
          subject: `New cycle ${nextCycle} started in group ${group.name}`,
          text: `A new contribution cycle (#${nextCycle}) has been initialized. Please make your payments.`
        });
      }
    } catch (err) {
      console.error("Error sending cycle start emails:", err);
    }

    res.status(201).json({ success: true, cycle });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// record contribution after successful payment (uses amount, paymentReference etc.)
exports.recordContribution = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!req.body || !req.body.amount) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: amount, paymentReference, transactionId" 
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

    // send receipt
    try {
      await sendMail({
        to: req.user.email,
        subject: "Contribution received",
        text: `Your contribution of ${amount} for group ${groupId} has been recorded.`
      });
    } catch (err) {
      console.error("Failed to send contribution email:", err);
    }

    res.json({ success: true, contribution });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// get statistics for a group or cycle
exports.getGroupStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { cycle } = req.query; // optional cycleNumber
    const stats = await contributionService.getGroupContributionStats(groupId, cycle);
    res.json({ success: true, stats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get a member's contribution history
exports.getMemberHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;
    const history = await contributionService.getMemberContributionHistory(userId, groupId);
    res.json({ success: true, history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get next recipient info
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

// complete a cycle (owner triggers after payout)
exports.completeCycle = async (req, res) => {
  try {
    const { cycleId } = req.params;
    
    if (!req.body || !req.body.payoutReference) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required field: payoutReference" 
      });
    }

    const { payoutReference } = req.body;

    // ensure owner of the group is performing this
    const RotationCycle = require("../modules/contributions/rotationCycleModel");
    const cycle = await RotationCycle.findById(cycleId).populate('group');
    if (!cycle) return res.status(404).json({ success: false, message: "Cycle not found" });
    if (cycle.group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the group owner can complete a cycle" });
    }

    const updated = await contributionService.completeRotationCycle(cycleId, payoutReference);

    // notify group members and recipient
    try {
      const group = await Group.findById(cycle.group._id).populate("members");
      const recipient = await User.findById(updated.recipient);
      const emails = group.members.map(m => m.email).filter(Boolean);
      if (emails.length) {
        await sendMail({
          to: emails.join(","),
          subject: `Cycle ${cycle.cycleNumber} completed for group ${group.name}`,
          text: `The cycle has been marked complete. Payout reference: ${payoutReference}`
        });
      }
      if (recipient && recipient.email) {
        await sendMail({
          to: recipient.email,
          subject: "You have received a payout",
          text: `You are the recipient for cycle ${cycle.cycleNumber} of group ${group.name}.` 
        });
      }
    } catch (err) {
      console.error("Error sending completion emails:", err);
    }

    res.json({ success: true, cycle: updated });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// check cycle completion
exports.checkCycle = async (req, res) => {
  try {
    const { groupId, cycleNumber } = req.params;
    const result = await contributionService.checkCycleCompletion(groupId, parseInt(cycleNumber));
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

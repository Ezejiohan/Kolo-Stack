const contributionService = require("../services/contributionService");
const Group = require("../modules/groups/groupModel");

// initialize a new rotation cycle for a group (owner only)
exports.initializeCycle = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId);
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
    const { amount, paymentReference, transactionId } = req.body;

    const contribution = await contributionService.recordContribution(
      groupId,
      req.user._id,
      amount,
      paymentReference,
      transactionId
    );

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
    const { payoutReference } = req.body;

    // ensure owner of the group is performing this
    const RotationCycle = require("../modules/contributions/rotationCycleModel");
    const cycle = await RotationCycle.findById(cycleId).populate('group');
    if (!cycle) return res.status(404).json({ success: false, message: "Cycle not found" });
    if (cycle.group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the group owner can complete a cycle" });
    }

    const updated = await contributionService.completeRotationCycle(cycleId, payoutReference);
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

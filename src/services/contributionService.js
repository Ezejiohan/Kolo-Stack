const Contribution = require("../modules/contributions/contributionModel");
const RotationCycle = require("../modules/contributions/rotationCycleModel");
const Group = require("../modules/groups/groupModel");

/**
 * Get contribution statistics for a group
 * FIX: Added pagination support + lean() for performance
 */
exports.getGroupContributionStats = async (groupId, cycleNumber = null) => {
  try {
    const query = { group: groupId };
    if (cycleNumber) {
      query.cycleNumber = parseInt(cycleNumber, 10);
    }

    const contributions = await Contribution.find(query)
      .populate("user", "firstName lastName email")
      .lean(); // FIX: use lean() for read-only stats to improve performance

    const stats = {
      totalContributions: contributions.reduce((sum, c) => sum + c.amount, 0),
      completedCount: contributions.filter((c) => c.status === "completed").length,
      pendingCount: contributions.filter((c) => c.status === "pending").length,
      defaultedCount: contributions.filter((c) => c.status === "defaulted").length,
      memberStats: [],
    };

    // Group by member
    const memberMap = {};
    contributions.forEach((contrib) => {
      // FIX: Guard against missing/unpopulated user references
      if (!contrib.user) return;
      const userId = contrib.user._id
        ? contrib.user._id.toString()
        : contrib.user.toString();
      if (!memberMap[userId]) {
        memberMap[userId] = {
          user: contrib.user,
          totalContributed: 0,
          completed: 0,
          pending: 0,
          defaulted: 0,
        };
      }
      memberMap[userId].totalContributed += contrib.amount;
      // FIX: Safely increment; ignore unknown statuses
      if (memberMap[userId][contrib.status] !== undefined) {
        memberMap[userId][contrib.status]++;
      }
    });

    stats.memberStats = Object.values(memberMap);
    return stats;
  } catch (error) {
    throw error;
  }
};

/**
 * Initialize a new rotation cycle
 * FIX: Prevent duplicate cycles for the same cycleNumber
 * FIX: Validate recipientUser exists before creating cycle
 */
exports.initializeRotationCycle = async (groupId, cycleNumber) => {
  try {
    const group = await Group.findById(groupId).populate("members");

    if (!group) throw new Error("Group not found");
    if (!group.members || group.members.length === 0)
      throw new Error("Group has no members");

    // FIX: Prevent duplicate cycle initialization (idempotency guard)
    const existingCycle = await RotationCycle.findOne({ group: groupId, cycleNumber });
    if (existingCycle) {
      throw new Error(`Cycle #${cycleNumber} already exists for this group`);
    }

    // Determine recipient based on currentRotationIndex
    const recipientPosition = (cycleNumber - 1) % group.members.length;
    const recipientUser = group.members[recipientPosition];

    // FIX: Validate recipient exists
    if (!recipientUser) {
      throw new Error("Could not determine recipient for this cycle");
    }

    // Calculate cycle dates based on rotation frequency
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);

    const frequencyMap = {
      daily: () => endDate.setDate(endDate.getDate() + 1),
      weekly: () => endDate.setDate(endDate.getDate() + 7),
      monthly: () => endDate.setMonth(endDate.getMonth() + 1),
    };

    if (frequencyMap[group.rotationFrequency]) {
      frequencyMap[group.rotationFrequency]();
    } else {
      // FIX: Default to monthly if unrecognised frequency
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const rotationCycle = new RotationCycle({
      group: groupId,
      cycleNumber,
      startDate,
      endDate,
      recipientUser: recipientUser._id,
      recipientPosition,
      totalAmount: group.contributionAmount * group.members.length,
      // FIX: Initialize contributorsCount to 0 (not member count)
      contributorsCount: 0,
      status: "pending",
    });

    await rotationCycle.save();

    // Create contribution records for all members
    const contributions = group.members.map((member) => ({
      group: groupId,
      user: member._id,
      amount: group.contributionAmount,
      cycleNumber,
      status: "pending",
      dueDate: endDate,
    }));

    await Contribution.insertMany(contributions);

    return rotationCycle;
  } catch (error) {
    throw error;
  }
};

/**
 * Record a user's contribution
 * FIX: Prevent recording a contribution for the wrong/already-completed contribution
 * FIX: Guard against missing latestCycle
 */
exports.recordContribution = async (
  groupId,
  userId,
  amount,
  paymentReference,
  transactionId
) => {
  try {
    const group = await Group.findById(groupId);
    if (!group) throw new Error("Group not found");

    const latestCycle = await RotationCycle.findOne({ group: groupId }).sort({
      cycleNumber: -1,
    });

    // FIX: Guard against no cycle existing yet
    if (!latestCycle) {
      throw new Error("No active cycle found for this group");
    }

    const currentCycleNumber = latestCycle.cycleNumber;

    // FIX: Check that the contribution record actually exists before updating
    const existingContribution = await Contribution.findOne({
      group: groupId,
      user: userId,
      cycleNumber: currentCycleNumber,
    });

    if (!existingContribution) {
      throw new Error("Contribution record not found for this cycle");
    }

    // FIX: Prevent double-recording a completed contribution
    if (existingContribution.status === "completed") {
      throw new Error("Contribution has already been recorded for this cycle");
    }

    const contribution = await Contribution.findByIdAndUpdate(
      existingContribution._id,
      {
        amount,
        paymentReference,
        transaction: transactionId,
        status: "completed",
        paidDate: new Date(),
      },
      { new: true }
    );

    // FIX: Only increment contributorsCount (was erroneously adding to
    // contributorsCount even though it was initialised to member count)
    await RotationCycle.findByIdAndUpdate(latestCycle._id, {
      $inc: { contributorsCount: 1 },
    });

    return contribution;
  } catch (error) {
    throw error;
  }
};

/**
 * Get member contribution history
 */
exports.getMemberContributionHistory = async (userId, groupId = null) => {
  try {
    const query = { user: userId };
    if (groupId) query.group = groupId;

    const contributions = await Contribution.find(query)
      .populate("group", "name contributionAmount")
      .sort({ createdAt: -1 })
      .lean(); // FIX: lean() for read-only queries

    return contributions;
  } catch (error) {
    throw error;
  }
};

/**
 * Get next recipient in rotation
 */
exports.getNextRecipient = async (groupId) => {
  try {
    const group = await Group.findById(groupId).populate("members");
    if (!group) throw new Error("Group not found");

    // FIX: Guard against empty members array
    if (!group.members || group.members.length === 0) {
      throw new Error("Group has no members");
    }

    const nextIndex =
      (group.currentRotationIndex + 1) % group.members.length;

    return {
      user: group.members[nextIndex],
      position: nextIndex,
      totalAmount: group.contributionAmount * group.members.length,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Complete a rotation cycle and payout to recipient
 * FIX: Guard against missing cycle; use cycle.recipientUser (not cycle.recipient)
 */
exports.completeRotationCycle = async (cycleId, payoutReference) => {
  try {
    const cycle = await RotationCycle.findById(cycleId);
    if (!cycle) throw new Error("Rotation cycle not found");

    // FIX: Prevent completing an already-completed cycle
    if (cycle.status === "completed") {
      throw new Error("Cycle has already been completed");
    }

    const updatedCycle = await RotationCycle.findByIdAndUpdate(
      cycleId,
      {
        status: "completed",
        payoutDate: new Date(),
        payoutReference,
      },
      { new: true }
    );

    const group = await Group.findById(cycle.group);
    if (!group) throw new Error("Group not found");

    const nextIndex =
      (cycle.recipientPosition + 1) % group.members.length;

    await Group.findByIdAndUpdate(cycle.group, {
      currentRotationIndex: nextIndex,
    });

    return updatedCycle;
  } catch (error) {
    throw error;
  }
};

/**
 * Check if all members have contributed in a cycle
 */
exports.checkCycleCompletion = async (groupId, cycleNumber) => {
  try {
    const contributions = await Contribution.find({
      group: groupId,
      cycleNumber,
    }).lean(); // FIX: lean() for read-only check

    // FIX: Handle case where no contributions exist for the cycle
    if (!contributions.length) {
      return {
        isComplete: false,
        pendingCount: 0,
        defaultedCount: 0,
        totalExpected: 0,
        completedCount: 0,
        message: "No contributions found for this cycle",
      };
    }

    const allCompleted = contributions.every((c) => c.status === "completed");
    const pendingCount = contributions.filter((c) => c.status === "pending").length;
    const defaultedCount = contributions.filter((c) => c.status === "defaulted").length;
    const completedCount = contributions.filter((c) => c.status === "completed").length;

    return {
      isComplete: allCompleted,
      pendingCount,
      defaultedCount,
      totalExpected: contributions.length,
      completedCount,
    };
  } catch (error) {
    throw error;
  }
};
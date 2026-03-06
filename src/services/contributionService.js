const Contribution = require("../modules/contributions/contributionModel");
const RotationCycle = require("../modules/contributions/rotationCycleModel");
const Group = require("../modules/groups/groupModel");

/**
 * Get contribution statistics for a group
 */
exports.getGroupContributionStats = async (groupId, cycleNumber = null) => {
  try {
    const query = { group: groupId };
    if (cycleNumber) {
      query.cycleNumber = cycleNumber;
    }

    const contributions = await Contribution.find(query)
      .populate('user', 'firstName lastName email');

    const stats = {
      totalContributions: contributions.reduce((sum, c) => sum + c.amount, 0),
      completedCount: contributions.filter(c => c.status === 'completed').length,
      pendingCount: contributions.filter(c => c.status === 'pending').length,
      defaultedCount: contributions.filter(c => c.status === 'defaulted').length,
      memberStats: []
    };

    // Group by member
    const memberMap = {};
    contributions.forEach(contrib => {
      const userId = contrib.user._id.toString();
      if (!memberMap[userId]) {
        memberMap[userId] = {
          user: contrib.user,
          totalContributed: 0,
          completed: 0,
          pending: 0,
          defaulted: 0
        };
      }
      memberMap[userId].totalContributed += contrib.amount;
      memberMap[userId][contrib.status]++;
    });

    stats.memberStats = Object.values(memberMap);
    return stats;
  } catch (error) {
    throw error;
  }
};

/**
 * Initialize a new rotation cycle
 */
exports.initializeRotationCycle = async (groupId, cycleNumber) => {
  try {
    const group = await Group.findById(groupId).populate('members');

    if (!group || group.members.length === 0) {
      throw new Error("Group not found or has no members");
    }

    // Get recipient based on currentRotationIndex
    const recipientPosition = (cycleNumber - 1) % group.members.length;
    const recipientUser = group.members[recipientPosition];

    // Calculate cycle dates based on rotation frequency
    const now = new Date();
    let startDate = new Date(now);
    let endDate = new Date(now);

    if (group.rotationFrequency === "daily") {
      endDate.setDate(endDate.getDate() + 1);
    } else if (group.rotationFrequency === "weekly") {
      endDate.setDate(endDate.getDate() + 7);
    } else if (group.rotationFrequency === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Create rotation cycle
    const rotationCycle = new RotationCycle({
      group: groupId,
      cycleNumber,
      startDate,
      endDate,
      recipientUser: recipientUser._id,
      recipientPosition,
      totalAmount: group.contributionAmount * group.members.length,
      contributorsCount: group.members.length,
      status: "pending"
    });

    await rotationCycle.save();

    // Create contribution records for all members
    const contributions = group.members.map(member => ({
      group: groupId,
      user: member._id,
      amount: group.contributionAmount,
      cycleNumber,
      status: "pending",
      dueDate: endDate
    }));

    await Contribution.insertMany(contributions);

    return rotationCycle;
  } catch (error) {
    throw error;
  }
};

/**
 * Record a user's contribution
 */
exports.recordContribution = async (groupId, userId, amount, paymentReference, transactionId) => {
  try {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Get current cycle number
    const latestCycle = await RotationCycle.findOne({ group: groupId })
      .sort({ cycleNumber: -1 });

    const currentCycleNumber = latestCycle ? latestCycle.cycleNumber : 1;

    // Find or create contribution record
    const contribution = await Contribution.findOneAndUpdate(
      { group: groupId, user: userId, cycleNumber: currentCycleNumber },
      {
        amount,
        paymentReference,
        transaction: transactionId,
        status: "completed",
        paidDate: new Date()
      },
      { new: true }
    );

    if (!contribution) {
      throw new Error("Contribution record not found for this cycle");
    }

    // Update rotation cycle contributors count
    await RotationCycle.findByIdAndUpdate(latestCycle._id, {
      $inc: { contributorsCount: 1 }
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
    if (groupId) {
      query.group = groupId;
    }

    const contributions = await Contribution.find(query)
      .populate('group', 'name contributionAmount')
      .sort({ createdAt: -1 });

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
    const group = await Group.findById(groupId).populate('members');
    if (!group) {
      throw new Error("Group not found");
    }

    const nextIndex = (group.currentRotationIndex + 1) % group.members.length;
    return {
      user: group.members[nextIndex],
      position: nextIndex,
      totalAmount: group.contributionAmount * group.members.length
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Complete a rotation cycle and payout to recipient
 */
exports.completeRotationCycle = async (cycleId, payoutReference) => {
  try {
    const cycle = await RotationCycle.findByIdAndUpdate(
      cycleId,
      {
        status: "completed",
        payoutDate: new Date(),
        payoutReference
      },
      { new: true }
    );

    // Update group rotation index
    const group = await Group.findById(cycle.group);
    const nextIndex = (cycle.recipientPosition + 1) % group.members.length;

    await Group.findByIdAndUpdate(cycle.group, {
      currentRotationIndex: nextIndex
    });

    return cycle;
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
      cycleNumber
    });

    const allCompleted = contributions.every(c => c.status === 'completed');
    const pendingCount = contributions.filter(c => c.status === 'pending').length;
    const defaultedCount = contributions.filter(c => c.status === 'defaulted').length;

    return {
      isComplete: allCompleted,
      pendingCount,
      defaultedCount,
      totalExpected: contributions.length,
      completedCount: contributions.filter(c => c.status === 'completed').length
    };
  } catch (error) {
    throw error;
  }
};

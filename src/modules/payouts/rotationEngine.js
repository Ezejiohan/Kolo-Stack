const cron = require("node-cron");
const mongoose = require("mongoose");

const Group = require("../groups/groupModel");
const Wallet = require("../wallet/walletModel");
const Transaction = require("../transactions/transactionModel");

cron.schedule("0 0 * * *", async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("Running payout engine...");

    const groups = await Group.find({ isActive: true }).session(session);

    for (const group of groups) {
      if (!group.members.length) continue;

      const totalPool =
        group.contributionAmount * group.members.length;

      const receiver =
        group.members[group.currentRotationIndex];

      let wallet =
        await Wallet.findOne({ user: receiver }).session(session);

      if (!wallet) {
        wallet = await Wallet.create(
          [{ user: receiver, balance: 0 }],
          { session }
        );
        wallet = wallet[0];
      }

      wallet.balance += totalPool;
      await wallet.save({ session });

      await Transaction.create(
        [{
          user: receiver,
          type: "payout",
          amount: totalPool,
          group: group._id,
          status: "completed"
        }],
        { session }
      );

      group.currentRotationIndex =
        (group.currentRotationIndex + 1) %
        group.members.length;

      await group.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    console.log("Payout completed successfully");

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Payout Engine Error:", error);
  }
});

const User = require("../../modules/users/userModel");
const Group = require("../../modules/groups/groupModel");
const Transaction = require("../../modules/transactions/transactionModel");
const KYC = require("../../modules/kyc/kycModel");

exports.getPlatformStats = async (req, res) => {
  const users = await User.countDocuments();
  const groups = await Group.countDocuments();
  const transactions = await Transaction.countDocuments();
  const pendingKYC = await KYC.countDocuments({ status: "pending" });

  res.json({ users, groups, transactions, pendingKYC });
};

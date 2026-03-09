const User = require("../../modules/users/userModel");
const Group = require("../../modules/groups/groupModel");
const Transaction = require("../../modules/transactions/transactionModel");
const KYC = require("../../modules/kycModel");

exports.getPlatformStats = async (req, res) => {
  const users = await User.countDocuments();
  const groups = await Group.countDocuments();
  const transactions = await Transaction.countDocuments();
  const pendingKYC = await KYC.countDocuments({ status: "pending" });

  res.json({ users, groups, transactions, pendingKYC });
};

exports.makeUserAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.role = "admin";
    await user.save();

    res.json({
      success: true,
      message: "User role updated to admin",
      data: {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

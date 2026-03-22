const User = require("../../modules/users/userModel");
const Group = require("../../modules/groups/groupModel");
const Transaction = require("../../modules/transactions/transactionModel");
const KYC = require("../../modules/kycModel");

/**
 * Get platform-wide statistics
 */
exports.getPlatformStats = async (req, res) => {
  try {
    // FIX: Wrapped in try/catch (was missing)
    const [users, groups, transactions, pendingKYC] = await Promise.all([
      User.countDocuments(),
      Group.countDocuments(),
      Transaction.countDocuments(),
      KYC.countDocuments({ status: "pending" }),
    ]);
    res.json({ users, groups, transactions, pendingKYC });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Promote a user to admin
 * FIX: Route was missing `authorize("admin")` middleware — any authenticated
 *      user could promote themselves or others to admin.
 *      The fix is applied in adminRoute.js (adding authorize("admin")),
 *      but we also add a self-guard here as defence-in-depth.
 */
exports.makeUserAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    // FIX: Defence-in-depth — only admins may call this endpoint
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: admin role required",
      });
    }

    // FIX: Prevent self-demotion/re-promotion edge case (harmless but noisy)
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
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
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
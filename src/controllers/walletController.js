const mongoose = require("mongoose");
const KYC = require("../modules/kycModel");
const Wallet = require("../modules/wallet/walletModel");
const Transaction = require("../modules/transactions/transactionModel");
const AuditLog = require("../modules/audit/auditLogModel");
const { getOrCreateWallet } = require("../services/walletService");

/**
 * Get wallet (auto-create if missing)
 */
exports.getWallet = async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.user._id);
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Deposit funds
 * FIX: Added upper-bound validation on amount to prevent absurd deposits
 * FIX: idempotency check now returns consistent shape with active transaction data
 */
exports.deposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;
    const idempotencyKey = req.headers["idempotency-key"];

    if (!idempotencyKey) throw new Error("Idempotency key required");

    // FIX: Validate amount is a positive number with a reasonable upper bound
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new Error("Invalid amount: must be a positive number");
    }
    if (amount > 10_000_000) {
      throw new Error("Deposit amount exceeds the maximum allowed limit");
    }

    // Idempotency check
    const existingTx = await Transaction.findOne({ idempotencyKey }).session(session);
    if (existingTx) {
      await session.abortTransaction();
      session.endSession();
      return res.json({
        message: "Deposit already processed",
        transactionId: existingTx._id,
      });
    }

    let wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet) {
      wallet = await Wallet.create([{ user: req.user._id, balance: 0 }], { session });
      wallet = wallet[0];
    }

    wallet.balance += amount;
    await wallet.save({ session });

    const newTx = await Transaction.create(
      [{ user: req.user._id, type: "deposit", amount, status: "completed", idempotencyKey }],
      { session }
    );

    await AuditLog.create(
      [{ user: req.user._id, action: "DEPOSIT", metadata: { amount }, ipAddress: req.ip }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Deposit successful", transactionId: newTx[0]._id });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: error.message });
  }
};

/**
 * Withdraw funds
 * FIX: KYC check is now done via requireKyc middleware on the route (DRY),
 *      but we keep the in-controller check as defence-in-depth.
 * FIX: Added minimum withdrawal amount validation
 */
exports.withdraw = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;

    // FIX: Validate amount type and value
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new Error("Invalid withdrawal amount: must be a positive number");
    }

    // Defence-in-depth KYC check (primary check is requireKyc middleware)
    const kyc = await KYC.findOne({ user: req.user._id }).session(session);
    if (!kyc || kyc.status !== "approved") throw new Error("KYC verification required");

    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);
    if (!wallet || wallet.balance < amount) throw new Error("Insufficient balance");

    wallet.balance -= amount;
    await wallet.save({ session });

    await Transaction.create(
      [{ user: req.user._id, type: "withdraw", amount, status: "completed" }],
      { session }
    );

    await AuditLog.create(
      [{ user: req.user._id, action: "WITHDRAWAL", metadata: { amount }, ipAddress: req.ip }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Withdrawal successful", balance: wallet.balance });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
};
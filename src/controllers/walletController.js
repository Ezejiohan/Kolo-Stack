const mongoose = require("mongoose");
const KYC = require("../modules/kyc/kycModel");
const Wallet = require("../modules/wallet/walletModel");
const Transaction = require("../modules/transactions/transactionModel");
const AuditLog = require("../modules/audit/auditLogModel");

// Create wallet automatically if not exists
const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) wallet = await Wallet.create({ user: userId });
  return wallet;
};

// Deposit
exports.deposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;
    const idempotencyKey = req.headers["idempotency-key"];

    if (!idempotencyKey)
      throw new Error("Idempotency key required");

    if (!amount || amount <= 0)
      throw new Error("Invalid amount");

    // Check if transaction already exists
    const existingTx = await Transaction.findOne({
      idempotencyKey
    }).session(session);

    if (existingTx) {
      await session.abortTransaction();
      session.endSession();

      return res.json({
        message: "Deposit already processed",
        transactionId: existingTx._id
      });
    }

    // 🔥 2️⃣ Continue normally
    let wallet = await Wallet.findOne({ user: req.user._id }).session(session);

    if (!wallet) {
      wallet = await Wallet.create(
        [{ user: req.user._id, balance: 0 }],
        { session }
      );
      wallet = wallet[0];
    }

    wallet.balance += amount;
    await wallet.save({ session });

    const newTx = await Transaction.create(
      [{
        user: req.user._id,
        type: "deposit",
        amount,
        status: "completed",
        idempotencyKey
      }],
      { session }
    );

    await AuditLog.create(
      [{
        user: req.user._id,
        action: "DEPOSIT",
        metadata: { amount },
        ipAddress: req.ip
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: "Deposit successful",
      transactionId: newTx[0]._id
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: error.message });
  }
};

// Withdraw
exports.withdraw = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;

    if (!amount || amount <= 0)
      throw new Error("Invalid withdrawal amount");

    /* =========================
       KYC CHECK
    ========================= */
    const kyc = await KYC.findOne({ user: req.user._id }).session(session);

    if (!kyc || kyc.status !== "approved")
      throw new Error("KYC verification required");

    /* =========================
       GET WALLET
    ========================= */
    const wallet = await Wallet.findOne({ user: req.user._id }).session(session);

    if (!wallet || wallet.balance < amount)
      throw new Error("Insufficient balance");

    /* =========================
       DEDUCT BALANCE
    ========================= */
    wallet.balance -= amount;
    await wallet.save({ session });

    /* =========================
       CREATE TRANSACTION RECORD
    ========================= */
    await Transaction.create(
      [{
        user: req.user._id,
        type: "withdraw",
        amount,
        status: "completed"
      }],
      { session }
    );

    /* =========================
       ✅ AUDIT LOG (INSIDE SAME TRANSACTION)
    ========================= */
    await AuditLog.create(
      [{
        user: req.user._id,
        action: "WITHDRAWAL",
        metadata: { amount },
        ipAddress: req.ip
      }],
      { session }
    );

    /* =========================
       COMMIT
    ========================= */
    await session.commitTransaction();
    session.endSession();

    res.json({
      message: "Withdrawal successful",
      balance: wallet.balance
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

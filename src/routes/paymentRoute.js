const express = require("express");
const paymentRouter = express.Router();

const { protect } = require("../middlewares/userMiddleware");
const { userLimiter } = require("../middlewares/userRateLimiter");

const {
  initializePayment,
  verifyPayment,
  handleWebhook,
  getPaymentHistory
} = require("../controllers/payments/paymentController");

// Initialize payment
paymentRouter.post("/initialize", protect, userLimiter, initializePayment);

// Verify payment
paymentRouter.get("/verify/:reference", protect, verifyPayment);

// Get payment history
paymentRouter.get("/history", protect, getPaymentHistory);

// Webhook endpoint (no auth needed for webhooks)
paymentRouter.post("/webhook", handleWebhook);

module.exports = paymentRouter;

const express = require("express");
const walletRouter = express.Router();

const { protect } = require("../middlewares/userMiddleware");
const { userLimiter } = require("../middlewares/userRateLimiter");
const { deposit, withdraw } = require("../controllers/walletController");

walletRouter.post("/deposit", protect, userLimiter, deposit);
walletRouter.post("/withdraw", protect, userLimiter, withdraw);

module.exports = walletRouter;
